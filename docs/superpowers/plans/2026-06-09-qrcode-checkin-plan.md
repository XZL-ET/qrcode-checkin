# 企业微信扫码签到系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建企业微信扫码签到系统 — 管理员创建会议生成二维码，员工企微扫码自动匹配身份一键签到。

**Architecture:** Next.js 全栈应用，同时承载管理端 SPA（Desktop）和员工端 H5（企微内嵌）。后端 API Routes 处理业务逻辑，Prisma ORM 对接 MySQL。企微 JSSDK 做 OAuth 身份识别。

**Tech Stack:** Next.js 14 (App Router)、TypeScript、Prisma ORM、MySQL、JWT (jose)、qrcode、bcryptjs

---

## 文件结构总览

```
QianDao/
├── prisma/
│   ├── schema.prisma              # 数据库模型定义
│   └── seed.ts                    # 初始化管理员账号
├── src/
│   ├── lib/
│   │   ├── db.ts                  # Prisma 客户端单例
│   │   ├── auth.ts                # JWT 签发/校验 + 企微 OAuth
│   │   ├── wework-api.ts          # 企微通讯录 API 封装
│   │   └── qrcode.ts             # 二维码生成
│   ├── types/
│   │   └── index.ts              # 共享类型定义
│   ├── middleware.ts              # UA 检测 + 企微环境路由
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── meetings/route.ts
│   │   │   │   ├── meetings/[id]/route.ts
│   │   │   │   ├── meetings/[id]/qrcode/route.ts
│   │   │   │   ├── meetings/[id]/checkins/route.ts
│   │   │   │   └── stats/route.ts
│   │   │   ├── checkin/
│   │   │   │   ├── preview/[meetingId]/route.ts
│   │   │   │   ├── confirm/[meetingId]/route.ts
│   │   │   │   └── my-records/route.ts
│   │   │   └── internal/
│   │   │       └── sync-contacts/route.ts
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── meetings/
│   │   │   │   ├── page.tsx         # 会议列表
│   │   │   │   ├── new/page.tsx     # 创建会议
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx     # 编辑会议
│   │   │   │       └── checkins/page.tsx  # 签到明细
│   │   │   └── layout.tsx           # 管理端布局（侧边栏+顶栏）
│   │   ├── checkin/
│   │   │   └── [meetingId]/page.tsx # 员工签到/下载引导
│   │   ├── layout.tsx               # 根布局
│   │   └── page.tsx                 # 首页（空或跳转）
│   └── __tests__/
│       ├── auth.test.ts
│       ├── checkin.test.ts
│       └── api/
│           ├── admin-login.test.ts
│           ├── admin-meetings.test.ts
│           └── checkin-confirm.test.ts
├── .env.example
├── next.config.js
├── package.json
├── tsconfig.json
└── jest.config.ts
```

---

## Phase 1: 项目初始化

### Task 1: 脚手架搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.env.example`

- [ ] **Step 1: 初始化 Next.js 项目**

```bash
cd D:/ClaudeCode/QianDao
npx create-next-app@latest . --typescript --eslint --tailwind --src-dir --app --no-import-alias --use-npm
```

Expected: Next.js 项目文件生成，`npm run dev` 可启动。

- [ ] **Step 2: 安装额外依赖**

```bash
npm install prisma @prisma/client jose qrcode bcryptjs
npm install -D @types/qrcode @types/bcryptjs jest @jest/globals ts-jest @types/jest
```

Expected: 依赖安装成功。

- [ ] **Step 3: 创建 `.env.example`**

```
# 数据库
DATABASE_URL="mysql://root:password@localhost:3306/qiandao"

# JWT
JWT_SECRET="change-me-to-a-random-string"

# 企业微信
WEWORK_CORP_ID="your-corp-id"
WEWORK_CORP_SECRET="your-corp-secret"
WEWORK_AGENT_ID="your-agent-id"

# 应用
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

- [ ] **Step 4: 创建 `jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
```

- [ ] **Step 5: 在 `package.json` 添加 test 脚本**

将 `"scripts"` 中的 `"test"` 修改为：

```json
"test": "jest --runInBand"
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with dependencies"
```

---

### Task 2: Prisma 数据库 Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

- [ ] **Step 1: 配置 `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Admin {
  id           Int       @id @default(autoincrement())
  username     String    @unique @db.VarChar(50)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  createdAt    DateTime  @default(now()) @map("created_at")
  meetings     Meeting[]

  @@map("admins")
}

