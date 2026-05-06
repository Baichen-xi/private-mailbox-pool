# API 契约

本文档定义私有邮箱池 MVP 的 HTTP 接口契约。所有接口均由 Cloudflare Worker 在 `/api` 路径下提供。

## 约定

- 除特别说明外，响应体均为 JSON。
- 时间戳使用 ISO 8601 UTC 字符串。
- ID 使用 ULID 或 UUIDv7。
- 管理员认证请求使用安全的会话 Cookie。
- 邮箱令牌请求使用 `Authorization: Bearer <token>`。
- 所有错误统一使用以下结构：

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username or password is incorrect."
  }
}
```

## 认证

### `POST /api/auth/login`

认证管理员并创建会话。

请求：

```json
{
  "username": "admin",
  "password": "plain-text-password"
}
```

成功 `200`：

```json
{
  "ok": true,
  "session": {
    "expiresAt": "2026-05-07T08:00:00Z"
  }
}
```

失败码：
- `INVALID_CREDENTIALS`
- `LOGIN_BLOCKED`
- `RATE_LIMITED`

### `POST /api/auth/logout`

撤销当前会话。

成功 `200`：

```json
{ "ok": true }
```

### `GET /api/session`

返回当前管理员会话和顶层权限信息。

成功 `200`：

```json
{
  "authenticated": true,
  "admin": {
    "id": "01J...",
    "username": "admin"
  },
  "security": {
    "cloudflareAccessRequired": true
  }
}
```

## 仪表盘

### `GET /api/dashboard`

返回顶层统计信息和最近事件。

成功 `200`：

```json
{
  "stats": {
    "mailboxCount": 12,
    "activeMailboxCount": 10,
    "unreadEmailCount": 8,
    "availableSubdomainCount": 34
  },
  "recentEmails": [
    {
      "id": "01J...",
      "mailboxId": "01J...",
      "subject": "Verify your account",
      "fromAddress": "noreply@example.org",
      "receivedAt": "2026-05-06T09:32:12Z"
    }
  ],
  "securityAlerts": [
    {
      "id": "01J...",
      "level": "warning",
      "message": "5 failed login attempts from 1 IP in the last hour."
    }
  ]
}
```

## 邮箱

### `GET /api/mailboxes`

返回分页后的邮箱列表。

查询参数：
- `q`
- `status`
- `cursor`
- `limit`

成功 `200`：

```json
{
  "items": [
    {
      "id": "01J...",
      "localPart": "hello",
      "fullAddress": "hello@a1b2.example.com",
      "status": "active",
      "note": "GitHub signup",
      "retentionMode": "keep_forever",
      "lastReceivedAt": "2026-05-06T09:32:12Z",
      "totalEmailCount": 14,
      "unreadEmailCount": 2,
      "createdAt": "2026-05-01T08:00:00Z"
    }
  ],
  "nextCursor": null
}
```

### `POST /api/mailboxes`

创建邮箱并分配一个可用子域名。

请求：

```json
{
  "localPartMode": "custom",
  "localPart": "hello",
  "note": "GitHub signup",
  "retentionMode": "keep_forever",
  "retentionDays": null
}
```

规则：
- `localPartMode` 只能是 `random` 或 `custom`。
- 若为 `custom`，则必须提供 `localPart`。
- 系统会自动分配下一个可用子域名。

成功 `201`：

```json
{
  "mailbox": {
    "id": "01J...",
    "fullAddress": "hello@a1b2.example.com",
    "status": "active"
  }
}
```

失败码：
- `NO_SUBDOMAIN_AVAILABLE`
- `LOCAL_PART_TAKEN`
- `INVALID_LOCAL_PART`
- `RATE_LIMITED`

### `GET /api/mailboxes/:id`

返回单个邮箱及其当前子域名元数据。

### `PATCH /api/mailboxes/:id`

更新邮箱元数据。

请求：

```json
{
  "status": "paused",
  "note": "Do not use this week",
  "retentionMode": "delete_after_days",
  "retentionDays": 30
}
```

### `DELETE /api/mailboxes/:id`

软删除邮箱。R2 中的原始对象会保留到后台清理任务完成。

成功 `200`：

```json
{ "ok": true }
```

### `POST /api/mailboxes/:id/tokens`

为邮箱创建只读或读写访问令牌。

请求：

```json
{
  "tokenName": "Desktop viewer",
  "scope": "read",
  "expiresAt": null
}
```

成功 `201`：

```json
{
  "token": {
    "id": "01J...",
    "plainText": "mbx_live_...",
    "scope": "read"
  }
}
```

## 邮件

### `GET /api/mailboxes/:id/emails`

返回某个邮箱下分页后的邮件摘要列表。

查询参数：
- `cursor`
- `limit`
- `q`
- `unreadOnly`

成功 `200`：

```json
{
  "items": [
    {
      "id": "01J...",
      "subject": "Verify your account",
      "fromName": "GitHub",
      "fromAddress": "noreply@github.com",
      "receivedAt": "2026-05-06T09:32:12Z",
      "isRead": false,
      "hasAttachments": false,
      "textPreview": "Please verify your email address..."
    }
  ],
  "nextCursor": null
}
```

### `GET /api/emails/:id`

返回单封邮件及清洗后的内容引用。

成功 `200`：

```json
{
  "email": {
    "id": "01J...",
    "mailboxId": "01J...",
    "subject": "Verify your account",
    "fromName": "GitHub",
    "fromAddress": "noreply@github.com",
    "toAddress": "hello@a1b2.example.com",
    "receivedAt": "2026-05-06T09:32:12Z",
    "isRead": false,
    "textBody": "Please verify your email address...",
    "htmlBody": "<p>Please verify your email address...</p>",
    "headers": {
      "message-id": "<...>"
    },
    "attachments": [
      {
        "id": "01J...",
        "filename": "invoice.pdf",
        "contentType": "application/pdf",
        "sizeBytes": 10240
      }
    ]
  }
}
```

### `PATCH /api/emails/:id/read`

将邮件标记为已读或未读。

请求：

```json
{
  "isRead": true
}
```

### `DELETE /api/emails/:id`

软删除单封邮件。

### `GET /api/emails/:id/raw`

下载原始 `.eml` 内容。

响应：
- `200 text/plain` 或 `message/rfc822`

### `GET /api/emails/:id/attachments/:attachmentId`

从 R2 流式返回单个附件。

响应：
- `200`，返回附件字节流

## 子域名

### `GET /api/subdomains`

返回当前子域名池。

查询参数：
- `status`
- `cursor`
- `limit`

### `POST /api/subdomains/generate`

批量生成子域名并写入池中。

请求：

```json
{
  "count": 50,
  "labelLength": 4
}
```

成功 `201`：

```json
{
  "createdCount": 50
}
```

### `PATCH /api/subdomains/:id`

允许禁用或保留某个子域名。

请求：

```json
{
  "status": "disabled",
  "note": "Used by a service that blocked it"
}
```

### `POST /api/subdomains/rebalance`

确保子域名池中的可用数量不少于配置的最小值。

## 设置

### `GET /api/settings`

返回按分组整理后的应用设置。

### `PATCH /api/settings`

仅更新允许修改的设置项。

请求：

```json
{
  "mail": {
    "allowCustomLocalPart": true,
    "maxAttachmentSizeMb": 10
  },
  "security": {
    "maxLoginFailures": 10,
    "loginBlockMinutes": 15
  }
}
```

## 审计日志

### `GET /api/audit-logs`

返回分页后的审计事件。

查询参数：
- `action`
- `targetType`
- `cursor`
- `limit`

成功 `200`：

```json
{
  "items": [
    {
      "id": "01J...",
      "action": "mailbox.created",
      "actorType": "admin",
      "actorId": "01J...",
      "targetType": "mailbox",
      "targetId": "01J...",
      "ipAddress": "203.0.113.8",
      "createdAt": "2026-05-06T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```

## 仅供 Worker 使用的入站邮件流程

### `email(message, env, ctx)`

这不是公开 HTTP 接口。Cloudflare Email Routing 会通过该入口把入站邮件交给 Worker。

必需处理步骤：

1. 根据 `to` 地址解析出目标邮箱。
2. 若邮箱不存在或已暂停，则拒绝收信。
3. 安全地解析 MIME。
4. 将原始邮件存入 R2。
5. 将文本正文、清洗后的 HTML 正文和附件对象存入 R2。
6. 将元数据行写入 D1。
7. 更新邮箱计数器。
8. 写入一条 `email.received` 审计日志。
