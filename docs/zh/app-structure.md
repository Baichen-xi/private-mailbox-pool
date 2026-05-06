# 应用结构

## 页面地图

### `/login`

用途：
- 在 Cloudflare Access 成功放行后，用应用级密码再次保护整个站点。

主要区域：
- 应用标题和简短说明
- 用户名输入框
- 密码输入框
- 提交按钮
- 冷却时间或封禁提示

### `/`

用途：
- 展示每日状态的仪表盘。

主要区域：
- 顶部指标：邮箱数量、未读数量、可用子域名数量
- 最近邮件
- 安全告警
- 快捷操作：创建邮箱、打开审计日志、生成子域名

### `/mailboxes`

用途：
- 在一个页面里管理所有邮箱。

主要区域：
- 搜索栏
- 状态筛选
- 新建邮箱按钮
- 邮箱表格或卡片列表
- 操作：复制地址、打开收件箱、暂停、归档、删除

### `/mailboxes/:id`

用途：
- 查看单个邮箱的收件箱。

主要区域：
- 邮箱头部，展示地址、备注、状态
- 邮件列表面板
- 工具栏：搜索、未读筛选、刷新
- 空状态提示

### `/emails/:id`

用途：
- 查看单封邮件详情。

主要区域：
- 头部：主题、发件人、收件人、时间戳
- 操作：标为已读、复制验证码、复制链接、下载原始邮件、删除
- 内容标签页：文本、HTML、邮件头
- 附件列表

### `/subdomains`

用途：
- 维护可用子域名池。

主要区域：
- 子域名池概览
- 批量生成表单
- 状态筛选
- 子域名表格和分配状态

### `/settings`

用途：
- 编辑防护规则和默认值。

主要区域：
- 安全设置
- 邮件设置
- 子域名池设置
- 保存按钮

### `/audit-logs`

用途：
- 查看可疑行为和系统变更。

主要区域：
- 筛选栏
- 事件表格
- 元数据抽屉

## 低保真线框图

### 登录页

```text
+------------------------------------------------------+
| Private Mailbox Pool                                 |
| Private inboxes backed by Cloudflare                 |
|                                                      |
| Username   [__________________________]              |
| Password   [__________________________]              |
|                                                      |
| [ Sign in ]                                          |
|                                                      |
| Too many failed attempts? Wait 12 minutes.           |
+------------------------------------------------------+
```

### 仪表盘

```text
+---------------------------------------------------------------+
| Metrics: [12 mailboxes] [8 unread] [34 subdomains available] |
|---------------------------------------------------------------|
| Quick actions: [New mailbox] [Generate subdomains] [Logs]     |
|---------------------------------------------------------------|
| Recent mail                                                   |
| - Verify your account      noreply@github.com    2 min ago    |
| - Your code is 514283      no-reply@openai.com   9 min ago    |
|---------------------------------------------------------------|
| Security alerts                                                |
| - 5 failed logins from 203.0.113.8 in the last hour           |
+---------------------------------------------------------------+
```

### 邮箱列表页

```text
+--------------------------------------------------------------------+
| Search [________________]  Status [active v]   [ New mailbox ]     |
|--------------------------------------------------------------------|
| hello@a1b2.example.com   active   2 unread   GitHub signup         |
| shop@z9x8.example.com    paused   0 unread   Payment retries       |
| code@m4n5.example.com    active   1 unread   Testing               |
+--------------------------------------------------------------------+
```

### 单邮箱收件箱

```text
+-------------------------+------------------------------------------+
| hello@a1b2.example.com  | Search [____________] [Refresh]          |
| Active   14 total       |------------------------------------------|
|-------------------------| Verify your account                      |
| * GitHub                | From: noreply@github.com                 |
|   Verify your account   | Time: 2026-05-06 17:32                  |
|-------------------------|------------------------------------------|
|   OpenAI                | Body preview / open full email           |
|   Your code is 514283   |                                          |
|-------------------------|------------------------------------------|
+-------------------------+------------------------------------------+
```

### 邮件详情页

```text
+--------------------------------------------------------------------+
| Verify your account                                                |
| From: GitHub <noreply@github.com>                                  |
| To: hello@a1b2.example.com                                         |
| Time: 2026-05-06 17:32                                             |
| Actions: [Copy code] [Copy links] [Download .eml] [Delete]         |
|--------------------------------------------------------------------|
| Tabs: [Text] [HTML] [Headers]                                      |
|--------------------------------------------------------------------|
| Please verify your email address by clicking the button below.     |
|                                                                    |
| Attachments                                                        |
| - invoice.pdf                                                      |
+--------------------------------------------------------------------+
```

## 推荐目录结构

```text
.
├── docs/
│   ├── api-contract.md
│   ├── app-structure.md
│   └── schema.sql
├── migrations/
│   └── 0001_initial.sql
├── src/
│   ├── worker/
│   │   ├── index.ts
│   │   ├── env.ts
│   │   ├── router/
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── mailboxes.ts
│   │   │   ├── emails.ts
│   │   │   ├── subdomains.ts
│   │   │   ├── settings.ts
│   │   │   └── audit-logs.ts
│   │   ├── email/
│   │   │   ├── handle-inbound.ts
│   │   │   ├── mime-parser.ts
│   │   │   ├── sanitize-html.ts
│   │   │   └── attachment-store.ts
│   │   ├── auth/
│   │   │   ├── sessions.ts
│   │   │   ├── password.ts
│   │   │   └── rate-limit.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── mailboxes.ts
│   │   │   ├── emails.ts
│   │   │   ├── subdomains.ts
│   │   │   ├── settings.ts
│   │   │   └── audit-logs.ts
│   │   ├── lib/
│   │   │   ├── ids.ts
│   │   │   ├── validation.ts
│   │   │   ├── responses.ts
│   │   │   └── time.ts
│   │   └── types/
│   │       └── api.ts
│   ├── app/
│   │   ├── routes/
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── mailboxes.tsx
│   │   │   ├── mailbox-detail.tsx
│   │   │   ├── email-detail.tsx
│   │   │   ├── subdomains.tsx
│   │   │   ├── settings.tsx
│   │   │   └── audit-logs.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── mailbox/
│   │   │   ├── email/
│   │   │   └── settings/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── shared/
│       ├── constants.ts
│       ├── schemas.ts
│       └── dto.ts
├── public/
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## 开发顺序

1. 将 `schema.sql` 作为迁移 `0001_initial.sql` 应用到数据库。
2. 实现认证路由和会话中间件。
3. 实现邮箱 CRUD 和子域名分配。
4. 实现入站邮件处理和 R2 持久化。
5. 实现收件箱和邮件详情 UI。
6. 加入审计日志和限流。