model Department {
  id           Int        @id @default(autoincrement())
  weworkDeptId BigInt     @unique @map("wework_dept_id")
  name         String     @db.VarChar(100)
  parentId     Int?       @map("parent_id")
  syncTime     DateTime   @default(now()) @map("sync_time")
  parent       Department? @relation("DepartmentTree", fields: [parentId], references: [id])
  children     Department[] @relation("DepartmentTree")
  employees    Employee[]

  @@map("departments")
}

model Employee {
  id           Int        @id @default(autoincrement())
  departmentId Int?       @map("department_id")
  weworkUserid String     @unique @map("wework_userid") @db.VarChar(64)
  name         String     @db.VarChar(50)
  avatar       String?    @db.VarChar(255)
  mobile       String?    @db.VarChar(20)
  syncTime     DateTime   @default(now()) @map("sync_time")
  department   Department? @relation(fields: [departmentId], references: [id])
  checkIns     CheckIn[]

  @@map("employees")
}

model Meeting {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(200)
  location  String?   @db.VarChar(200)
  startTime DateTime  @map("start_time")
  endTime   DateTime? @map("end_time")
  qrCodeUrl String?   @map("qr_code_url") @db.VarChar(500)
  status    MeetingStatus @default(pending)
  createdBy Int       @map("created_by")
  createdAt DateTime  @default(now()) @map("created_at")
  admin     Admin     @relation(fields: [createdBy], references: [id])
  checkIns  CheckIn[]

  @@map("meetings")
}

enum MeetingStatus {
  pending
  active
  ended
}

model CheckIn {
  id          Int      @id @default(autoincrement())
  meetingId   Int      @map("meeting_id")
  employeeId  Int      @map("employee_id")
  checkInTime DateTime @default(now()) @map("check_in_time")
  meeting     Meeting  @relation(fields: [meetingId], references: [id])
  employee    Employee @relation(fields: [employeeId], references: [id])

  @@unique([meetingId, employeeId])
  @@map("check_ins")
}
```

- [ ] **Step 2: 创建 `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hash,
    },
  });
  console.log('Seed: admin user created (admin / admin123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: 添加 seed 脚本到 `package.json`**

在 `package.json` 中添加：

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

安装 tsx：

```bash
npm install -D tsx
```

- [ ] **Step 4: 运行 Prisma 迁移 + 种子**

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: 数据库表创建成功，管理员账号写入。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add Prisma schema and seed"
```

---

## Phase 2: 核心工具库

### Task 3: 数据库客户端

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: 实现 Prisma 单例**

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/db.ts
git commit -m "feat: add Prisma client singleton"
```

---

### Task 4: 共享类型定义

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 定义类型**

```typescript
// src/types/index.ts

// API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 管理员 JWT payload
export interface AdminPayload {
  adminId: number;
  username: string;
}

// 企微 OAuth 结果
export interface WeWorkOAuthResult {
  userid: string;
  errcode: number;
  errmsg: string;
}

// 企微成员信息
export interface WeWorkMember {
  userid: string;
  name: string;
  department: number[];
  mobile: string;
  avatar: string;
}

// 签到预览数据
export interface CheckInPreview {
  meeting: {
    id: number;
    title: string;
    location: string | null;
    startTime: string;
  };
  employee: {
    id: number;
    name: string;
    department: string | null;
    avatar: string | null;
  };
  alreadyCheckedIn: boolean;
  meetingStatus: string;
}

// 签到统计
export interface CheckInStats {
  totalMeetings: number;
  activeMeetings: number;
  totalCheckIns: number;
  avgRate: number;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 5: 认证工具

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/__tests__/auth.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/__tests__/auth.test.ts
import { signAdminToken, verifyAdminToken } from '@/lib/auth';

describe('auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('signs and verifies a valid admin token', async () => {
    const token = await signAdminToken({ adminId: 1, username: 'admin' });
    expect(typeof token).toBe('string');

    const payload = await verifyAdminToken(token);
    expect(payload).toMatchObject({ adminId: 1, username: 'admin' });
  });

  it('rejects an invalid token', async () => {
    await expect(verifyAdminToken('bad-token')).rejects.toThrow();
  });

  it('rejects token with wrong secret', async () => {
    const token = await signAdminToken({ adminId: 1, username: 'admin' });
    process.env.JWT_SECRET = 'wrong-secret';
    await expect(verifyAdminToken(token)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest src/__tests__/auth.test.ts
```

Expected: FAIL — 模块未实现。

- [ ] **Step 3: 实现 `src/lib/auth.ts`**

```typescript
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import type { AdminPayload } from '@/types';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(secret);
};

export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as AdminPayload;
}

// 企微 OAuth: code 换取 userid
export async function getWeWorkUserId(
  code: string
): Promise<string> {
  const corpId = process.env.WEWORK_CORP_ID;
  const corpSecret = process.env.WEWORK_CORP_SECRET;

  if (!corpId || !corpSecret) {
    throw new Error('WeWork credentials not configured');
  }

  // 获取 access_token
  const tokenRes = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`
  );
  const tokenData = await tokenRes.json();

  if (tokenData.errcode !== 0) {
    throw new Error(`Failed to get access_token: ${tokenData.errmsg}`);
  }

  // code 换取 userid
  const userRes = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${tokenData.access_token}&code=${code}`
  );
  const userData = await userRes.json();

  if (userData.errcode !== 0) {
    throw new Error(`Failed to get userid: ${userData.errmsg}`);
  }

  return userData.userid;
}

// 生成企微 OAuth 授权 URL
export function getWeWorkOAuthUrl(redirectUri: string, state: string): string {
  const corpId = process.env.WEWORK_CORP_ID;
  const agentId = process.env.WEWORK_AGENT_ID;
  const encoded = encodeURIComponent(redirectUri);
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${encoded}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=${state}#wechat_redirect`;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx jest src/__tests__/auth.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add JWT auth and WeWork OAuth utilities"
```

---

### Task 6: 企业微信 API 封装

**Files:**
- Create: `src/lib/wework-api.ts`

- [ ] **Step 1: 实现企微通讯录 API 封装**

```typescript
// src/lib/wework-api.ts
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

  // 注意: parent_id 指向自增主键，这里先同步所有部门，再修复 parent_id 外键映射
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
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/wework-api.ts
git commit -m "feat: add WeWork contacts sync service"
```

---

### Task 7: 二维码生成

**Files:**
- Create: `src/lib/qrcode.ts`

- [ ] **Step 1: 实现二维码生成工具**

```typescript
// src/lib/qrcode.ts
import QRCode from 'qrcode';

