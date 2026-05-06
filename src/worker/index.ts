import PostalMime, { type Address, type Email } from "postal-mime";
import type { Env } from "./env";
import { getBooleanVar, getNumberVar } from "./env";
import { getAuthenticatedAdmin, createSessionCookie, clearSessionCookie } from "./auth/sessions";
import { hashPassword, verifyPassword } from "./auth/password";
import { ensureBootstrapAdmin, getAdminByUsername, markAdminLogin } from "./db/admins";
import { createAttachmentRecord, getAttachmentById, listAttachmentsForEmail } from "./db/attachments";
import { writeAuditLog } from "./db/audit-logs";
import { getDashboardStats, getRecentFailedLoginAlert } from "./db/dashboard";
import {
  createEmailRecord,
  findEmailByMailboxAndMessageId,
  getEmailById,
  listEmailsForMailbox,
  markEmailAsRead,
  markEmailsAsRead,
  softDeleteEmails
} from "./db/emails";
import { countRecentFailedAttempts, recordLoginAttempt } from "./db/login-attempts";
import {
  countExistingMailboxForSubdomain,
  createMailbox,
  deleteMailboxesWithoutEmails,
  decrementMailboxUnreadCount,
  findMailboxByAddress,
  getMailboxById,
  getMailboxSummary,
  incrementMailboxCounters,
  listMailboxes,
  refreshMailboxEmailCounters
} from "./db/mailboxes";
import {
  deleteUnusedSubdomains,
  findAvailableSubdomain,
  getSubdomainById,
  getSubdomainSummary,
  insertSubdomains,
  listSubdomains
} from "./db/subdomains";
import { createId } from "./lib/ids";
import { errorResponse, html, json, redirect } from "./lib/responses";
import { nowTimestamp, toSqliteTimestamp } from "./lib/time";

type Locale = "en" | "zh";

const translations = {
  en: {
    appTitleSuffixSignIn: "Sign in",
    appTitleSuffixDashboard: "Dashboard",
    appTitleSuffixMailboxes: "Mailbox Workspace",
    appTitleSuffixMailboxDetail: "Mailbox Detail",
    appTitleSuffixEmailDetail: "Email Detail",
    appSubtitleLogin: "Private inboxes backed by Cloudflare. Sign in to reach the admin dashboard.",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    secondGateHint: "Cloudflare Access should sit in front of this app in production. This page is the second gate.",
    language: "Language",
    chinese: "中文",
    english: "English",
    unableToSignIn: "Unable to sign in.",
    signedInAs: "Signed in as",
    milestoneShell: "This is the private shell for Milestone 1.",
    logOut: "Log out",
    dashboard: "Dashboard",
    mailboxWorkspace: "Mailbox workspace",
    mailboxes: "Mailboxes",
    unreadEmails: "Unread emails",
    availableSubdomains: "Available subdomains",
    activeMailboxes: "Active mailboxes",
    nextBuildTargets: "Next build targets",
    nextBuildTargetsBody: "Mailbox CRUD, subdomain pool management, and inbound email persistence come next.",
    configReminder: "Config reminder",
    configReminderBody:
      "Before the first login, set BOOTSTRAP_ADMIN_PASSWORD_HASH or BOOTSTRAP_ADMIN_PASSWORD_PLAIN, and replace the D1 database placeholder in wrangler.toml.",
    openMailboxWorkspace: "Open mailbox workspace",
    mailboxWorkspaceSubtitle: "Generate subdomains, create long-lived inboxes, and inspect the current pool.",
    subdomainPool: "Subdomain pool",
    poolHint: "These subdomains should later exist in Cloudflare Email Routing as accepted receiving domains.",
    generateSubdomains: "Generate subdomains",
    generateCount: "How many",
    labelLength: "Label length",
    customSubdomains: "Custom subdomain labels",
    customSubdomainsHint: "One label per line. Example: inbox-a",
    customSubdomainsPlaceholder: "vip\nregister\narchive-01",
    createMailbox: "Create mailbox",
    localPartMode: "Local part mode",
    selectedSubdomain: "Subdomain",
    randomLocalPart: "Random",
    customLocalPart: "Custom",
    localPart: "Local part",
    localPartPlaceholder: "example: hello",
    note: "Note",
    notePlaceholder: "Why are you creating this inbox?",
    noNote: "No note",
    createNow: "Create now",
    refreshData: "Refresh data",
    mailboxList: "Mailbox list",
    mailboxOverview: "Mailbox overview",
    inbox: "Inbox",
    inboxSummary: "Inbox summary",
    emailList: "Email list",
    emailSearchLabel: "Search emails",
    emailSearchPlaceholder: "Search sender, subject, or preview",
    emailFilterLabel: "Filter",
    emailFilterAll: "All emails",
    emailFilterUnread: "Unread only",
    emailFilterAttachments: "With attachments",
    emailSortLabel: "Sort",
    emailSortNewest: "Newest first",
    emailSortOldest: "Oldest first",
    emailResultsSummary: "Showing {displayed} of {total}",
    noMatchingEmails: "No emails match the current filters.",
    selectVisible: "Select visible",
    clearSelection: "Clear selection",
    selectedCount: "{count} selected",
    markSelectedRead: "Mark selected as read",
    deleteSelected: "Delete selected",
    bulkMarkReadSuccess: "Marked {count} emails as read.",
    bulkDeleteSuccess: "Deleted {count} emails.",
    confirmDeleteSelected: "Delete the selected emails?",
    invalidEmailSelection: "Select at least one email first.",
    totalEmails: "Total emails",
    lastReceivedAt: "Last received",
    mailboxReady: "This mailbox is active and ready to receive mail.",
    noRecentEmail: "No recent email yet",
    storedEmailsHint: "Stored messages for this mailbox are listed below.",
    retentionPolicy: "Retention",
    retentionKeepForever: "Keep forever",
    retentionDeleteAfterDays: "Delete after {days} days",
    backToMailboxes: "Back to workspace",
    mailboxDetailSubtitle: "Review mailbox settings and the current inbox state.",
    emailDetailSubtitle: "Read the full stored message content.",
    mailboxNotFound: "The mailbox does not exist or was deleted.",
    emailNotFound: "The email does not exist or was deleted.",
    from: "From",
    to: "To",
    replyTo: "Reply-To",
    subject: "Subject",
    receivedAt: "Received",
    messageId: "Message-ID",
    noSubject: "(No subject)",
    inboxEmpty: "No emails yet. This mailbox is ready to receive mail.",
    emailRead: "Read",
    emailUnread: "Unread",
    hasAttachments: "Attachment",
    openEmail: "Open email",
    backToMailbox: "Back to mailbox",
    emailBody: "Email body",
    bodyUnavailable: "No stored message body is available for this email.",
    bodySourceText: "Text body",
    bodySourceHtmlFallback: "HTML converted to readable text",
    bodySourceHtmlSafe: "Sanitized HTML preview",
    viewHtml: "HTML",
    viewText: "Text",
    previewImage: "Image preview",
    inlineImagesAllowed: "Inline images from this email only",
    downloadRawEmail: "Download raw email",
    attachmentList: "Attachments",
    noAttachments: "No attachments",
    attachmentCount: "{count} attachments",
    attachmentUnavailable: "The attachment could not be found.",
    recentSubdomains: "Recent subdomains",
    noneYet: "Nothing yet.",
    status: "Status",
    address: "Address",
    createdAt: "Created",
    summaryTotal: "Total",
    summaryAvailable: "Available",
    summaryAssigned: "In use",
    summaryDisabled: "Disabled",
    summaryPaused: "Paused",
    statusActive: "Active",
    statusPaused: "Paused",
    statusArchived: "Archived",
    statusDeleted: "Deleted",
    statusAvailable: "Available",
    statusAssigned: "Assigned",
    statusReserved: "Reserved",
    statusDisabled: "Disabled",
    noSubdomainAvailable: "No available subdomain exists yet. Generate a batch first.",
    noSuchSubdomain: "The selected subdomain does not exist or is disabled.",
    deleteEmptyMailboxes: "Delete mailboxes with no emails",
    deleteAllSubdomains: "Delete unused subdomains",
    deleteEmptyMailboxesSuccess: "Deleted {count} mailboxes with no emails.",
    deleteAllSubdomainsSuccess: "Deleted {count} unused subdomains.",
    invalidCredentials: "Username or password is incorrect.",
    loginBlocked: "Too many failed attempts. Try again in {minutes} minutes.",
    invalidInput: "Username and password are required.",
    invalidLocalPart:
      "Local part must be 1-32 characters and use lowercase letters, numbers, dots, underscores, or hyphens.",
    unauthorized: "Sign in required.",
    routeNotFound: "Route not found.",
    recentFailedLogins: "{count} failed login attempts from {ip} in the last hour.",
    generateSuccess: "Generated {count} new subdomains.",
    mailboxCreated: "Mailbox created: {address}",
    unexpectedError: "Something went wrong. Please try again."
  },
  zh: {
    appTitleSuffixSignIn: "登录",
    appTitleSuffixDashboard: "仪表盘",
    appTitleSuffixMailboxes: "邮箱工作台",
    appTitleSuffixMailboxDetail: "邮箱详情",
    appTitleSuffixEmailDetail: "邮件详情",
    appSubtitleLogin: "这是一个基于 Cloudflare 的私有收件箱。登录后进入管理仪表盘。",
    username: "用户名",
    password: "密码",
    signIn: "登录",
    secondGateHint: "生产环境中建议由 Cloudflare Access 挡在最前面，这一页是第二层门禁。",
    language: "语言",
    chinese: "中文",
    english: "English",
    unableToSignIn: "登录失败。",
    signedInAs: "当前登录账号",
    milestoneShell: "这是里程碑 1 的私有应用外壳。",
    logOut: "退出登录",
    dashboard: "仪表盘",
    mailboxWorkspace: "邮箱工作台",
    mailboxes: "邮箱数量",
    unreadEmails: "未读邮件",
    availableSubdomains: "可用子域名",
    activeMailboxes: "活跃邮箱",
    nextBuildTargets: "下一步开发重点",
    nextBuildTargetsBody: "接下来会继续实现邮箱 CRUD、子域名池管理和入站邮件持久化。",
    configReminder: "配置提醒",
    configReminderBody:
      "首次登录前请先设置 BOOTSTRAP_ADMIN_PASSWORD_HASH 或 BOOTSTRAP_ADMIN_PASSWORD_PLAIN，并把 wrangler.toml 里的 D1 占位数据库 ID 换成真实值。",
    openMailboxWorkspace: "进入邮箱工作台",
    mailboxWorkspaceSubtitle: "在这里生成子域名、创建长期邮箱，并查看当前资源池状态。",
    subdomainPool: "子域名池",
    poolHint: "这些子域名后续需要在 Cloudflare Email Routing 中真实配置为可接收邮件的域名。",
    generateSubdomains: "生成子域名",
    generateCount: "生成数量",
    labelLength: "前缀长度",
    customSubdomains: "自定义子域名前缀",
    customSubdomainsHint: "每行一个前缀，例如：inbox-a",
    customSubdomainsPlaceholder: "vip\nregister\narchive-01",
    createMailbox: "创建邮箱",
    localPartMode: "邮箱前缀模式",
    selectedSubdomain: "子域名",
    randomLocalPart: "随机",
    customLocalPart: "自定义",
    localPart: "邮箱前缀",
    localPartPlaceholder: "例如：hello",
    note: "备注",
    notePlaceholder: "创建这个邮箱是为了什么？",
    noNote: "无备注",
    createNow: "立即创建",
    refreshData: "刷新数据",
    mailboxList: "邮箱列表",
    mailboxOverview: "邮箱概览",
    inbox: "收件箱",
    inboxSummary: "收件摘要",
    emailList: "邮件列表",
    emailSearchLabel: "搜索邮件",
    emailSearchPlaceholder: "搜索发件人、主题或预览内容",
    emailFilterLabel: "筛选",
    emailFilterAll: "全部邮件",
    emailFilterUnread: "仅未读",
    emailFilterAttachments: "仅含附件",
    emailSortLabel: "排序",
    emailSortNewest: "最新优先",
    emailSortOldest: "最早优先",
    emailResultsSummary: "当前显示 {displayed} / {total}",
    noMatchingEmails: "当前筛选条件下没有匹配的邮件。",
    selectVisible: "选择当前结果",
    clearSelection: "清空选择",
    selectedCount: "已选择 {count} 封",
    markSelectedRead: "标记所选为已读",
    deleteSelected: "删除所选邮件",
    bulkMarkReadSuccess: "已将 {count} 封邮件标记为已读。",
    bulkDeleteSuccess: "已删除 {count} 封邮件。",
    confirmDeleteSelected: "确定删除当前选中的邮件吗？",
    invalidEmailSelection: "请先选择至少一封邮件。",
    totalEmails: "邮件总数",
    lastReceivedAt: "最后收信",
    mailboxReady: "这个邮箱已启用，可以继续接收邮件。",
    noRecentEmail: "暂时还没有最近邮件",
    storedEmailsHint: "下方列出这个邮箱已经保存的邮件。",
    retentionPolicy: "保留策略",
    retentionKeepForever: "永久保留",
    retentionDeleteAfterDays: "{days} 天后删除",
    backToMailboxes: "返回工作台",
    mailboxDetailSubtitle: "查看邮箱配置和当前收件箱状态。",
    emailDetailSubtitle: "查看这封邮件保存下来的完整内容。",
    mailboxNotFound: "该邮箱不存在，或已经被删除。",
    emailNotFound: "该邮件不存在，或已经被删除。",
    from: "发件人",
    to: "收件人",
    replyTo: "回复地址",
    subject: "主题",
    receivedAt: "接收时间",
    messageId: "Message-ID",
    noSubject: "（无主题）",
    inboxEmpty: "暂时还没有邮件，这个邮箱已经可以开始接收邮件了。",
    emailRead: "已读",
    emailUnread: "未读",
    hasAttachments: "附件",
    openEmail: "查看邮件",
    backToMailbox: "返回邮箱",
    emailBody: "邮件正文",
    bodyUnavailable: "这封邮件暂时没有可显示的正文内容。",
    bodySourceText: "文本正文",
    bodySourceHtmlFallback: "由 HTML 转换的可读文本",
    bodySourceHtmlSafe: "安全 HTML 预览",
    viewHtml: "HTML",
    viewText: "文本",
    previewImage: "图片预览",
    inlineImagesAllowed: "仅允许这封邮件自己的内联图片",
    downloadRawEmail: "下载原始邮件",
    attachmentList: "附件列表",
    noAttachments: "没有附件",
    attachmentCount: "{count} 个附件",
    attachmentUnavailable: "找不到这个附件。",
    recentSubdomains: "最近子域名",
    noneYet: "还没有数据。",
    status: "状态",
    address: "地址",
    createdAt: "创建时间",
    summaryTotal: "总数",
    summaryAvailable: "可用",
    summaryAssigned: "已使用",
    summaryDisabled: "已禁用",
    summaryPaused: "已暂停",
    statusActive: "活跃",
    statusPaused: "暂停",
    statusArchived: "已归档",
    statusDeleted: "已删除",
    statusAvailable: "可用",
    statusAssigned: "已分配",
    statusReserved: "已保留",
    statusDisabled: "已禁用",
    noSubdomainAvailable: "当前没有可用子域名，请先生成一批。",
    noSuchSubdomain: "所选子域名不存在或已被禁用。",
    deleteEmptyMailboxes: "删除没有邮件的邮箱",
    deleteAllSubdomains: "删除未使用子域名",
    deleteEmptyMailboxesSuccess: "已删除 {count} 个没有邮件的邮箱。",
    deleteAllSubdomainsSuccess: "已删除 {count} 个未使用子域名。",
    invalidCredentials: "用户名或密码不正确。",
    loginBlocked: "失败次数过多，请在 {minutes} 分钟后再试。",
    invalidInput: "用户名和密码不能为空。",
    invalidLocalPart: "邮箱前缀长度需在 1-32 之间，并且只能使用小写字母、数字、点、下划线或短横线。",
    unauthorized: "需要先登录。",
    routeNotFound: "未找到对应路由。",
    recentFailedLogins: "过去一小时内，来自 {ip} 的登录失败次数达到 {count} 次。",
    generateSuccess: "已生成 {count} 个新子域名。",
    mailboxCreated: "邮箱已创建：{address}",
    unexpectedError: "出现了一点问题，请稍后再试。"
  }
} as const;

