# Cloudflare 网页端部署教程（适合小白）

这份教程的目标很简单：

- 把代码放到 GitHub
- 让 Cloudflare 自动把这个项目部署成 Worker
- 在 Cloudflare 后台创建 D1 和 R2
- 配好管理员初始密码
- 接通域名收信
- 最后用你自己的真实邮箱发一封测试邮件，确认整套系统能跑通

整份教程尽量走网页端。你只需要在本机用一次 PowerShell，把项目上传到 GitHub。之后的大部分操作都在 Cloudflare 网页后台完成。

## 一、先理解这套项目是怎么工作的

你可以把它理解成 5 个部分一起协作：

1. `GitHub`
   - 存放项目代码
   - Cloudflare 从这里读取代码并自动部署

2. `Cloudflare Worker`
   - 相当于你的网站后台程序
   - 负责登录、邮箱管理、邮件列表、邮件详情、收信入口

3. `D1`
   - 相当于数据库
   - 存管理员、邮箱、子域名、邮件元数据、会话、审计日志等

4. `R2`
   - 相当于文件仓库
   - 存原始 `.eml` 邮件、HTML 正文、纯文本正文、附件

5. `Cloudflare Email Routing / Email Service`
   - 把外部邮件转交给 Worker 的 `email()` 入口
   - 比如别人发邮件到 `demo@alpha.example.com`，Cloudflare 会把这封邮件交给你的 Worker 处理

## 二、你需要提前准备什么

开始之前，请确认你已经有下面这些东西：

1. 一个 `GitHub` 账号
2. 一个 `Cloudflare` 账号
3. 一个已经接入 `Cloudflare DNS` 的域名
4. 本地项目目录：

```text
C:\Users\zero\Documents\New project
```

5. 本机已经安装：
   - `Git`
   - `Node.js`

如果你之前已经能在本地打开项目页面，比如：

```text
http://127.0.0.1:8787/login
```

那说明本地基础环境大概率已经没问题了。

## 三、先把代码上传到 GitHub

这一步只需要在你电脑上的 `PowerShell` 里操作。

### 1. 打开 PowerShell

你可以这样打开：

- 在 Windows 开始菜单里搜索 `PowerShell`
- 打开后进入项目目录

执行：

```powershell
cd "C:\Users\zero\Documents\New project"
```

### 2. 在 GitHub 网页创建一个空仓库

进入 GitHub 网站后：

1. 登录 GitHub
2. 点击右上角 `+`
3. 选择 `New repository`
4. 仓库名可以填写：

```text
private-mailbox-pool
```

5. 建议选择：
   - `Private`
6. 不要勾选：
   - `Add a README file`
   - `.gitignore`
   - `license`

然后点击 `Create repository`

### 3. 回到 PowerShell，把本地项目推送到 GitHub

执行下面这些命令：

```powershell
cd "C:\Users\zero\Documents\New project"
git init
git add .
git commit -m "Initial import for Cloudflare deployment"
git branch -M main
git remote add origin https://github.com/你的GitHub用户名/private-mailbox-pool.git
git push -u origin main
```

把这行里的地址改成你自己的：

```text
https://github.com/你的GitHub用户名/private-mailbox-pool.git
```

### 4. 如果提示 `remote origin already exists`

说明你之前已经绑过远程仓库，不用慌，执行：

```powershell
git remote set-url origin https://github.com/你的GitHub用户名/private-mailbox-pool.git
git push -u origin main
```

上传成功后，刷新 GitHub 仓库页面，你应该能看到完整项目文件。

## 四、先在 GitHub 网页里改好 `wrangler.toml`

Cloudflare 后面会按这个文件里的配置来部署。

在 GitHub 仓库页面找到：

```text
wrangler.toml
```

点击编辑，重点确认下面这些内容。

### 1. `BASE_DOMAIN`

把它改成你的主域名。例如你的域名是：

```text
example.com
```

那就改成：

```toml
BASE_DOMAIN = "example.com"
```

不要带：

- `https://`
- 路径
- 邮箱名前缀