export async function generateCheckInQRCode(
  meetingId: number
): Promise<{ qrCodeDataURL: string; checkInUrl: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const checkInUrl = `${baseUrl}/checkin/${meetingId}`;

  const dataURL = await QRCode.toDataURL(checkInUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return { qrCodeDataURL: dataURL, checkInUrl };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/qrcode.ts
git commit -m "feat: add QR code generation utility"
```

---

## Phase 3: API Routes — 管理员

### Task 8: 管理员登录 API

**Files:**
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/__tests__/api/admin-login.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/__tests__/api/admin-login.test.ts
import { POST } from '@/app/api/admin/login/route';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    admin: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

describe('POST /api/admin/login', () => {
  it('returns 400 when username or password missing', async () => {
    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 401 when admin not found', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'nobody', password: 'test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns token on successful login', async () => {
    const hash = await bcrypt.hash('password', 10);
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: hash,
    });
    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest src/__tests__/api/admin-login.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 实现 API Route**

```typescript
// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAdminToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const token = await signAdminToken({
      adminId: admin.id,
      username: admin.username,
    });

    return NextResponse.json({
      success: true,
      data: { token, username: admin.username },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 运行测试**

```bash
npx jest src/__tests__/api/admin-login.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add admin login API"
```

---

### Task 9: 管理员鉴权中间件

**Files:**
- Create: `src/lib/admin-guard.ts`

- [ ] **Step 1: 实现鉴权辅助函数**

```typescript
// src/lib/admin-guard.ts
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import type { AdminPayload } from '@/types';

// 从请求中解析 JWT 并返回 admin 信息，失败返回 401 响应
export async function authenticateAdmin(
  request: Request
): Promise<AdminPayload | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  try {
    return await verifyAdminToken(token);
  } catch {
    return NextResponse.json(
      { success: false, error: '登录已过期，请重新登录' },
      { status: 401 }
    );
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/admin-guard.ts
git commit -m "feat: add admin auth guard utility"
```

---

### Task 10: 会议 CRUD API

**Files:**
- Create: `src/app/api/admin/meetings/route.ts`
- Create: `src/app/api/admin/meetings/[id]/route.ts`
- Create: `src/__tests__/api/admin-meetings.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/__tests__/api/admin-meetings.test.ts

// 模拟 auth guard
const mockVerify = jest.fn();
jest.mock('@/lib/admin-guard', () => ({
  authenticateAdmin: (req: Request) => mockVerify(req),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    meeting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';
import { GET, POST } from '@/app/api/admin/meetings/route';
import { PUT, DELETE } from '@/app/api/admin/meetings/[id]/route';

describe('GET /api/admin/meetings', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerify.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401 })
    );
    const req = new Request('http://localhost/api/admin/meetings');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns meeting list for authenticated admin', async () => {
    mockVerify.mockResolvedValue({ adminId: 1, username: 'admin' });
    (prisma.meeting.findMany as jest.Mock).mockResolvedValue([
      { id: 1, title: 'Q2 Review', location: 'Room A', startTime: new Date(), status: 'pending', _count: { checkIns: 3 } },
    ]);
    (prisma.meeting.count as jest.Mock).mockResolvedValue(1);

    const req = new Request('http://localhost/api/admin/meetings');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.meetings).toHaveLength(1);
  });
});

describe('POST /api/admin/meetings', () => {
  it('creates a meeting and returns QR code', async () => {
    mockVerify.mockResolvedValue({ adminId: 1, username: 'admin' });
    (prisma.meeting.create as jest.Mock).mockResolvedValue({
      id: 1,
      title: 'New Meeting',
      location: 'Room B',
      startTime: new Date('2026-06-12T14:00:00'),
      status: 'pending',
    });

    const req = new Request('http://localhost/api/admin/meetings', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Meeting',
        location: 'Room B',
        startTime: '2026-06-12T14:00:00',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.qrCodeDataURL).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest src/__tests__/api/admin-meetings.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 实现 `src/app/api/admin/meetings/route.ts`**

```typescript
// src/app/api/admin/meetings/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { generateCheckInQRCode } from '@/lib/qrcode';

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const status = searchParams.get('status') || undefined;

  const where = status ? { status: status as 'pending' | 'active' | 'ended' } : {};

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { checkIns: true } } },
    }),
    prisma.meeting.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: { meetings, total, page, pageSize },
  });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { title, location, startTime, endTime } = await request.json();

  if (!title || !startTime) {
    return NextResponse.json(
      { success: false, error: '会议名称和开始时间不能为空' },
      { status: 400 }
    );
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      location: location || null,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      createdBy: auth.adminId,
    },
  });

  // 生成二维码
  const { qrCodeDataURL, checkInUrl } = await generateCheckInQRCode(meeting.id);

  // 更新二维码 URL
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { qrCodeUrl: checkInUrl },
  });

  return NextResponse.json(
    {
      success: true,
      data: { ...meeting, qrCodeDataURL, checkInUrl },
    },
    { status: 201 }
  );
}
```

- [ ] **Step 4: 实现 `src/app/api/admin/meetings/[id]/route.ts`**

```typescript
// src/app/api/admin/meetings/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  const { title, location, startTime, endTime, status } = await request.json();

  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(location !== undefined && { location }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(status && { status }),
    },
  });

  return NextResponse.json({ success: true, data: meeting });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  await prisma.meeting.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx jest src/__tests__/api/admin-meetings.test.ts