type TranslationKey = keyof (typeof translations)["en"];

function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function resolveLocale(request: Request): Locale {
  const url = new URL(request.url);
  const queryLang = url.searchParams.get("lang");
  if (queryLang === "zh" || queryLang === "en") {
    return queryLang;
  }

  const hint =
    request.headers.get("x-app-language") ??
    request.headers.get("accept-language") ??
    "";

  return hint.toLowerCase().includes("zh") ? "zh" : "en";
}

function t(locale: Locale, key: TranslationKey, params: Record<string, string | number> = {}): string {
  let value: string = translations[locale][key];
  for (const [paramKey, paramValue] of Object.entries(params)) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function renderLanguageSwitcher(pathname: string, locale: Locale): string {
  const items: Array<{ locale: Locale; label: string }> = [
    { locale: "zh", label: translations[locale].chinese },
    { locale: "en", label: translations[locale].english }
  ];

  return `<div class="lang-switch" aria-label="${t(locale, "language")}">
    ${items
      .map(
        ({ locale: targetLocale, label }) =>
          `<a class="lang-link${targetLocale === locale ? " is-active" : ""}" href="${pathname}?lang=${targetLocale}">${label}</a>`
      )
      .join("")}
  </div>`;
}

function renderNav(pathname: string, locale: Locale): string {
  const items = [
    { href: "/dashboard", label: t(locale, "dashboard") },
    { href: "/mailboxes", label: t(locale, "mailboxWorkspace") }
  ];

  return `<nav class="nav-pills">
    ${items
      .map(
        (item) =>
          `<a class="nav-pill${pathname === item.href ? " is-active" : ""}" href="${item.href}?lang=${locale}">${item.label}</a>`
      )
      .join("")}
  </nav>`;
}

function renderLayout(title: string, body: string, locale: Locale): string {
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3f1ea;
        --bg-soft: #f8f6f0;
        --panel: #fffdfa;
        --panel-soft: rgba(255, 255, 255, 0.78);
        --text: #1f1b16;
        --muted: #666055;
        --line: #d9d2c4;
        --line-strong: #c8bead;
        --accent: #156f5b;
        --accent-strong: #0f5848;
        --accent-soft: rgba(21, 111, 91, 0.08);
        --danger: #9b2c2c;
      }
      * { box-sizing: border-box; }
      html {
        font-size: 16px;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", "Noto Sans", sans-serif;
        color: var(--text);
        line-height: 1.5;
        background:
          radial-gradient(circle at top right, rgba(209, 230, 223, 0.45) 0%, rgba(209, 230, 223, 0) 28%),
          radial-gradient(circle at top left, rgba(241, 227, 197, 0.45) 0%, rgba(241, 227, 197, 0) 24%),
          linear-gradient(180deg, #f8f6f0 0%, #efebe2 100%);
      }
      a {
        color: var(--accent-strong);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
        text-decoration-color: rgba(15, 88, 72, 0.3);
      }
      .shell {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 32px 20px 48px;
      }
      .shell--centered {
        align-items: center;
      }
      .panel {
        width: min(1180px, 100%);
        background: rgba(255, 253, 248, 0.95);
        border: 1px solid rgba(201, 193, 177, 0.75);
        border-radius: 12px;
        box-shadow:
          0 24px 70px rgba(32, 25, 16, 0.08),
          0 2px 12px rgba(32, 25, 16, 0.04);
        overflow: hidden;
        backdrop-filter: blur(10px);
      }
      .panel--narrow {
        width: min(480px, 100%);
      }
      .header {
        padding: 28px 32px 24px;
        border-bottom: 1px solid var(--line);
        background:
          linear-gradient(135deg, rgba(21, 111, 91, 0.1), rgba(255, 255, 255, 0) 44%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.28));
      }
      .header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .content {
        padding: 28px 32px 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 3vw, 36px);
        line-height: 1.06;
        font-weight: 700;
      }
      h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.25;
        font-weight: 700;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      form {
        display: grid;
        gap: 18px;
      }
      label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }
      input, select, textarea {
        appearance: none;
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #fff;
        font: inherit;
        color: var(--text);
        transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }
      input:focus,
      select:focus,
      textarea:focus {
        outline: none;
        border-color: rgba(21, 111, 91, 0.65);
        box-shadow: 0 0 0 4px rgba(21, 111, 91, 0.12);
      }
      input:disabled,
      select:disabled,
      textarea:disabled {
        background: #f6f3ec;
        color: #8c8578;
      }
      input[type="checkbox"] {
        appearance: auto;
        width: 18px;
        height: 18px;
        padding: 0;
        margin: 0;
        border-radius: 6px;
        border: 1px solid var(--line-strong);
        background: white;
        accent-color: var(--accent);
        cursor: pointer;
        box-shadow: none;
      }
      input[type="checkbox"]:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(21, 111, 91, 0.14);
      }
      textarea {
        min-height: 96px;
        resize: vertical;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 10px;
        padding: 12px 16px;
        background: linear-gradient(180deg, #1a7e67 0%, #156f5b 100%);
        color: white;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(21, 111, 91, 0.18);
        transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
      }
      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px rgba(21, 111, 91, 0.2);
      }
      button:active {
        transform: translateY(0);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        box-shadow: none;
      }
      button.secondary {
        background: rgba(255, 255, 255, 0.76);
        color: var(--accent-strong);
        border: 1px solid var(--line);
        box-shadow: none;
      }
      button.secondary:hover {
        background: rgba(255, 255, 255, 0.96);
        border-color: var(--line-strong);
      }
      .lang-switch {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      }
      .lang-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 68px;
        padding: 8px 12px;
        border-radius: 999px;
        color: var(--muted);
        font-size: 14px;
      }
      .lang-link:hover {
        text-decoration: none;
      }
      .lang-link.is-active {
        background: var(--accent);
        color: white;
      }
      .nav-pills {
        display: inline-flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .nav-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 9px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
        color: var(--muted);
        font-size: 14px;
        transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
      }
      .nav-pill:hover {
        text-decoration: none;
        border-color: var(--line-strong);
        color: var(--text);
      }
      .nav-pill.is-active {
        border-color: var(--accent);
        color: var(--accent-strong);
        background: var(--accent-soft);
      }
      .stack {
        display: grid;
        gap: 20px;
      }
      .title-block {
        display: grid;
        gap: 6px;
      }
      .row {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .row--start {
        align-items: flex-start;
      }
      .metrics {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      .metric {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #fbf8f1 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
        min-height: 106px;
        display: grid;
        align-content: start;
        gap: 8px;
      }
      .metric strong {
        display: block;
        font-size: 32px;
        line-height: 1;
        margin: 0;
      }
      .metric span {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }
      .notice {
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid rgba(155, 44, 44, 0.18);
        background: rgba(155, 44, 44, 0.06);
        color: var(--danger);
        font-size: 14px;
        line-height: 1.55;
      }
      .notice.success {
        border-color: rgba(21, 111, 91, 0.18);
        background: rgba(21, 111, 91, 0.08);
        color: var(--accent-strong);
      }
      .muted {
        color: var(--muted);
        font-size: 14px;
      }
      .list {
        display: grid;
        gap: 12px;
      }
      .list-item, .card {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.92);
      }
      .card {
        display: grid;
        gap: 16px;
        align-content: start;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
      }
      .card-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      .section-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.95fr);
      }
      .inline-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .toolbar-start {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .toolbar-end {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .selection-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .control-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(220px, 1.7fr) repeat(2, minmax(160px, 0.75fr));
      }
      .control-grid label {
        gap: 6px;
      }
      .result-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .selection-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .table-shell {
        display: grid;
        gap: 16px;
      }
      .checkbox-cell {
        width: 42px;
      }
      .checkbox-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .table th,
      .table td {
        text-align: left;
        padding: 14px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      .table th {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .table tbody tr {
        transition: background 140ms ease;
      }
      .table tbody tr:hover {
        background: rgba(21, 111, 91, 0.04);
      }
      .table tbody tr.is-unread {
        background: rgba(21, 111, 91, 0.035);
      }
      .table tbody tr.is-unread:hover {
        background: rgba(21, 111, 91, 0.08);
      }
      .table tbody tr.is-selected {
        background: rgba(21, 111, 91, 0.12);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .table tbody tr.is-selected:hover {
        background: rgba(21, 111, 91, 0.16);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 5px 9px;
        border-radius: 999px;
        border: 1px solid rgba(21, 111, 91, 0.14);
        background: rgba(21, 111, 91, 0.08);
        color: var(--accent-strong);
        font-size: 12px;
        line-height: 1.2;
      }
      .badge-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .detail-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
      }
      .detail-list {
        display: grid;
        gap: 12px;
      }
      .detail-item {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px 16px;
        background: linear-gradient(180deg, #ffffff 0%, #fbf8f1 100%);
        display: grid;
        gap: 6px;
      }
      .detail-item strong,
      .detail-item code,
      .detail-item .detail-value {
        display: block;
        color: var(--text);
        overflow-wrap: anywhere;
      }
      .detail-label {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .detail-value {
        font-weight: 600;
        line-height: 1.55;
      }
      .detail-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .attachment-list {
        display: grid;
        gap: 12px;
      }
      .attachment-link {
        display: inline-flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
      }
      .attachment-link:hover {
        text-decoration: none;
      }
      .attachment-name {
        display: block;
        color: var(--text);
        font-weight: 700;
      }
      .attachment-meta {
        color: var(--muted);
        font-size: 13px;
      }
      .attachment-preview {
        display: block;
        max-width: 100%;
        max-height: 220px;
        margin-top: 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #f8f5ee;
      }
      .mode-switch .secondary.is-active {
        background: rgba(21, 111, 91, 0.08);
        border-color: var(--accent);
        color: var(--accent-strong);
      }
      .subject-link {
        display: inline-flex;
        align-items: flex-start;
        margin: 0;
      }
      .subject-link:hover {
        text-decoration: none;
      }
      .table-primary {
        display: grid;
        gap: 6px;
      }
      .address-chip {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid rgba(21, 111, 91, 0.12);
        background: #f2f8f6;
        color: var(--accent-strong);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .subject-title,
      .table-title {
        color: var(--text);
        font-size: 15px;
        line-height: 1.45;
      }
      .subject-title.is-unread {
        font-weight: 800;
      }
      .table-preview {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }
      .sender-cell {
        display: grid;
        gap: 4px;
      }
      .sender-name {
        color: var(--text);
        font-weight: 600;
      }
      .sender-address {
        color: var(--muted);
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .subdomain-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .email-body {
        min-height: 420px;
        padding: 20px 22px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: white;
        white-space: pre-wrap;
        overflow: auto;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.72;
        font-size: 14px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .email-html-frame {
        width: 100%;
        min-height: 520px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: white;
      }
      .body-source {
        margin-bottom: 10px;
        font-size: 13px;
      }
      .empty {
        padding: 22px 16px;
        border: 1px dashed var(--line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.55);
        color: var(--muted);
      }
      code {
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .mono {
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      @media (max-width: 860px) {
        .shell {
          padding: 20px 14px 32px;
        }
        .header,
        .content {
          padding-left: 18px;
          padding-right: 18px;
        }
        .section-grid {
          grid-template-columns: 1fr;
        }
        .detail-grid {
          grid-template-columns: 1fr;
        }
        .control-grid {
          grid-template-columns: 1fr;
        }
        .table {
          table-layout: auto;
        }
      }
      @media (max-width: 640px) {
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .card-grid {
          grid-template-columns: 1fr;
        }
        .table th,
        .table td {
          padding-left: 6px;
          padding-right: 6px;
        }
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function renderLoginPage(appName: string, locale: Locale): string {
  return renderLayout(
    `${appName} - ${t(locale, "appTitleSuffixSignIn")}`,
    `<main class="shell shell--centered">
      <section class="panel panel--narrow">
        <div class="header">
          <div class="header-top">
            <div></div>
            ${renderLanguageSwitcher("/login", locale)}
          </div>
          <h1>${appName}</h1>
          <p>${t(locale, "appSubtitleLogin")}</p>
        </div>
        <div class="content stack">
          <div id="message" class="notice" hidden></div>
          <form id="login-form">
            <label>
              ${t(locale, "username")}
              <input type="text" name="username" value="admin" autocomplete="username" required />
            </label>
            <label>
              ${t(locale, "password")}
              <input type="password" name="password" autocomplete="current-password" required />
            </label>
            <button type="submit">${t(locale, "signIn")}</button>
          </form>
          <p class="muted">${t(locale, "secondGateHint")}</p>
        </div>
      </section>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const localizedErrors = {
        INVALID_CREDENTIALS: ${JSON.stringify(t(locale, "invalidCredentials"))},
        LOGIN_BLOCKED: ${JSON.stringify(t(locale, "loginBlocked", { minutes: "{minutes}" }))},
        INVALID_INPUT: ${JSON.stringify(t(locale, "invalidInput"))},
        DEFAULT: ${JSON.stringify(t(locale, "unableToSignIn"))}
      };
      const form = document.getElementById("login-form");
      const message = document.getElementById("message");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.hidden = true;
        const formData = new FormData(form);
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-language": currentLang
          },
          body: JSON.stringify({
            username: formData.get("username"),
            password: formData.get("password")
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          message.hidden = false;
          const code = payload.error?.code;
          const serverMessage = payload.error?.message ?? localizedErrors.DEFAULT;
          if (code === "LOGIN_BLOCKED") {
            const matched = String(serverMessage).match(/(\\d+)/);
            const minutes = matched ? matched[1] : "";
            message.textContent = localizedErrors.LOGIN_BLOCKED.replace("{minutes}", minutes);
            return;
          }
          message.textContent = localizedErrors[code] ?? serverMessage ?? localizedErrors.DEFAULT;
          return;
        }
        window.location.href = "/dashboard?lang=" + encodeURIComponent(currentLang);
      });
    </script>`,
    locale
  );
}

function renderDashboardPage(appName: string, username: string, locale: Locale): string {
  return renderLayout(
    `${appName} - ${t(locale, "appTitleSuffixDashboard")}`,
    `<main class="shell">
      <section class="panel">
        <div class="header">
          <div class="header-top">
            ${renderNav("/dashboard", locale)}
            ${renderLanguageSwitcher("/dashboard", locale)}
          </div>
          <div class="row">
            <div>
              <h1>${appName}</h1>
              <p>${t(locale, "signedInAs")} <code>${username}</code>. ${t(locale, "milestoneShell")}</p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill is-active" href="/mailboxes?lang=${locale}">${t(locale, "openMailboxWorkspace")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div class="metrics" id="metrics">
            <div class="metric"><strong>-</strong><span>${t(locale, "mailboxes")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "unreadEmails")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "availableSubdomains")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "activeMailboxes")}</span></div>
          </div>
          <div id="security-alert" class="notice" hidden></div>
          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "nextBuildTargets")}</h2>
              <p class="muted">${t(locale, "nextBuildTargetsBody")}</p>
            </div>
            <div class="card">
              <h2>${t(locale, "configReminder")}</h2>
              <p class="muted">${t(locale, "configReminderBody")}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const metricsEl = document.getElementById("metrics");
      const alertEl = document.getElementById("security-alert");
      const logoutButton = document.getElementById("logout-button");

      logoutButton.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
      });

      async function loadDashboard() {
        const response = await fetch("/api/dashboard?lang=" + encodeURIComponent(currentLang), {
          headers: {
            "x-app-language": currentLang
          }
        });
        if (response.status === 401) {
          window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
          return;
        }

        const payload = await response.json();
        metricsEl.innerHTML = [
          [${JSON.stringify(t(locale, "mailboxes"))}, payload.stats.mailboxCount],
          [${JSON.stringify(t(locale, "unreadEmails"))}, payload.stats.unreadEmailCount],
          [${JSON.stringify(t(locale, "availableSubdomains"))}, payload.stats.availableSubdomainCount],
          [${JSON.stringify(t(locale, "activeMailboxes"))}, payload.stats.activeMailboxCount]
        ].map(([label, value]) => (
          '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>'
        )).join("");

        if (payload.securityAlerts.length > 0) {
          alertEl.hidden = false;
          alertEl.textContent = payload.securityAlerts[0].message;
        }
      }

      loadDashboard();
    </script>`,
    locale
  );
}

function renderMailboxesPage(appName: string, username: string, locale: Locale): string {
  return renderLayout(
    `${appName} - ${t(locale, "appTitleSuffixMailboxes")}`,
    `<main class="shell">
      <section class="panel">
        <div class="header">
          <div class="header-top">
            ${renderNav("/mailboxes", locale)}
            ${renderLanguageSwitcher("/mailboxes", locale)}
          </div>
          <div class="row">
            <div>
              <h1>${t(locale, "mailboxWorkspace")}</h1>
              <p>${t(locale, "mailboxWorkspaceSubtitle")} <code>${username}</code></p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill" href="/dashboard?lang=${locale}">${t(locale, "dashboard")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div id="page-message" class="notice" hidden></div>

          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "subdomainPool")}</h2>
              <p class="muted">${t(locale, "poolHint")}</p>
              <div class="metrics" id="subdomain-summary">
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryTotal")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryAvailable")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryAssigned")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryDisabled")}</span></div>
              </div>
            </div>
            <div class="card">
              <h2>${t(locale, "mailboxList")}</h2>
              <div class="metrics" id="mailbox-summary">
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryTotal")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "activeMailboxes")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryPaused")}</span></div>
              </div>
            </div>
          </div>

          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "generateSubdomains")}</h2>
              <form id="subdomain-form">
                <label>
                  ${t(locale, "generateCount")}
                  <input type="number" name="count" min="1" max="200" value="20" required />
                </label>
                <label>
                  ${t(locale, "labelLength")}
                  <input type="number" name="labelLength" min="3" max="8" value="4" required />
                </label>
                <label>
                  ${t(locale, "customSubdomains")}
                  <textarea name="customLabels" placeholder="${t(locale, "customSubdomainsPlaceholder")}"></textarea>
                </label>
                <p class="muted">${t(locale, "customSubdomainsHint")}</p>
                <button type="submit">${t(locale, "generateSubdomains")}</button>
              </form>
            </div>
            <div class="card">
              <h2>${t(locale, "createMailbox")}</h2>
              <form id="mailbox-form">
                <label>
                  ${t(locale, "selectedSubdomain")}
                  <select name="subdomainId" id="subdomain-select"></select>
                </label>
                <label>
                  ${t(locale, "localPartMode")}
                  <select name="localPartMode" id="local-part-mode">
                    <option value="random">${t(locale, "randomLocalPart")}</option>
                    <option value="custom">${t(locale, "customLocalPart")}</option>
                  </select>
                </label>
                <label>
                  ${t(locale, "localPart")}
                  <input type="text" name="localPart" id="local-part-input" placeholder="${t(locale, "localPartPlaceholder")}" disabled />
                </label>
                <label>
                  ${t(locale, "note")}
                  <textarea name="note" placeholder="${t(locale, "notePlaceholder")}"></textarea>
                </label>
                <button type="submit">${t(locale, "createNow")}</button>
              </form>
            </div>
          </div>

          <div class="toolbar">
            <button id="delete-empty-mailboxes-button" class="secondary" type="button">${t(locale, "deleteEmptyMailboxes")}</button>
            <button id="delete-all-subdomains-button" class="secondary" type="button">${t(locale, "deleteAllSubdomains")}</button>
          </div>

          <div class="section-grid">
            <div class="card">
              <div class="row">
                <h2>${t(locale, "mailboxList")}</h2>
                <button id="refresh-button" class="secondary" type="button">${t(locale, "refreshData")}</button>
              </div>
              <table class="table">
                <thead>
                  <tr>
                    <th>${t(locale, "address")}</th>
                    <th>${t(locale, "status")}</th>
                    <th>${t(locale, "note")}</th>
                    <th>${t(locale, "createdAt")}</th>
                  </tr>
                </thead>
                <tbody id="mailbox-rows"></tbody>
              </table>
              <div id="mailbox-empty" class="empty" hidden>${t(locale, "noneYet")}</div>
            </div>

            <div class="card">
              <h2>${t(locale, "recentSubdomains")}</h2>
              <div class="list" id="subdomain-list"></div>
              <div id="subdomain-empty" class="empty" hidden>${t(locale, "noneYet")}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const text = {
        summaryTotal: ${JSON.stringify(t(locale, "summaryTotal"))},
        summaryAvailable: ${JSON.stringify(t(locale, "summaryAvailable"))},
        summaryAssigned: ${JSON.stringify(t(locale, "summaryAssigned"))},
        summaryDisabled: ${JSON.stringify(t(locale, "summaryDisabled"))},
        activeMailboxes: ${JSON.stringify(t(locale, "activeMailboxes"))},
        summaryPaused: ${JSON.stringify(t(locale, "summaryPaused"))},
        generateSuccess: ${JSON.stringify(t(locale, "generateSuccess", { count: "{count}" }))},
        mailboxCreated: ${JSON.stringify(t(locale, "mailboxCreated", { address: "{address}" }))},
        noSubdomainAvailable: ${JSON.stringify(t(locale, "noSubdomainAvailable"))},
        noSuchSubdomain: ${JSON.stringify(t(locale, "noSuchSubdomain"))},
        noNote: ${JSON.stringify(t(locale, "noNote"))},
        deleteEmptyMailboxesSuccess: ${JSON.stringify(t(locale, "deleteEmptyMailboxesSuccess", { count: "{count}" }))},
        deleteAllSubdomainsSuccess: ${JSON.stringify(t(locale, "deleteAllSubdomainsSuccess", { count: "{count}" }))},
        invalidLocalPart: ${JSON.stringify(t(locale, "invalidLocalPart"))},
        unexpectedError: ${JSON.stringify(t(locale, "unexpectedError"))},
        status: {
          active: ${JSON.stringify(t(locale, "statusActive"))},
          paused: ${JSON.stringify(t(locale, "statusPaused"))},
          archived: ${JSON.stringify(t(locale, "statusArchived"))},
          deleted: ${JSON.stringify(t(locale, "statusDeleted"))},
          available: ${JSON.stringify(t(locale, "statusAvailable"))},
          assigned: ${JSON.stringify(t(locale, "statusAssigned"))},
          disabled: ${JSON.stringify(t(locale, "statusDisabled"))},
          reserved: ${JSON.stringify(t(locale, "statusReserved"))}
        }
      };

      const pageMessage = document.getElementById("page-message");
      const mailboxRows = document.getElementById("mailbox-rows");
      const mailboxEmpty = document.getElementById("mailbox-empty");
      const subdomainList = document.getElementById("subdomain-list");
      const subdomainEmpty = document.getElementById("subdomain-empty");
      const subdomainSummary = document.getElementById("subdomain-summary");
      const mailboxSummary = document.getElementById("mailbox-summary");
      const logoutButton = document.getElementById("logout-button");
      const refreshButton = document.getElementById("refresh-button");
      const subdomainForm = document.getElementById("subdomain-form");
      const mailboxForm = document.getElementById("mailbox-form");
      const subdomainSelect = document.getElementById("subdomain-select");
      const localPartMode = document.getElementById("local-part-mode");
      const localPartInput = document.getElementById("local-part-input");
      const deleteEmptyMailboxesButton = document.getElementById("delete-empty-mailboxes-button");
      const deleteAllSubdomainsButton = document.getElementById("delete-all-subdomains-button");

      function showMessage(kind, value) {
        pageMessage.hidden = false;
        pageMessage.className = kind === "success" ? "notice success" : "notice";
        pageMessage.textContent = value;
      }

      function clearMessage() {
        pageMessage.hidden = true;
      }

      function formatDate(value) {
        if (!value) return "-";
        return value.replace("T", " ").slice(0, 16);
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function setLocalPartMode() {
        localPartInput.disabled = localPartMode.value !== "custom";
        if (localPartInput.disabled) {
          localPartInput.value = "";
        }
      }

      localPartMode.addEventListener("change", setLocalPartMode);
      setLocalPartMode();

      logoutButton.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
      });

      refreshButton.addEventListener("click", () => {
        clearMessage();
        loadData();
      });

      deleteEmptyMailboxesButton.addEventListener("click", async () => {
        clearMessage();
        const response = await fetch("/api/mailboxes/cleanup-empty?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "x-app-language": currentLang
          }
        });
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }
        showMessage("success", text.deleteEmptyMailboxesSuccess.replace("{count}", String(payload.deletedCount)));
        await loadData();
      });

      deleteAllSubdomainsButton.addEventListener("click", async () => {
        clearMessage();
        const response = await fetch("/api/subdomains/delete-all?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "x-app-language": currentLang
          }
        });
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }
        showMessage("success", text.deleteAllSubdomainsSuccess.replace("{count}", String(payload.deletedCount)));
        await loadData();
      });

      subdomainForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();
        const formData = new FormData(subdomainForm);
        const response = await fetch("/api/subdomains/generate?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-language": currentLang
          },
          body: JSON.stringify({
            count: Number(formData.get("count")),
            labelLength: Number(formData.get("labelLength")),
            customLabels: String(formData.get("customLabels") ?? "")
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }
        showMessage("success", text.generateSuccess.replace("{count}", String(payload.createdCount)));
        await loadData();
      });

      mailboxForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();
        const formData = new FormData(mailboxForm);
        const response = await fetch("/api/mailboxes?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-language": currentLang
          },
          body: JSON.stringify({
            subdomainId: formData.get("subdomainId"),
            localPartMode: formData.get("localPartMode"),
            localPart: formData.get("localPart"),
            note: formData.get("note")
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }
        showMessage("success", text.mailboxCreated.replace("{address}", payload.mailbox.fullAddress));
        mailboxForm.reset();
        setLocalPartMode();
        await loadData();
      });

      async function loadData() {
        const [mailboxesResponse, subdomainsResponse] = await Promise.all([
          fetch("/api/mailboxes?lang=" + encodeURIComponent(currentLang), {
            headers: { "x-app-language": currentLang }
          }),
          fetch("/api/subdomains?lang=" + encodeURIComponent(currentLang), {
            headers: { "x-app-language": currentLang }
          })
        ]);

        if (mailboxesResponse.status === 401 || subdomainsResponse.status === 401) {
          window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
          return;
        }

        const mailboxesPayload = await mailboxesResponse.json();
        const subdomainsPayload = await subdomainsResponse.json();

        subdomainSummary.innerHTML = [
          [text.summaryTotal, subdomainsPayload.summary.total],
          [text.summaryAvailable, subdomainsPayload.summary.available],
          [text.summaryAssigned, subdomainsPayload.summary.assigned],
          [text.summaryDisabled, subdomainsPayload.summary.disabled]
        ].map(([label, value]) => (
          '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>'
        )).join("");

        mailboxSummary.innerHTML = [
          [text.summaryTotal, mailboxesPayload.summary.total],
          [text.activeMailboxes, mailboxesPayload.summary.active],
          [text.summaryPaused, mailboxesPayload.summary.paused]
        ].map(([label, value]) => (
          '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>'
        )).join("");

        mailboxRows.innerHTML = "";
        if (mailboxesPayload.items.length === 0) {
          mailboxEmpty.hidden = false;
        } else {
          mailboxEmpty.hidden = true;
          mailboxRows.innerHTML = mailboxesPayload.items.map((item) => (
            '<tr>' +
              '<td>' +
                '<a class="table-primary" href="/mailboxes/' + encodeURIComponent(item.id) + '?lang=' + encodeURIComponent(currentLang) + '">' +
                  '<span class="address-chip">' + escapeHtml(item.fullAddress) + '</span>' +
                '</a>' +
              '</td>' +
              '<td><span class="badge">' + (text.status[item.status] || item.status) + '</span></td>' +
              '<td><span class="table-preview">' + escapeHtml(item.note || text.noNote) + '</span></td>' +
              '<td><span class="mono">' + formatDate(item.createdAt) + '</span></td>' +
            '</tr>'
          )).join("");
        }

        if (subdomainsPayload.items.length === 0) {
          subdomainEmpty.hidden = false;
          subdomainList.innerHTML = "";
          subdomainSelect.innerHTML = "";
        } else {
          subdomainEmpty.hidden = true;
          subdomainSelect.innerHTML = subdomainsPayload.items
            .filter((item) => item.status !== "disabled")
            .map((item) => (
              '<option value="' + item.id + '">' + escapeHtml(item.fullDomain) + ' (' + (item.mailboxCount || 0) + ')</option>'
            )).join("");
          subdomainList.innerHTML = subdomainsPayload.items.map((item) => (
            '<div class="list-item">' +
              '<div class="row row--start">' +
                '<span class="address-chip">' + escapeHtml(item.fullDomain) + '</span>' +
                '<span class="badge">' + (text.status[item.status] || item.status) + '</span>' +
              '</div>' +
              '<div class="subdomain-meta">' +
                '<p class="muted">' + text.activeMailboxes + '</p>' +
                '<strong>' + (item.mailboxCount || 0) + '</strong>' +
              '</div>' +
            '</div>'
          )).join("");
        }
      }

      loadData();
    </script>`,
    locale
  );
}

function renderMailboxDetailPage(appName: string, username: string, locale: Locale, mailboxId: string): string {
  return renderLayout(
    `${appName} - ${t(locale, "appTitleSuffixMailboxDetail")}`,
    `<main class="shell">
      <section class="panel">
        <div class="header">
          <div class="header-top">
            ${renderNav("/mailboxes", locale)}
            ${renderLanguageSwitcher(`/mailboxes/${mailboxId}`, locale)}
          </div>
          <div class="row">
            <div>
              <h1 id="mailbox-address">-</h1>
              <p>${t(locale, "mailboxDetailSubtitle")} <code>${username}</code></p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill" href="/mailboxes?lang=${locale}">${t(locale, "backToMailboxes")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div id="page-message" class="notice" hidden></div>

          <div class="metrics" id="detail-metrics">
            <div class="metric"><strong>-</strong><span>${t(locale, "totalEmails")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "unreadEmails")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "lastReceivedAt")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "status")}</span></div>
          </div>

          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "mailboxOverview")}</h2>
              <div class="list" id="mailbox-overview"></div>
            </div>
            <div class="card">
              <div class="row row--start">
                <div class="title-block">
                  <h2>${t(locale, "inboxSummary")}</h2>
                  <p id="inbox-summary-lead" class="muted">${t(locale, "mailboxReady")}</p>
                </div>
                <button id="refresh-button" class="secondary" type="button">${t(locale, "refreshData")}</button>
              </div>
              <div class="list" id="inbox-summary"></div>
            </div>
          </div>

          <div class="card">
            <div class="table-shell">
              <div class="toolbar">
                <div class="title-block">
                  <h2>${t(locale, "emailList")}</h2>
                  <p id="email-list-lead" class="muted">${t(locale, "storedEmailsHint")}</p>
                </div>
                <div class="toolbar-end">
                  <span id="email-results-meta" class="result-meta">${t(locale, "emailResultsSummary", { displayed: "0", total: "0" })}</span>
                </div>
              </div>
              <div class="toolbar">
                <div class="selection-actions">
                  <button id="select-visible-button" class="secondary" type="button">${t(locale, "selectVisible")}</button>
                  <button id="clear-selection-button" class="secondary" type="button">${t(locale, "clearSelection")}</button>
                  <span id="selection-meta" class="selection-meta">${t(locale, "selectedCount", { count: "0" })}</span>
                </div>
                <div class="selection-actions">
                  <button id="mark-read-button" class="secondary" type="button" disabled>${t(locale, "markSelectedRead")}</button>
                  <button id="delete-selected-button" class="secondary" type="button" disabled>${t(locale, "deleteSelected")}</button>
                </div>
              </div>
              <div class="control-grid">
                <label>
                  ${t(locale, "emailSearchLabel")}
                  <input id="email-search" type="search" placeholder="${t(locale, "emailSearchPlaceholder")}" />
                </label>
                <label>
                  ${t(locale, "emailFilterLabel")}
                  <select id="email-filter">
                    <option value="all">${t(locale, "emailFilterAll")}</option>
                    <option value="unread">${t(locale, "emailFilterUnread")}</option>
                    <option value="attachments">${t(locale, "emailFilterAttachments")}</option>
                  </select>
                </label>
                <label>
                  ${t(locale, "emailSortLabel")}
                  <select id="email-sort">
                    <option value="newest">${t(locale, "emailSortNewest")}</option>
                    <option value="oldest">${t(locale, "emailSortOldest")}</option>
                  </select>
                </label>
              </div>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th class="checkbox-cell">
                    <span class="checkbox-wrap">
                      <input id="select-all-checkbox" type="checkbox" aria-label="${t(locale, "selectVisible")}" />
                    </span>
                  </th>
                  <th>${t(locale, "from")}</th>
                  <th>${t(locale, "subject")}</th>
                  <th>${t(locale, "receivedAt")}</th>
                  <th>${t(locale, "status")}</th>
                </tr>
              </thead>
              <tbody id="inbox-rows"></tbody>
            </table>
            <div id="inbox-empty" class="empty" hidden>${t(locale, "inboxEmpty")}</div>
          </div>
        </div>
      </section>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const mailboxId = ${JSON.stringify(mailboxId)};
      const text = {
        mailboxNotFound: ${JSON.stringify(t(locale, "mailboxNotFound"))},
        noNote: ${JSON.stringify(t(locale, "noNote"))},
        noSubject: ${JSON.stringify(t(locale, "noSubject"))},
        inboxEmpty: ${JSON.stringify(t(locale, "inboxEmpty"))},
        inboxSummary: ${JSON.stringify(t(locale, "inboxSummary"))},
        emailSearchPlaceholder: ${JSON.stringify(t(locale, "emailSearchPlaceholder"))},
        emailFilterAll: ${JSON.stringify(t(locale, "emailFilterAll"))},
        emailFilterUnread: ${JSON.stringify(t(locale, "emailFilterUnread"))},
        emailFilterAttachments: ${JSON.stringify(t(locale, "emailFilterAttachments"))},
        emailSortNewest: ${JSON.stringify(t(locale, "emailSortNewest"))},
        emailSortOldest: ${JSON.stringify(t(locale, "emailSortOldest"))},
        emailResultsSummary: ${JSON.stringify(t(locale, "emailResultsSummary", { displayed: "{displayed}", total: "{total}" }))},
        noMatchingEmails: ${JSON.stringify(t(locale, "noMatchingEmails"))},
        selectVisible: ${JSON.stringify(t(locale, "selectVisible"))},
        clearSelection: ${JSON.stringify(t(locale, "clearSelection"))},
        selectedCount: ${JSON.stringify(t(locale, "selectedCount", { count: "{count}" }))},
        markSelectedRead: ${JSON.stringify(t(locale, "markSelectedRead"))},
        deleteSelected: ${JSON.stringify(t(locale, "deleteSelected"))},
        bulkMarkReadSuccess: ${JSON.stringify(t(locale, "bulkMarkReadSuccess", { count: "{count}" }))},
        bulkDeleteSuccess: ${JSON.stringify(t(locale, "bulkDeleteSuccess", { count: "{count}" }))},
        confirmDeleteSelected: ${JSON.stringify(t(locale, "confirmDeleteSelected"))},
        invalidEmailSelection: ${JSON.stringify(t(locale, "invalidEmailSelection"))},
        summaryTotal: ${JSON.stringify(t(locale, "summaryTotal"))},
        totalEmails: ${JSON.stringify(t(locale, "totalEmails"))},
        unreadEmails: ${JSON.stringify(t(locale, "unreadEmails"))},
        lastReceivedAt: ${JSON.stringify(t(locale, "lastReceivedAt"))},
        mailboxReady: ${JSON.stringify(t(locale, "mailboxReady"))},
        noRecentEmail: ${JSON.stringify(t(locale, "noRecentEmail"))},
        storedEmailsHint: ${JSON.stringify(t(locale, "storedEmailsHint"))},
        retentionPolicy: ${JSON.stringify(t(locale, "retentionPolicy"))},
        retentionKeepForever: ${JSON.stringify(t(locale, "retentionKeepForever"))},
        retentionDeleteAfterDays: ${JSON.stringify(t(locale, "retentionDeleteAfterDays", { days: "{days}" }))},
        address: ${JSON.stringify(t(locale, "address"))},
        note: ${JSON.stringify(t(locale, "note"))},
        createdAt: ${JSON.stringify(t(locale, "createdAt"))},
        status: ${JSON.stringify(t(locale, "status"))},
        emailRead: ${JSON.stringify(t(locale, "emailRead"))},
        emailUnread: ${JSON.stringify(t(locale, "emailUnread"))},
        hasAttachments: ${JSON.stringify(t(locale, "hasAttachments"))},
        unexpectedError: ${JSON.stringify(t(locale, "unexpectedError"))},
        badges: {
          active: ${JSON.stringify(t(locale, "statusActive"))},
          paused: ${JSON.stringify(t(locale, "statusPaused"))},
          archived: ${JSON.stringify(t(locale, "statusArchived"))},
          deleted: ${JSON.stringify(t(locale, "statusDeleted"))}
        }
      };

      const addressEl = document.getElementById("mailbox-address");
      const pageMessage = document.getElementById("page-message");
      const detailMetrics = document.getElementById("detail-metrics");
      const mailboxOverview = document.getElementById("mailbox-overview");
      const inboxSummary = document.getElementById("inbox-summary");
      const inboxSummaryLead = document.getElementById("inbox-summary-lead");
      const emailListLead = document.getElementById("email-list-lead");
      const emailResultsMeta = document.getElementById("email-results-meta");
      const selectionMeta = document.getElementById("selection-meta");
      const emailSearchInput = document.getElementById("email-search");
      const emailFilterSelect = document.getElementById("email-filter");
      const emailSortSelect = document.getElementById("email-sort");
      const selectVisibleButton = document.getElementById("select-visible-button");
      const clearSelectionButton = document.getElementById("clear-selection-button");
      const markReadButton = document.getElementById("mark-read-button");
      const deleteSelectedButton = document.getElementById("delete-selected-button");
      const selectAllCheckbox = document.getElementById("select-all-checkbox");
      const inboxRows = document.getElementById("inbox-rows");
      const inboxEmpty = document.getElementById("inbox-empty");
      const refreshButton = document.getElementById("refresh-button");
      const logoutButton = document.getElementById("logout-button");
      let mailboxEmails = [];
      let selectedEmailIds = new Set();

      function showMessage(kind, value) {
        pageMessage.hidden = false;
        pageMessage.className = kind === "success" ? "notice success" : "notice";
        pageMessage.textContent = value;
      }

      function clearMessage() {
        pageMessage.hidden = true;
      }

      function formatDate(value) {
        if (!value) return "-";
        return value.replace("T", " ").slice(0, 16);
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function formatRetention(mailbox) {
        if (mailbox.retentionMode === "delete_after_days" && mailbox.retentionDays) {
          return text.retentionDeleteAfterDays.replace("{days}", String(mailbox.retentionDays));
        }
        return text.retentionKeepForever;
      }

      function formatResultsSummary(displayed, total) {
        return text.emailResultsSummary
          .replace("{displayed}", String(displayed))
          .replace("{total}", String(total));
      }

      function formatSelectedCount(count) {
        return text.selectedCount.replace("{count}", String(count));
      }

      function getFilteredEmails() {
        const searchTerm = String(emailSearchInput.value || "").trim().toLowerCase();
        const filterMode = emailFilterSelect.value;
        const sortMode = emailSortSelect.value;

        const filtered = mailboxEmails.filter((email) => {
          if (filterMode === "unread" && email.isRead) {
            return false;
          }
          if (filterMode === "attachments" && !email.hasAttachments) {
            return false;
          }

          if (!searchTerm) {
            return true;
          }

          const haystack = [
            email.fromName,
            email.fromAddress,
            email.subject,
            email.textPreview
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(searchTerm);
        });

        filtered.sort((left, right) => {
          const leftTime = Date.parse(left.receivedAt || "") || 0;
          const rightTime = Date.parse(right.receivedAt || "") || 0;
          return sortMode === "oldest" ? leftTime - rightTime : rightTime - leftTime;
        });

        return filtered;
      }

      function getSelectedEmailIds() {
        return mailboxEmails
          .filter((email) => selectedEmailIds.has(email.id))
          .map((email) => email.id);
      }

      function updateSelectionUi(filteredEmails) {
        const selectedCount = getSelectedEmailIds().length;
        selectionMeta.textContent = formatSelectedCount(selectedCount);
        markReadButton.disabled = selectedCount === 0;
        deleteSelectedButton.disabled = selectedCount === 0;
        clearSelectionButton.disabled = selectedCount === 0;

        const visibleIds = filteredEmails.map((email) => email.id);
        const visibleSelectedCount = visibleIds.filter((id) => selectedEmailIds.has(id)).length;
        selectVisibleButton.disabled = visibleIds.length === 0;
        selectAllCheckbox.checked = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
        selectAllCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length;
        selectAllCheckbox.disabled = visibleIds.length === 0;
      }

      async function runBulkAction(pathname, successMessageFactory) {
        const emailIds = getSelectedEmailIds();
        if (emailIds.length === 0) {
          showMessage("error", text.invalidEmailSelection);
          return;
        }

        const response = await fetch(pathname + "?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-language": currentLang
          },
          body: JSON.stringify({ emailIds })
        });
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        selectedEmailIds = new Set();
        showMessage("success", successMessageFactory(payload.updatedCount ?? payload.deletedCount ?? 0));
        await loadMailboxDetail();
      }

      function renderInboxRows() {
        const filteredEmails = getFilteredEmails();
        emailResultsMeta.textContent = formatResultsSummary(filteredEmails.length, mailboxEmails.length);

        if (mailboxEmails.length === 0) {
          inboxRows.innerHTML = "";
          inboxEmpty.hidden = false;
          inboxEmpty.textContent = text.inboxEmpty;
          updateSelectionUi([]);
          return;
        }

        if (filteredEmails.length === 0) {
          inboxRows.innerHTML = "";
          inboxEmpty.hidden = false;
          inboxEmpty.textContent = text.noMatchingEmails;
          updateSelectionUi(filteredEmails);
          return;
        }

        inboxEmpty.hidden = true;
        inboxRows.innerHTML = filteredEmails.map((email) => (
          '<tr class="' +
            [
              !email.isRead ? "is-unread" : "",
              selectedEmailIds.has(email.id) ? "is-selected" : ""
            ].filter(Boolean).join(" ") +
          '">' +
            '<td class="checkbox-cell">' +
              '<span class="checkbox-wrap">' +
                '<input class="email-row-checkbox" type="checkbox" data-email-id="' + escapeHtml(email.id) + '"' +
                (selectedEmailIds.has(email.id) ? ' checked' : '') +
                ' aria-label="' + escapeHtml(email.subject || email.fromAddress || text.noSubject) + '" />' +
              '</span>' +
            '</td>' +
            '<td>' +
              '<div class="sender-cell">' +
                (email.fromName
                  ? '<span class="sender-name">' + escapeHtml(email.fromName) + '</span><span class="sender-address">&lt;' + escapeHtml(email.fromAddress) + '&gt;</span>'
                  : '<span class="sender-name">' + escapeHtml(email.fromAddress) + '</span>') +
              '</div>' +
            '</td>' +
            '<td>' +
              '<a class="subject-link table-primary" href="/mailboxes/' + encodeURIComponent(mailboxId) + '/emails/' + encodeURIComponent(email.id) + '?lang=' + encodeURIComponent(currentLang) + '">' +
                '<strong class="subject-title' + (email.isRead ? "" : " is-unread") + '">' + escapeHtml(email.subject || text.noSubject) + '</strong>' +
              '</a>' +
              (email.textPreview ? '<p class="table-preview">' + escapeHtml(email.textPreview) + '</p>' : '') +
            '</td>' +
            '<td><span class="mono">' + formatDate(email.receivedAt) + '</span></td>' +
            '<td>' +
              '<div class="badge-row">' +
                '<span class="badge">' + (email.isRead ? text.emailRead : text.emailUnread) + '</span>' +
                (email.hasAttachments ? '<span class="badge">' + text.hasAttachments + '</span>' : '') +
              '</div>' +
            '</td>' +
          '</tr>'
        )).join("");
        updateSelectionUi(filteredEmails);
      }

      logoutButton.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
      });

      refreshButton.addEventListener("click", () => {
        clearMessage();
        loadMailboxDetail();
      });

      selectVisibleButton.addEventListener("click", () => {
        const filteredEmails = getFilteredEmails();
        for (const email of filteredEmails) {
          selectedEmailIds.add(email.id);
        }
        renderInboxRows();
      });

      clearSelectionButton.addEventListener("click", () => {
        selectedEmailIds = new Set();
        renderInboxRows();
      });

      markReadButton.addEventListener("click", async () => {
        clearMessage();
        await runBulkAction(
          "/api/mailboxes/" + encodeURIComponent(mailboxId) + "/emails/mark-read",
          (count) => text.bulkMarkReadSuccess.replace("{count}", String(count))
        );
      });

      deleteSelectedButton.addEventListener("click", async () => {
        clearMessage();
        if (!window.confirm(text.confirmDeleteSelected)) {
          return;
        }
        await runBulkAction(
          "/api/mailboxes/" + encodeURIComponent(mailboxId) + "/emails/delete",
          (count) => text.bulkDeleteSuccess.replace("{count}", String(count))
        );
      });

      selectAllCheckbox.addEventListener("change", () => {
        const filteredEmails = getFilteredEmails();
        if (selectAllCheckbox.checked) {
          for (const email of filteredEmails) {
            selectedEmailIds.add(email.id);
          }
        } else {
          for (const email of filteredEmails) {
            selectedEmailIds.delete(email.id);
          }
        }
        renderInboxRows();
      });

      inboxRows.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.classList.contains("email-row-checkbox")) {
          return;
        }
        const emailId = target.getAttribute("data-email-id");
        if (!emailId) {
          return;
        }
        if (target.checked) {
          selectedEmailIds.add(emailId);
        } else {
          selectedEmailIds.delete(emailId);
        }
        renderInboxRows();
      });

      emailSearchInput.addEventListener("input", renderInboxRows);
      emailFilterSelect.addEventListener("change", renderInboxRows);
      emailSortSelect.addEventListener("change", renderInboxRows);

      async function loadMailboxDetail() {
        const [mailboxResponse, emailsResponse] = await Promise.all([
          fetch("/api/mailboxes/" + encodeURIComponent(mailboxId) + "?lang=" + encodeURIComponent(currentLang), {
            headers: { "x-app-language": currentLang }
          }),
          fetch("/api/mailboxes/" + encodeURIComponent(mailboxId) + "/emails?lang=" + encodeURIComponent(currentLang), {
            headers: { "x-app-language": currentLang }
          })
        ]);

        if (mailboxResponse.status === 401 || emailsResponse.status === 401) {
          window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
          return;
        }

        if (mailboxResponse.status === 404) {
          addressEl.textContent = text.mailboxNotFound;
          showMessage("error", text.mailboxNotFound);
          detailMetrics.innerHTML = "";
          mailboxOverview.innerHTML = "";
          inboxSummary.innerHTML = "";
          inboxSummaryLead.textContent = "";
          emailListLead.textContent = "";
          emailResultsMeta.textContent = formatResultsSummary(0, 0);
          mailboxEmails = [];
          selectedEmailIds = new Set();
          inboxRows.innerHTML = "";
          inboxEmpty.hidden = false;
          updateSelectionUi([]);
          return;
        }

        const mailboxPayload = await mailboxResponse.json();
        if (!mailboxResponse.ok) {
          showMessage("error", mailboxPayload.error?.message ?? text.unexpectedError);
          return;
        }

        const emailsPayload = await emailsResponse.json();
        if (!emailsResponse.ok) {
          showMessage("error", emailsPayload.error?.message ?? text.unexpectedError);
          return;
        }

        const mailbox = mailboxPayload.mailbox;
        addressEl.textContent = mailbox.fullAddress;

        detailMetrics.innerHTML = [
          [text.totalEmails, mailbox.totalEmailCount],
          [text.unreadEmails, mailbox.unreadEmailCount],
          [text.lastReceivedAt, formatDate(mailbox.lastReceivedAt)],
          [text.status, text.badges[mailbox.status] || mailbox.status]
        ].map(([label, value]) => (
          '<div class="metric"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>'
        )).join("");

        mailboxOverview.innerHTML = [
          [text.address, mailbox.fullAddress],
          [text.note, mailbox.note || text.noNote],
          [text.createdAt, formatDate(mailbox.createdAt)],
          [text.retentionPolicy, formatRetention(mailbox)]
        ].map(([label, value]) => (
          '<div class="list-item">' +
            '<p class="detail-label">' + escapeHtml(label) + '</p>' +
            '<strong class="detail-value">' + escapeHtml(value) + '</strong>' +
          '</div>'
        )).join("");

        inboxSummaryLead.textContent = text.mailboxReady;
        inboxSummary.innerHTML = [
          [text.status, text.badges[mailbox.status] || mailbox.status],
          [text.unreadEmails, String(mailbox.unreadEmailCount)],
          [text.lastReceivedAt, mailbox.lastReceivedAt ? formatDate(mailbox.lastReceivedAt) : text.noRecentEmail]
        ].map(([label, value]) => (
          '<div class="list-item">' +
            '<p class="detail-label">' + escapeHtml(label) + '</p>' +
            '<strong class="detail-value">' + escapeHtml(value) + '</strong>' +
          '</div>'
        )).join("");

        emailListLead.textContent = text.storedEmailsHint;
        mailboxEmails = Array.isArray(emailsPayload.items) ? emailsPayload.items : [];
        selectedEmailIds = new Set(
          mailboxEmails.filter((email) => selectedEmailIds.has(email.id)).map((email) => email.id)
        );
        renderInboxRows();
      }

      loadMailboxDetail();
    </script>`,
    locale
  );
}

function renderEmailDetailPage(
  appName: string,
  username: string,
  locale: Locale,
  mailboxId: string,
  emailId: string
): string {
  return renderLayout(
    `${appName} - ${t(locale, "appTitleSuffixEmailDetail")}`,
    `<main class="shell">
      <section class="panel">
        <div class="header">
          <div class="header-top">
            ${renderNav("/mailboxes", locale)}
            ${renderLanguageSwitcher(`/mailboxes/${mailboxId}/emails/${emailId}`, locale)}
          </div>
          <div class="row">
            <div>
              <h1 id="email-subject">-</h1>
              <p>${t(locale, "emailDetailSubtitle")} <code>${username}</code></p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill" href="/mailboxes/${mailboxId}?lang=${locale}">${t(locale, "backToMailbox")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div id="page-message" class="notice" hidden></div>
          <div class="detail-grid">
            <div class="card">
              <h2>${t(locale, "mailboxOverview")}</h2>
              <div class="detail-actions">
                <a id="raw-download-link" class="nav-pill" href="#">${t(locale, "downloadRawEmail")}</a>
              </div>
              <div id="email-meta" class="detail-list"></div>
              <div class="stack" style="margin-top: 16px;">
                <div class="row">
                  <h2>${t(locale, "attachmentList")}</h2>
                  <span id="attachment-count" class="muted">${t(locale, "noAttachments")}</span>
                </div>
                <div id="attachment-list" class="attachment-list"></div>
              </div>
            </div>
            <div class="card">
              <div class="row">
                <h2>${t(locale, "emailBody")}</h2>
                <div class="inline-actions mode-switch" id="body-mode-switch" hidden>
                  <button id="mode-html-button" class="secondary" type="button">${t(locale, "viewHtml")}</button>
                  <button id="mode-text-button" class="secondary" type="button">${t(locale, "viewText")}</button>
                </div>
                <button id="refresh-button" class="secondary" type="button">${t(locale, "refreshData")}</button>
              </div>
              <p id="body-source" class="muted body-source"></p>
              <iframe
                id="email-html-frame"
                class="email-html-frame"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                hidden
              ></iframe>
              <pre id="email-body" class="email-body">-</pre>
            </div>
          </div>
        </div>
      </section>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const mailboxId = ${JSON.stringify(mailboxId)};
      const emailId = ${JSON.stringify(emailId)};
      const text = {
        emailNotFound: ${JSON.stringify(t(locale, "emailNotFound"))},
        noSubject: ${JSON.stringify(t(locale, "noSubject"))},
        bodyUnavailable: ${JSON.stringify(t(locale, "bodyUnavailable"))},
        bodySourceText: ${JSON.stringify(t(locale, "bodySourceText"))},
        bodySourceHtmlFallback: ${JSON.stringify(t(locale, "bodySourceHtmlFallback"))},
        bodySourceHtmlSafe: ${JSON.stringify(t(locale, "bodySourceHtmlSafe"))},
        viewHtml: ${JSON.stringify(t(locale, "viewHtml"))},
        viewText: ${JSON.stringify(t(locale, "viewText"))},
        downloadRawEmail: ${JSON.stringify(t(locale, "downloadRawEmail"))},
        attachmentList: ${JSON.stringify(t(locale, "attachmentList"))},
        noAttachments: ${JSON.stringify(t(locale, "noAttachments"))},
        attachmentCount: ${JSON.stringify(t(locale, "attachmentCount", { count: "{count}" }))},
        from: ${JSON.stringify(t(locale, "from"))},
        to: ${JSON.stringify(t(locale, "to"))},
        replyTo: ${JSON.stringify(t(locale, "replyTo"))},
        receivedAt: ${JSON.stringify(t(locale, "receivedAt"))},
        messageId: ${JSON.stringify(t(locale, "messageId"))},
        status: ${JSON.stringify(t(locale, "status"))},
        hasAttachments: ${JSON.stringify(t(locale, "hasAttachments"))},
        attachmentUnavailable: ${JSON.stringify(t(locale, "attachmentUnavailable"))},
        emailRead: ${JSON.stringify(t(locale, "emailRead"))},
        emailUnread: ${JSON.stringify(t(locale, "emailUnread"))},
        unexpectedError: ${JSON.stringify(t(locale, "unexpectedError"))}
      };

      const subjectEl = document.getElementById("email-subject");
      const metaEl = document.getElementById("email-meta");
      const bodyModeSwitch = document.getElementById("body-mode-switch");
      const modeHtmlButton = document.getElementById("mode-html-button");
      const modeTextButton = document.getElementById("mode-text-button");
      const bodyEl = document.getElementById("email-body");
      const htmlFrameEl = document.getElementById("email-html-frame");
      const bodySourceEl = document.getElementById("body-source");
      const rawDownloadLink = document.getElementById("raw-download-link");
      const attachmentCountEl = document.getElementById("attachment-count");
      const attachmentListEl = document.getElementById("attachment-list");
      const pageMessage = document.getElementById("page-message");
      const refreshButton = document.getElementById("refresh-button");
      const logoutButton = document.getElementById("logout-button");
      let currentEmail = null;

      function showMessage(kind, value) {
        pageMessage.hidden = false;
        pageMessage.className = kind === "success" ? "notice success" : "notice";
        pageMessage.textContent = value;
      }

      function clearMessage() {
        pageMessage.hidden = true;
      }

      function formatDate(value) {
        if (!value) return "-";
        return value.replace("T", " ").slice(0, 16);
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function formatBytes(value) {
        if (!Number.isFinite(value) || value <= 0) {
          return "0 B";
        }
        if (value < 1024) {
          return value + " B";
        }
        if (value < 1024 * 1024) {
          return (value / 1024).toFixed(1) + " KB";
        }
        return (value / (1024 * 1024)).toFixed(1) + " MB";
      }

      function setActiveMode(mode) {
        if (!currentEmail) {
          return;
        }

        const hasHtml = Boolean(currentEmail.htmlDocument);
        const hasText = Boolean(currentEmail.bodyText);

        bodyModeSwitch.hidden = !(hasHtml && hasText);
        modeHtmlButton.classList.toggle("is-active", mode === "html");
        modeTextButton.classList.toggle("is-active", mode === "text");

        if (mode === "html" && hasHtml) {
          htmlFrameEl.hidden = false;
          bodyEl.hidden = true;
          htmlFrameEl.srcdoc = currentEmail.htmlDocument;
          bodySourceEl.textContent = text.bodySourceHtmlSafe;
          return;
        }

        htmlFrameEl.hidden = true;
        htmlFrameEl.srcdoc = "";
        bodyEl.hidden = false;
        bodyEl.textContent = currentEmail.bodyText || text.bodyUnavailable;
        bodySourceEl.textContent = currentEmail.bodySource === "html_fallback"
          ? text.bodySourceHtmlFallback
          : text.bodySourceText;
      }

      logoutButton.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
      });

      refreshButton.addEventListener("click", () => {
        clearMessage();
        loadEmailDetail();
      });

      modeHtmlButton.addEventListener("click", () => setActiveMode("html"));
      modeTextButton.addEventListener("click", () => setActiveMode("text"));

      async function loadEmailDetail() {
        const response = await fetch(
          "/api/mailboxes/" + encodeURIComponent(mailboxId) + "/emails/" + encodeURIComponent(emailId) + "?lang=" + encodeURIComponent(currentLang),
          { headers: { "x-app-language": currentLang } }
        );

        if (response.status === 401) {
          window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
          return;
        }

        const payload = await response.json();
        if (response.status === 404) {
          subjectEl.textContent = text.emailNotFound;
          metaEl.innerHTML = "";
          bodySourceEl.textContent = "";
          bodyEl.textContent = text.emailNotFound;
          showMessage("error", payload.error?.message ?? text.emailNotFound);
          return;
        }

        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        const email = payload.email;
        currentEmail = email;
        subjectEl.textContent = email.subject || text.noSubject;
        rawDownloadLink.href = email.rawDownloadUrl;
        metaEl.innerHTML = [
          [text.from, email.fromDisplay],
          [text.to, email.toAddress],
          [text.replyTo, email.replyTo || "-"],
          [text.receivedAt, formatDate(email.receivedAt)],
          [text.messageId, email.messageId || "-"],
          [text.status, email.isRead ? text.emailRead : text.emailUnread],
          [text.hasAttachments, email.hasAttachments ? text.hasAttachments : "-"]
        ].map(([label, value]) => (
          '<div class="detail-item">' +
            '<p class="detail-label">' + escapeHtml(label) + '</p>' +
            '<strong class="detail-value">' + escapeHtml(value) + '</strong>' +
          '</div>'
        )).join("");

        setActiveMode(email.htmlDocument ? "html" : "text");

        if (!email.attachments || email.attachments.length === 0) {
          attachmentCountEl.textContent = text.noAttachments;
          attachmentListEl.innerHTML = '<div class="detail-item"><strong>' + escapeHtml(text.noAttachments) + '</strong></div>';
          return;
        }

        attachmentCountEl.textContent = text.attachmentCount.replace("{count}", String(email.attachments.length));
        attachmentListEl.innerHTML = email.attachments.map((attachment) => (
          '<div class="detail-item">' +
            '<a class="attachment-link" href="' + escapeHtml(attachment.downloadUrl) + '">' +
              '<span class="attachment-name">' + escapeHtml(attachment.filename) + '</span>' +
            '</a>' +
            '<p class="muted">' + escapeHtml(attachment.contentType) + ' · ' + escapeHtml(formatBytes(attachment.sizeBytes)) + '</p>' +
            (attachment.previewUrl
              ? '<img class="attachment-preview" src="' + escapeHtml(attachment.previewUrl) + '" alt="' + escapeHtml(attachment.filename || text.previewImage) + '" />'
              : '') +
          '</div>'
        )).join("");
      }

      loadEmailDetail();
    </script>`,
    locale
  );
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  return (await request.json()) as Record<string, unknown>;
}

async function resolveBootstrapAdminPasswordHash(env: Env): Promise<string> {
  const configuredHash = env.BOOTSTRAP_ADMIN_PASSWORD_HASH?.trim();
  if (configuredHash) {
    return configuredHash;
  }

  const plainPassword = env.BOOTSTRAP_ADMIN_PASSWORD_PLAIN?.trim();
  if (!plainPassword) {
    return "";
  }

  return hashPassword(plainPassword);
}

function normalizeBulkEmailIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 100))];
}

function createRandomLabel(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let output = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let index = 0; index < length; index += 1) {
    output += alphabet[bytes[index] % alphabet.length];
  }
  return output;
}

function createRandomLocalPart(): string {
  return createRandomLabel(10);
}

function isValidSubdomainLabel(value: string): boolean {
  if (value.length < 1 || value.length > 63) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

function normalizeLocalPart(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidLocalPart(value: string): boolean {
  if (value.length < 1 || value.length > 32) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/.test(value);
}

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function isMailboxAddress(value: Address): value is Extract<Address, { address: string }> {
  return "address" in value && typeof value.address === "string";
}

function getFirstMailbox(addresses?: Address[]): { name: string | null; address: string | null } {
  if (!addresses) {
    return { name: null, address: null };
  }

  for (const item of addresses) {
    if (isMailboxAddress(item)) {
      return {
        name: item.name || null,
        address: item.address || null
      };
    }
  }

  return { name: null, address: null };
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeQuotedAttribute(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readTagAttribute(rawAttributes: string, attributeName: string): string | null {
  const pattern = new RegExp(
    `${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|[^\\s"'=<>` + "`" + `]+)`,
    "i"
  );
  const match = rawAttributes.match(pattern);
  if (!match) {
    return null;
  }

  return decodeQuotedAttribute(match[1]);
}

function sanitizeHref(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (/^https?:/i.test(normalized) || /^mailto:/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function sanitizeImageSrc(value: string | null, cidMap: Map<string, string>): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\/api\/mailboxes\/[^/]+\/emails\/[^/]+\/attachments\/[^/]+\/preview\b/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.toLowerCase().startsWith("cid:")) {
    const cidKey = trimmed.slice(4).replace(/^<|>$/g, "").toLowerCase();
    return cidMap.get(cidKey) ?? null;
  }

  return null;
}

function sanitizeTableSpan(rawAttributes: string, attributeName: "colspan" | "rowspan"): string | null {
  const value = readTagAttribute(rawAttributes, attributeName);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
    return null;
  }

  return String(parsed);
}

function htmlToReadableText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const HTML_EMAIL_ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

function sanitizeHtmlEmail(value: string, cidMap: Map<string, string>): string {
  const withoutBlockedSections = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|select|textarea|video|audio|canvas|svg|math|meta|base|link|head|title|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|select|textarea|video|audio|canvas|svg|math|meta|base|link|head|title|noscript)\b[^>]*\/?>/gi, "");

  const withBlockedImages = withoutBlockedSections.replace(/<img\b([^>]*)\/?>/gi, (_match, rawAttributes) => {
    const src = sanitizeImageSrc(readTagAttribute(rawAttributes, "src"), cidMap);
    const altText = readTagAttribute(rawAttributes, "alt");
    if (src) {
      const altPart = altText ? ` alt="${escapeHtmlText(altText)}"` : "";
      return `<img src="${escapeHtmlText(src)}"${altPart} class="email-inline-image" />`;
    }

    const label = altText ? `[Image blocked: ${escapeHtmlText(altText)}]` : "[Image blocked]";
    return `<span class="email-image-blocked">${label}</span>`;
  });

  return withBlockedImages.replace(/<\/?([a-z0-9:-]+)([^>]*)>/gi, (fullMatch, rawTagName, rawAttributes) => {
    const isClosingTag = fullMatch.startsWith("</");
    const tagName = rawTagName.toLowerCase();
    if (!HTML_EMAIL_ALLOWED_TAGS.has(tagName)) {
      return "";
    }

    if (isClosingTag) {
      return `</${tagName}>`;
    }

    let sanitizedAttributes = "";

    if (tagName === "a") {
      const href = sanitizeHref(readTagAttribute(rawAttributes, "href"));
      if (href) {
        sanitizedAttributes = ` href="${escapeHtmlText(href)}" target="_blank" rel="nofollow noopener noreferrer"`;
      }
    }

    if (tagName === "span") {
      const className = readTagAttribute(rawAttributes, "class");
      if (className === "email-image-blocked") {
        sanitizedAttributes += ` class="email-image-blocked"`;
      }
    }

    if (tagName === "img") {
      const src = sanitizeImageSrc(readTagAttribute(rawAttributes, "src"), cidMap);
      if (!src) {
        return "";
      }
      const altText = readTagAttribute(rawAttributes, "alt");
      sanitizedAttributes += ` src="${escapeHtmlText(src)}" class="email-inline-image"`;
      if (altText) {
        sanitizedAttributes += ` alt="${escapeHtmlText(altText)}"`;
      }
    }

    if (tagName === "td" || tagName === "th") {
      const colspan = sanitizeTableSpan(rawAttributes, "colspan");
      const rowspan = sanitizeTableSpan(rawAttributes, "rowspan");
      if (colspan) {
        sanitizedAttributes += ` colspan="${colspan}"`;
      }
      if (rowspan) {
        sanitizedAttributes += ` rowspan="${rowspan}"`;
      }
    }

    return `<${tagName}${sanitizedAttributes}>`;
  });
}

function wrapSanitizedHtmlDocument(value: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: http: https:; style-src 'unsafe-inline';" />
    <style>
      body {
        margin: 0;
        padding: 18px;
        color: #1c1b19;
        background: #ffffff;
        font: 14px/1.6 "Segoe UI", "Noto Sans", sans-serif;
        overflow-wrap: anywhere;
      }
      a {
        color: #0f5848;
      }
      p, div, blockquote, pre, ul, ol, table {
        margin: 0 0 12px;
      }
      pre {
        white-space: pre-wrap;
        background: #f6f4ee;
        border: 1px solid #ddd6c6;
        border-radius: 8px;
        padding: 12px;
      }
      blockquote {
        border-left: 3px solid #ddd6c6;
        padding-left: 12px;
        color: #67635b;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #ddd6c6;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      .email-image-blocked {
        display: inline-block;
        padding: 6px 8px;
        border: 1px dashed #ddd6c6;
        border-radius: 6px;
        background: #f8f5ee;
        color: #67635b;
        font-size: 13px;
      }
      .email-inline-image {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 0 12px;
        border: 1px solid #ddd6c6;
        border-radius: 8px;
        background: #f8f5ee;
      }
    </style>
  </head>
  <body>${value}</body>
</html>`;
}

function buildPreview(email: Email): string | null {
  const source = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
  if (!source) {
    return null;
  }

  return source.slice(0, 240);
}

function resolveReceivedAt(email: Email): string {
  if (email.date) {
    const parsed = new Date(email.date);
    if (!Number.isNaN(parsed.getTime())) {
      return toSqliteTimestamp(parsed);
    }
  }

  return nowTimestamp();
}

function sanitizeKeyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "mail";
}

function buildEmailStoragePrefix(mailboxId: string, emailId: string, receivedAt: string): string {
  const stamp = receivedAt.replace(/[^\d]/g, "").slice(0, 14) || Date.now().toString();
  return `mailboxes/${mailboxId}/${stamp}-${emailId}`;
}

function toAttachmentBytes(content: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }

  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }

  return new TextEncoder().encode(content);
}

async function readBucketText(bucket: R2Bucket, key: string | null): Promise<string | null> {
  if (!key) {
    return null;
  }

  const object = await bucket.get(key);
  if (!object) {
    return null;
  }

  return object.text();
}

function sanitizeDownloadFilename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "download.bin";
  }

  return trimmed.replace(/[\\/:*?"<>|]+/g, "-");
}

function buildContentDisposition(filename: string): string {
  const safe = sanitizeDownloadFilename(filename);
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function buildInlineContentDisposition(filename: string): string {
  const safe = sanitizeDownloadFilename(filename);
  const encoded = encodeURIComponent(safe);
  return `inline; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function isPreviewableImageContentType(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^image\/(png|jpeg|jpg|gif|webp|bmp)$/i.test(value);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const maxFailures = getNumberVar(env.MAX_LOGIN_FAILURES, 10);
  const blockMinutes = getNumberVar(env.LOGIN_BLOCK_MINUTES, 15);

  const recentFailures = await countRecentFailedAttempts(env.DB, ipAddress, blockMinutes);
  if (recentFailures >= maxFailures) {
    await writeAuditLog(env.DB, {
      actorType: "access",
      action: "auth.login.blocked",
      targetType: "admin_session",
      ipAddress,
      userAgent,
      metadata: { recentFailures }
    });
    return errorResponse(429, "LOGIN_BLOCKED", t(locale, "loginBlocked", { minutes: blockMinutes }));
  }

  const body = await parseJsonBody(request);
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return errorResponse(400, "INVALID_INPUT", t(locale, "invalidInput"));
  }

  await ensureBootstrapAdmin(env.DB, env.BOOTSTRAP_ADMIN_USERNAME, await resolveBootstrapAdminPasswordHash(env));

  const admin = await getAdminByUsername(env.DB, username);
  const isPasswordValid = admin ? await verifyPassword(password, admin.password_hash) : false;

  if (!admin || !isPasswordValid || admin.is_active !== 1) {
    await recordLoginAttempt(env.DB, {
      ipAddress,
      username,
      wasSuccessful: false,
      failureReason: "invalid_credentials"
    });
    await writeAuditLog(env.DB, {
      actorType: "access",
      action: "auth.login.failed",
      targetType: "admin",
      ipAddress,
      userAgent,
      metadata: { username }
    });
    return errorResponse(401, "INVALID_CREDENTIALS", t(locale, "invalidCredentials"));
  }

  await recordLoginAttempt(env.DB, {
    ipAddress,
    username,
    wasSuccessful: true,
    failureReason: null
  });
  await markAdminLogin(env.DB, admin.id, ipAddress);
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.id,
    action: "auth.login.succeeded",
    targetType: "admin_session",
    ipAddress,
    userAgent
  });

  const cookie = await createSessionCookie(env, {
    adminId: admin.id,
    ipAddress,
    userAgent,
    secure: isSecureRequest(request)
  });

  return json(
    {
      ok: true,
      session: {
        expiresAt: new Date(Date.now() + getNumberVar(env.SESSION_TTL_HOURS, 24) * 60 * 60 * 1000).toISOString()
      }
    },
    {
      headers: {
        "set-cookie": cookie
      }
    }
  );
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookie = await clearSessionCookie(request, env, isSecureRequest(request));
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": cookie
      }
    }
  );
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const admin = await getAuthenticatedAdmin(request, env);
  return json({
    authenticated: Boolean(admin),
    admin: admin
      ? {
          id: admin.adminId,
          username: admin.username
        }
      : null,
    security: {
      cloudflareAccessRequired: getBooleanVar(env.CF_ACCESS_ENABLED, false)
    }
  });
}

async function handleDashboardApi(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const [stats, alert] = await Promise.all([
    getDashboardStats(env.DB),
    getRecentFailedLoginAlert(env.DB)
  ]);

  return json({
    stats,
    recentEmails: [],
    securityAlerts: alert
      ? [
          {
            id: "recent-login-failures",
            level: "warning",
            message: t(locale, "recentFailedLogins", {
              count: alert.total,
              ip: alert.ipAddress
            })
          }
        ]
      : []
  });
}

async function handleSubdomainListApi(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const [summary, items] = await Promise.all([
    getSubdomainSummary(env.DB),
    listSubdomains(env.DB, 20)
  ]);

  return json({
    summary,
    items: items.map((item) => ({
      id: item.id,
      fullDomain: item.full_domain,
      status: item.status,
      createdAt: item.created_at,
      mailboxCount: item.mailbox_count ?? 0
    }))
  });
}

async function handleGenerateSubdomains(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const body = await parseJsonBody(request);
  const count = Math.max(1, Math.min(200, Number(body.count ?? 20)));
  const labelLength = Math.max(3, Math.min(8, Number(body.labelLength ?? 4)));
  const customLabels = String(body.customLabels ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => isValidSubdomainLabel(item));

  if (customLabels.length > 0) {
    const createdCount = await insertSubdomains(
      env.DB,
      customLabels.map((label) => ({
        label,
        fullDomain: `${label}.${env.BASE_DOMAIN}`
      }))
    );

    await writeAuditLog(env.DB, {
      actorType: "admin",
      actorId: admin.adminId,
      action: "subdomains.generated.custom",
      targetType: "subdomain_pool",
      targetId: null,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { requestedCount: customLabels.length, createdCount }
    });

    return json({ createdCount });
  }

  let createdCount = 0;
  let attempts = 0;

  while (createdCount < count && attempts < count * 12) {
    const remaining = count - createdCount;
    const batchSize = remaining;
    const candidates: Array<{ label: string; fullDomain: string }> = [];

    for (let index = 0; index < batchSize; index += 1) {
      const label = createRandomLabel(labelLength);
      candidates.push({
        label,
        fullDomain: `${label}.${env.BASE_DOMAIN}`
      });
    }

    createdCount += await insertSubdomains(env.DB, candidates);
    attempts += batchSize;
  }
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "subdomains.generated",
    targetType: "subdomain_pool",
    targetId: null,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { requestedCount: count, labelLength, createdCount }
  });

  return json({ createdCount });
}