只写裸域名。

### 2. D1 数据库占位符

你会看到类似：

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

这里现在先不用乱填。等会儿我们在 Cloudflare 后台创建 D1 之后，把真实的 `Database ID` 再填回来。

### 3. R2 bucket 名称

默认是：

```toml
bucket_name = "private-mailbox-pool-mail"
```

后面你在 Cloudflare 创建 R2 bucket 时，名字最好就用这个，省得来回改。

### 4. `[[send_email]]`

当前项目主要用的是 `email()` 收信入口。这个 `[[send_email]]` 目前不是这条主线的核心配置。

所以你现在可以这样理解：

- 如果 Cloudflare 后台不报错，就先保留
- 如果后续 Cloudflare 对这个配置有额外要求，再按后台提示调整

不用在这一步卡住。

## 五、在 Cloudflare 网页后台创建 D1 数据库

接下来全部进入 Cloudflare 网页后台操作。

### 1. 创建 D1

大致路径通常是：

1. 登录 Cloudflare
2. 左侧进入 `Storage & Databases`
3. 点击 `D1`
4. 点击 `Create database`

数据库名称建议直接填：

```text
private-mailbox-pool
```

创建完成后，进入这个数据库详情页。

### 2. 复制 Database ID

在 D1 数据库详情页里，找到它的 `Database ID`，复制下来。

### 3. 回到 GitHub 修改 `wrangler.toml`

把：

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

改成真实 ID，例如：