```

Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add meeting CRUD API"
```

---

### Task 11: 二维码 & 签到明细 & 统计 API

**Files:**
- Create: `src/app/api/admin/meetings/[id]/qrcode/route.ts`
- Create: `src/app/api/admin/meetings/[id]/checkins/route.ts`
- Create: `src/app/api/admin/stats/route.ts`

- [ ] **Step 1: 实现二维码接口**

```typescript
// src/app/api/admin/meetings/[id]/qrcode/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { generateCheckInQRCode } from '@/lib/qrcode';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  const meeting = await prisma.meeting.findUnique({ where: { id } });

  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  const { qrCodeDataURL, checkInUrl } = await generateCheckInQRCode(id);

  return NextResponse.json({
    success: true,
    data: { qrCodeDataURL, checkInUrl, meeting },
  });
}
```

- [ ] **Step 2: 实现签到明细接口**

```typescript
// src/app/api/admin/meetings/[id]/checkins/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  const records = await prisma.checkIn.findMany({
    where: { meetingId: id },
    include: {
      employee: {
        include: { department: true },
      },
    },
    orderBy: { checkInTime: 'asc' },
  });

  return NextResponse.json({
    success: true,
    data: {
      meeting,
      records: records.map((r) => ({
        id: r.id,
        employeeName: r.employee.name,
        departmentName: r.employee.department?.name || '-',
        avatar: r.employee.avatar,
        checkInTime: r.checkInTime,
      })),
      total: records.length,
    },
  });
}
```

- [ ] **Step 3: 实现统计接口**

```typescript
// src/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const [totalMeetings, activeMeetings, totalCheckIns, employeeCount] =
    await Promise.all([
      prisma.meeting.count(),
      prisma.meeting.count({ where: { status: 'active' } }),
      prisma.checkIn.count(),
      prisma.employee.count(),
    ]);

  const avgRate = totalMeetings > 0
    ? Math.round((totalCheckIns / (totalMeetings * Math.max(employeeCount, 1))) * 100)
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      totalMeetings,
      activeMeetings,
      totalCheckIns,
      employeeCount,
      avgRate,
    },
  });
}
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add QR code, checkin detail, and stats API"
```