async function handleDeleteEmptyMailboxes(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const deletedCount = await deleteMailboxesWithoutEmails(env.DB);
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "mailboxes.deleted_empty",
    targetType: "mailbox",
    targetId: null,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { deletedCount }
  });

  return json({ deletedCount });
}

async function handleDeleteAllSubdomains(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const deletedCount = await deleteUnusedSubdomains(env.DB);
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "subdomains.deleted_unused",
    targetType: "subdomain_pool",
    targetId: null,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { deletedCount }
  });

  return json({ deletedCount });
}

async function handleMailboxListApi(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const [items, summary] = await Promise.all([
    listMailboxes(env.DB, 100),
    getMailboxSummary(env.DB)
  ]);

  return json({
    summary,
    items: items.map((item) => ({
      id: item.id,
      fullAddress: item.full_address,
      status: item.status,
      note: item.note,
      createdAt: item.created_at
    }))
  });
}

async function handleMailboxDetailApi(request: Request, env: Env, mailboxId: string): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  return json({
    mailbox: {
      id: mailbox.id,
      fullAddress: mailbox.full_address,
      status: mailbox.status,
      note: mailbox.note,
      createdAt: mailbox.created_at,
      lastReceivedAt: mailbox.last_received_at,
      totalEmailCount: mailbox.total_email_count,
      unreadEmailCount: mailbox.unread_email_count,
      retentionMode: mailbox.retention_mode,
      retentionDays: mailbox.retention_days
    }
  });
}

