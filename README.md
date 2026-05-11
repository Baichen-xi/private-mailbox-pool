# Private Mailbox Pool

Private long-lived inboxes built on Cloudflare Workers, D1, and R2.

<details open>
<summary><strong>中文（默认）</strong></summary>

## 1. 项目是什么

这是一个自用型私有邮箱池后台。它的目标不是公开临时邮箱站，而是让你在自己的 Cloudflare 账号和域名下：

- 批量管理接收子域名
- 创建长期保存的邮箱
- 接收并持久化邮件正文、原始邮件和附件
- 用管理员后台统一处理会话、安全记录和异常登录

当前仓库已经包含：

- Cloudflare Worker 管理后台
- D1 数据库存储
- R2 邮件正文和附件存储
- 邮件收信入口 `email()`
- 中英文后台界面
- 管理员面板、会话强制下线、密码修改、异常 IP 清理

## 2. 默认示例配置

仓库里的默认示例域名已经改成：

```toml
BASE_DOMAIN = "example.com"
```

这只是占位值。正式部署前，你需要把它改成你自己的主域名，例如：

```toml
BASE_DOMAIN = "yourdomain.com"
```

## 3. 关键配置说明

核心配置文件是 [wrangler.toml](./wrangler.toml)。

常见变量：

| 变量 | 作用 | 示例 |
| --- | --- | --- |
| `APP_NAME` | 后台显示名称 | `Private Mailbox Pool` |
| `BASE_DOMAIN` | 主接收域名 | `example.com` |
| `COOKIE_NAME` | 登录会话 Cookie 名称 | `pmp_session` |
| `SESSION_TTL_HOURS` | 会话有效小时数 | `24` |
| `MAX_LOGIN_FAILURES` | 单 IP 最大失败次数 | `10` |
| `LOGIN_BLOCK_MINUTES` | 达到阈值后的封锁分钟数 | `15` |
| `CF_ACCESS_ENABLED` | 是否启用 Cloudflare Access 前置门禁标记 | `false` |
| `BOOTSTRAP_ADMIN_USERNAME` | 初始管理员用户名 | `admin` |
| `BOOTSTRAP_ADMIN_PASSWORD_PLAIN` | 初始管理员明文密码 | `""` |
| `BOOTSTRAP_ADMIN_PASSWORD_HASH` | 初始管理员密码哈希 | `""` |
| `CLOUDFLARE_ZONE_ID` | 可选，用于自动检测域名 DNS 与 Email Routing | `example_zone_id` |
| `CLOUDFLARE_API_TOKEN` | 可选，只读 API Token，用于自动检测 Email Routing 配置 | Cloudflare Secret |

密码模式支持两种：

1. 明文密码模式  
直接填写 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`，适合本地测试、演示、网页端快速部署。

2. 哈希密码模式  
填写 `BOOTSTRAP_ADMIN_PASSWORD_HASH`，适合不想把明文写进配置文件时使用。

优先级：

- 如果同时填写了 `BOOTSTRAP_ADMIN_PASSWORD_HASH` 和 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`
- 系统会优先使用 `BOOTSTRAP_ADMIN_PASSWORD_HASH`

建议：

- 本地测试或自用演示：可以直接填写 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`
- 正式线上：更推荐用 Cloudflare Secret，而不是把真实密码提交到 GitHub
- 公开仓库：`wrangler.toml` 里只保留示例值，真实域名、Zone ID、API Token、管理员密码都在 Cloudflare 后台填写

## 4. 本地启动

### 4.1 安装依赖

```bash
npm install
```

### 4.2 准备本地变量

你可以选择两种方式：

方式 A：直接改 `.dev.vars`

```text
APP_NAME=Private Mailbox Pool
BASE_DOMAIN=example.com
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD_PLAIN=change-this-in-dev
```

方式 B：直接改 `wrangler.toml` 里的 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`

### 4.3 初始化本地数据库

```bash
npx wrangler d1 migrations apply private-mailbox-pool --local
```

### 4.4 启动本地开发服务

```bash
npm run dev
```

默认你可以在本地打开：

```text
http://127.0.0.1:8787/login
```

### 4.5 本地登录

```text
用户名：admin
密码：你设置的 BOOTSTRAP_ADMIN_PASSWORD_PLAIN
```

## 5. 网页端部署教程（适合小白）

这套流程尽量少用命令行，主要在 GitHub 和 Cloudflare 网页里完成。

### 第 1 步：把项目上传到 GitHub

你需要先把当前项目放到自己的 GitHub 仓库里。

如果你已经上传过，这一步跳过。

### 第 2 步：准备 Cloudflare 资源

登录 Cloudflare 后台，然后准备这两个资源：

1. 创建一个 D1 数据库  
用途：保存管理员、子域名、邮箱、邮件元数据

