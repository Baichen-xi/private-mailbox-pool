# API 文档

本文档记录当前 Worker 已实现的真实接口。除下载接口外，响应均为 JSON。管理接口都需要登录后的会话 Cookie。

## 通用错误

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "当前无法继续"
  }
}
```

## 认证

### `POST /api/auth/login`

请求：

```json
{
  "username": "admin",
  "password": "plain-text-password"
}
```

成功 `200`，并返回 `Set-Cookie`：

```json
{
  "ok": true,
  "session": {
    "expiresAt": "2026-05-07T08:00:00.000Z"
  }
}
```

### `POST /api/auth/logout`

退出当前会话。

### `GET /api/session`

返回当前是否已登录，以及 Cloudflare Access 是否启用。

## 仪表盘与管理员

### `GET /api/dashboard`

返回邮箱数量、未读邮件、可用子域名和最近安全提醒。

### `GET /api/admin/overview`

返回管理员账号、会话、登录尝试、异常 IP 和健康检查信息。

### `POST /api/admin/password`

修改当前管理员密码。

### `POST /api/admin/sessions/:id/revoke`

强制下线指定会话。

### `POST /api/admin/login-attempts/clear`

请求：

```json
{ "ipAddress": "203.0.113.10" }
```

清理该 IP 的失败登录记录。

## 子域名池

### `GET /api/subdomains`

返回子域名列表与汇总。

### `POST /api/subdomains/generate`

生成随机或自定义子域名。

```json
{
  "count": 20,
  "labelLength": 4,
  "customLabels": "vip\nregister"
}
```

### `POST /api/subdomains/:id/verification`

手动标记子域名状态。

```json
{ "verificationStatus": "verified" }
```

可选值：`verified`、`unverified`、`invalid`。

### `POST /api/subdomains/:id/verify`

自动检测该子域名的 DNS MX。检测到 Cloudflare Email Routing MX 时，会继续尝试使用 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ZONE_ID` 检查区域 Email Routing 配置。

如果没有配置 Cloudflare API 变量，会退回为公开 DNS 检测：Cloudflare MX 记为 `verified`；无 MX 记为 `invalid`；非 Cloudflare MX 记为 `unverified`。

### `POST /api/subdomains/verify-all`

批量检测当前子域名池。每个结果会返回 `verificationStatus`、`mxRecords`、`routingDetected` 和 `apiChecked`。

### `POST /api/subdomains/:id/delete`

删除指定子域名；若其下有邮箱，会连同邮箱及相关存储一起删除。

### `POST /api/subdomains/delete-all`

只删除未被邮箱使用的子域名。

## 邮箱分组

### `GET /api/mailbox-groups`

返回所有分组及每个分组的活跃邮箱数量。

### `POST /api/mailbox-groups`

创建分组。

```json
{
  "name": "registrations",
  "color": "#156f5b"
}
```

### `POST /api/mailbox-groups/:id`

重命名分组或修改颜色。

```json
{
  "name": "banking",
  "color": "#7c3aed"
}
```

### `POST /api/mailbox-groups/:id/delete`

删除空分组。若分组下仍有邮箱，会返回 `MAILBOX_GROUP_NOT_EMPTY`。

## 邮箱

### `GET /api/mailboxes`

返回邮箱列表和汇总。列表包含 `groupId`、`groupName`、`groupColor`、`status`、`note`、`totalEmailCount`。

### `POST /api/mailboxes`

创建邮箱。`subdomainId` 为空时使用随机子域名池，`candidateSubdomainId` 可用于前端传入当前候选域名。

```json
{
  "subdomainId": "",
  "candidateSubdomainId": "subdomain-id",
  "groupId": "group-id",
  "localPartMode": "custom",
  "localPart": "hello",
  "note": "GitHub signup"
}
```

如果同地址邮箱之前被软删除，再次创建会恢复原邮箱和原邮件。

### `GET /api/mailboxes/:id`

返回邮箱详情。

### `POST /api/mailboxes/:id/metadata`

更新备注和分组。

```json
{
  "note": "new note",
  "groupId": "group-id"
}
```

### `POST /api/mailboxes/:id/status`

暂停或恢复收信。

```json
{ "status": "paused" }
```

可选值：`active`、`paused`、`archived`。只有 `active` 会接收新邮件。

### `POST /api/mailboxes/:id/note`

仅更新备注。

### `POST /api/mailboxes/:id/delete`

删除邮箱。无邮件邮箱会硬删除；有邮件邮箱会软删除，后续重新创建同地址时可恢复邮件。

### `POST /api/mailboxes/cleanup-empty`

硬删除所有无邮件邮箱。

## 邮件

### `GET /api/mailboxes/:id/emails`

返回某邮箱下的邮件列表。

### `GET /api/mailboxes/:id/emails/:emailId`

返回邮件详情，包含文本正文、安全 HTML 预览、附件下载链接。

### `POST /api/mailboxes/:id/emails/mark-read`

批量标记已读。

```json
{ "emailIds": ["email-id"] }
```

### `POST /api/mailboxes/:id/emails/delete`

批量软删除邮件。

### `GET /api/mailboxes/:id/emails/:emailId/raw`

下载原始 `.eml`。

### `GET /api/mailboxes/:id/emails/:emailId/attachments/:attachmentId`

下载附件。

### `GET /api/mailboxes/:id/emails/:emailId/attachments/:attachmentId/preview`

预览可显示的图片附件。

## 维护

### `POST /api/maintenance/run`

手动执行生产维护任务：清理过期邮件、归档旧软删除邮箱、扫描 R2 孤儿文件样本。生产环境也会通过 `wrangler.toml` 中的 Cron 每天自动执行。

## 健康检查

### `GET /health`

返回服务是否存活。