async function handleMailboxEmailsApi(request: Request, env: Env, mailboxId: string): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const items = await listEmailsForMailbox(env.DB, mailboxId, 100);

  return json({
    items: items.map((item) => ({
      id: item.id,
      fromName: item.from_name,
      fromAddress: item.from_address,
      toAddress: item.to_address,
      subject: item.subject,
      receivedAt: item.received_at,
      isRead: item.is_read === 1,
      hasAttachments: item.has_attachments === 1,
      sizeBytes: item.size_bytes,
      textPreview: item.text_preview
    }))
  });
}

async function handleMailboxEmailsMarkReadApi(request: Request, env: Env, mailboxId: string): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const body = await parseJsonBody(request);
  const emailIds = normalizeBulkEmailIds(body.emailIds);
  if (emailIds.length === 0) {
    return errorResponse(400, "INVALID_INPUT", t(locale, "invalidInput"));
  }

  const updatedCount = await markEmailsAsRead(env.DB, mailboxId, emailIds);
  await refreshMailboxEmailCounters(env.DB, mailboxId);
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "emails.bulk_mark_read",
    targetType: "email",
    targetId: null,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      mailboxId,
      requestedCount: emailIds.length,
      updatedCount
    }
  });

  return json({ updatedCount });
}

async function handleMailboxEmailsDeleteApi(request: Request, env: Env, mailboxId: string): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const body = await parseJsonBody(request);
  const emailIds = normalizeBulkEmailIds(body.emailIds);
  if (emailIds.length === 0) {
    return errorResponse(400, "INVALID_INPUT", t(locale, "invalidInput"));
  }

  const deletedCount = await softDeleteEmails(env.DB, mailboxId, emailIds);
  await refreshMailboxEmailCounters(env.DB, mailboxId);
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "emails.bulk_delete",
    targetType: "email",
    targetId: null,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      mailboxId,
      requestedCount: emailIds.length,
      deletedCount
    }
  });

  return json({ deletedCount });
}