```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

保存提交到 GitHub。

## 六、在 Cloudflare 后台初始化数据库表

创建 D1 只是建了一个空数据库，还没有表结构。你必须把项目里的初始化 SQL 执行进去。

### 1. 打开本地文件

找到项目里的文件：

```text
migrations/0001_initial.sql
```

用编辑器打开它，复制里面全部内容。

### 2. 回到 Cloudflare D1 后台执行 SQL

在 Cloudflare 的 D1 数据库页面里，找到类似下面的入口：

- `Console`
- `Query`
- `Run SQL`

不同时间 Cloudflare 的按钮名字可能稍有变化，但核心意思一样，就是能执行 SQL 的地方。

把 `0001_initial.sql` 的全部内容粘进去，然后执行。

如果你是从零部署，继续按顺序执行：

- `migrations/0002_unique_mailbox_subdomain.sql`
- `migrations/0003_reuse_subdomains.sql`
- `migrations/0004_mailbox_groups_and_domain_health.sql`
- `migrations/0005_mail_block_rules.sql`

### 3. 为什么这一步必须做

因为这个 SQL 会创建项目需要的所有核心表，比如：

- `admins`
- `sessions`
- `subdomains`
- `mailboxes`
- `emails`
- `attachments`
- `login_attempts`
- `rate_limit_buckets`
- `audit_logs`

如果你不执行这一步，后面网页可以部署出来，但登录、建邮箱、收邮件都会报错。

## 七、在 Cloudflare 后台创建 R2 Bucket

### 1. 创建 R2

大致路径通常是：

1. 左侧进入 `Storage & Databases`
2. 点击 `R2`
3. 点击 `Create bucket`

Bucket 名称建议直接填写：

```text
private-mailbox-pool-mail
```

这要和 `wrangler.toml` 里的：

```toml
bucket_name = "private-mailbox-pool-mail"
```

保持一致。

### 2. 这一步的作用

R2 用来存这些内容：

- 原始邮件 `.eml`
- 纯文本正文
- HTML 正文
- 附件

如果 R2 没建好，邮件就算进来了，也没法完整保存。

## 八、用 Cloudflare 网页端从 GitHub 部署 Worker

这一步是整个教程最关键的一步。

### 1. 进入 Workers & Pages

在 Cloudflare 后台中，进入：

- `Workers & Pages`

### 2. 创建项目

常见路径通常类似：

1. 点击 `Create`
2. 选择 `Import a repository`

如果 Cloudflare 页面样式和按钮名字有变化，你只要抓住一个原则：

- 目标是“从 GitHub 仓库导入并自动构建 Worker”

### 3. 连接 GitHub

如果是第一次使用，Cloudflare 会让你授权 GitHub。

按页面提示完成授权，然后选择你的仓库：

```text
private-mailbox-pool
```

### 4. 选择分支

通常选择：

```text
main
```

### 5. 根目录怎么填

因为这个项目本身就在仓库根目录，所以根目录一般保持默认即可，也就是仓库根目录。

### 6. 注意：这是 Worker，不是静态 Pages

这个项目不是纯前端站点，它需要：

- Worker 代码执行
- D1 数据库绑定
- R2 Bucket 绑定
- `email()` 收信入口

所以你要把它当成 `Worker 项目` 来部署，而不是普通静态页面项目。

## 九、在 Cloudflare 项目后台配置变量、密钥和绑定

仓库导入只是第一步。真正能不能跑起来，取决于配置是否填完整。

部署项目创建好后，进入这个 Worker 项目的设置页面。

### 1. 添加普通变量（Variables）

把下面这些变量按项目当前配置填进去：

```text
APP_NAME = Private Mailbox Pool
BASE_DOMAIN = 你的主域名
CLOUDFLARE_ZONE_ID = 你的区域 ID
COOKIE_NAME = pmp_session
SESSION_TTL_HOURS = 24
MAX_LOGIN_FAILURES = 10
LOGIN_BLOCK_MINUTES = 15
CF_ACCESS_ENABLED = false
BOOTSTRAP_ADMIN_USERNAME = admin
```

其中最关键的是：

- `BASE_DOMAIN`
  - 必须和你的真实域名一致
- `CLOUDFLARE_ZONE_ID`
  - 填区域 ID，不是账户 ID
  - 用于后台检测 DNS 和 Email Routing 状态
- `BOOTSTRAP_ADMIN_USERNAME`
  - 建议先直接填 `admin`

### 2. 添加密钥（Secrets）

这次项目已经支持你直接填写明文初始密码，所以你不用先手动算哈希。

在 Secrets 中添加：

```text
BOOTSTRAP_ADMIN_PASSWORD_PLAIN = 你的初始管理员密码
CLOUDFLARE_API_TOKEN = 你创建的只读 API Token
```

例如：

```text
BOOTSTRAP_ADMIN_PASSWORD_PLAIN = MyStrongPassword123!
```

这样第一次登录时，系统会自动把这个明文密码转换成哈希并写入管理员账户。

`CLOUDFLARE_API_TOKEN` 用于后台检测 Email Routing 配置。这个值只显示一次，不要发到聊天里，也不要写进 GitHub。

### 3. 关于 `BOOTSTRAP_ADMIN_PASSWORD_HASH`

如果你以后更喜欢哈希模式，也可以改用：

```text
BOOTSTRAP_ADMIN_PASSWORD_HASH
```

但对现在这个网页端部署教程来说，推荐你先用：

```text
BOOTSTRAP_ADMIN_PASSWORD_PLAIN
```

更省事，也更适合小白。

注意规则：

- 如果你同时设置了 `BOOTSTRAP_ADMIN_PASSWORD_HASH`
- 又设置了 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`

那么系统会优先使用：

```text
BOOTSTRAP_ADMIN_PASSWORD_HASH
```

### 4. 配置 D1 绑定

在项目绑定里添加 D1：

- Binding name:

```text
DB
```

- 绑定到你刚才创建的：

```text
private-mailbox-pool
```

### 5. 配置 R2 绑定

在项目绑定里添加 R2：

- Binding name:

```text
MAIL_BUCKET
```

- 绑定到你刚才创建的 Bucket：

```text
private-mailbox-pool-mail
```

### 6. 保存后重新部署

有些 Cloudflare 配置保存后会自动触发一次新部署，有些场景需要你手动点一次重新部署。

如果你不确定，最稳妥的做法是：

- 保存完配置
- 手动再触发一次 Deploy

这样可以确保新变量和绑定都真的生效。

## 十、第一次登录测试

部署成功后，打开 Cloudflare 给你的 Worker 地址。

