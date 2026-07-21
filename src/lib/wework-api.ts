import { prisma } from '@/lib/db';

interface WeWorkToken {
  access_token: string;
  expires_in: number;
  errcode: number;
  errmsg: string;
}

interface WeWorkDepartment {
  id: number;
  name: string;
  parentid: number;
}

interface WeWorkMember {
  userid: string;
  name: string;
  department: number[];
  mobile: string;
  avatar: string;
}

// Token 缓存与并发控制
let cachedToken: string | null = null;
let tokenExpireAt: number = 0;
let tokenPromise: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpireAt - 60000) {
    return cachedToken;
  }

  // 防止并发请求同时刷新 token
  if (!tokenPromise) {
    tokenPromise = refreshAccessToken().finally(() => {
      tokenPromise = null;
    });
  }

  return tokenPromise;
}

/** 带超时和重试的 token 刷新，失败时不影响已缓存的旧 token */
async function refreshAccessToken(): Promise<string> {
  const corpId = process.env.WEWORK_CORP_ID;
  const corpSecret = process.env.WEWORK_CORP_SECRET;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000); // 10 秒超时

      const res = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      const data: WeWorkToken = await res.json();

      if (data.errcode !== 0) {
        throw new Error(`获取企微 access_token 失败: ${data.errmsg} (errcode=${data.errcode})`);
      }

      cachedToken = data.access_token;
      tokenExpireAt = Date.now() + data.expires_in * 1000;

      return cachedToken;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 3) {
        // 指数退避：1s → 2s，避免雪崩
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error('获取企微 access_token 失败');
}

/**
 * 获取全部部门（含嵌套子部门）。
 * 企微 API: department/list?id=0 从根开始递归返回所有部门。
 */
async function fetchDepartments(token: string): Promise<WeWorkDepartment[]> {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=${token}&id=0`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode !== 0) {
    throw new Error(`获取部门列表失败: ${data.errmsg} (errcode=${data.errcode})`);
  }
  return data.department ?? [];
}

async function fetchDepartmentMembers(token: string, deptId: number): Promise<WeWorkMember[]> {
  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/user/simplelist?access_token=${token}&department_id=${deptId}&fetch_child=0`
  );
  const data = await res.json();
  if (data.errcode !== 0) {
    throw new Error(`获取部门成员失败 (dept=${deptId}): ${data.errmsg} (errcode=${data.errcode})`);
  }
  return data.userlist ?? [];
}

// 全量同步通讯录
export async function syncContacts(): Promise<{ deptCount: number; empCount: number }> {
  const token = await getAccessToken();
  const syncStartTime = new Date();

  // 1. 同步部门 —— 一次调用获取全部部门（id=0 递归返回所有）
  const allDepts = await fetchDepartments(token);

  for (const dept of allDepts) {
    await prisma.department.upsert({
      where: { weworkDeptId: BigInt(dept.id) },
      // parentId 在第二遍中通过企微 ID → DB ID 映射修正
      update: { name: dept.name, syncTime: syncStartTime },
      create: {
        weworkDeptId: BigInt(dept.id),
        name: dept.name,
        syncTime: syncStartTime,
      },
    });
  }

  // parent_id 指向自增主键，修复外键映射
  const dbDepts = await prisma.department.findMany();
  const deptMap = new Map(dbDepts.map((d) => [Number(d.weworkDeptId), d.id]));

  for (const dept of allDepts) {
    // parentid=0 表示根部门 → parentId 设为 null；
    // 始终更新，确保部门移回根层级时旧 parentId 被清除
    const dbParentId = dept.parentid ? (deptMap.get(dept.parentid) ?? null) : null;
    await prisma.department.updateMany({
      where: { weworkDeptId: BigInt(dept.id) },
      data: { parentId: dbParentId },
    });
  }

  // 2. 同步成员 —— 逐个部门拉取成员，容错继续
  const seenEmployees = new Map<string, WeWorkMember>();
  let memberFetchErrors: string[] = [];

  for (const dept of allDepts) {
    try {
      const members = await fetchDepartmentMembers(token, dept.id);
      for (const member of members) {
        if (!seenEmployees.has(member.userid)) {
          seenEmployees.set(member.userid, member);
        }
      }
    } catch (error) {
      const msg = `[dept=${dept.id}] ${error instanceof Error ? error.message : error}`;
      console.warn('[syncContacts] 跳过部门成员:', msg);
      memberFetchErrors.push(msg);
    }
  }

  let empCount = 0;
  for (const [userid, member] of seenEmployees) {
    // 使用 member.department[0] 作为主部门，而非首次出现的部门
    const primaryWeWorkDeptId = member.department?.[0];
    const dbDeptId = primaryWeWorkDeptId ? (deptMap.get(primaryWeWorkDeptId) ?? null) : null;

    await prisma.employee.upsert({
      where: { weworkUserid: userid },
      update: {
        name: member.name,
        departmentId: dbDeptId,
        mobile: member.mobile,
        avatar: member.avatar,
        syncTime: syncStartTime,
      },
      create: {
        weworkUserid: member.userid,
        name: member.name,
        departmentId: dbDeptId,
        mobile: member.mobile,
        avatar: member.avatar,
        syncTime: syncStartTime,
      },
    });
    empCount++;
  }

  // 3. 清理在企微中已删除的数据（syncTime 未更新的即为残留）
  //    顺序很重要：先删成员再删部门，避免外键冲突
  const deletedEmps = await prisma.employee.deleteMany({
    where: {
      syncTime: { lt: syncStartTime },
      checkIns: { none: {} }, // 有签到记录的保留，不删
    },
  });
  const deletedDepts = await prisma.department.deleteMany({
    where: {
      syncTime: { lt: syncStartTime },
      employees: { none: {} },
      children: { none: {} },
    },
  });

  if (memberFetchErrors.length > 0) {
    console.warn(
      `[syncContacts] ${memberFetchErrors.length} 个部门的成员获取失败，已跳过:\n` +
      memberFetchErrors.map((e) => `  - ${e}`).join('\n')
    );
  }

  console.log(
    `[syncContacts] 部门: ${allDepts.length} 个 (清理 ${deletedDepts.count}), ` +
    `成员: ${empCount} 人 (清理 ${deletedEmps.count})`
  );

  return { deptCount: allDepts.length, empCount };
}