async function handleMailboxEmailDetailApi(
  request: Request,
  env: Env,
  mailboxId: string,
  emailId: string
): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const email = await getEmailById(env.DB, mailboxId, emailId);
  if (!email) {
    return errorResponse(404, "EMAIL_NOT_FOUND", t(locale, "emailNotFound"));
  }
  const attachments = await listAttachmentsForEmail(env.DB, email.id);
  const cidMap = new Map<string, string>();
  for (const attachment of attachments) {
    if (!attachment.cid || !isPreviewableImageContentType(attachment.content_type)) {
      continue;
    }

    const normalizedCid = attachment.cid.replace(/^<|>$/g, "").toLowerCase();
    cidMap.set(
      normalizedCid,
      `/api/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachment.id}/preview?lang=${locale}`
    );
  }

  if (email.is_read === 0) {
    const changed = await markEmailAsRead(env.DB, mailboxId, emailId);
    if (changed) {
      await decrementMailboxUnreadCount(env.DB, mailboxId);
      email.is_read = 1;
    }
  }

  let bodyText = await readBucketText(env.MAIL_BUCKET, email.text_body_r2_key);
  let bodySource: "text" | "html_fallback" | "none" = "none";
  let htmlDocument: string | null = null;

  if (bodyText) {
    bodySource = "text";
  }

  const htmlBody = await readBucketText(env.MAIL_BUCKET, email.html_body_r2_key);
  if (htmlBody) {
    const sanitizedHtml = sanitizeHtmlEmail(htmlBody, cidMap);
    htmlDocument = wrapSanitizedHtmlDocument(sanitizedHtml);
    if (!bodyText) {
      bodyText = htmlToReadableText(htmlBody);
      bodySource = "html_fallback";
    }
  }

  const fromDisplay = email.from_name
    ? `${email.from_name} <${email.from_address}>`
    : email.from_address;

  return json({
    email: {
      id: email.id,
      subject: email.subject,
      fromDisplay,
      fromAddress: email.from_address,
      toAddress: email.to_address,
      replyTo: email.reply_to,
      messageId: email.message_id,
      receivedAt: email.received_at,
      isRead: email.is_read === 1,
      hasAttachments: email.has_attachments === 1,
      sizeBytes: email.size_bytes,
      bodyText,
      bodySource,
      htmlDocument,
      rawDownloadUrl: `/api/mailboxes/${mailboxId}/emails/${emailId}/raw?lang=${locale}`,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        contentId: attachment.cid,
        sizeBytes: attachment.size_bytes,
        downloadUrl: `/api/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachment.id}?lang=${locale}`,
        previewUrl: isPreviewableImageContentType(attachment.content_type)
          ? `/api/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachment.id}/preview?lang=${locale}`
          : null
      }))
    }
  });
}

