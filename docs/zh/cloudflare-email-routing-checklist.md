# Cloudflare Email Routing 联调清单

这份清单用于 Worker `email()` 收信入口接好之后，进行第一轮完整联调。

## 当前已经具备的收信能力

现在这套 Worker 已经可以：

- 通过 `email()` 接收来信
- 按收件地址匹配已有邮箱
- 拒收不存在或已停用的邮箱
- 将原始 `.eml` 写入 R2
- 在有内容时将解析后的文本正文和 HTML 正文写入 R2
- 将邮件元数据写入 D1
- 将附件元数据写入 D1，并把附件文件写入 R2
- 自动更新邮箱总邮件数、未读数、最后收信时间

## 本地开发测试

Cloudflare 官方支持通过 Wrangler 在本地测试 `email()`。

1. 启动本地开发：

```bash
npm run dev
```

2. 先在页面里创建一个邮箱，例如：

```text
demo@alpha.example.com
```

3. 向 Wrangler 的本地邮件入口发送一封原始邮件：

```bash
curl -X POST "http://localhost:8787/cdn-cgi/handler/email?from=sender@example.com&to=demo@alpha.example.com" \
  -H "content-type: application/json" \
  --data-binary @sample.eml
```

4. 刷新邮箱详情页，确认：

- 邮件总数增加
- 未读数增加
- 最后收信时间更新
- 收件箱中出现对应邮件

## Cloudflare 正式联调清单

### 1. Worker 与存储

- 创建 D1 数据库
- 创建 R2 Bucket
- 在 `wrangler.toml` 中填入真实 D1 database id
- 部署 Worker
- 对远程 D1 执行 migration

### 2. 域名与 Email Routing

- 域名已经托管在 Cloudflare
- 该 Zone 已开启 Email Routing
- Cloudflare Email Routing 需要的 MX 记录已经生效
- Cloudflare Email Routing 需要的 SPF 记录已经生效

### 3. 将邮件路由到 Worker

你可以选择以下几种方式之一：

- 根域名 catch-all
- 根域名下的指定地址
- 你明确支持的子域名地址

按这个项目当前模型，建议只把你真正打算开放的域名和子域名接入，不要一开始就把所有入口都放开。

### 4. 应用配置

- `BASE_DOMAIN` 与生产域名一致
- `CLOUDFLARE_ZONE_ID` 已作为普通变量添加
- `CLOUDFLARE_API_TOKEN` 已作为 Secret 添加，权限至少包含 Zone Read、DNS Read、Email Routing Rules Read
- `BOOTSTRAP_ADMIN_PASSWORD_HASH` 已存入 Cloudflare Secret
- 生产环境前面已经加上 Cloudflare Access

### 5. 第一轮真实收信测试

1. 在页面中创建一个邮箱。
2. 用 Gmail、QQ 邮箱、Outlook 或其他外部邮箱发一封测试邮件。
3. 确认邮件进入对应收件箱。
4. 确认 R2 中有原始邮件对象。
5. 确认 D1 中有对应邮件记录。

## 推荐第一轮验证矩阵

- 活跃邮箱可以正常收信
- 不存在的邮箱会被拒收
- 已暂停邮箱会被拒收
- 同一发件人可以连续向同一邮箱发送多封邮件
- 可复用子域名下的多个邮箱都能被正确匹配

## 这一步之后仍然待完成的内容

这些内容不会阻塞第一轮收信联调，但仍然是后续主线：

- 邮件详情页
- 附件下载界面
- HTML 渲染前的安全清洗
- 已读 / 未读操作
- 对临时性失败更完善的重试与兜底机制