你会看到登录页。

### 登录信息

用户名：

```text
admin
```

密码：

```text
你在 BOOTSTRAP_ADMIN_PASSWORD_PLAIN 里填写的那个密码
```

### 第一次登录时系统会做什么

当前项目的逻辑是：

1. 先检查 D1 里有没有这个 bootstrap admin
2. 如果没有
3. 且你已经设置了初始密码
4. 系统会自动创建这个管理员账户

所以你不需要先去后台手动插一条管理员数据。

## 十一、接通 Cloudflare 收信能力

到这里为止，你的网站和后台基本已经能打开了。但“能打开页面”不等于“能收邮件”。

要真正收信，你还需要把域名邮件路由接进来。

### 1. 确保域名已经托管在 Cloudflare

如果你的域名 DNS 还不在 Cloudflare，这一步先不要继续，因为 Email Routing / Email Service 依赖 Cloudflare 对域名的控制。

### 2. 进入 Email Routing 或 Email Service

Cloudflare 近年的功能命名有调整，你在后台里可能会看到：

- `Email Routing`
- `Email`
- `Email Service`

只要是管理域名收信、路由、把邮件交给 Worker 的地方，就是我们要找的位置。

### 3. 按 Cloudflare 提示补齐 DNS 记录

Cloudflare 通常会要求你完成这些配置：

- `MX`
- `SPF`
- 可能还包括其他邮件相关记录

很多情况下后台会直接给出“需要添加什么记录”，你按提示操作就行。

### 4. 等待 DNS 生效

DNS 改动不是瞬间全球生效，通常需要等待一段时间。

有时候几分钟就好了，有时候可能要更久。

如果后面你发现页面没报错，但就是收不到邮件，先不要急，第一反应应该是：

- 检查 DNS 是否已经生效

## 十二、在系统里先创建一个测试邮箱

接下来不要一上来就做全量路由，先做最小测试。

例如你先在系统里创建一个邮箱：

```text
demo@alpha.example.com
```

这里：

- `demo` 是邮箱前缀
- `alpha.example.com` 是子域名

先只验证这一个地址能不能收进来。

## 十三、在 Cloudflare 后台创建邮件路由规则

建议第一轮联调时，不要直接上全域 catch-all。

最稳妥的做法是：

- 先给一个具体地址建路由

例如只把：

```text
demo@alpha.example.com
```

这一个地址交给 Worker。

### 为什么不建议一开始就用 catch-all

因为如果你一开始就把整个域名全部放开：

- 一旦规则写错
- 一旦邮箱匹配逻辑理解错
- 一旦有垃圾邮件打进来

你会很难排查问题。

先用单地址测试，跑通之后，再考虑是否扩大范围。

## 十四、发送第一封真实测试邮件

现在你可以用外部邮箱给刚才的测试地址发一封邮件。

例如：

- Gmail
- QQ 邮箱
- Outlook

发到：

```text
demo@alpha.example.com
```

测试时建议你发三种内容：

1. 一封纯文本邮件
2. 一封 HTML 邮件
3. 一封带图片或附件的邮件

这样能一次性验证更多功能。

## 十五、回到系统里检查是否真的收到了

进入你的应用后台，检查下面这些地方：

1. 仪表盘总数是否变化
2. 邮箱详情页里是否出现新邮件
3. 未读数是否增加
4. 最后收信时间是否更新
5. 邮件详情是否能打开
6. HTML 邮件是否能安全显示
7. 附件是否可以下载
8. 原始 `.eml` 是否能查看或下载

如果这些都正常，说明主链路已经通了。

## 十六、推荐你第一次联调时的最小成功标准

你不需要一开始就把所有功能全测完。第一轮只要满足下面这些，就算部署成功了：

1. 页面能打开
2. 能用 `admin` 登录
3. 能创建邮箱
4. 外部邮箱发来的邮件能进入指定邮箱
5. 邮件列表能显示出来
6. 邮件详情能打开
7. 附件或 HTML 至少有一种能正常查看