2. 创建一个 R2 Bucket  
用途：保存邮件正文、原始邮件、附件

建议名称直接和仓库默认配置保持一致：

- D1：`private-mailbox-pool`
- R2：`private-mailbox-pool-mail`

### 第 3 步：修改 GitHub 仓库里的 `wrangler.toml`

在 GitHub 网页中打开 [wrangler.toml](./wrangler.toml)，至少改这几项：

```toml
BASE_DOMAIN = "yourdomain.com"
BOOTSTRAP_ADMIN_USERNAME = "admin"
BOOTSTRAP_ADMIN_PASSWORD_PLAIN = "你的初始密码"
```

你还需要把 D1 的 `database_id` 改成你在 Cloudflare 后台创建出来的真实 ID。

如果你不想把真实密码提交到 GitHub，那么可以这样处理：

- 让 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN = ""`
- 部署完成后，在 Cloudflare 后台给 Worker 添加同名 Secret

### 第 4 步：在 Cloudflare 后台导入 GitHub 项目

进入 Cloudflare 的 `Workers & Pages`，导入你的 GitHub 仓库并创建项目。

部署时重点检查：

- 入口文件：`src/worker/index.ts`
- 配置文件：`wrangler.toml`

### 第 5 步：补绑定和变量

如果导入后 Cloudflare 没有自动识别完整绑定，请在项目设置里确认：

1. D1 绑定  
名称必须是：`DB`

2. R2 绑定  
名称必须是：`MAIL_BUCKET`

3. 环境变量 / Secret  
至少确认：

- `APP_NAME`
- `BASE_DOMAIN`
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD_PLAIN` 或 `BOOTSTRAP_ADMIN_PASSWORD_HASH`
- `CLOUDFLARE_ZONE_ID`，普通变量，填写域名的区域 ID
- `CLOUDFLARE_API_TOKEN`，Secret，填写只读 API Token

### 第 6 步：执行数据库迁移

如果你完全不用本地命令行，最简单的方式是：

- 在 Cloudflare 的 D1 控制台里执行 [migrations/0001_initial.sql](./migrations/0001_initial.sql)
- 再执行 [migrations/0002_unique_mailbox_subdomain.sql](./migrations/0002_unique_mailbox_subdomain.sql)
- 再执行 [migrations/0003_reuse_subdomains.sql](./migrations/0003_reuse_subdomains.sql)
- 再执行 [migrations/0004_mailbox_groups_and_domain_health.sql](./migrations/0004_mailbox_groups_and_domain_health.sql)

更稳妥的方式还是走 CLI，见下方 CLI 教程。

### 第 7 步：首次登录后台

部署完成后，打开：

```text
https://你的-worker-域名/login
```

使用：

```text
用户名：admin
密码：你在配置里填写的初始密码
```

### 第 8 步：上线后建议立刻做的事

首次登录后建议马上做：

1. 进入管理员面板修改密码
2. 清空 `wrangler.toml` 中的 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`
3. 改为在 Cloudflare 后台用 Secret 保存密码
4. 给站点前面加上 Cloudflare Access

## 6. CLI 部署教程（适合愿意用命令行）

### 6.1 登录 Cloudflare

```bash
npx wrangler login
```

### 6.2 创建 D1 数据库

```bash
npx wrangler d1 create private-mailbox-pool
```

执行后会返回一个 `database_id`，把它填回 [wrangler.toml](./wrangler.toml)。

### 6.3 创建 R2 Bucket

```bash
npx wrangler r2 bucket create private-mailbox-pool-mail
```

### 6.4 修改 `wrangler.toml`

至少改下面这些：

```toml
BASE_DOMAIN = "yourdomain.com"
database_id = "你的真实 D1 database_id"
BOOTSTRAP_ADMIN_USERNAME = "admin"
BOOTSTRAP_ADMIN_PASSWORD_PLAIN = "你的初始密码"
```

如果你不想把明文密码写入文件，可以先生成哈希：

```bash
npm run hash:password -- "你的密码"
```

然后把结果填进：

```toml
BOOTSTRAP_ADMIN_PASSWORD_HASH = "生成出来的哈希"
```

### 6.5 执行生产数据库迁移

```bash
npx wrangler d1 migrations apply private-mailbox-pool --remote
```

### 6.6 部署 Worker

```bash
npm run deploy
```

### 6.7 打开后台并登录

部署成功后，打开 Worker 域名：

```text
https://你的-worker-域名/login
```

然后使用你设置的管理员账号登录。

## 7. 邮件路由联调提醒

只把 Worker 部署好还不够，真正收信还需要你的域名和 Email Routing 配好。

建议你继续按下面文档检查：

- [Cloudflare Email Routing 联调清单（中文）](./docs/zh/cloudflare-email-routing-checklist.md)
- [Cloudflare Email Routing Checklist (English)](./docs/en/cloudflare-email-routing-checklist.md)

## 8. 安全建议

自用项目也建议至少做到这几条：

1. 不要把真实生产密码长期放在 GitHub 仓库里
2. 首次登录后立刻在管理员面板修改密码
3. 给后台前面加 Cloudflare Access
4. 定期查看管理员面板中的：
   - 最近会话
   - 最近登录尝试
   - 异常登录 IP
5. 如果只是演示或测试，结束后清理 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`

