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

let cachedToken: string | null = null;
let tokenExpireAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpireAt - 60000) {
    return cachedToken;
  }

  const corpId = process.env.WEWORK_CORP_ID;
  const corpSecret = process.env.WEWORK_CORP_SECRET;

  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`
  );
  const data: WeWorkToken = await res.json();

  if (data.errcode !== 0) {
    throw new Error(`获取企微 access_token 失败: ${data.errmsg}`);
  }

  cachedToken = data.access_token;
  tokenExpireAt = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

async function fetchDepartments(token: string, parentId = 0): Promise<WeWorkDepartment[]> {
  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=${token}&id=${parentId}`
  );
  const data = await res.json();
  if (data.errcode !== 0) return [];
  return data.department;
}

async function fetchDepartmentMembers(token: string, deptId: number): Promise<WeWorkMember[]> {
  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/user/simplelist?access_token=${token}&department_id=${deptId}&fetch_child=0`
  );
  const data = await res.json();
  if (data.errcode !== 0) return [];
  return data.userlist;
}

// 全量同步通讯录
export async function syncContacts(): Promise<{ deptCount: number; empCount: number }> {
  const token = await getAccessToken();

  // 1. 同步部门
  const allDepts = await fetchDepartments(token);

  for (const dept of allDepts) {
    await prisma.department.upsert({
      where: { weworkDeptId: BigInt(dept.id) },
      update: { name: dept.name, parentId: dept.parentid || null, syncTime: new Date() },
      create: {
        weworkDeptId: BigInt(dept.id),
        name: dept.name,
        parentId: dept.parentid || null,
      },
    });
  }

  // parent_id 指向自增主键，修复外键映射
  const dbDepts = await prisma.department.findMany();
  const deptMap = new Map(dbDepts.map((d) => [Number(d.weworkDeptId), d.id]));

  for (const dept of allDepts) {
    if (dept.parentid) {
      const dbParentId = deptMap.get(dept.parentid) ?? null;
      await prisma.department.updateMany({
        where: { weworkDeptId: BigInt(dept.id) },
        data: { parentId: dbParentId },
      });
    }
  }

  // 2. 同步成员
  let empCount = 0;
  for (const dept of allDepts) {
    const members = await fetchDepartmentMembers(token, dept.id);
    for (const member of members) {
      const dbDeptId = deptMap.get(dept.id) ?? null;
      await prisma.employee.upsert({
        where: { weworkUserid: member.userid },
        update: {
          name: member.name,
          departmentId: dbDeptId,
          mobile: member.mobile,
          avatar: member.avatar,
          syncTime: new Date(),
        },
        create: {
          weworkUserid: member.userid,
          name: member.name,
          departmentId: dbDeptId,
          mobile: member.mobile,
          avatar: member.avatar,
        },
      });
      empCount++;
    }
  }

  return { deptCount: allDepts.length, empCount };
}