async function handleMailboxEmailRawDownloadApi(
  request: Request,
  env: Env,
  mailboxId: string,
  emailId: string
): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const email = await getEmailById(env.DB, mailboxId, emailId);
  if (!email) {
    return errorResponse(404, "EMAIL_NOT_FOUND", t(locale, "emailNotFound"));
  }

  const object = await env.MAIL_BUCKET.get(email.raw_r2_key);
  if (!object) {
    return errorResponse(404, "RAW_EMAIL_NOT_FOUND", t(locale, "emailNotFound"));
  }

  return new Response(object.body, {
    headers: {
      "content-type": "message/rfc822",
      "content-disposition": buildContentDisposition(`email-${email.id}.eml`)
    }
  });
}

async function handleMailboxEmailAttachmentDownloadApi(
  request: Request,
  env: Env,
  mailboxId: string,
  emailId: string,
  attachmentId: string
): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const email = await getEmailById(env.DB, mailboxId, emailId);
  if (!email) {
    return errorResponse(404, "EMAIL_NOT_FOUND", t(locale, "emailNotFound"));
  }

  const attachment = await getAttachmentById(env.DB, email.id, attachmentId);
  if (!attachment) {
    return errorResponse(404, "ATTACHMENT_NOT_FOUND", t(locale, "attachmentUnavailable"));
  }

  const object = await env.MAIL_BUCKET.get(attachment.r2_key);
  if (!object) {
    return errorResponse(404, "ATTACHMENT_OBJECT_NOT_FOUND", t(locale, "attachmentUnavailable"));
  }

  return new Response(object.body, {
    headers: {
      "content-type": attachment.content_type || "application/octet-stream",
      "content-disposition": buildContentDisposition(attachment.filename)
    }
  });
}