## 9. 相关文档

- [文档索引](./docs/README.md)
- [数据库结构](./docs/schema.sql)
- [初始迁移 0001](./migrations/0001_initial.sql)
- [网页端 Cloudflare 部署长教程（中文）](./docs/zh/cloudflare-dashboard-deploy-step-by-step.md)

## 10. 官方参考

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Cloudflare Email Routing Docs](https://developers.cloudflare.com/email-routing/)
- [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)

</details>

<details>
<summary><strong>English</strong></summary>

## 1. What this project is

This is a private mailbox pool for self-hosted use on Cloudflare. It is designed for managing your own receiving domains and long-lived mailboxes, not for running a public disposable-email site.

You can use it to:

- manage subdomain pools
- create long-lived inboxes
- store email bodies, raw messages, and attachments
- review admin sessions and suspicious login activity

## 2. Default sample domain

The repository now uses:

```toml
BASE_DOMAIN = "example.com"
```

Replace it before production:

```toml
BASE_DOMAIN = "yourdomain.com"
```

## 3. Important configuration

Main file: [wrangler.toml](./wrangler.toml)

Password bootstrap supports two modes:

1. `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`  
Fastest for local testing, demos, and dashboard-first deployment.

2. `BOOTSTRAP_ADMIN_PASSWORD_HASH`  
Better if you do not want to store plain text in config.

If both are filled, the hash wins.

## 4. Local run

Install dependencies:

```bash
npm install
```

Apply local migrations:

```bash
npx wrangler d1 migrations apply private-mailbox-pool --local
```

Start dev server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:8787/login
```

## 5. Dashboard-first deployment

1. Upload the repo to GitHub.
2. Create a D1 database in Cloudflare.
3. Create an R2 bucket in Cloudflare.
4. Edit [wrangler.toml](./wrangler.toml) in GitHub:
   - keep `BASE_DOMAIN = "example.com"` for a public template, or set your real domain only if the repository is private
   - set the real `database_id`
   - set `BOOTSTRAP_ADMIN_USERNAME`
   - optionally set `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`
5. Import the GitHub repo in `Workers & Pages`.
6. Verify bindings:
   - D1 binding name: `DB`
   - R2 binding name: `MAIL_BUCKET`
7. Add production variables/secrets in Cloudflare Dashboard:
   - `BASE_DOMAIN` as a plain variable
   - `CLOUDFLARE_ZONE_ID` as a plain variable
   - `CLOUDFLARE_API_TOKEN` as a secret
   - `BOOTSTRAP_ADMIN_PASSWORD_PLAIN` or `BOOTSTRAP_ADMIN_PASSWORD_HASH` as a secret
8. Apply migrations.
9. Open `/login` and sign in.

If you do not want to commit a plain password, keep the password field empty in the repo and add a Cloudflare Secret after the Worker is created.

## 6. CLI deployment

Login:

```bash
npx wrangler login
```

Create D1:

```bash
npx wrangler d1 create private-mailbox-pool
```

Create R2:

```bash
npx wrangler r2 bucket create private-mailbox-pool-mail
```

Apply remote migrations:

```bash
npx wrangler d1 migrations apply private-mailbox-pool --remote
```

Deploy:

```bash
npm run deploy
```

Generate a password hash if needed:

```bash
npm run hash:password -- "your-password"
```

## 7. Email routing

Worker deployment alone is not enough for inbound mail. You still need domain DNS and Cloudflare Email Routing configured correctly.

Check:

- [Chinese checklist](./docs/zh/cloudflare-email-routing-checklist.md)
- [English checklist](./docs/en/cloudflare-email-routing-checklist.md)

## 8. Security notes

- Do not leave a real production password in GitHub long term.
- Do not commit a real Cloudflare API token, Zone ID, or private domain-specific value unless you are comfortable making it public.
- Change the admin password immediately after first sign-in.
- Prefer Cloudflare Secret for production credentials.
- Put Cloudflare Access in front of the admin panel when possible.

## 9. Extra docs

- [Docs index](./docs/README.md)
- [Schema](./docs/schema.sql)
- [Migration 0001](./migrations/0001_initial.sql)
- [Chinese dashboard deployment guide](./docs/zh/cloudflare-dashboard-deploy-step-by-step.md)

## 10. Official references

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Cloudflare Email Routing Docs](https://developers.cloudflare.com/email-routing/)
- [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)

</details>