---

## Phase 4: API Routes — 员工签到

### Task 12: 签到预览 & 确认 API

**Files:**
- Create: `src/app/api/checkin/preview/[meetingId]/route.ts`
- Create: `src/app/api/checkin/confirm/[meetingId]/route.ts`
- Create: `src/app/api/checkin/my-records/route.ts`
- Create: `src/__tests__/api/checkin-confirm.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/__tests__/api/checkin-confirm.test.ts

jest.mock('@/lib/db', () => ({
  prisma: {
    meeting: { findUnique: jest.fn() },
    employee: { findUnique: jest.fn() },
    checkIn: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

import { prisma } from '@/lib/db';
import { POST } from '@/app/api/checkin/confirm/[meetingId]/route';

describe('POST /api/checkin/confirm/:meetingId', () => {
  it('returns 400 when employeeId missing', async () => {
    const req = new Request('http://localhost/api/checkin/confirm/1', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: { meetingId: '1' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when meeting not found', async () => {
    (prisma.meeting.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new Request('http://localhost/api/checkin/confirm/999', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 1 }),
    });
    const res = await POST(req, { params: { meetingId: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 when meeting is ended', async () => {
    (prisma.meeting.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'ended',
    });
    const req = new Request('http://localhost/api/checkin/confirm/1', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 1 }),
    });
    const res = await POST(req, { params: { meetingId: '1' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('已结束');
  });

  it('returns 400 on duplicate check-in', async () => {
    (prisma.meeting.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
    });
    (prisma.checkIn.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    const req = new Request('http://localhost/api/checkin/confirm/1', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 1 }),
    });
    const res = await POST(req, { params: { meetingId: '1' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('已签到');
  });

  it('creates check-in successfully', async () => {
    (prisma.meeting.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
    });
    (prisma.checkIn.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.checkIn.create as jest.Mock).mockResolvedValue({
      id: 1,
      meetingId: 1,
      employeeId: 1,
      checkInTime: new Date(),
    });
    const req = new Request('http://localhost/api/checkin/confirm/1', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 1 }),
    });
    const res = await POST(req, { params: { meetingId: '1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest src/__tests__/api/checkin-confirm.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 实现签到预览接口**

```typescript
// src/app/api/checkin/preview/[meetingId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWeWorkUserId } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  const meetingId = parseInt(params.meetingId);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json(
      { success: false, error: '缺少 OAuth code' },
      { status: 400 }
    );
  }

  try {
    // 企微 OAuth: code → userid
    const userid = await getWeWorkUserId(code);

    // 查数据库匹配员工
    const employee = await prisma.employee.findUnique({
      where: { weworkUserid: userid },
      include: { department: true },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: '未找到你的信息，请联系管理员' },
        { status: 403 }
      );
    }

    // 查会议
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: '会议不存在' },
        { status: 404 }
      );
    }

    // 检查是否已签到
    const existing = await prisma.checkIn.findUnique({
      where: {
        meetingId_employeeId: { meetingId, employeeId: employee.id },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          location: meeting.location,
          startTime: meeting.startTime.toISOString(),
        },
        employee: {
          id: employee.id,
          name: employee.name,
          department: employee.department?.name || null,
          avatar: employee.avatar,
        },
        alreadyCheckedIn: !!existing,
        meetingStatus: meeting.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 实现签到确认接口**

```typescript
// src/app/api/checkin/confirm/[meetingId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  const meetingId = parseInt(params.meetingId);
  const { employeeId } = await request.json();

  if (!employeeId) {
    return NextResponse.json(
      { success: false, error: '缺少员工信息' },
      { status: 400 }
    );
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  if (meeting.status === 'ended') {
    return NextResponse.json(
      { success: false, error: '会议已结束，无法签到' },
      { status: 400 }
    );
  }

  // 防重复签到
  const existing = await prisma.checkIn.findUnique({
    where: { meetingId_employeeId: { meetingId, employeeId } },
  });

  if (existing) {
    return NextResponse.json(
      { success: false, error: '你已签到，无需重复签到' },
      { status: 400 }
    );
  }

  const checkIn = await prisma.checkIn.create({
    data: { meetingId, employeeId },
  });

  return NextResponse.json({
    success: true,
    data: { id: checkIn.id, checkInTime: checkIn.checkInTime },
  });
}
```

- [ ] **Step 5: 实现我的签到记录接口**

```typescript
// src/app/api/checkin/my-records/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWeWorkUserId } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json(
      { success: false, error: '缺少 OAuth code' },
      { status: 400 }
    );
  }

  try {
    const userid = await getWeWorkUserId(code);
    const employee = await prisma.employee.findUnique({
      where: { weworkUserid: userid },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: '未找到员工信息' },
        { status: 403 }
      );
    }

    const records = await prisma.checkIn.findMany({
      where: { employeeId: employee.id },
      include: { meeting: true },
      orderBy: { checkInTime: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: records.map((r) => ({
        id: r.id,
        meetingTitle: r.meeting.title,
        meetingLocation: r.meeting.location,
        checkInTime: r.checkInTime,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
npx jest src/__tests__/api/checkin-confirm.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add check-in preview, confirm and my-records API"
```

---

### Task 13: 通讯录同步内部接口

**Files:**
- Create: `src/app/api/internal/sync-contacts/route.ts`

- [ ] **Step 1: 实现同步接口**

```typescript
// src/app/api/internal/sync-contacts/route.ts
import { NextResponse } from 'next/server';
import { syncContacts } from '@/lib/wework-api';

export async function POST(request: Request) {
  // 内部接口，用简单 token 鉴权
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.INTERNAL_API_TOKEN || 'internal-secret';

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await syncContacts();
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add internal contacts sync API"
```

---

## Phase 5: 中间件 — UA 检测

### Task 14: UA 检测中间件

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 实现中间件**

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // 只处理签到页面
  if (!pathname.startsWith('/checkin/')) {
    return NextResponse.next();
  }

  const isWeWork = userAgent.toLowerCase().includes('wxwork');

  // 非企微环境 → 标记让前端展示下载引导
  if (!isWeWork) {
    const url = request.nextUrl.clone();
    url.searchParams.set('non_wxwork', '1');
    return NextResponse.rewrite(url);
  }

  // 企微环境 → 检查是否有 OAuth code，没有则跳转授权
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    const corpId = process.env.WEWORK_CORP_ID;
    const agentId = process.env.WEWORK_AGENT_ID;
    const redirectUri = encodeURIComponent(request.nextUrl.href);

    if (corpId && agentId) {
      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=checkin#wechat_redirect`;
      return NextResponse.redirect(authUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/checkin/:path*',
};
```

- [ ] **Step 2: 提交**

```bash
git add src/middleware.ts
git commit -m "feat: add UA detection and OAuth redirect middleware"
```

---

## Phase 6: 前端 — 管理端

### Task 15: 管理端布局 + 登录页

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: 实现管理端布局**

```tsx
// src/app/admin/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const stored = localStorage.getItem('admin_username');
    if (!token && pathname !== '/admin/login') {
      router.push('/admin/login');
    } else {
      setUsername(stored);
    }
  }, [pathname, router]);

  // 登录页不需要布局
  if (pathname === '/admin/login') return <>{children}</>;

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">📋 签到系统</span>
          <span className="text-gray-400 text-sm">管理后台</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/meetings" className="text-sm hover:text-green-400">会议管理</Link>
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">退出</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: 实现登录页**

```tsx
// src/app/admin/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      localStorage.setItem('admin_token', data.data.token);
      localStorage.setItem('admin_username', data.data.username);
      router.push('/admin/meetings');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">📋 签到管理后台</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add admin layout and login page"
```

---

### Task 16: 会议列表页

**Files:**
- Create: `src/app/admin/meetings/page.tsx`

- [ ] **Step 1: 实现会议列表页**

```tsx
// src/app/admin/meetings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Meeting {
  id: number;
  title: string;
  location: string | null;
  startTime: string;
  status: 'pending' | 'active' | 'ended';
  _count: { checkIns: number };
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/meetings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setMeetings(data.data.meetings);
    setLoading(false);
  };

  const statusLabel = (s: string) =>
    s === 'pending' ? '未开始' : s === 'active' ? '进行中' : '已结束';

  const statusColor = (s: string) =>
    s === 'pending' ? 'text-yellow-600' : s === 'active' ? 'text-green-600' : 'text-gray-400';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">会议列表</h1>
        <Link
          href="/admin/meetings/new"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          + 创建会议
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : meetings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>还没有会议，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold">{m.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  🕐 {new Date(m.startTime).toLocaleString('zh-CN')}
                  {m.location && ` | 📍 ${m.location}`}
                </p>
                <p className={`text-xs mt-1 ${statusColor(m.status)}`}>
                  {statusLabel(m.status)} · 已签到 {m._count.checkIns} 人
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('admin_token');
                    const res = await fetch(`/api/admin/meetings/${m.id}/qrcode`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    if (data.success) {
                      // 打开二维码弹窗（简单实现：新窗口展示）
                      const w = window.open('', '_blank', 'width=400,height=600')!;
                      w.document.write(
                        `<img src="${data.data.qrCodeDataURL}" style="width:100%"/><p style="text-align:center">${m.title}</p>`
                      );
                    }
                  }}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-100"
                >
                  📱 二维码
                </button>
                <Link
                  href={`/admin/meetings/${m.id}/checkins`}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-100"
                >
                  📊 明细
                </Link>
                <Link
                  href={`/admin/meetings/${m.id}`}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-100"
                >
                  ✏️
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add admin meeting list page"
```

---

### Task 17: 创建/编辑会议页

**Files:**
- Create: `src/app/admin/meetings/new/page.tsx`
- Create: `src/app/admin/meetings/[id]/page.tsx`

- [ ] **Step 1: 实现创建会议页**

```tsx
// src/app/admin/meetings/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewMeetingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    location: '',
    startTime: '',
    endTime: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error);
      setLoading(false);
      return;
    }

    // 创建成功，展示二维码
    const qrData = data.data;
    const w = window.open('', '_blank', 'width=400,height=600')!;
    w.document.write(
      `<div style="text-align:center;padding:20px"><h2>${form.title}</h2><img src="${qrData.qrCodeDataURL}" style="max-width:100%"/><p>扫码即可签到</p><button onclick="window.close()" style="margin-top:20px;padding:8px 20px">关闭</button></div>`
    );
    router.push('/admin/meetings');
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">创建会议</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">会议名称 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">会议地点</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">开始时间 *</label>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">结束时间</label>
          <input
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建并生成二维码'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 实现编辑会议页**

```tsx
// src/app/admin/meetings/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditMeetingPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState({ title: '', location: '', startTime: '', endTime: '', status: 'pending' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`/api/admin/meetings?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const m = data.data.meetings.find((m: { id: number }) => m.id === parseInt(id));
          if (m) {
            setForm({
              title: m.title,
              location: m.location || '',
              startTime: new Date(m.startTime).toISOString().slice(0, 16),
              endTime: m.endTime ? new Date(m.endTime).toISOString().slice(0, 16) : '',
              status: m.status,
            });
          }
        }
        setFetching(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin/meetings/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error);
      setLoading(false);
      return;
    }
    router.push('/admin/meetings');
  };

  if (fetching) return <p className="text-gray-500">加载中...</p>;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">编辑会议</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">会议名称</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">地点</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">开始时间</label>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">结束时间</label>
          <input
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">状态</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="pending">未开始</option>
            <option value="active">进行中</option>
            <option value="ended">已结束</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add create and edit meeting pages"