async function handleMailboxEmailAttachmentPreviewApi(
  request: Request,
  env: Env,
  mailboxId: string,
  emailId: string,
  attachmentId: string
): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return errorResponse(404, "MAILBOX_NOT_FOUND", t(locale, "mailboxNotFound"));
  }

  const email = await getEmailById(env.DB, mailboxId, emailId);
  if (!email) {
    return errorResponse(404, "EMAIL_NOT_FOUND", t(locale, "emailNotFound"));
  }

  const attachment = await getAttachmentById(env.DB, email.id, attachmentId);
  if (!attachment || !isPreviewableImageContentType(attachment.content_type)) {
    return errorResponse(404, "ATTACHMENT_PREVIEW_NOT_FOUND", t(locale, "attachmentUnavailable"));
  }

  const object = await env.MAIL_BUCKET.get(attachment.r2_key);
  if (!object) {
    return errorResponse(404, "ATTACHMENT_OBJECT_NOT_FOUND", t(locale, "attachmentUnavailable"));
  }

  return new Response(object.body, {
    headers: {
      "content-type": attachment.content_type,
      "content-disposition": buildInlineContentDisposition(attachment.filename),
      "cache-control": "private, max-age=300"
    }
  });
}

async function handleCreateMailbox(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const body = await parseJsonBody(request);
  const subdomainId = String(body.subdomainId ?? "").trim();
  const localPartMode = String(body.localPartMode ?? "random");
  const localPart =
    localPartMode === "custom"
      ? normalizeLocalPart(String(body.localPart ?? ""))
      : createRandomLocalPart();
  const note = String(body.note ?? "").trim().slice(0, 140) || null;

  if (!isValidLocalPart(localPart)) {
    return errorResponse(400, "INVALID_LOCAL_PART", t(locale, "invalidLocalPart"));
  }

  const subdomain = subdomainId
    ? await getSubdomainById(env.DB, subdomainId)
    : await findAvailableSubdomain(env.DB);
  if (!subdomain) {
    return errorResponse(409, "NO_SUBDOMAIN_AVAILABLE", t(locale, "noSubdomainAvailable"));
  }
  if (subdomain.status === "disabled") {
    return errorResponse(409, "SUBDOMAIN_DISABLED", t(locale, "noSuchSubdomain"));
  }

  const fullAddress = `${localPart}@${subdomain.full_domain}`;
  const existingMailboxCount = await countExistingMailboxForSubdomain(env.DB, subdomain.id);

  try {
    const created = await createMailbox(env.DB, {
      localPart,
      subdomainId: subdomain.id,
      fullAddress,
      note
    });

    await writeAuditLog(env.DB, {
      actorType: "admin",
      actorId: admin.adminId,
      action: "mailbox.created",
      targetType: "mailbox",
      targetId: created.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { fullAddress, note, subdomainId: subdomain.id, priorMailboxCount: existingMailboxCount }
    });

    return json(
      {
        mailbox: {
          id: created.id,
          fullAddress,
          status: "active"
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(409, "MAILBOX_CONFLICT", t(locale, "unexpectedError"));
  }
}

async function handleInboundEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const toAddress = normalizeEmailAddress(message.to);
  const fromAddress = normalizeEmailAddress(message.from);
  const mailbox = await findMailboxByAddress(env.DB, toAddress);

  if (!mailbox) {
    message.setReject(`Unknown mailbox: ${toAddress}`);
    await writeAuditLog(env.DB, {
      actorType: "system",
      actorId: null,
      action: "email.rejected_unknown_mailbox",
      targetType: "mailbox",
      targetId: null,
      metadata: { toAddress, fromAddress }
    });
    return;
  }

  if (mailbox.status !== "active") {
    message.setReject(`Mailbox is not accepting mail: ${toAddress}`);
    await writeAuditLog(env.DB, {
      actorType: "system",
      actorId: null,
      action: "email.rejected_inactive_mailbox",
      targetType: "mailbox",
      targetId: mailbox.id,
      metadata: { toAddress, fromAddress, status: mailbox.status }
    });
    return;
  }

  try {
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(rawEmail, {
      attachmentEncoding: "arraybuffer"
    });

    if (parsed.messageId) {
      const existing = await findEmailByMailboxAndMessageId(env.DB, mailbox.id, parsed.messageId);
      if (existing) {
        await writeAuditLog(env.DB, {
          actorType: "system",
          actorId: null,
          action: "email.duplicate_ignored",
          targetType: "mailbox",
          targetId: mailbox.id,
          metadata: { toAddress, fromAddress, messageId: parsed.messageId, existingEmailId: existing.id }
        });
        return;
      }
    }

    const emailId = createId();
    const receivedAt = resolveReceivedAt(parsed);
    const rawR2Key = `${buildEmailStoragePrefix(mailbox.id, emailId, receivedAt)}/raw.eml`;
    const fromHeader = parsed.from && isMailboxAddress(parsed.from)
      ? {
          name: parsed.from.name || null,
          address: normalizeEmailAddress(parsed.from.address)
        }
      : { name: null, address: fromAddress };
    const replyTo = getFirstMailbox(parsed.replyTo);
    const textBodyR2Key = parsed.text ? `${buildEmailStoragePrefix(mailbox.id, emailId, receivedAt)}/body.txt` : null;
    const htmlBodyR2Key = parsed.html ? `${buildEmailStoragePrefix(mailbox.id, emailId, receivedAt)}/body.html` : null;

    await env.MAIL_BUCKET.put(rawR2Key, rawEmail, {
      httpMetadata: {
        contentType: "message/rfc822"
      }
    });

    if (parsed.text && textBodyR2Key) {
      await env.MAIL_BUCKET.put(textBodyR2Key, parsed.text, {
        httpMetadata: {
          contentType: "text/plain; charset=utf-8"
        }
      });
    }

    if (parsed.html && htmlBodyR2Key) {
      await env.MAIL_BUCKET.put(htmlBodyR2Key, parsed.html, {
        httpMetadata: {
          contentType: "text/html; charset=utf-8"
        }
      });
    }

    const created = await createEmailRecord(env.DB, {
      id: emailId,
      mailboxId: mailbox.id,
      messageId: parsed.messageId?.trim() || null,
      threadKey: parsed.references?.trim() || parsed.inReplyTo?.trim() || parsed.messageId?.trim() || null,
      fromName: fromHeader.name,
      fromAddress: fromHeader.address ?? fromAddress,
      toAddress,
      replyTo: replyTo.address ? normalizeEmailAddress(replyTo.address) : null,
      subject: parsed.subject?.trim() || null,
      receivedAt,
      isRead: false,
      hasAttachments: parsed.attachments.length > 0,
      htmlSanitized: false,
      sizeBytes: message.rawSize,
      textPreview: buildPreview(parsed),
      textBodyR2Key,
      htmlBodyR2Key,
      rawR2Key,
      headersJson: JSON.stringify(parsed.headers),
      spamScore: null
    });

    let attachmentIndex = 0;
    for (const attachment of parsed.attachments) {
      attachmentIndex += 1;
      const filename = attachment.filename || `attachment-${attachmentIndex}`;
      const bytes = toAttachmentBytes(attachment.content);
      const attachmentR2Key = `${buildEmailStoragePrefix(mailbox.id, emailId, receivedAt)}/attachments/${attachmentIndex}-${sanitizeKeyPart(filename)}`;

      await env.MAIL_BUCKET.put(attachmentR2Key, bytes, {
        httpMetadata: {
          contentType: attachment.mimeType || "application/octet-stream"
        }
      });

      await createAttachmentRecord(env.DB, {
        emailId: created.id,
        filename,
        contentType: attachment.mimeType || "application/octet-stream",
        contentDisposition: attachment.disposition,
        contentId: attachment.contentId || null,
        sizeBytes: bytes.byteLength,
        r2Key: attachmentR2Key
      });
    }

    await incrementMailboxCounters(env.DB, mailbox.id, receivedAt);
    await writeAuditLog(env.DB, {
      actorType: "system",
      actorId: null,
      action: "email.received",
      targetType: "mailbox",
      targetId: mailbox.id,
      metadata: {
        emailId,
        toAddress,
        fromAddress: fromHeader.address ?? fromAddress,
        subject: parsed.subject?.trim() || null,
        rawSize: message.rawSize,
        attachmentCount: parsed.attachments.length
      }
    });
  } catch (error) {
    console.error("Failed to process inbound email", error);
    message.setReject(`Mailbox processing failed for ${toAddress}`);

    try {
      await writeAuditLog(env.DB, {
        actorType: "system",
        actorId: null,
        action: "email.receive_failed",
        targetType: "mailbox",
        targetId: mailbox.id,
        metadata: {
          toAddress,
          fromAddress,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    } catch (auditError) {
      console.error("Failed to write inbound email failure audit log", auditError);
    }
  }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  const mailboxEmailAttachmentPreviewApiMatch =
    request.method === "GET" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails\/([^/]+)\/attachments\/([^/]+)\/preview$/) : null;
  const emailPageMatch =
    request.method === "GET" ? url.pathname.match(/^\/mailboxes\/([^/]+)\/emails\/([^/]+)$/) : null;
  const mailboxPageMatch = request.method === "GET" ? url.pathname.match(/^\/mailboxes\/([^/]+)$/) : null;
  const mailboxEmailAttachmentApiMatch =
    request.method === "GET" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails\/([^/]+)\/attachments\/([^/]+)$/) : null;
  const mailboxEmailRawApiMatch =
    request.method === "GET" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails\/([^/]+)\/raw$/) : null;
  const mailboxEmailApiMatch =
    request.method === "GET" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails\/([^/]+)$/) : null;
  const mailboxEmailsMatch = request.method === "GET" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails$/) : null;
  const mailboxEmailsMarkReadMatch =
    request.method === "POST" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails\/mark-read$/) : null;
  const mailboxEmailsDeleteMatch =
    request.method === "POST" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/emails\/delete$/) : null;
  const mailboxApiMatch = request.method === "GET" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)$/) : null;

  if (request.method === "GET" && url.pathname === "/") {
    return redirect(admin ? `/dashboard?lang=${locale}` : `/login?lang=${locale}`);
  }

  if (request.method === "GET" && url.pathname === "/login") {
    return admin ? redirect(`/dashboard?lang=${locale}`) : html(renderLoginPage(env.APP_NAME, locale));
  }

  if (request.method === "GET" && url.pathname === "/dashboard") {
    return admin ? html(renderDashboardPage(env.APP_NAME, admin.username, locale)) : redirect(`/login?lang=${locale}`);
  }

  if (request.method === "GET" && url.pathname === "/mailboxes") {
    return admin ? html(renderMailboxesPage(env.APP_NAME, admin.username, locale)) : redirect(`/login?lang=${locale}`);
  }

  if (emailPageMatch) {
    return admin
      ? html(renderEmailDetailPage(env.APP_NAME, admin.username, locale, emailPageMatch[1], emailPageMatch[2]))
      : redirect(`/login?lang=${locale}`);
  }

  if (mailboxPageMatch) {
    return admin
      ? html(renderMailboxDetailPage(env.APP_NAME, admin.username, locale, mailboxPageMatch[1]))
      : redirect(`/login?lang=${locale}`);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    return handleLogin(request, env);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return handleLogout(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    return handleSession(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    return handleDashboardApi(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/subdomains") {
    return handleSubdomainListApi(request, env);
  }

  if (request.method === "POST" && url.pathname === "/api/subdomains/generate") {
    return handleGenerateSubdomains(request, env);
  }

  if (request.method === "POST" && url.pathname === "/api/subdomains/delete-all") {
    return handleDeleteAllSubdomains(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/mailboxes") {
    return handleMailboxListApi(request, env);
  }

  if (mailboxEmailAttachmentPreviewApiMatch) {
    return handleMailboxEmailAttachmentPreviewApi(
      request,
      env,
      mailboxEmailAttachmentPreviewApiMatch[1],
      mailboxEmailAttachmentPreviewApiMatch[2],
      mailboxEmailAttachmentPreviewApiMatch[3]
    );
  }

  if (mailboxEmailAttachmentApiMatch) {
    return handleMailboxEmailAttachmentDownloadApi(
      request,
      env,
      mailboxEmailAttachmentApiMatch[1],
      mailboxEmailAttachmentApiMatch[2],
      mailboxEmailAttachmentApiMatch[3]
    );
  }

  if (mailboxEmailRawApiMatch) {
    return handleMailboxEmailRawDownloadApi(
      request,
      env,
      mailboxEmailRawApiMatch[1],
      mailboxEmailRawApiMatch[2]
    );
  }

  if (mailboxEmailApiMatch) {
    return handleMailboxEmailDetailApi(request, env, mailboxEmailApiMatch[1], mailboxEmailApiMatch[2]);
  }

  if (mailboxEmailsMarkReadMatch) {
    return handleMailboxEmailsMarkReadApi(request, env, mailboxEmailsMarkReadMatch[1]);
  }

  if (mailboxEmailsDeleteMatch) {
    return handleMailboxEmailsDeleteApi(request, env, mailboxEmailsDeleteMatch[1]);
  }

  if (mailboxEmailsMatch) {
    return handleMailboxEmailsApi(request, env, mailboxEmailsMatch[1]);
  }

  if (mailboxApiMatch) {
    return handleMailboxDetailApi(request, env, mailboxApiMatch[1]);
  }

  if (request.method === "POST" && url.pathname === "/api/mailboxes") {
    return handleCreateMailbox(request, env);
  }

  if (request.method === "POST" && url.pathname === "/api/mailboxes/cleanup-empty") {
    return handleDeleteEmptyMailboxes(request, env);
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, service: "private-mailbox-pool" });
  }

  return errorResponse(404, "NOT_FOUND", t(locale, "routeNotFound"));
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
  email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    return handleInboundEmail(message, env);
  }
};
