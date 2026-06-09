# 企业微信扫码签到系统 — 设计文档

> **版本:** v1.0 | **日期:** 2026-06-09

## 1. 概述

### 1.1 项目背景

一款供企业微信员工使用的会议签到软件。管理员在后台创建会议并生成签到二维码，员工用企业微信扫码后自动匹配身份信息，点击签到按钮完成签到。

### 1.2 核心目标

- 管理员能快速创建会议、生成签到二维码
- 员工扫码后零输入完成签到（自动识别身份）
- 非企微用户扫码获得友好的下载引导
- 签到数据可追溯、可统计

### 1.3 技术选型

| 层次 | 技术 | 说明 |
|------|------|------|
| 前端（管理端）| React + Next.js | SPA 管理后台 |
| 前端（员工端）| React H5（企微内嵌）| 轻量签到页面 |
| 后端 | Node.js + TypeScript | REST API |
| 数据库 | MySQL | 持久化存储 |
| 身份认证 | 企微 OAuth 2.0 | 扫码获取 userid |
| 通讯录同步 | 企微通讯录 API | 拉取部门/员工数据 |

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────┐        ┌─────────────────────┐
│     管理员后台        │        │    员工签到 H5        │
│    (Desktop SPA)     │        │   (企微内嵌网页)       │
│                      │        │                      │
│  · 会议 CRUD          │        │  · 扫码进入            │
│  · 生成/查看二维码     │        │  · OAuth 身份识别       │
│  · 签到统计/明细      │        │  · 一键签到            │
│  · 手动触发通讯录同步   │        │  · 签到历史            │
└─────────┬───────────┘        └──────────┬──────────┘
          │                               │
          │       HTTPS REST API          │
          │                               │
          └───────────┬───────────────────┘
                      │
          ┌───────────┴───────────┐
          │   Node.js 后端服务      │
          │                       │
          │  · JWT 鉴权中间件       │
          │  · 企微 OAuth 处理       │
          │  · 通讯录同步服务        │
          │  · 签到业务逻辑          │
          │  · 二维码生成            │
          └───────────┬───────────┘
                      │
          ┌───────────┴───────────┐
          │       MySQL            │
          │                        │
          │  departments           │
          │  employees             │
          │  meetings              │
          │  check_ins             │
          │  admins                │
          └────────────────────────┘
```

### 2.2 部署结构

单服务 + 单数据库部署，Next.js 同时承载管理端 SPA 和员工端 H5 页面路由。

---

## 3. 功能模块

### 3.1 模块清单

| 模块 | 功能 | 用户角色 |
|------|------|---------|
| 会议管理 | 创建、编辑、删除、列表、状态管理 | 管理员 |
| 二维码服务 | 生成签到二维码（含会议 ID）、保存/复制 | 管理员 |
| 签到流程 | 扫码→OAuth→匹配身份→确认签到 | 员工 |
| 通讯录同步 | 从企微 API 拉取部门/员工信息 | 系统自动/管理员手动 |
| 签到统计 | 会议签到率、明细查询、数据导出 | 管理员 |
| 环境检测 | UA 判断企微/非企微环境，引导下载 | 系统自动 |

---

## 4. 数据库设计

### 4.1 ER 图

```
departments              employees                meetings
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ id (PK)      │◄───────│ department_id│        │ id (PK)      │
│ wework_dept_id│       │ id (PK)      │        │ title        │
│ name         │       │ wework_userid│        │ location     │
│ parent_id    │       │ name         │        │ start_time   │
│ sync_time    │       │ avatar       │        │ end_time     │
└──────────────┘       │ mobile       │        │ qr_code_url  │
                       │ sync_time    │        │ status       │
                       └──────┬───────┘        │ created_by   │
                              │                └──────┬───────┘
                              │                       │
                              │    check_ins          │
                              │    ┌──────────────┐   │
                              │    │ id (PK)      │   │
                              └────│ employee_id  │◄──┘
                                   │ meeting_id   │
                                   │ check_in_time│
                                   └──────────────┘
                                   UNIQUE (meeting_id, employee_id)
```

### 4.2 表结构

```sql
-- 部门表（从企微通讯录同步）
CREATE TABLE departments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  wework_dept_id BIGINT NOT NULL UNIQUE COMMENT '企微部门ID',
  name          VARCHAR(100) NOT NULL,
  parent_id     INT DEFAULT NULL COMMENT '上级部门ID（自引用）',
  sync_time     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES departments(id)
);