做到这里，你就已经不是“部署失败”，而是“主链路已打通，后面进入优化阶段”。

## 十七、最常见的报错排查

这里是最容易踩坑的地方，我按“小白最常见问题”给你列出来。

### 1. 页面能打开，但登录失败

先检查：

- 是否设置了 `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`
- 是否设置了 `BOOTSTRAP_ADMIN_USERNAME=admin`
- D1 表是否已经初始化

如果你没执行 `migrations/0001_initial.sql`，管理员表都不存在，登录肯定不行。

### 2. 登录页正常，但进入后台报数据库错误

先检查：

- D1 绑定名是不是 `DB`
- 绑定的数据库是不是你刚才创建的那个
- `wrangler.toml` 里的 `database_id` 是否已经换成真实 ID

### 3. 邮件收不到

先检查：

- `BASE_DOMAIN` 是否正确
- 邮箱地址是否真的存在于系统中
- Cloudflare 邮件路由规则是否写对
- DNS 的 `MX / SPF` 是否已经生效
- 邮件是不是发到了错误地址

### 4. 邮件进来了，但正文或附件不完整

先检查：

- R2 bucket 是否已经创建
- R2 绑定名是不是 `MAIL_BUCKET`
- 绑定的 bucket 名称是否和 `wrangler.toml` 一致

### 5. 明明改了配置，但线上还是旧效果

这通常说明：

- 你改的是 GitHub 文件，但 Cloudflare 还没重新部署
- 或者你改的是 Variables / Secrets，但没有触发新部署

最稳妥的做法是：

- 保存配置后，手动再部署一次

### 6. 子域名和真实收件地址对不上

这个项目现在是“先在系统里有邮箱，再让 Cloudflare 把对应地址的邮件转进来”的思路。

所以你要保证三件事完全一致：

1. 系统里创建的邮箱地址
2. Cloudflare 路由规则里的目标地址
3. 你外部邮箱实际发送的地址

只要三者有一个拼错，就收不到。

## 十八、我建议你的实际部署顺序

如果你想把风险降到最低，建议严格按这个顺序走：

1. 本地项目确认能启动
2. 上传 GitHub
3. 在 GitHub 改 `wrangler.toml`
4. 在 Cloudflare 创建 D1
5. 在 Cloudflare 执行初始化 SQL
6. 在 Cloudflare 创建 R2
7. 从 GitHub 导入并部署 Worker
8. 在 Cloudflare 配 Variables / Secrets / Bindings
9. 先测试 `admin` 登录
10. 再配置 Email Routing / Email Service
11. 只用一个邮箱地址做首轮收信测试
12. 收信成功后，再扩大到更多邮箱和更多子域名

这个顺序的好处是：每一步都能单独验证，出了问题也更容易定位。

## 十九、这份教程对应的官方文档

如果你在 Cloudflare 后台看到的按钮名字和这份教程略有不同，不用紧张，优先参考下面这些官方文档：

- Workers Builds:
  - [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- D1:
  - [Cloudflare D1](https://developers.cloudflare.com/d1/)
  - [D1 Get started](https://developers.cloudflare.com/d1/get-started/)
- R2:
  - [Create R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/)
- Email Service / Email Routing:
  - [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
  - [Route emails to your Worker](https://developers.cloudflare.com/email-service/get-started/route-emails/)
  - [Routing addresses](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)
  - [Email Routing overview](https://developers.cloudflare.com/email-routing/)

## 二十、部署完成后你下一步该做什么

当你完成这份教程后，建议下一步按下面顺序继续：

1. 先只部署测试环境，不要直接当生产环境长期使用
2. 用 1 到 3 个邮箱地址反复测试真实收信
3. 检查 HTML 邮件、图片、附件、原始 `.eml` 的展示是否符合预期
4. 再决定是否开启更大范围的路由规则
5. 最后再补安全加固，比如 Cloudflare Access、限流、日志审计、管理员密码轮换

如果你现在的目标只是“先能在 Cloudflare 上真实收一封邮件”，那你看完这份教程后，已经具备直接开干的条件了。