```

---

### Task 18: 签到明细页

**Files:**
- Create: `src/app/admin/meetings/[id]/checkins/page.tsx`

- [ ] **Step 1: 实现签到明细页**

```tsx
// src/app/admin/meetings/[id]/checkins/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface CheckInRecord {
  id: number;
  employeeName: string;
  departmentName: string;
  avatar: string | null;
  checkInTime: string;
}

export default function CheckInsPage() {
  const { id } = useParams<{ id: string }>();
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [meeting, setMeeting] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`/api/admin/meetings/${id}/checkins`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRecords(data.data.records);
          setMeeting(data.data.meeting);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">
        {meeting?.title || '签到明细'}
      </h1>
      <p className="text-sm text-gray-500 mb-6">共 {records.length} 人签到</p>

      {records.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>暂无签到记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500">
                <th className="px-4 py-3">员工</th>
                <th className="px-4 py-3">部门</th>
                <th className="px-4 py-3">签到时间</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">
                      {r.employeeName.charAt(0)}
                    </div>
                    <span>{r.employeeName}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.departmentName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(r.checkInTime).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add checkin detail page"
```

---

## Phase 7: 前端 — 员工签到端

### Task 19: 签到页（含下载引导）

**Files:**
- Create: `src/app/checkin/[meetingId]/page.tsx`

- [ ] **Step 1: 实现签到/下载引导页**

```tsx
// src/app/checkin/[meetingId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface PreviewData {
  meeting: { id: number; title: string; location: string | null; startTime: string };
  employee: { id: number; name: string; department: string | null; avatar: string | null };
  alreadyCheckedIn: boolean;
  meetingStatus: string;
}

export default function CheckInPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const nonWxwork = searchParams.get('non_wxwork') === '1';

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    if (nonWxwork || !code) return;

    fetch(`/api/checkin/preview/${meetingId}?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPreview(data.data);
          if (data.data.alreadyCheckedIn) setCheckedIn(true);
        } else {
          setError(data.error);
        }
      })
      .catch(() => setError('网络错误'));
  }, [meetingId, code, nonWxwork]);

  const handleCheckIn = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/checkin/confirm/${meetingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: preview.employee.id }),
      });
      const data = await res.json();

      if (data.success) {
        setCheckedIn(true);
      } else {
        setError(data.error);
      }
    } catch {
      setError('签到失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 下载引导页
  if (nonWxwork) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">📱</div>
        <h1 className="text-xl font-bold mb-2">请使用企业微信扫码</h1>
        <p className="text-gray-500 mb-8">检测到你还没有安装企业微信，请先下载</p>
        <a
          href="https://work.weixin.qq.com/"
          className="bg-green-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-600 mb-4 w-full max-w-xs"
        >
          📥 下载企业微信
        </a>
        <p className="text-sm text-gray-400 mb-6">安装后重新扫码即可签到</p>
        <div className="bg-white rounded-lg p-4 text-left text-sm text-gray-500 max-w-xs">
          <p className="font-semibold text-gray-600 mb-2">💡 已经有企业微信？</p>
          <p>· 请用<strong>企业微信的扫一扫</strong>重新扫码</p>
          <p>· 或在企微中<strong>打开工作台</strong>找到签到应用</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  // 会议已结束
  const isEnded = preview.meetingStatus === 'ended';

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-sm mx-auto">
        {/* 顶部图标 */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{checkedIn ? '✅' : '📋'}</div>
          <h1 className="text-xl font-bold">{checkedIn ? '签到成功' : '签到确认'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {checkedIn ? '你已完成签到' : '会议信息已确认，身份已匹配'}
          </p>
        </div>

        {/* 会议信息 */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <h2 className="font-semibold">📋 {preview.meeting.title}</h2>
          <p className="text-sm text-gray-500 mt-2">
            🕐 {new Date(preview.meeting.startTime).toLocaleString('zh-CN')}
          </p>
          {preview.meeting.location && (
            <p className="text-sm text-gray-500 mt-1">📍 {preview.meeting.location}</p>
          )}
        </div>

        {/* 员工信息 */}
        <div className="bg-green-50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center text-lg font-bold">
              {preview.employee.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{preview.employee.name}</p>
              <p className="text-sm text-gray-500">{preview.employee.department || '-'}</p>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-3">{error}</p>
        )}

        {/* 签到按钮 */}
        {checkedIn ? (
          <button
            disabled
            className="w-full py-3 rounded-lg text-lg font-semibold bg-gray-200 text-gray-500"
          >
            已签到 ✅
          </button>
        ) : isEnded ? (
          <button
            disabled
            className="w-full py-3 rounded-lg text-lg font-semibold bg-gray-200 text-gray-500"
          >
            会议已结束
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full py-3 rounded-lg text-lg font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '签到中...' : '签到'}
          </button>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          扫码自动匹配身份，无需手动输入
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add employee check-in and download guidance page"
```

---

## Phase 8: 收尾

### Task 20: 根路由跳转 & 环境检查

**Files:**
- Create: `src/app/page.tsx`

- [ ] **Step 1: 首页重定向**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/admin/login');
}
```

- [ ] **Step 2: 添加 test 脚本到 package.json**

确保 `package.json` 中有：

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "jest --runInBand --forceExit"
}
```

- [ ] **Step 3: 运行所有测试**

```bash
npm test
```

Expected: 所有测试 PASS.

- [ ] **Step 4: 验证构建**

```bash
npm run build
```

Expected: 构建成功，无 TypeScript 错误。

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: add root redirect and finalize project"
```

---

## 实现顺序总结

```
Phase 1: 项目初始化
  Task 1: 脚手架搭建
  Task 2: Prisma Schema

Phase 2: 核心工具库
  Task 3: 数据库客户端
  Task 4: 共享类型定义
  Task 5: 认证工具 (JWT + OAuth)
  Task 6: 企微 API 封装
  Task 7: 二维码生成

Phase 3: 管理员 API
  Task 8: 登录 API
  Task 9: 鉴权中间件
  Task 10: 会议 CRUD API
  Task 11: 二维码 & 明细 & 统计 API

Phase 4: 员工 API
  Task 12: 签到预览 & 确认 API
  Task 13: 通讯录同步 API

Phase 5: 中间件
  Task 14: UA 检测中间件

Phase 6: 管理端前端
  Task 15: 布局 + 登录页
  Task 16: 会议列表页
  Task 17: 创建/编辑会议页
  Task 18: 签到明细页

Phase 7: 员工端前端
  Task 19: 签到页 + 下载引导页

Phase 8: 收尾
  Task 20: 根路由 + 测试 + 构建验证
```

**依赖关系：** Phase 2 依赖 Phase 1，Phase 3-4 依赖 Phase 2，Phase 6-7 依赖 Phase 3-4。Phase 5 独立。按顺序执行。