-- 员工表（从企微通讯录同步）
CREATE TABLE employees (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  department_id INT COMMENT '所属部门',
  wework_userid VARCHAR(64) NOT NULL UNIQUE COMMENT '企微userid（OAuth返回值）',
  name          VARCHAR(50) NOT NULL,
  avatar        VARCHAR(255) COMMENT '头像URL',
  mobile        VARCHAR(20) COMMENT '手机号',
  sync_time     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 管理员表
CREATE TABLE admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 会议表
CREATE TABLE meetings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL COMMENT '会议名称',
  location      VARCHAR(200) COMMENT '会议地点',
  start_time    DATETIME NOT NULL,
  end_time      DATETIME,
  qr_code_url   VARCHAR(500) COMMENT '签到二维码URL',
  status        ENUM('pending','active','ended') NOT NULL DEFAULT 'pending',
  created_by    INT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 签到记录表
CREATE TABLE check_ins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id    INT NOT NULL,
  employee_id   INT NOT NULL,
  check_in_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_meeting_employee (meeting_id, employee_id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

**设计要点：**
- `check_ins` 的联合唯一约束防重复签到
- `departments` 自引用实现树形部门结构
- 员工头像 URL 直接从企微获取，不做本地存储
- `meetings.status` 三个状态：`pending`（未开始）、`active`（进行中）、`ended`（已结束）

---

## 5. API 设计

### 5.1 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录（用户名+密码） |
| GET  | `/api/admin/meetings` | 会议列表（分页、状态筛选） |
| POST | `/api/admin/meetings` | 创建会议 |
| PUT  | `/api/admin/meetings/:id` | 编辑会议 |
| DELETE | `/api/admin/meetings/:id` | 删除会议 |
| GET  | `/api/admin/meetings/:id/qrcode` | 获取签到二维码图片 |
| GET  | `/api/admin/meetings/:id/checkins` | 获取签到明细列表 |
| GET  | `/api/admin/stats` | 签到统计概览 |

### 5.2 员工签到接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/checkin/preview/:meetingId` | 获取签到预览（会议+员工信息） |
| POST | `/api/checkin/confirm/:meetingId` | 确认签到 |
| GET  | `/api/checkin/my-records` | 我的签到记录 |

### 5.3 内部接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/internal/sync-contacts` | 同步企微通讯录 |

### 5.4 鉴权方案

- **管理员接口** → JWT token（登录后返回，Bearer 方式携带）
- **员工接口** → 企微 OAuth code 换取 userid + access_token，每个接口校验 token 有效性

### 5.5 环境判断与路由

```
请求到达 → 检测 User-Agent
  ├── 包含 "wxwork" → 企微环境 → 走 OAuth 流程 → 签到页
  └── 其他 → 非企微环境 → 展示下载引导页
```

---

## 6. 前端页面设计

### 6.1 页面清单

| 页面 | 路由 | 端 |
|------|------|-----|
| 管理员登录 | `/admin/login` | Desktop |
| 会议列表 | `/admin/meetings` | Desktop |
| 创建/编辑会议 | `/admin/meetings/new` `/admin/meetings/:id/edit` | Desktop |
| 签到明细 | `/admin/meetings/:id/checkins` | Desktop |
| 签到确认页 | `/checkin/:meetingId` | Mobile H5 |
| 下载引导页 | `/checkin/:meetingId`（非企微 UA） | Mobile H5 |

### 6.2 签到确认页（核心页面）

**触发流程：**
1. 员工用企微扫一扫扫码
2. 企微内置浏览器打开 `/checkin/:meetingId`
3. 后端发起 OAuth 授权 → 获取 code → 换 userid → 匹配员工信息
4. 返回页面：会议信息卡片 + 员工身份卡片 + 签到按钮
5. 员工点击「签到」→ POST 确认 → 成功反馈

**页面元素：**
- 会议名称、时间、地点
- 自动匹配的员工姓名、部门、头像
- 绿色「签到」按钮（唯一操作）
- 提示文字："扫码自动匹配身份，无需手动输入"
- 签到成功后的勾选动画

### 6.3 二维码弹窗（管理端）

管理员点击会议旁的「📱 二维码」按钮弹出：
- 二维码图片（可放大）
- 「保存图片」按钮 → 下载 PNG
- 「复制链接」按钮 → 复制签到 URL 到剪贴板
- 会议摘要信息（名称、时间、地点）

---

## 7. 核心流程

### 7.1 签到主流程

```
管理员创建会议
    │
    ▼
系统生成签到 URL：https://domain/checkin/:meetingId
并编码为二维码图片
    │
    ▼
管理员分享（投屏/发群/打印）
    │
    ▼
员工用企微扫码
    │
    ├── UA 含 "wxwork"？
    │     ├── 是 → 企微 OAuth 跳转
    │     │        │
    │     │        ▼
    │     │     获取 code → 后端换 userid
    │     │        │
    │     │        ▼
    │     │     查 employees 表匹配员工信息
    │     │        │
    │     │        ├── 找到 → 返回签到确认页
    │     │        └── 未找到 → 提示"你不在通讯录中，请联系管理员"
    │     │
    │     └── 否 → 展示下载引导页
    │
    ▼
员工确认信息 → 点击签到
    │
    ▼
后端校验：meeting 状态是否有效 + 是否已签到
    │
    ├── 通过 → 写入 check_ins 表 → 返回成功
    └── 失败 → 返回错误提示（"已签到"/"会议未开始"等）
```

### 7.2 通讯录同步流程

```
管理员触发 / 定时任务
    │
    ▼
调用企微通讯录 API
  · 获取部门列表 → upsert departments
  · 遍历部门获取成员 → upsert employees
    │
    ▼
更新 sync_time → 完成
```

---

## 8. 错误处理

### 8.1 异常场景与处理

| 场景 | 处理方式 |
|------|---------|
| 企微 OAuth 授权失败 | 展示错误提示，引导重试 |
| userid 在通讯录中不存在 | 提示"未找到你的信息，请联系管理员" |
| 会议已结束 | 签到按钮置灰，显示"会议已结束" |
| 重复签到 | 返回"已签到"状态，按钮变为"已签到 ✅" |
| 网络超时 | 按钮 loading 状态，提示重试 |
| 企微 API 限频 | 同步任务失败重试，管理员手动触发兜底 |

### 8.2 前端状态覆盖

签到确认按钮三态：
- **可签到**（绿色按钮）→ 点击 → loading → 成功/失败
- **已签到**（灰色，显示 ✅）
- **不可签到**（灰色，显示"会议未开始"/"会议已结束"）

---

## 9. 测试策略

### 9.1 单元测试

- 签到业务逻辑：重复签到检测、状态校验
- 通讯录同步：数据 upsert 逻辑
- OAuth 流程：code 换取 userid

### 9.2 集成测试

- API 端点完整流程测试
- 数据库约束验证（唯一索引防重）

### 9.3 E2E 场景

- 管理员创建会议 → 生成二维码 → 员工扫码 → 签到成功
- 非企微浏览器打开 → 展示下载引导页
- 重复扫码 → 显示已签到状态

---

## 10. 待定事项

- 管理员登录方式：目前设计为用户名密码，后续可扩展为企微扫码登录
- 定时通讯录同步：初期通过管理员手动触发 + 简单定时任务，不引入消息队列
- 数据导出：Excel 导出功能可在第二阶段实现

---

## 11. 项目结构（规划）

```
QianDao/
├── src/
│   ├── pages/            # Next.js 页面路由
│   │   ├── admin/        # 管理端页面
│   │   │   ├── login.tsx
│   │   │   ├── meetings/
│   │   │   │   ├── index.tsx       # 会议列表
│   │   │   │   ├── new.tsx         # 创建会议
│   │   │   │   └── [id]/
│   │   │   │       ├── edit.tsx    # 编辑会议
│   │   │   │       └── checkins.tsx # 签到明细
│   │   │   └── stats.tsx           # 统计
│   │   ├── checkin/
│   │   │   └── [meetingId].tsx     # 员工签到页/下载引导
│   │   └── api/                    # API 路由
│   │       ├── admin/
│   │       ├── checkin/
│   │       └── internal/
│   ├── lib/              # 工具库
│   │   ├── db.ts                  # 数据库连接
│   │   ├── auth.ts                # JWT + 企微 OAuth
│   │   ├── wework-api.ts          # 企微 SDK 封装
│   │   └── qrcode.ts             # 二维码生成
│   └── types/            # TypeScript 类型定义
├── prisma/               # 数据库 schema（使用 Prisma ORM）
│   └── schema.prisma
├── package.json
└── tsconfig.json
```
