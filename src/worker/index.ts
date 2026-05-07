import PostalMime, { type Address, type Email } from "postal-mime";
import type { Env } from "./env";
import { getBooleanVar, getNumberVar } from "./env";
import { getAuthenticatedAdmin, createSessionCookie, clearSessionCookie } from "./auth/sessions";
import {
  getAdminPanelStats,
  listAdminSummaries,
  listRecentAuditLogs,
  listRecentLoginAttempts,
  listRecentSessions
} from "./db/admin-panel";
import { hashPassword, verifyPassword } from "./auth/password";
import { ensureBootstrapAdmin, getAdminById, getAdminByUsername, markAdminLogin, updateAdminPasswordHash } from "./db/admins";
import {
  createAttachmentRecord,
  getAttachmentById,
  listAttachmentKeysForMailbox,
  listAttachmentsForEmail
} from "./db/attachments";
import { writeAuditLog } from "./db/audit-logs";
import { getDashboardStats, getRecentFailedLoginAlert } from "./db/dashboard";
import { getDatabaseHealth } from "./db/health";
import {
  createEmailRecord,
  findEmailByMailboxAndMessageId,
  getEmailById,
  listEmailStorageKeysForMailbox,
  listEmailsForMailbox,
  markEmailAsRead,
  markEmailsAsRead,
  softDeleteEmails
} from "./db/emails";
import { countRecentFailedAttempts, recordLoginAttempt } from "./db/login-attempts";
import { clearFailedLoginAttemptsByIp, listSuspiciousLoginIps } from "./db/login-attempts";
import {
  countExistingMailboxForSubdomain,
  createMailbox,
  deleteMailboxById,
  deleteMailboxesBySubdomainId,
  deleteMailboxesWithoutEmails,
  decrementMailboxUnreadCount,
  findMailboxByAddress,
  getMailboxById,
  getMailboxSummary,
  incrementMailboxCounters,
  listMailboxDeletionCandidatesBySubdomain,
  listMailboxes,
  refreshMailboxEmailCounters
} from "./db/mailboxes";
import {
  deleteSubdomainById,
  deleteUnusedSubdomains,
  findAvailableSubdomain,
  getSubdomainById,
  getSubdomainSummary,
  insertSubdomains,
  listSubdomains
} from "./db/subdomains";
import { getSessionById, revokeOtherSessionsForAdmin, revokeSessionById } from "./db/sessions";
import { createId } from "./lib/ids";
import { errorResponse, html, json, redirect } from "./lib/responses";
import { nowTimestamp, toSqliteTimestamp } from "./lib/time";

type Locale = "en" | "zh";

const translations = {
  en: {
    appTitleSuffixSignIn: "Sign in",
    appTitleSuffixDashboard: "Dashboard",
    appTitleSuffixAdminPanel: "Admin Panel",
    appTitleSuffixMailboxes: "Mailbox Workspace",
    appTitleSuffixMailboxDetail: "Mailbox Detail",
    appTitleSuffixEmailDetail: "Email Detail",
    appSubtitleLogin: "Sign in to manage private mailboxes, domain pools, and stored mail.",
    noticeSuccessEyebrow: "Success",
    noticeSuccessTitle: "Operation completed",
    noticeErrorEyebrow: "Attention",
    noticeErrorTitle: "Unable to continue",
    noticeReminderEyebrow: "Reminder",
    noticeReminderTitle: "Before you continue",
    loginAccessTitle: "Access",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    secondGateHint: "Authorized administrators only.",
    language: "Language",
    chinese: "中文",
    english: "English",
    unableToSignIn: "Unable to sign in.",
    signedInAs: "Signed in as",
    milestoneShell: "This is the private shell for Milestone 1.",
    logOut: "Sign out",
    dashboard: "Dashboard",
    adminPanel: "Admin",
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
    openMailboxWorkspace: "Open workspace",
    openAdminPanel: "Open admin panel",
    mailboxWorkspaceSubtitle: "Manage receiving domains, create long-lived mailboxes, and keep the current pool organized.",
    subdomainPool: "Subdomain pool",
    poolHint: "These are the receiving domains currently available for mailbox creation.",
    generateSubdomains: "Generate subdomains",
    generateCount: "How many",
    labelLength: "Label length",
    customSubdomains: "Custom subdomain labels",
    customSubdomainsHint: "One label per line. Example: inbox-a",
    customSubdomainsPlaceholder: "vip\nregister\narchive-01",
    createMailbox: "Create mailbox",
    localPartMode: "Local part mode",
    selectedSubdomain: "Subdomain",
    randomSubdomainOption: "Auto assign (random pool)",
    subdomainStrategyTitle: "Subdomain assignment",
    subdomainStrategyAutoEyebrow: "Random pool",
    subdomainStrategyAutoTitle: "Mailboxes will use the random subdomain pool.",
    subdomainStrategyAutoBody:
      "New mailboxes will automatically use the next available receiving domain. Next candidate: {domain}. Available now: {count}.",
    subdomainStrategyManualEyebrow: "Pinned domain",
    subdomainStrategyManualTitle: "This mailbox will use {domain}.",
    subdomainStrategyManualBody: "The selected domain currently holds {count} mailboxes.",
    subdomainStrategyEmptyEyebrow: "Receiving unavailable",
    subdomainStrategyEmptyTitle: "No receiving domains are available right now.",
    autoCandidate: "Auto candidate",
    randomLocalPart: "Random",
    customLocalPart: "Custom",
    localPart: "Local part",
    localPartPlaceholder: "example: hello",
    note: "Note",
    notePlaceholder: "Why are you creating this inbox?",
    noNote: "No note",
    createNow: "Create mailbox",
    refreshData: "Refresh",
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
    mailboxDetailSubtitle: "Review this mailbox and manage the messages stored inside.",
    emailDetailSubtitle: "Review the stored message, attachments, and available body views.",
    emailUnavailableMeta: "No message metadata is available for this record.",
    emailUnavailableBody: "This stored message is no longer available. It may have been removed or cleaned up.",
    mailboxNotFound: "The mailbox does not exist or was deleted.",
    mailboxUnavailableBody: "This mailbox record is no longer available. It may have been removed or cleaned up.",
    emailNotFound: "The email does not exist or was deleted.",
    from: "From",
    to: "To",
    replyTo: "Reply-To",
    subject: "Subject",
    receivedAt: "Received",
    messageId: "Message-ID",
    noSubject: "(No subject)",
    inboxEmpty: "No emails yet. This mailbox is ready to receive mail.",
    inboxEmptyTitle: "No emails yet",
    inboxEmptyBody: "This mailbox is active and ready to receive new messages.",
    noMatchingEmailsTitle: "No matching emails",
    noMatchingEmailsBody: "Try a different keyword or clear the current filters.",
    emailRead: "Read",
    emailUnread: "Unread",
    hasAttachments: "Attachment",
    openEmail: "View email",
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
    recentSubdomains: "Domain list",
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
    deleteEmptyMailboxes: "Clear empty mailboxes",
    deleteAllSubdomains: "Clear unused domains",
    deleteEmptyMailboxesSuccess: "Cleared {count} empty mailboxes.",
    deleteAllSubdomainsSuccess: "Cleared {count} unused domains.",
    dashboardSubtitle: "Review mailbox activity, unread mail, and available receiving capacity.",
    dashboardOverview: "Overview",
    dashboardOverviewBody: "Keep a quick view of mailbox volume, unread mail, and receiving capacity in one place.",
    dashboardActions: "Quick actions",
    dashboardActionsBody: "Open the workspace to create addresses, manage domains, and review stored mail.",
    adminPanelSubtitle: "Review administrator access, security activity, and current operating policy.",
    adminOverviewCard: "Admin overview",
    adminOverviewBody: "Keep access accounts, recent sign-ins, and deployment rules visible in one place.",
    adminAccessPolicy: "Access policy",
    adminAccessPolicyBody: "These values describe how this deployment currently handles login and receiving domains.",
    adminRoster: "Administrator accounts",
    adminSecurityActions: "Security actions",
    adminSecurityActionsBody: "Use these controls to rotate credentials, remove active sessions, and clean suspicious failed-login records.",
    adminRecentSessions: "Recent sessions",
    adminRecentSessionsEmpty: "No session records yet.",
    adminRecentLogins: "Recent login attempts",
    adminRecentLoginsEmpty: "No login attempts recorded yet.",
    adminRecentAuditLogs: "Recent activity",
    adminRecentAuditLogsEmpty: "No audit activity recorded yet.",
    suspiciousLoginIps: "Suspicious IPs",
    suspiciousLoginIpsEmpty: "No suspicious IPs currently need attention.",
    systemHealth: "System health",
    systemHealthBody: "Check deployment safety and database migration status before production use.",
    systemHealthOk: "Ready",
    systemHealthNeedsAction: "Needs action",
    healthSchemaOk: "D1 schema is ready for multiple mailboxes under the same subdomain.",
    healthLegacySubdomainIndex:
      "D1 still has the old unique subdomain index. Apply migration 0003 before creating multiple mailboxes under one subdomain.",
    healthPlainPasswordWarning:
      "Plain bootstrap password is set in this deployment. Move it to a Cloudflare Secret or use BOOTSTRAP_ADMIN_PASSWORD_HASH for production.",
    adminCount: "Admins",
    activeSessions: "Active sessions",
    failedLogins24h: "Failed logins (24h)",
    auditEvents24h: "Audit events (24h)",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmNewPassword: "Confirm new password",
    updatePassword: "Update password",
    revokeSessionAction: "Force sign out",
    clearIpAttemptsAction: "Clear IP records",
    failedCount: "Failed count",
    lastSeen: "Last seen",
    relatedUsers: "Related users",
    configBaseDomain: "Base domain",
    configBootstrapAdmin: "Bootstrap admin",
    configCfAccess: "Cloudflare Access",
    configSessionTtl: "Session duration",
    configLoginThreshold: "Failure threshold",
    configLoginBlock: "Block duration",
    configReceivingStrategy: "Receiving strategy",
    configMailboxNaming: "Mailbox naming",
    configMailboxNamingValue: "Random local part or custom local part",
    policyRandomSubdomains: "Random subdomain pool with manual override",
    featureEnabled: "Enabled",
    featureDisabled: "Disabled",
    adminTableUsername: "Username",
    adminTableLastLogin: "Last login",
    ipAddress: "IP address",
    action: "Action",
    expiresAt: "Expires",
    result: "Result",
    reason: "Reason",
    target: "Target",
    currentSession: "Current session",
    loginSuccess: "Success",
    loginFailure: "Failed",
    notAvailable: "Not available",
    sessionStatusActive: "Active",
    sessionStatusRevoked: "Revoked",
    sessionStatusExpired: "Expired",
    sessionStatusCurrent: "Current",
    passwordChangedSuccess: "Password updated. Other sessions were signed out.",
    revokeSessionSuccess: "Session signed out.",
    revokeCurrentSessionSuccess: "Current session signed out. Please sign in again.",
    clearIpAttemptsSuccess: "Cleared failed login records for {ip}.",
    invalidCurrentPassword: "Current password is incorrect.",
    passwordTooShort: "New password must be at least 10 characters.",
    passwordConfirmMismatch: "New password confirmation does not match.",
    passwordReuseNotAllowed: "Use a different password than the current one.",
    revokeSessionConfirm: "Force this session to sign out?",
    revokeCurrentSessionConfirm: "Force the current session to sign out? You will be returned to the sign-in page.",
    clearIpAttemptsConfirm: "Clear all failed login records for {ip}?",
    dashboardStatusTitle: "Current status",
    dashboardStatusHealthy: "No security alerts were recorded in the last hour. Daily mailbox management can continue as usual.",
    dashboardStatusAlertTitle: "Recent security attention",
    mailboxSummaryCard: "Mailbox summary",
    mailboxSummaryHint: "Review mailbox volume, active inboxes, and paused addresses in one place.",
    workspaceMaintenance: "Maintenance",
    workspaceMaintenanceBody: "Run low-risk cleanup tasks for empty mailboxes and unused subdomains.",
    mailboxInfo: "Mailbox info",
    mailboxActivity: "Receiving",
    emailListHint: "Review, search, and bulk-manage stored messages for this mailbox.",
    noMailboxesYet: "No mailboxes yet.",
    noSubdomainsYet: "No domains yet.",
    noMailboxesYetAll: "No mailboxes yet. Create one above to start receiving mail.",
    noMailboxesYetFiltered: "No mailboxes exist under {domain} yet.",
    noSubdomainsYetAction: "No receiving domains yet. Generate a batch first, then create mailboxes.",
    mailboxListLeadAll: "All mailboxes",
    mailboxListLeadFiltered: "{domain}",
    mailboxFilterSummaryAll: "All mailboxes | {count} total",
    mailboxFilterSummaryFiltered: "{domain} | {count} mailboxes",
    subdomainListLead: "Click a domain to focus its mailboxes. Click it again to return to all mailboxes.",
    showAllMailboxes: "View all",
    pageIndicator: "Page {current} of {total}",
    previousPage: "Previous",
    nextPage: "Next",
    mailboxCountLabel: "Mailboxes",
    messageDetails: "Message details",
    deleteSelectedDomain: "Delete selected domain",
    deleteSelectedMailbox: "Delete selected mailbox",
    deleteSelectedDomainSuccess: "Deleted domain {domain}.",
    deleteSelectedMailboxSuccess: "Deleted mailbox {address}.",
    confirmDeleteEmptyMailboxes: "Clear all mailboxes that do not contain emails?",
    confirmDeleteAllSubdomains: "Clear all unused domains?",
    selectDomainToDelete: "Select a domain first.",
    selectMailboxToDelete: "Select a mailbox first.",
    confirmDeleteSelectedDomain: "Delete the selected domain?",
    confirmDeleteSelectedMailbox: "Delete the selected mailbox?",
    confirmDeleteSelectedDomainWithMailboxes:
      "This domain still has {count} mailboxes. Deleting it will also remove those mailboxes and stored mail. Continue?",
    confirmDeleteSelectedMailboxWithEmails:
      "This mailbox still has {count} emails. Deleting it will also remove stored messages and attachments. Continue?",
    confirmDialogDeleteTitle: "Confirm deletion",
    confirmDialogCleanupTitle: "Confirm cleanup",
    confirmDialogCancel: "Cancel",
    confirmDialogDeleteAction: "Delete",
    confirmDialogCleanupAction: "Clear",
    confirmDialogIrreversible: "This action cannot be undone.",
    invalidCredentials: "Username or password is incorrect.",
    loginBlocked: "Too many failed attempts. Try again in {minutes} minutes.",
    invalidInput: "Username and password are required.",
    invalidLocalPart:
      "Local part must be 1-32 characters and use lowercase letters, numbers, dots, underscores, or hyphens.",
    mailboxAlreadyExists: "This mailbox address already exists. Use another local part or another subdomain.",
    mailboxSchemaOutdated:
      "The remote D1 database still has an old migration state, so this subdomain can only create one mailbox. Apply migration 0003 and try again.",
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
    appTitleSuffixAdminPanel: "管理员面板",
    appTitleSuffixMailboxes: "邮箱工作台",
    appTitleSuffixMailboxDetail: "邮箱详情",
    appTitleSuffixEmailDetail: "邮件详情",
    appSubtitleLogin: "登录后管理私有邮箱、域名池和已保存邮件。",
    noticeSuccessEyebrow: "已完成",
    noticeSuccessTitle: "操作已完成",
    noticeErrorEyebrow: "处理失败",
    noticeErrorTitle: "当前无法继续",
    noticeReminderEyebrow: "提示",
    noticeReminderTitle: "继续前请先处理",
    loginAccessTitle: "登录说明",
    username: "用户名",
    password: "密码",
    signIn: "登录",
    secondGateHint: "仅限已授权管理员登录。",
    language: "语言",
    chinese: "中文",
    english: "English",
    unableToSignIn: "登录失败。",
    signedInAs: "当前登录账号",
    milestoneShell: "这是里程碑 1 的私有应用外壳。",
    logOut: "退出",
    dashboard: "仪表盘",
    adminPanel: "管理员",
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
    openMailboxWorkspace: "打开工作台",
    openAdminPanel: "打开管理员面板",
    mailboxWorkspaceSubtitle: "集中管理接收域名、创建长期邮箱，并维护当前资源池。",
    subdomainPool: "子域名池",
    poolHint: "这里展示当前可用于创建邮箱的接收域名。",
    generateSubdomains: "生成子域名",
    generateCount: "生成数量",
    labelLength: "前缀长度",
    customSubdomains: "自定义子域名前缀",
    customSubdomainsHint: "每行一个前缀，例如：inbox-a",
    customSubdomainsPlaceholder: "vip\nregister\narchive-01",
    createMailbox: "创建邮箱",
    localPartMode: "邮箱前缀模式",
    selectedSubdomain: "子域名",
    randomSubdomainOption: "自动分配（随机子域名）",
    subdomainStrategyTitle: "子域名分配状态",
    subdomainStrategyAutoEyebrow: "随机子域名池",
    subdomainStrategyAutoTitle: "当前会从随机子域名池中分配邮箱后缀。",
    subdomainStrategyAutoBody: "创建时会自动使用下一个可用接收域名。当前候选：{domain}。现有可用域名：{count} 个。",
    subdomainStrategyManualEyebrow: "固定域名",
    subdomainStrategyManualTitle: "本次创建会使用 {domain}。",
    subdomainStrategyManualBody: "这个域名下当前已有 {count} 个邮箱。",
    subdomainStrategyEmptyEyebrow: "当前不可接收",
    subdomainStrategyEmptyTitle: "暂时没有可用接收域名。",
    autoCandidate: "自动候选",
    randomLocalPart: "随机",
    customLocalPart: "自定义",
    localPart: "邮箱前缀",
    localPartPlaceholder: "例如：hello",
    note: "备注",
    notePlaceholder: "创建这个邮箱是为了什么？",
    noNote: "无备注",
    createNow: "创建邮箱",
    refreshData: "刷新",
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
    selectVisible: "勾选当前页",
    clearSelection: "取消勾选",
    selectedCount: "已选择 {count} 封",
    markSelectedRead: "标为已读",
    deleteSelected: "删除所选",
    bulkMarkReadSuccess: "已将 {count} 封邮件标记为已读。",
    bulkDeleteSuccess: "已删除 {count} 封邮件。",
    confirmDeleteSelected: "确定删除所选邮件吗？",
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
    mailboxDetailSubtitle: "查看邮箱信息，并管理这个邮箱内已保存的邮件。",
    emailDetailSubtitle: "查看这封邮件的正文、附件和保存记录。",
    emailUnavailableMeta: "这条邮件记录暂无可显示的信息。",
    emailUnavailableBody: "这封已保存邮件当前不可用，可能已被删除或清理。",
    mailboxNotFound: "该邮箱不存在，或已经被删除。",
    mailboxUnavailableBody: "这条邮箱记录当前不可用，可能已被删除或清理。",
    emailNotFound: "该邮件不存在，或已经被删除。",
    from: "发件人",
    to: "收件人",
    replyTo: "回复地址",
    subject: "主题",
    receivedAt: "接收时间",
    messageId: "Message-ID",
    noSubject: "（无主题）",
    inboxEmpty: "暂时还没有邮件，这个邮箱已经可以开始接收邮件了。",
    inboxEmptyTitle: "还没有邮件",
    inboxEmptyBody: "这个邮箱已经启用，可以继续等待新邮件进入。",
    noMatchingEmailsTitle: "没有匹配的邮件",
    noMatchingEmailsBody: "可以换一个关键词，或清空当前筛选条件后再查看。",
    emailRead: "已读",
    emailUnread: "未读",
    hasAttachments: "附件",
    openEmail: "查看详情",
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
    recentSubdomains: "域名列表",
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
    deleteEmptyMailboxes: "清理空邮箱",
    deleteAllSubdomains: "清理未使用域名",
    deleteEmptyMailboxesSuccess: "已清理 {count} 个空邮箱。",
    deleteAllSubdomainsSuccess: "已清理 {count} 个未使用域名。",
    dashboardSubtitle: "集中查看邮箱活跃度、未读邮件和可用接收容量。",
    dashboardOverview: "概览",
    dashboardOverviewBody: "在一个页面里快速查看邮箱数量、未读邮件和可用接收容量。",
    dashboardActions: "快捷入口",
    dashboardActionsBody: "前往邮箱工作台创建地址、管理域名池，并处理已保存邮件。",
    adminPanelSubtitle: "集中查看管理员访问状态、安全活动和当前运行策略。",
    adminOverviewCard: "管理概览",
    adminOverviewBody: "把管理员账号、近期登录和部署规则集中放在一个页面里查看。",
    adminAccessPolicy: "访问策略",
    adminAccessPolicyBody: "这里展示当前部署使用的登录规则和接收域名策略。",
    adminRoster: "管理员账号",
    adminSecurityActions: "安全操作",
    adminSecurityActionsBody: "在这里修改密码、强制下线会话，并清理异常失败登录 IP 记录。",
    adminRecentSessions: "最近会话",
    adminRecentSessionsEmpty: "暂时还没有会话记录。",
    adminRecentLogins: "最近登录尝试",
    adminRecentLoginsEmpty: "暂时还没有登录尝试记录。",
    adminRecentAuditLogs: "最近操作记录",
    adminRecentAuditLogsEmpty: "暂时还没有审计记录。",
    suspiciousLoginIps: "异常登录 IP",
    suspiciousLoginIpsEmpty: "当前没有需要处理的异常 IP。",
    systemHealth: "系统健康状态",
    systemHealthBody: "上线前在这里检查部署安全项和数据库迁移状态。",
    systemHealthOk: "状态正常",
    systemHealthNeedsAction: "需要处理",
    healthSchemaOk: "D1 结构已支持同一个子域名下创建多个邮箱。",
    healthLegacySubdomainIndex: "D1 中仍存在旧的子域名唯一索引。请先应用 0003 迁移，再在同一子域名下创建多个邮箱。",
    healthPlainPasswordWarning:
      "当前部署仍设置了明文初始密码。生产环境建议改用 Cloudflare Secret 或 BOOTSTRAP_ADMIN_PASSWORD_HASH。",
    adminCount: "管理员数量",
    activeSessions: "活跃会话",
    failedLogins24h: "24 小时失败登录",
    auditEvents24h: "24 小时操作记录",
    changePassword: "修改密码",
    currentPassword: "当前密码",
    newPassword: "新密码",
    confirmNewPassword: "确认新密码",
    updatePassword: "更新密码",
    revokeSessionAction: "强制下线",
    clearIpAttemptsAction: "清理该 IP 记录",
    failedCount: "失败次数",
    lastSeen: "最后出现",
    relatedUsers: "涉及账号",
    configBaseDomain: "主域名",
    configBootstrapAdmin: "初始管理员",
    configCfAccess: "Cloudflare Access",
    configSessionTtl: "会话时长",
    configLoginThreshold: "失败阈值",
    configLoginBlock: "封锁时长",
    configReceivingStrategy: "接收策略",
    configMailboxNaming: "邮箱前缀策略",
    configMailboxNamingValue: "支持随机前缀，也支持自定义前缀",
    policyRandomSubdomains: "随机子域名池，可按需手动指定",
    featureEnabled: "已启用",
    featureDisabled: "未启用",
    adminTableUsername: "用户名",
    adminTableLastLogin: "最后登录",
    ipAddress: "IP 地址",
    action: "操作",
    expiresAt: "到期时间",
    result: "结果",
    reason: "原因",
    target: "目标",
    currentSession: "当前会话",
    loginSuccess: "成功",
    loginFailure: "失败",
    notAvailable: "暂无",
    sessionStatusActive: "活跃",
    sessionStatusRevoked: "已撤销",
    sessionStatusExpired: "已过期",
    sessionStatusCurrent: "当前",
    passwordChangedSuccess: "密码已更新，其他会话已全部下线。",
    revokeSessionSuccess: "会话已强制下线。",
    revokeCurrentSessionSuccess: "当前会话已下线，请重新登录。",
    clearIpAttemptsSuccess: "已清理 {ip} 的失败登录记录。",
    invalidCurrentPassword: "当前密码不正确。",
    passwordTooShort: "新密码至少需要 10 位。",
    passwordConfirmMismatch: "两次输入的新密码不一致。",
    passwordReuseNotAllowed: "新密码不能与当前密码相同。",
    revokeSessionConfirm: "确定强制下线这个会话吗？",
    revokeCurrentSessionConfirm: "确定下线当前会话吗？执行后会回到登录页。",
    clearIpAttemptsConfirm: "确定清理 {ip} 的全部失败登录记录吗？",
    dashboardStatusTitle: "当前状态",
    dashboardStatusHealthy: "最近一小时内没有新的安全提醒，可以继续日常管理工作。",
    dashboardStatusAlertTitle: "最近安全提醒",
    mailboxSummaryCard: "邮箱概况",
    mailboxSummaryHint: "集中查看当前邮箱数量、活跃情况和暂停状态。",
    workspaceMaintenance: "维护操作",
    workspaceMaintenanceBody: "集中处理无邮件邮箱和未使用子域名，保持资源池整洁。",
    mailboxInfo: "邮箱信息",
    mailboxActivity: "接收状态",
    emailListHint: "在这里查看、搜索并批量处理这个邮箱里的邮件。",
    noMailboxesYet: "暂时还没有邮箱。",
    noSubdomainsYet: "暂时还没有域名。",
    noMailboxesYetAll: "还没有邮箱。先在上方创建一个邮箱，再开始收信。",
    noMailboxesYetFiltered: "{domain} 下还没有邮箱。",
    noSubdomainsYetAction: "还没有接收域名。先生成一批子域名，再创建邮箱。",
    mailboxListLeadAll: "全部邮箱",
    mailboxListLeadFiltered: "{domain}",
    mailboxFilterSummaryAll: "全部邮箱 | 共 {count} 个",
    mailboxFilterSummaryFiltered: "{domain} | {count} 个邮箱",
    subdomainListLead: "单击域名可筛选邮箱，再点一次可回到全部邮箱。",
    showAllMailboxes: "查看全部",
    pageIndicator: "第 {current} / {total} 页",
    previousPage: "上一页",
    nextPage: "下一页",
    mailboxCountLabel: "邮箱数量",
    messageDetails: "邮件详情",
    deleteSelectedDomain: "删除所选域名",
    deleteSelectedMailbox: "删除所选邮箱",
    deleteSelectedDomainSuccess: "已删除域名 {domain}。",
    deleteSelectedMailboxSuccess: "已删除邮箱 {address}。",
    confirmDeleteEmptyMailboxes: "确定清理所有空邮箱吗？",
    confirmDeleteAllSubdomains: "确定清理所有未使用域名吗？",
    selectDomainToDelete: "请先选择一个域名。",
    selectMailboxToDelete: "请先选择一个邮箱。",
    confirmDeleteSelectedDomain: "确定删除所选域名吗？",
    confirmDeleteSelectedMailbox: "确定删除所选邮箱吗？",
    confirmDeleteSelectedDomainWithMailboxes:
      "该域名下仍有 {count} 个邮箱。删除后会同时移除这些邮箱及其已保存邮件，是否继续？",
    confirmDeleteSelectedMailboxWithEmails:
      "该邮箱中仍有 {count} 封邮件。删除后会同时移除已保存邮件及附件，是否继续？",
    confirmDialogDeleteTitle: "确认删除",
    confirmDialogCleanupTitle: "确认清理",
    confirmDialogCancel: "取消",
    confirmDialogDeleteAction: "删除",
    confirmDialogCleanupAction: "清理",
    confirmDialogIrreversible: "此操作执行后无法撤销。",
    invalidCredentials: "用户名或密码不正确。",
    loginBlocked: "失败次数过多，请在 {minutes} 分钟后再试。",
    invalidInput: "用户名和密码不能为空。",
    invalidLocalPart: "邮箱前缀长度需在 1-32 之间，并且只能使用小写字母、数字、点、下划线或短横线。",
    mailboxAlreadyExists: "这个邮箱地址已经存在，请换一个邮箱前缀或子域名。",
    mailboxSchemaOutdated: "远程 D1 仍停留在旧迁移状态，导致一个子域名只能创建一个邮箱。请先应用 0003 迁移后再试。",
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
  const cfConnectingIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For")?.trim();
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = request.headers.get("X-Real-IP")?.trim();
  if (realIp) {
    return realIp;
  }

  const hostname = new URL(request.url).hostname;
  if (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1") {
    return "127.0.0.1";
  }

  return "0.0.0.0";
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function hasPlainBootstrapPassword(env: Env): boolean {
  return Boolean(env.BOOTSTRAP_ADMIN_PASSWORD_PLAIN?.trim());
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isLegacySubdomainUniqueIndexError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("idx_mailboxes_unique_subdomain") ||
    normalized.includes("unique constraint failed: mailboxes.subdomain_id")
  );
}

function isMailboxAddressConflictError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unique constraint failed: mailboxes.full_address") ||
    normalized.includes("unique constraint failed: mailboxes.local_part, mailboxes.subdomain_id")
  );
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
    { href: "/admin", label: t(locale, "adminPanel") },
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
      [hidden] {
        display: none !important;
      }
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
      button:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px rgba(21, 111, 91, 0.2);
      }
      button:not(:disabled):active {
        transform: translateY(0);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 1;
        color: #8c8578;
        background: linear-gradient(180deg, #efe9dc 0%, #e8e1d2 100%);
        border: 1px solid #ddd4c4;
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
      button.secondary:disabled {
        background: rgba(243, 239, 231, 0.92);
        border-color: #ddd4c4;
        color: #9a9285;
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
      .metrics--compact .metric {
        min-height: 92px;
        padding: 16px;
      }
      .metrics--compact .metric strong {
        font-size: 28px;
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
        display: grid;
        gap: 8px;
        padding: 14px 16px;
        border-radius: 10px;
        border: 1px solid rgba(155, 44, 44, 0.18);
        background: rgba(155, 44, 44, 0.06);
        color: var(--danger);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
      }
      .notice__eyebrow {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .notice__title {
        margin: 0;
        color: var(--text);
        font-size: 15px;
        font-weight: 700;
        line-height: 1.4;
      }
      .notice__body {
        margin: 0;
        color: inherit;
        font-size: 14px;
        line-height: 1.6;
      }
      .notice--success {
        border-color: rgba(21, 111, 91, 0.18);
        background: rgba(21, 111, 91, 0.08);
        color: var(--accent-strong);
      }
      .notice--success .notice__eyebrow {
        color: var(--accent-strong);
      }
      .notice--error .notice__eyebrow {
        color: var(--danger);
      }
      .notice--reminder {
        border-color: rgba(154, 111, 26, 0.2);
        background: rgba(154, 111, 26, 0.07);
        color: #7a5a1f;
      }
      .notice--reminder .notice__eyebrow {
        color: #8a661f;
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
      .list-item--interactive {
        cursor: pointer;
        transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
      }
      .list-item--interactive:hover {
        border-color: var(--line-strong);
        background: rgba(255, 255, 255, 0.98);
      }
      .list-item--interactive.is-active {
        border-color: rgba(21, 111, 91, 0.5);
        background: rgba(21, 111, 91, 0.08);
        box-shadow: inset 3px 0 0 var(--accent);
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
      .summary-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .section-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.95fr);
      }
      .section-grid--workspace {
        grid-template-columns: minmax(280px, 0.92fr) minmax(0, 1.45fr);
        align-items: stretch;
      }
      .sidebar-stack {
        display: grid;
        gap: 18px;
        align-content: start;
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
      .toolbar-panel {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        padding: 16px 18px;
        border: 1px solid rgba(21, 111, 91, 0.14);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.84);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
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
      .filter-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .selection-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding-top: 4px;
      }
      .pagination[hidden] {
        display: none;
      }
      .pagination-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
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
        transition: background 140ms ease, box-shadow 140ms ease;
      }
      .table tbody tr:hover {
        background: rgba(21, 111, 91, 0.04);
      }
      .table tbody tr.is-selected {
        background: rgba(21, 111, 91, 0.1);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .table tbody tr.is-selected:hover {
        background: rgba(21, 111, 91, 0.14);
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
      .detail-grid--mailbox {
        grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
      }
      .detail-list {
        display: grid;
        gap: 12px;
      }
      .state-panel {
        display: grid;
        gap: 10px;
        padding: 16px 18px;
        border: 1px dashed rgba(201, 193, 177, 0.92);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(249, 245, 237, 0.92) 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }
      .state-panel--compact {
        padding: 14px 16px;
        gap: 8px;
      }
      .state-panel--danger {
        border-style: solid;
        border-color: rgba(155, 44, 44, 0.18);
        background: rgba(155, 44, 44, 0.04);
      }
      .state-panel__title {
        margin: 0;
        color: var(--text);
        font-size: 15px;
        font-weight: 700;
        line-height: 1.4;
      }
      .state-panel__eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .state-panel__body {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.65;
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
      .workspace-card {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 10px;
        min-height: 100%;
      }
      .workspace-card__header {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        min-height: 68px;
      }
      .workspace-card__header .title-block {
        min-height: 68px;
        align-content: start;
      }
      .workspace-card__body {
        min-height: 0;
        display: grid;
        align-content: start;
        gap: 12px;
      }
      .workspace-card__footer {
        min-height: 32px;
        display: flex;
        align-items: flex-end;
      }
      .workspace-list {
        align-content: start;
        gap: 10px;
      }
      .workspace-list .list-item {
        padding: 14px 16px;
      }
      .workspace-table-wrap {
        min-height: 0;
      }
      .workspace-table-wrap .table {
        margin: 0;
      }
      .workspace-header-meta {
        display: grid;
        gap: 8px;
        justify-items: end;
      }
      .workspace-header-meta .pagination {
        padding-top: 0;
      }
      .confirm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(25, 28, 32, 0.32);
        backdrop-filter: blur(6px);
      }
      .confirm-backdrop[hidden] {
        display: none;
      }
      .confirm-dialog {
        width: min(500px, 100%);
        display: grid;
        gap: 18px;
        padding: 24px;
        border: 1px solid rgba(155, 44, 44, 0.14);
        border-radius: 10px;
        background: rgba(255, 253, 250, 0.99);
        box-shadow: 0 24px 60px rgba(27, 33, 35, 0.18);
      }
      .confirm-dialog__header {
        display: grid;
        gap: 6px;
      }
      .confirm-dialog__eyebrow {
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .confirm-dialog__body {
        display: grid;
        gap: 12px;
      }
      .confirm-dialog__message {
        color: var(--text);
        font-size: 15px;
        line-height: 1.65;
      }
      .confirm-dialog__detail {
        padding: 13px 14px;
        border: 1px solid rgba(155, 44, 44, 0.16);
        border-radius: 10px;
        background: rgba(155, 44, 44, 0.05);
        color: #7b4338;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
      .confirm-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
        padding-top: 6px;
        border-top: 1px solid rgba(217, 210, 196, 0.8);
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
      .email-body.is-empty-state {
        min-height: 260px;
        white-space: normal;
        color: var(--muted);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 244, 236, 0.96) 100%);
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
        line-height: 1.6;
      }
      .empty--center {
        text-align: center;
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
        .summary-grid,
        .section-grid {
          grid-template-columns: 1fr;
        }
        .detail-grid,
        .detail-grid--mailbox {
          grid-template-columns: 1fr;
        }
        .control-grid {
          grid-template-columns: 1fr;
        }
        .workspace-card__header,
        .workspace-card__header .title-block,
        .workspace-header-meta {
          min-height: 0;
        }
        .workspace-header-meta {
          justify-items: start;
        }
        .confirm-backdrop {
          padding: 14px;
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
          <div class="state-panel state-panel--compact">
            <p class="state-panel__eyebrow">${t(locale, "loginAccessTitle")}</p>
            <p class="state-panel__body">${t(locale, "secondGateHint")}</p>
          </div>
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
      const noticeText = {
        successEyebrow: ${JSON.stringify(t(locale, "noticeSuccessEyebrow"))},
        successTitle: ${JSON.stringify(t(locale, "noticeSuccessTitle"))},
        errorEyebrow: ${JSON.stringify(t(locale, "noticeErrorEyebrow"))},
        errorTitle: ${JSON.stringify(t(locale, "noticeErrorTitle"))},
        reminderEyebrow: ${JSON.stringify(t(locale, "noticeReminderEyebrow"))},
        reminderTitle: ${JSON.stringify(t(locale, "noticeReminderTitle"))}
      };
      const form = document.getElementById("login-form");
      const message = document.getElementById("message");

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function renderNotice(kind, body, title = "") {
        const palette = kind === "success"
          ? { eyebrow: noticeText.successEyebrow, title: title || noticeText.successTitle, className: "notice notice--success" }
          : kind === "reminder"
            ? { eyebrow: noticeText.reminderEyebrow, title: title || noticeText.reminderTitle, className: "notice notice--reminder" }
            : { eyebrow: noticeText.errorEyebrow, title: title || noticeText.errorTitle, className: "notice notice--error" };
        return {
          className: palette.className,
          html:
            '<p class="notice__eyebrow">' + escapeHtml(palette.eyebrow) + '</p>' +
            '<p class="notice__title">' + escapeHtml(palette.title) + '</p>' +
            '<p class="notice__body">' + escapeHtml(body) + '</p>'
        };
      }

      function showNotice(kind, body, title = "") {
        const notice = renderNotice(kind, body, title);
        message.hidden = false;
        message.className = notice.className;
        message.innerHTML = notice.html;
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.hidden = true;
        message.innerHTML = "";
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
          const code = payload.error?.code;
          const serverMessage = payload.error?.message ?? localizedErrors.DEFAULT;
          if (code === "LOGIN_BLOCKED") {
            const matched = String(serverMessage).match(/(\\d+)/);
            const minutes = matched ? matched[1] : "";
            showNotice("reminder", localizedErrors.LOGIN_BLOCKED.replace("{minutes}", minutes));
            return;
          }
          if (code === "INVALID_INPUT") {
            showNotice("reminder", localizedErrors.INVALID_INPUT);
            return;
          }
          showNotice("error", localizedErrors[code] ?? serverMessage ?? localizedErrors.DEFAULT);
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
              <p>${t(locale, "signedInAs")} <code>${username}</code>. ${t(locale, "dashboardSubtitle")}</p>
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
          <div id="security-alert" class="state-panel state-panel--compact">
            <p id="security-alert-title" class="state-panel__eyebrow">${t(locale, "dashboardStatusTitle")}</p>
            <p id="security-alert-body" class="state-panel__body">${t(locale, "dashboardStatusHealthy")}</p>
          </div>
          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "dashboardOverview")}</h2>
              <p class="muted">${t(locale, "dashboardOverviewBody")}</p>
            </div>
            <div class="card">
              <h2>${t(locale, "dashboardActions")}</h2>
              <p class="muted">${t(locale, "dashboardActionsBody")}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const metricsEl = document.getElementById("metrics");
      const alertEl = document.getElementById("security-alert");
      const alertTitleEl = document.getElementById("security-alert-title");
      const alertBodyEl = document.getElementById("security-alert-body");
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
          alertEl.className = "state-panel state-panel--compact state-panel--danger";
          alertTitleEl.textContent = ${JSON.stringify(t(locale, "dashboardStatusAlertTitle"))};
          alertBodyEl.textContent = payload.securityAlerts[0].message;
          return;
        }

        alertEl.className = "state-panel state-panel--compact";
        alertTitleEl.textContent = ${JSON.stringify(t(locale, "dashboardStatusTitle"))};
        alertBodyEl.textContent = ${JSON.stringify(t(locale, "dashboardStatusHealthy"))};
      }

      loadDashboard();
    </script>`,
    locale
  );
}

function renderAdminPage(appName: string, username: string, locale: Locale): string {
  return renderLayout(
    `${appName} - ${t(locale, "appTitleSuffixAdminPanel")}`,
    `<main class="shell">
      <section class="panel">
        <div class="header">
          <div class="header-top">
            ${renderNav("/admin", locale)}
            ${renderLanguageSwitcher("/admin", locale)}
          </div>
          <div class="row">
            <div>
              <h1>${t(locale, "adminPanel")}</h1>
              <p>${t(locale, "signedInAs")} <code>${username}</code>. ${t(locale, "adminPanelSubtitle")}</p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill" href="/dashboard?lang=${locale}">${t(locale, "dashboard")}</a>
              <a class="nav-pill" href="/mailboxes?lang=${locale}">${t(locale, "openMailboxWorkspace")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div id="page-message" class="notice" hidden></div>
          <div class="metrics" id="admin-metrics">
            <div class="metric"><strong>-</strong><span>${t(locale, "adminCount")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "activeSessions")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "failedLogins24h")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "auditEvents24h")}</span></div>
          </div>
          <div id="admin-health" class="state-panel state-panel--compact">
            <p class="state-panel__eyebrow">${t(locale, "systemHealth")}</p>
            <p class="state-panel__title">${t(locale, "systemHealthOk")}</p>
            <p class="state-panel__body">${t(locale, "systemHealthBody")}</p>
          </div>

          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "adminOverviewCard")}</h2>
              <p class="muted">${t(locale, "adminOverviewBody")}</p>
              <div id="admin-roster" class="detail-list"></div>
            </div>
            <div class="card">
              <h2>${t(locale, "adminAccessPolicy")}</h2>
              <p class="muted">${t(locale, "adminAccessPolicyBody")}</p>
              <div id="admin-policy" class="detail-list"></div>
            </div>
          </div>

          <div class="card-grid">
            <div class="card">
              <h2>${t(locale, "changePassword")}</h2>
              <p class="muted">${t(locale, "adminSecurityActionsBody")}</p>
              <form id="password-form">
                <label>
                  ${t(locale, "currentPassword")}
                  <input type="password" name="currentPassword" autocomplete="current-password" required />
                </label>
                <label>
                  ${t(locale, "newPassword")}
                  <input type="password" name="newPassword" autocomplete="new-password" required />
                </label>
                <label>
                  ${t(locale, "confirmNewPassword")}
                  <input type="password" name="confirmPassword" autocomplete="new-password" required />
                </label>
                <button type="submit">${t(locale, "updatePassword")}</button>
              </form>
            </div>
            <div class="card">
              <h2>${t(locale, "suspiciousLoginIps")}</h2>
              <p class="muted">${t(locale, "adminSecurityActionsBody")}</p>
              <div class="workspace-table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>${t(locale, "ipAddress")}</th>
                      <th>${t(locale, "failedCount")}</th>
                      <th>${t(locale, "lastSeen")}</th>
                      <th>${t(locale, "relatedUsers")}</th>
                      <th>${t(locale, "action")}</th>
                    </tr>
                  </thead>
                  <tbody id="suspicious-ip-rows"></tbody>
                </table>
              </div>
              <div id="suspicious-ip-empty" class="empty empty--center" hidden>${t(locale, "suspiciousLoginIpsEmpty")}</div>
            </div>
          </div>

          <div class="card">
            <div class="row row--start">
              <h2>${t(locale, "adminRecentSessions")}</h2>
            </div>
            <div class="workspace-table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>${t(locale, "adminTableUsername")}</th>
                    <th>${t(locale, "ipAddress")}</th>
                    <th>${t(locale, "createdAt")}</th>
                    <th>${t(locale, "expiresAt")}</th>
                    <th>${t(locale, "status")}</th>
                    <th>${t(locale, "action")}</th>
                  </tr>
                </thead>
                <tbody id="session-rows"></tbody>
              </table>
            </div>
            <div id="session-empty" class="empty empty--center" hidden>${t(locale, "adminRecentSessionsEmpty")}</div>
          </div>

          <div class="card">
            <div class="row row--start">
              <h2>${t(locale, "adminRecentLogins")}</h2>
            </div>
            <div class="workspace-table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>${t(locale, "adminTableUsername")}</th>
                    <th>${t(locale, "ipAddress")}</th>
                    <th>${t(locale, "result")}</th>
                    <th>${t(locale, "reason")}</th>
                    <th>${t(locale, "createdAt")}</th>
                  </tr>
                </thead>
                <tbody id="login-attempt-rows"></tbody>
              </table>
            </div>
            <div id="login-attempt-empty" class="empty empty--center" hidden>${t(locale, "adminRecentLoginsEmpty")}</div>
          </div>

          <div class="card">
            <div class="row row--start">
              <h2>${t(locale, "adminRecentAuditLogs")}</h2>
            </div>
            <div class="workspace-table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>${t(locale, "action")}</th>
                    <th>${t(locale, "target")}</th>
                    <th>${t(locale, "createdAt")}</th>
                  </tr>
                </thead>
                <tbody id="audit-log-rows"></tbody>
              </table>
            </div>
            <div id="audit-log-empty" class="empty empty--center" hidden>${t(locale, "adminRecentAuditLogsEmpty")}</div>
          </div>
        </div>
      </section>
      <div id="confirm-backdrop" class="confirm-backdrop" hidden>
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
          <div class="confirm-dialog__header">
            <span id="confirm-dialog-eyebrow" class="confirm-dialog__eyebrow">${t(locale, "confirmDialogDeleteTitle")}</span>
            <h2 id="confirm-dialog-title">${t(locale, "confirmDialogDeleteTitle")}</h2>
          </div>
          <div class="confirm-dialog__body">
            <p id="confirm-dialog-message" class="confirm-dialog__message"></p>
            <p id="confirm-dialog-detail" class="confirm-dialog__detail" hidden></p>
          </div>
          <div class="confirm-dialog__actions">
            <button id="confirm-dialog-cancel" class="secondary" type="button">${t(locale, "confirmDialogCancel")}</button>
            <button id="confirm-dialog-confirm" type="button">${t(locale, "confirmDialogDeleteAction")}</button>
          </div>
        </div>
      </div>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const text = {
        adminCount: ${JSON.stringify(t(locale, "adminCount"))},
        activeSessions: ${JSON.stringify(t(locale, "activeSessions"))},
        failedLogins24h: ${JSON.stringify(t(locale, "failedLogins24h"))},
        auditEvents24h: ${JSON.stringify(t(locale, "auditEvents24h"))},
        configBaseDomain: ${JSON.stringify(t(locale, "configBaseDomain"))},
        configBootstrapAdmin: ${JSON.stringify(t(locale, "configBootstrapAdmin"))},
        configCfAccess: ${JSON.stringify(t(locale, "configCfAccess"))},
        configSessionTtl: ${JSON.stringify(t(locale, "configSessionTtl"))},
        configLoginThreshold: ${JSON.stringify(t(locale, "configLoginThreshold"))},
        configLoginBlock: ${JSON.stringify(t(locale, "configLoginBlock"))},
        configReceivingStrategy: ${JSON.stringify(t(locale, "configReceivingStrategy"))},
        configMailboxNaming: ${JSON.stringify(t(locale, "configMailboxNaming"))},
        configMailboxNamingValue: ${JSON.stringify(t(locale, "configMailboxNamingValue"))},
        policyRandomSubdomains: ${JSON.stringify(t(locale, "policyRandomSubdomains"))},
        featureEnabled: ${JSON.stringify(t(locale, "featureEnabled"))},
        featureDisabled: ${JSON.stringify(t(locale, "featureDisabled"))},
        noticeSuccessEyebrow: ${JSON.stringify(t(locale, "noticeSuccessEyebrow"))},
        noticeSuccessTitle: ${JSON.stringify(t(locale, "noticeSuccessTitle"))},
        noticeErrorEyebrow: ${JSON.stringify(t(locale, "noticeErrorEyebrow"))},
        noticeErrorTitle: ${JSON.stringify(t(locale, "noticeErrorTitle"))},
        noticeReminderEyebrow: ${JSON.stringify(t(locale, "noticeReminderEyebrow"))},
        noticeReminderTitle: ${JSON.stringify(t(locale, "noticeReminderTitle"))},
        notAvailable: ${JSON.stringify(t(locale, "notAvailable"))},
        loginSuccess: ${JSON.stringify(t(locale, "loginSuccess"))},
        loginFailure: ${JSON.stringify(t(locale, "loginFailure"))},
        currentPassword: ${JSON.stringify(t(locale, "currentPassword"))},
        newPassword: ${JSON.stringify(t(locale, "newPassword"))},
        confirmNewPassword: ${JSON.stringify(t(locale, "confirmNewPassword"))},
        updatePassword: ${JSON.stringify(t(locale, "updatePassword"))},
        revokeSessionAction: ${JSON.stringify(t(locale, "revokeSessionAction"))},
        clearIpAttemptsAction: ${JSON.stringify(t(locale, "clearIpAttemptsAction"))},
        currentSession: ${JSON.stringify(t(locale, "currentSession"))},
        sessionStatusActive: ${JSON.stringify(t(locale, "sessionStatusActive"))},
        sessionStatusRevoked: ${JSON.stringify(t(locale, "sessionStatusRevoked"))},
        sessionStatusExpired: ${JSON.stringify(t(locale, "sessionStatusExpired"))},
        sessionStatusCurrent: ${JSON.stringify(t(locale, "sessionStatusCurrent"))},
        passwordChangedSuccess: ${JSON.stringify(t(locale, "passwordChangedSuccess"))},
        revokeSessionSuccess: ${JSON.stringify(t(locale, "revokeSessionSuccess"))},
        revokeCurrentSessionSuccess: ${JSON.stringify(t(locale, "revokeCurrentSessionSuccess"))},
        clearIpAttemptsSuccess: ${JSON.stringify(t(locale, "clearIpAttemptsSuccess", { ip: "{ip}" }))},
        invalidCurrentPassword: ${JSON.stringify(t(locale, "invalidCurrentPassword"))},
        passwordTooShort: ${JSON.stringify(t(locale, "passwordTooShort"))},
        passwordConfirmMismatch: ${JSON.stringify(t(locale, "passwordConfirmMismatch"))},
        passwordReuseNotAllowed: ${JSON.stringify(t(locale, "passwordReuseNotAllowed"))},
        revokeSessionConfirm: ${JSON.stringify(t(locale, "revokeSessionConfirm"))},
        revokeCurrentSessionConfirm: ${JSON.stringify(t(locale, "revokeCurrentSessionConfirm"))},
        clearIpAttemptsConfirm: ${JSON.stringify(t(locale, "clearIpAttemptsConfirm", { ip: "{ip}" }))},
        suspiciousLoginIpsEmpty: ${JSON.stringify(t(locale, "suspiciousLoginIpsEmpty"))},
        systemHealth: ${JSON.stringify(t(locale, "systemHealth"))},
        systemHealthOk: ${JSON.stringify(t(locale, "systemHealthOk"))},
        systemHealthNeedsAction: ${JSON.stringify(t(locale, "systemHealthNeedsAction"))},
        healthSchemaOk: ${JSON.stringify(t(locale, "healthSchemaOk"))},
        healthLegacySubdomainIndex: ${JSON.stringify(t(locale, "healthLegacySubdomainIndex"))},
        healthPlainPasswordWarning: ${JSON.stringify(t(locale, "healthPlainPasswordWarning"))},
        confirmDialogDeleteTitle: ${JSON.stringify(t(locale, "confirmDialogDeleteTitle"))},
        confirmDialogCleanupTitle: ${JSON.stringify(t(locale, "confirmDialogCleanupTitle"))},
        confirmDialogCancel: ${JSON.stringify(t(locale, "confirmDialogCancel"))},
        confirmDialogDeleteAction: ${JSON.stringify(t(locale, "confirmDialogDeleteAction"))},
        confirmDialogCleanupAction: ${JSON.stringify(t(locale, "confirmDialogCleanupAction"))},
        confirmDialogIrreversible: ${JSON.stringify(t(locale, "confirmDialogIrreversible"))},
        active: ${JSON.stringify(t(locale, "statusActive"))},
        paused: ${JSON.stringify(t(locale, "statusPaused"))},
        unexpectedError: ${JSON.stringify(t(locale, "unexpectedError"))}
      };

      const pageMessage = document.getElementById("page-message");
      const confirmBackdrop = document.getElementById("confirm-backdrop");
      const confirmDialogEyebrow = document.getElementById("confirm-dialog-eyebrow");
      const confirmDialogTitle = document.getElementById("confirm-dialog-title");
      const confirmDialogMessage = document.getElementById("confirm-dialog-message");
      const confirmDialogDetail = document.getElementById("confirm-dialog-detail");
      const confirmDialogCancel = document.getElementById("confirm-dialog-cancel");
      const confirmDialogConfirm = document.getElementById("confirm-dialog-confirm");
      const metricsEl = document.getElementById("admin-metrics");
      const healthEl = document.getElementById("admin-health");
      const rosterEl = document.getElementById("admin-roster");
      const policyEl = document.getElementById("admin-policy");
      const passwordForm = document.getElementById("password-form");
      const suspiciousIpRows = document.getElementById("suspicious-ip-rows");
      const suspiciousIpEmpty = document.getElementById("suspicious-ip-empty");
      const sessionRows = document.getElementById("session-rows");
      const sessionEmpty = document.getElementById("session-empty");
      const loginAttemptRows = document.getElementById("login-attempt-rows");
      const loginAttemptEmpty = document.getElementById("login-attempt-empty");
      const auditLogRows = document.getElementById("audit-log-rows");
      const auditLogEmpty = document.getElementById("audit-log-empty");
      const logoutButton = document.getElementById("logout-button");
      let pendingConfirmResolver = null;

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function formatDate(value) {
        if (!value) return text.notAvailable;
        return String(value).replace("T", " ").slice(0, 16);
      }

      function showMessage(kind, value) {
        const palette = kind === "success"
          ? { eyebrow: text.noticeSuccessEyebrow, title: text.noticeSuccessTitle, className: "notice notice--success" }
          : kind === "reminder"
            ? { eyebrow: text.noticeReminderEyebrow, title: text.noticeReminderTitle, className: "notice notice--reminder" }
            : { eyebrow: text.noticeErrorEyebrow, title: text.noticeErrorTitle, className: "notice notice--error" };
        pageMessage.hidden = false;
        pageMessage.className = palette.className;
        pageMessage.innerHTML =
          '<p class="notice__eyebrow">' + escapeHtml(palette.eyebrow) + '</p>' +
          '<p class="notice__title">' + escapeHtml(palette.title) + '</p>' +
          '<p class="notice__body">' + escapeHtml(value) + '</p>';
      }

      function clearMessage() {
        pageMessage.hidden = true;
        pageMessage.innerHTML = "";
      }

      function renderDetailItem(label, value, meta = "") {
        return '<div class="detail-item">' +
          '<span class="detail-label">' + escapeHtml(label) + '</span>' +
          '<strong class="detail-value">' + escapeHtml(value) + '</strong>' +
          (meta ? '<span class="table-preview">' + escapeHtml(meta) + '</span>' : "") +
        '</div>';
      }

      function renderSystemHealth(health) {
        const messages = [];
        const needsAction = Boolean(health?.database?.legacySubdomainUniqueIndexExists) || Boolean(health?.plainBootstrapPasswordExposed);

        messages.push(
          health?.database?.legacySubdomainUniqueIndexExists
            ? text.healthLegacySubdomainIndex
            : text.healthSchemaOk
        );
        if (health?.plainBootstrapPasswordExposed) {
          messages.push(text.healthPlainPasswordWarning);
        }

        healthEl.className = "state-panel state-panel--compact" + (needsAction ? " state-panel--danger" : "");
        healthEl.innerHTML =
          '<p class="state-panel__eyebrow">' + escapeHtml(text.systemHealth) + '</p>' +
          '<p class="state-panel__title">' + escapeHtml(needsAction ? text.systemHealthNeedsAction : text.systemHealthOk) + '</p>' +
          '<p class="state-panel__body">' + escapeHtml(messages.join(" ")) + '</p>';
      }

      function resolveConfirmDialog(result) {
        if (!pendingConfirmResolver) {
          return;
        }
        const next = pendingConfirmResolver;
        pendingConfirmResolver = null;
        confirmBackdrop.hidden = true;
        document.body.style.overflow = "";
        next(result);
      }

      function openConfirmDialog(options) {
        confirmDialogEyebrow.textContent = options.eyebrow || text.confirmDialogDeleteTitle;
        confirmDialogTitle.textContent = options.title || text.confirmDialogDeleteTitle;
        confirmDialogMessage.textContent = options.message || "";
        confirmDialogDetail.hidden = !options.detail;
        confirmDialogDetail.textContent = options.detail || "";
        confirmDialogConfirm.textContent = options.confirmLabel || text.confirmDialogDeleteAction;
        confirmBackdrop.hidden = false;
        document.body.style.overflow = "hidden";

        return new Promise((resolve) => {
          pendingConfirmResolver = resolve;
        });
      }

      function getSessionStatus(session) {
        if (session.isCurrent) {
          return text.sessionStatusCurrent;
        }
        if (session.revokedAt) {
          return text.sessionStatusRevoked;
        }
        const expiresAt = Date.parse(String(session.expiresAt || ""));
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
          return text.sessionStatusExpired;
        }
        return text.sessionStatusActive;
      }

      confirmDialogCancel.addEventListener("click", () => {
        resolveConfirmDialog(false);
      });

      confirmDialogConfirm.addEventListener("click", () => {
        resolveConfirmDialog(true);
      });

      confirmBackdrop.addEventListener("click", (event) => {
        if (event.target === confirmBackdrop) {
          resolveConfirmDialog(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !confirmBackdrop.hidden) {
          resolveConfirmDialog(false);
        }
      });

      logoutButton.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
      });

      passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();
        const formData = new FormData(passwordForm);
        const currentPassword = String(formData.get("currentPassword") ?? "");
        const newPassword = String(formData.get("newPassword") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");

        if (newPassword.length < 10) {
          showMessage("reminder", text.passwordTooShort);
          return;
        }
        if (newPassword !== confirmPassword) {
          showMessage("reminder", text.passwordConfirmMismatch);
          return;
        }
        if (currentPassword === newPassword) {
          showMessage("reminder", text.passwordReuseNotAllowed);
          return;
        }

        const response = await fetch("/api/admin/password?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-language": currentLang
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          const reminderCodes = [
            "INVALID_CURRENT_PASSWORD",
            "PASSWORD_TOO_SHORT",
            "PASSWORD_CONFIRM_MISMATCH",
            "PASSWORD_REUSE_NOT_ALLOWED"
          ];
          showMessage(reminderCodes.includes(payload.error?.code) ? "reminder" : "error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        passwordForm.reset();
        showMessage("success", text.passwordChangedSuccess);
        await loadAdminPanel();
      });

      sessionRows.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const button = target.closest("[data-session-id]");
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        if (button.disabled) {
          return;
        }

        clearMessage();
        const sessionId = button.getAttribute("data-session-id");
        const isCurrent = button.getAttribute("data-current") === "true";
        if (!sessionId) {
          return;
        }

        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogDeleteTitle,
          title: text.revokeSessionAction,
          message: isCurrent ? text.revokeCurrentSessionConfirm : text.revokeSessionConfirm,
          detail: text.confirmDialogIrreversible,
          confirmLabel: text.revokeSessionAction
        });
        if (!confirmed) {
          return;
        }

        const response = await fetch(
          "/api/admin/sessions/" + encodeURIComponent(sessionId) + "/revoke?lang=" + encodeURIComponent(currentLang),
          {
            method: "POST",
            headers: { "x-app-language": currentLang }
          }
        );
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        if (payload.signedOutCurrentSession) {
          showMessage("success", text.revokeCurrentSessionSuccess);
          window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
          return;
        }

        showMessage("success", text.revokeSessionSuccess);
        await loadAdminPanel();
      });

      suspiciousIpRows.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const button = target.closest("[data-clear-ip]");
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        if (button.disabled) {
          return;
        }

        clearMessage();
        const ipAddress = button.getAttribute("data-clear-ip");
        if (!ipAddress) {
          return;
        }

        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogCleanupTitle,
          title: text.clearIpAttemptsAction,
          message: text.clearIpAttemptsConfirm.replace("{ip}", ipAddress),
          detail: text.confirmDialogIrreversible,
          confirmLabel: text.confirmDialogCleanupAction
        });
        if (!confirmed) {
          return;
        }

        const response = await fetch("/api/admin/login-attempts/clear?lang=" + encodeURIComponent(currentLang), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-language": currentLang
          },
          body: JSON.stringify({ ipAddress })
        });
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        showMessage("success", text.clearIpAttemptsSuccess.replace("{ip}", ipAddress));
        await loadAdminPanel();
      });

      async function loadAdminPanel() {
        const response = await fetch("/api/admin/overview?lang=" + encodeURIComponent(currentLang), {
          headers: { "x-app-language": currentLang }
        });

        if (response.status === 401) {
          window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
          return;
        }

        const payload = await response.json();
        if (!response.ok) {
          rosterEl.innerHTML = renderDetailItem(text.adminCount, text.notAvailable, payload.error?.message ?? text.unexpectedError);
          return;
        }

        metricsEl.innerHTML = [
          [text.adminCount, payload.stats.adminCount],
          [text.activeSessions, payload.stats.activeSessionCount],
          [text.failedLogins24h, payload.stats.failedLoginCount24h],
          [text.auditEvents24h, payload.stats.auditEventCount24h]
        ].map(([label, value]) => (
          '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>'
        )).join("");
        renderSystemHealth(payload.health);

        rosterEl.innerHTML = (payload.admins || []).map((admin) => (
          renderDetailItem(
            admin.username,
            admin.isActive ? text.active : text.paused,
            formatDate(admin.lastLoginAt) + ' | ' + (admin.lastLoginIp || text.notAvailable)
          )
        )).join("");

        policyEl.innerHTML = [
          [text.configBaseDomain, payload.config.baseDomain],
          [text.configBootstrapAdmin, payload.config.bootstrapAdminUsername],
          [text.configCfAccess, payload.config.cfAccessEnabled ? text.featureEnabled : text.featureDisabled],
          [text.configSessionTtl, payload.config.sessionTtlHours + 'h'],
          [text.configLoginThreshold, String(payload.config.maxLoginFailures)],
          [text.configLoginBlock, payload.config.loginBlockMinutes + 'm'],
          [text.configReceivingStrategy, text.policyRandomSubdomains],
          [text.configMailboxNaming, text.configMailboxNamingValue]
        ].map(([label, value]) => renderDetailItem(label, value)).join("");

        if (!payload.suspiciousLoginIps || payload.suspiciousLoginIps.length === 0) {
          suspiciousIpRows.innerHTML = "";
          suspiciousIpEmpty.hidden = false;
        } else {
          suspiciousIpEmpty.hidden = true;
          suspiciousIpRows.innerHTML = payload.suspiciousLoginIps.map((item) => (
            '<tr>' +
              '<td><span class="mono">' + escapeHtml(item.ipAddress) + '</span></td>' +
              '<td><span class="badge">' + escapeHtml(String(item.failedCount)) + '</span></td>' +
              '<td><span class="mono">' + escapeHtml(formatDate(item.lastAttemptAt)) + '</span></td>' +
              '<td><span class="table-preview">' + escapeHtml(item.usernames || text.notAvailable) + '</span></td>' +
              '<td><button class="secondary" type="button" data-clear-ip="' + escapeHtml(item.ipAddress) + '">' + escapeHtml(text.clearIpAttemptsAction) + '</button></td>' +
            '</tr>'
          )).join("");
        }

        if (!payload.recentSessions || payload.recentSessions.length === 0) {
          sessionRows.innerHTML = "";
          sessionEmpty.hidden = false;
        } else {
          sessionEmpty.hidden = true;
          sessionRows.innerHTML = payload.recentSessions.map((session) => (
            '<tr>' +
              '<td><div class="table-primary"><span class="table-title">' + escapeHtml(session.username) + '</span>' +
                (session.isCurrent ? '<span class="table-preview">' + escapeHtml(text.currentSession) + '</span>' : '') +
              '</div></td>' +
              '<td><span class="mono">' + escapeHtml(session.ipAddress || text.notAvailable) + '</span></td>' +
              '<td><span class="mono">' + escapeHtml(formatDate(session.createdAt)) + '</span></td>' +
              '<td><span class="mono">' + escapeHtml(formatDate(session.expiresAt)) + '</span></td>' +
              '<td><span class="badge">' + escapeHtml(getSessionStatus(session)) + '</span></td>' +
              '<td><button class="secondary" type="button" data-session-id="' + escapeHtml(session.id) + '" data-current="' + (session.isCurrent ? "true" : "false") + '"' +
                (getSessionStatus(session) !== text.sessionStatusActive && getSessionStatus(session) !== text.sessionStatusCurrent ? ' disabled' : '') +
              '>' + escapeHtml(text.revokeSessionAction) + '</button></td>' +
            '</tr>'
          )).join("");
        }

        if (!payload.recentLoginAttempts || payload.recentLoginAttempts.length === 0) {
          loginAttemptRows.innerHTML = "";
          loginAttemptEmpty.hidden = false;
        } else {
          loginAttemptEmpty.hidden = true;
          loginAttemptRows.innerHTML = payload.recentLoginAttempts.map((item) => (
            '<tr>' +
              '<td><span class="table-title">' + escapeHtml(item.username || text.notAvailable) + '</span></td>' +
              '<td><span class="mono">' + escapeHtml(item.ipAddress || text.notAvailable) + '</span></td>' +
              '<td><span class="badge">' + escapeHtml(item.wasSuccessful ? text.loginSuccess : text.loginFailure) + '</span></td>' +
              '<td><span class="table-preview">' + escapeHtml(item.failureReason || text.notAvailable) + '</span></td>' +
              '<td><span class="mono">' + escapeHtml(formatDate(item.createdAt)) + '</span></td>' +
            '</tr>'
          )).join("");
        }

        if (!payload.recentAuditLogs || payload.recentAuditLogs.length === 0) {
          auditLogRows.innerHTML = "";
          auditLogEmpty.hidden = false;
        } else {
          auditLogEmpty.hidden = true;
          auditLogRows.innerHTML = payload.recentAuditLogs.map((item) => (
            '<tr>' +
              '<td><code>' + escapeHtml(item.action) + '</code></td>' +
              '<td><span class="table-preview">' + escapeHtml(item.targetType + (item.targetId ? ' / ' + item.targetId : '')) + '</span></td>' +
              '<td><span class="mono">' + escapeHtml(formatDate(item.createdAt)) + '</span></td>' +
            '</tr>'
          )).join("");
        }
      }

      loadAdminPanel();
    </script>`,
    locale
  );
}

function renderMailboxesPage(appName: string, locale: Locale): string {
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
              <p>${t(locale, "mailboxWorkspaceSubtitle")}</p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill" href="/dashboard?lang=${locale}">${t(locale, "dashboard")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div id="page-message" class="notice" hidden></div>

          <div class="summary-grid">
            <div class="card">
              <h2>${t(locale, "subdomainPool")}</h2>
              <p class="muted">${t(locale, "poolHint")}</p>
              <div class="metrics metrics--compact" id="subdomain-summary">
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryTotal")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryAvailable")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryAssigned")}</span></div>
                <div class="metric"><strong>-</strong><span>${t(locale, "summaryDisabled")}</span></div>
              </div>
            </div>
            <div class="card">
              <h2>${t(locale, "mailboxSummaryCard")}</h2>
              <p class="muted">${t(locale, "mailboxSummaryHint")}</p>
              <div class="metrics metrics--compact" id="mailbox-summary">
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
                <div id="subdomain-target-state" class="state-panel state-panel--compact">
                  <p class="state-panel__eyebrow">${t(locale, "subdomainStrategyTitle")}</p>
                  <p class="state-panel__title">${t(locale, "subdomainStrategyEmptyTitle")}</p>
                  <p class="state-panel__body">${t(locale, "noSubdomainsYetAction")}</p>
                </div>
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

          <div class="toolbar-panel">
            <div class="title-block">
              <h2>${t(locale, "workspaceMaintenance")}</h2>
              <p>${t(locale, "workspaceMaintenanceBody")}</p>
            </div>
            <div class="inline-actions">
              <button id="delete-empty-mailboxes-button" class="secondary" type="button">${t(locale, "deleteEmptyMailboxes")}</button>
              <button id="delete-all-subdomains-button" class="secondary" type="button">${t(locale, "deleteAllSubdomains")}</button>
            </div>
          </div>

          <div class="section-grid section-grid--workspace">
            <div class="card workspace-card">
              <div class="workspace-card__header">
                <div class="title-block">
                  <h2>${t(locale, "recentSubdomains")}</h2>
                  <p id="subdomain-list-lead" class="muted">${t(locale, "subdomainListLead")}</p>
                </div>
                <div class="workspace-header-meta">
                  <span id="subdomain-page-indicator" class="result-meta">${t(locale, "pageIndicator", { current: "1", total: "1" })}</span>
                  <button id="delete-selected-subdomain-button" class="secondary" type="button">${t(locale, "deleteSelectedDomain")}</button>
                </div>
              </div>
              <div class="workspace-card__body">
                <div class="list workspace-list" id="subdomain-list"></div>
                <div id="subdomain-empty" class="empty empty--center" hidden>${t(locale, "noSubdomainsYetAction")}</div>
              </div>
              <div id="subdomain-pagination" class="pagination workspace-card__footer" hidden>
                <div class="pagination-buttons">
                  <button id="subdomain-prev-button" class="secondary" type="button">${t(locale, "previousPage")}</button>
                  <button id="subdomain-next-button" class="secondary" type="button">${t(locale, "nextPage")}</button>
                </div>
              </div>
            </div>

            <div class="card workspace-card">
              <div class="workspace-card__header">
                <div class="title-block">
                    <h2>${t(locale, "mailboxList")}</h2>
                    <p id="mailbox-list-lead" class="muted">${t(locale, "mailboxListLeadAll")}</p>
                </div>
                <div class="workspace-header-meta">
                  <span id="mailbox-page-indicator" class="result-meta">${t(locale, "pageIndicator", { current: "1", total: "1" })}</span>
                  <div class="inline-actions">
                    <button id="delete-selected-mailbox-button" class="secondary" type="button">${t(locale, "deleteSelectedMailbox")}</button>
                    <button id="clear-subdomain-filter-button" class="secondary" type="button">${t(locale, "showAllMailboxes")}</button>
                    <button id="refresh-button" class="secondary" type="button">${t(locale, "refreshData")}</button>
                  </div>
                </div>
              </div>
              <div class="workspace-card__body">
                <div class="toolbar">
                  <span id="mailbox-filter-meta" class="filter-meta">${t(locale, "mailboxListLeadAll")}</span>
                </div>
                <div class="workspace-table-wrap">
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
                </div>
                <div id="mailbox-empty" class="empty empty--center" hidden>${t(locale, "noMailboxesYetAll")}</div>
              </div>
              <div id="mailbox-pagination" class="pagination workspace-card__footer" hidden>
                <div class="pagination-buttons">
                  <button id="mailbox-prev-button" class="secondary" type="button">${t(locale, "previousPage")}</button>
                  <button id="mailbox-next-button" class="secondary" type="button">${t(locale, "nextPage")}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div id="confirm-backdrop" class="confirm-backdrop" hidden>
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
          <div class="confirm-dialog__header">
            <span id="confirm-dialog-eyebrow" class="confirm-dialog__eyebrow">${t(locale, "confirmDialogDeleteTitle")}</span>
            <h2 id="confirm-dialog-title">${t(locale, "confirmDialogDeleteTitle")}</h2>
          </div>
          <div class="confirm-dialog__body">
            <p id="confirm-dialog-message" class="confirm-dialog__message"></p>
            <div id="confirm-dialog-detail" class="confirm-dialog__detail" hidden></div>
          </div>
          <div class="confirm-dialog__actions">
            <button id="confirm-dialog-cancel" class="secondary" type="button">${t(locale, "confirmDialogCancel")}</button>
            <button id="confirm-dialog-confirm" type="button">${t(locale, "confirmDialogDeleteAction")}</button>
          </div>
        </div>
      </div>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const text = {
        summaryTotal: ${JSON.stringify(t(locale, "summaryTotal"))},
        summaryAvailable: ${JSON.stringify(t(locale, "summaryAvailable"))},
        summaryAssigned: ${JSON.stringify(t(locale, "summaryAssigned"))},
        summaryDisabled: ${JSON.stringify(t(locale, "summaryDisabled"))},
        mailboxes: ${JSON.stringify(t(locale, "mailboxes"))},
        activeMailboxes: ${JSON.stringify(t(locale, "activeMailboxes"))},
        summaryPaused: ${JSON.stringify(t(locale, "summaryPaused"))},
        generateSuccess: ${JSON.stringify(t(locale, "generateSuccess", { count: "{count}" }))},
        mailboxCreated: ${JSON.stringify(t(locale, "mailboxCreated", { address: "{address}" }))},
        noSubdomainAvailable: ${JSON.stringify(t(locale, "noSubdomainAvailable"))},
        noSuchSubdomain: ${JSON.stringify(t(locale, "noSuchSubdomain"))},
        noNote: ${JSON.stringify(t(locale, "noNote"))},
        deleteEmptyMailboxesSuccess: ${JSON.stringify(t(locale, "deleteEmptyMailboxesSuccess", { count: "{count}" }))},
        deleteAllSubdomainsSuccess: ${JSON.stringify(t(locale, "deleteAllSubdomainsSuccess", { count: "{count}" }))},
        deleteSelectedDomainSuccess: ${JSON.stringify(t(locale, "deleteSelectedDomainSuccess", { domain: "{domain}" }))},
        deleteSelectedMailboxSuccess: ${JSON.stringify(t(locale, "deleteSelectedMailboxSuccess", { address: "{address}" }))},
        confirmDeleteEmptyMailboxes: ${JSON.stringify(t(locale, "confirmDeleteEmptyMailboxes"))},
        confirmDeleteAllSubdomains: ${JSON.stringify(t(locale, "confirmDeleteAllSubdomains"))},
        selectDomainToDelete: ${JSON.stringify(t(locale, "selectDomainToDelete"))},
        selectMailboxToDelete: ${JSON.stringify(t(locale, "selectMailboxToDelete"))},
        confirmDeleteSelectedDomain: ${JSON.stringify(t(locale, "confirmDeleteSelectedDomain"))},
        confirmDeleteSelectedMailbox: ${JSON.stringify(t(locale, "confirmDeleteSelectedMailbox"))},
        confirmDeleteSelectedDomainWithMailboxes: ${JSON.stringify(
          t(locale, "confirmDeleteSelectedDomainWithMailboxes", { count: "{count}" })
        )},
        confirmDeleteSelectedMailboxWithEmails: ${JSON.stringify(
          t(locale, "confirmDeleteSelectedMailboxWithEmails", { count: "{count}" })
        )},
        confirmDialogDeleteTitle: ${JSON.stringify(t(locale, "confirmDialogDeleteTitle"))},
        confirmDialogCleanupTitle: ${JSON.stringify(t(locale, "confirmDialogCleanupTitle"))},
        confirmDialogCancel: ${JSON.stringify(t(locale, "confirmDialogCancel"))},
        confirmDialogDeleteAction: ${JSON.stringify(t(locale, "confirmDialogDeleteAction"))},
        confirmDialogCleanupAction: ${JSON.stringify(t(locale, "confirmDialogCleanupAction"))},
        confirmDialogIrreversible: ${JSON.stringify(t(locale, "confirmDialogIrreversible"))},
        noticeSuccessEyebrow: ${JSON.stringify(t(locale, "noticeSuccessEyebrow"))},
        noticeSuccessTitle: ${JSON.stringify(t(locale, "noticeSuccessTitle"))},
        noticeErrorEyebrow: ${JSON.stringify(t(locale, "noticeErrorEyebrow"))},
        noticeErrorTitle: ${JSON.stringify(t(locale, "noticeErrorTitle"))},
        noticeReminderEyebrow: ${JSON.stringify(t(locale, "noticeReminderEyebrow"))},
        noticeReminderTitle: ${JSON.stringify(t(locale, "noticeReminderTitle"))},
        invalidLocalPart: ${JSON.stringify(t(locale, "invalidLocalPart"))},
        unexpectedError: ${JSON.stringify(t(locale, "unexpectedError"))},
        randomSubdomainOption: ${JSON.stringify(t(locale, "randomSubdomainOption"))},
        subdomainStrategyTitle: ${JSON.stringify(t(locale, "subdomainStrategyTitle"))},
        subdomainStrategyAutoEyebrow: ${JSON.stringify(t(locale, "subdomainStrategyAutoEyebrow"))},
        subdomainStrategyAutoTitle: ${JSON.stringify(t(locale, "subdomainStrategyAutoTitle"))},
        subdomainStrategyAutoBody: ${JSON.stringify(
          t(locale, "subdomainStrategyAutoBody", { domain: "{domain}", count: "{count}" })
        )},
        subdomainStrategyManualEyebrow: ${JSON.stringify(t(locale, "subdomainStrategyManualEyebrow"))},
        subdomainStrategyManualTitle: ${JSON.stringify(
          t(locale, "subdomainStrategyManualTitle", { domain: "{domain}" })
        )},
        subdomainStrategyManualBody: ${JSON.stringify(
          t(locale, "subdomainStrategyManualBody", { count: "{count}" })
        )},
        subdomainStrategyEmptyEyebrow: ${JSON.stringify(t(locale, "subdomainStrategyEmptyEyebrow"))},
        subdomainStrategyEmptyTitle: ${JSON.stringify(t(locale, "subdomainStrategyEmptyTitle"))},
        autoCandidate: ${JSON.stringify(t(locale, "autoCandidate"))},
        noMailboxesYet: ${JSON.stringify(t(locale, "noMailboxesYet"))},
        noSubdomainsYet: ${JSON.stringify(t(locale, "noSubdomainsYet"))},
        noMailboxesYetAll: ${JSON.stringify(t(locale, "noMailboxesYetAll"))},
        noMailboxesYetFiltered: ${JSON.stringify(t(locale, "noMailboxesYetFiltered", { domain: "{domain}" }))},
        noSubdomainsYetAction: ${JSON.stringify(t(locale, "noSubdomainsYetAction"))},
        mailboxListLeadAll: ${JSON.stringify(t(locale, "mailboxListLeadAll"))},
        mailboxListLeadFiltered: ${JSON.stringify(t(locale, "mailboxListLeadFiltered", { domain: "{domain}" }))},
        mailboxFilterSummaryAll: ${JSON.stringify(t(locale, "mailboxFilterSummaryAll", { count: "{count}" }))},
        mailboxFilterSummaryFiltered: ${JSON.stringify(
          t(locale, "mailboxFilterSummaryFiltered", { domain: "{domain}", count: "{count}" })
        )},
        subdomainListLead: ${JSON.stringify(t(locale, "subdomainListLead"))},
        pageIndicator: ${JSON.stringify(t(locale, "pageIndicator", { current: "{current}", total: "{total}" }))},
        mailboxCountLabel: ${JSON.stringify(t(locale, "mailboxCountLabel"))},
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
      const confirmBackdrop = document.getElementById("confirm-backdrop");
      const confirmDialogEyebrow = document.getElementById("confirm-dialog-eyebrow");
      const confirmDialogTitle = document.getElementById("confirm-dialog-title");
      const confirmDialogMessage = document.getElementById("confirm-dialog-message");
      const confirmDialogDetail = document.getElementById("confirm-dialog-detail");
      const confirmDialogCancel = document.getElementById("confirm-dialog-cancel");
      const confirmDialogConfirm = document.getElementById("confirm-dialog-confirm");
      const mailboxRows = document.getElementById("mailbox-rows");
      const mailboxEmpty = document.getElementById("mailbox-empty");
      const subdomainList = document.getElementById("subdomain-list");
      const subdomainEmpty = document.getElementById("subdomain-empty");
      const subdomainTargetState = document.getElementById("subdomain-target-state");
      const mailboxListLead = document.getElementById("mailbox-list-lead");
      const mailboxFilterMeta = document.getElementById("mailbox-filter-meta");
      const clearSubdomainFilterButton = document.getElementById("clear-subdomain-filter-button");
      const subdomainSummary = document.getElementById("subdomain-summary");
      const mailboxSummary = document.getElementById("mailbox-summary");
      const logoutButton = document.getElementById("logout-button");
      const refreshButton = document.getElementById("refresh-button");
      const deleteSelectedSubdomainButton = document.getElementById("delete-selected-subdomain-button");
      const deleteSelectedMailboxButton = document.getElementById("delete-selected-mailbox-button");
      const subdomainForm = document.getElementById("subdomain-form");
      const mailboxForm = document.getElementById("mailbox-form");
      const subdomainSelect = document.getElementById("subdomain-select");
      const localPartMode = document.getElementById("local-part-mode");
      const localPartInput = document.getElementById("local-part-input");
      const deleteEmptyMailboxesButton = document.getElementById("delete-empty-mailboxes-button");
      const deleteAllSubdomainsButton = document.getElementById("delete-all-subdomains-button");
      const mailboxPagination = document.getElementById("mailbox-pagination");
      const mailboxPageIndicator = document.getElementById("mailbox-page-indicator");
      const mailboxPrevButton = document.getElementById("mailbox-prev-button");
      const mailboxNextButton = document.getElementById("mailbox-next-button");
      const subdomainPagination = document.getElementById("subdomain-pagination");
      const subdomainPageIndicator = document.getElementById("subdomain-page-indicator");
      const subdomainPrevButton = document.getElementById("subdomain-prev-button");
      const subdomainNextButton = document.getElementById("subdomain-next-button");
      const DESKTOP_SUBDOMAIN_PAGE_SIZE = 10;
      const MOBILE_SUBDOMAIN_PAGE_SIZE = 6;
      const MAILBOX_PAGE_SIZE = 10;
      const AUTO_SUBDOMAIN_VALUE = "__auto__";
      const LAST_SELECTED_SUBDOMAIN_STORAGE_KEY = "pmp:last-selected-subdomain";
      let allMailboxes = [];
      let allSubdomains = [];
      let selectedSubdomainId = "all";
      let selectedMailboxId = "";
      let currentMailboxPage = 1;
      let currentSubdomainPage = 1;
      let pendingConfirmResolver = null;

      function showMessage(kind, value) {
        const palette = kind === "success"
          ? { eyebrow: text.noticeSuccessEyebrow, title: text.noticeSuccessTitle, className: "notice notice--success" }
          : kind === "reminder"
            ? { eyebrow: text.noticeReminderEyebrow, title: text.noticeReminderTitle, className: "notice notice--reminder" }
            : { eyebrow: text.noticeErrorEyebrow, title: text.noticeErrorTitle, className: "notice notice--error" };
        pageMessage.hidden = false;
        pageMessage.className = palette.className;
        pageMessage.innerHTML =
          '<p class="notice__eyebrow">' + escapeHtml(palette.eyebrow) + '</p>' +
          '<p class="notice__title">' + escapeHtml(palette.title) + '</p>' +
          '<p class="notice__body">' + escapeHtml(value) + '</p>';
      }

      function clearMessage() {
        pageMessage.hidden = true;
        pageMessage.innerHTML = "";
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

      function formatPageIndicator(current, total) {
        return text.pageIndicator
          .replace("{current}", String(current))
          .replace("{total}", String(total));
      }

      function getSubdomainPageSize() {
        return window.innerWidth <= 860 ? MOBILE_SUBDOMAIN_PAGE_SIZE : DESKTOP_SUBDOMAIN_PAGE_SIZE;
      }

      function paginate(items, currentPage, pageSize) {
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
        const safePage = Math.min(Math.max(1, currentPage), totalPages);
        const start = (safePage - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize),
          currentPage: safePage,
          totalPages
        };
      }

      function resolveConfirmDialog(result) {
        if (!pendingConfirmResolver) {
          return;
        }
        const next = pendingConfirmResolver;
        pendingConfirmResolver = null;
        confirmBackdrop.hidden = true;
        document.body.style.overflow = "";
        next(result);
      }

      function openConfirmDialog(options) {
        confirmDialogEyebrow.textContent = options.eyebrow || text.confirmDialogDeleteTitle;
        confirmDialogTitle.textContent = options.title || text.confirmDialogDeleteTitle;
        confirmDialogMessage.textContent = options.message || "";
        confirmDialogDetail.hidden = !options.detail;
        confirmDialogDetail.textContent = options.detail || "";
        confirmDialogConfirm.textContent = options.confirmLabel || text.confirmDialogDeleteAction;
        confirmBackdrop.hidden = false;
        document.body.style.overflow = "hidden";

        return new Promise((resolve) => {
          pendingConfirmResolver = resolve;
        });
      }

      function getSelectedSubdomain() {
        return allSubdomains.find((item) => item.id === selectedSubdomainId) ?? null;
      }

      function getAutoAssignedSubdomain() {
        const availableSubdomains = allSubdomains
          .filter((item) => item.status !== "disabled")
          .slice()
          .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
        return availableSubdomains[0] ?? null;
      }

      function getStoredSubdomainPreference() {
        try {
          return window.localStorage.getItem(LAST_SELECTED_SUBDOMAIN_STORAGE_KEY) || "";
        } catch (_error) {
          return "";
        }
      }

      function setStoredSubdomainPreference(subdomainId) {
        try {
          if (!subdomainId) {
            window.localStorage.removeItem(LAST_SELECTED_SUBDOMAIN_STORAGE_KEY);
            return;
          }
          window.localStorage.setItem(LAST_SELECTED_SUBDOMAIN_STORAGE_KEY, subdomainId);
        } catch (_error) {
          // Ignore storage errors in restricted environments.
        }
      }

      function renderStatePanel(eyebrow, title, body, tone = "default") {
        const toneClass = tone === "danger" ? " state-panel--danger" : "";
        subdomainTargetState.className = "state-panel state-panel--compact" + toneClass;
        subdomainTargetState.innerHTML =
          '<p class="state-panel__eyebrow">' + escapeHtml(eyebrow) + '</p>' +
          '<p class="state-panel__title">' + escapeHtml(title) + '</p>' +
          '<p class="state-panel__body">' + escapeHtml(body) + '</p>';
      }

      function renderSubdomainStrategyState() {
        if (allSubdomains.length === 0) {
          renderStatePanel(
            text.subdomainStrategyEmptyEyebrow,
            text.subdomainStrategyEmptyTitle,
            text.noSubdomainsYetAction,
            "danger"
          );
          return;
        }

        const selectedValue = subdomainSelect.value;
        if (!selectedValue || selectedValue === AUTO_SUBDOMAIN_VALUE) {
          const autoAssignedSubdomain = getAutoAssignedSubdomain();
          if (!autoAssignedSubdomain) {
            renderStatePanel(
              text.subdomainStrategyEmptyEyebrow,
              text.subdomainStrategyEmptyTitle,
              text.noSubdomainsYetAction,
              "danger"
            );
            return;
          }

          const availableCount = allSubdomains.filter((item) => item.status !== "disabled").length;
          renderStatePanel(
            text.subdomainStrategyAutoEyebrow,
            text.subdomainStrategyAutoTitle,
            text.subdomainStrategyAutoBody
              .replace("{domain}", autoAssignedSubdomain.fullDomain)
              .replace("{count}", String(availableCount))
          );
          return;
        }

        const selectedSubdomain = allSubdomains.find((item) => item.id === selectedValue);
        if (!selectedSubdomain) {
          renderStatePanel(
            text.subdomainStrategyEmptyEyebrow,
            text.subdomainStrategyEmptyTitle,
            text.noSubdomainsYetAction,
            "danger"
          );
          return;
        }

        renderStatePanel(
          text.subdomainStrategyManualEyebrow,
          text.subdomainStrategyManualTitle.replace("{domain}", selectedSubdomain.fullDomain),
          text.subdomainStrategyManualBody.replace("{count}", String(selectedSubdomain.mailboxCount || 0))
        );
      }

      function getFilteredMailboxes() {
        if (selectedSubdomainId === "all") {
          return allMailboxes;
        }
        return allMailboxes.filter((item) => item.subdomainId === selectedSubdomainId);
      }

      function getSelectedMailbox() {
        return allMailboxes.find((item) => item.id === selectedMailboxId) ?? null;
      }

      function syncSelectionState() {
        if (selectedMailboxId && !allMailboxes.some((item) => item.id === selectedMailboxId)) {
          selectedMailboxId = "";
        }
        deleteSelectedSubdomainButton.disabled = selectedSubdomainId === "all";
        deleteSelectedMailboxButton.disabled = !selectedMailboxId;
      }

      function updateMailboxFilterUi(filteredCount, totalCount) {
        const selectedSubdomain = getSelectedSubdomain();
        const leadText = selectedSubdomain
          ? text.mailboxListLeadFiltered.replace("{domain}", selectedSubdomain.fullDomain)
          : text.mailboxListLeadAll;
        const summaryText = selectedSubdomain
          ? text.mailboxFilterSummaryFiltered
              .replace("{domain}", selectedSubdomain.fullDomain)
              .replace("{count}", String(filteredCount))
          : text.mailboxFilterSummaryAll.replace("{count}", String(totalCount));

        mailboxListLead.textContent = leadText;
        mailboxFilterMeta.textContent = summaryText;
        clearSubdomainFilterButton.disabled = selectedSubdomainId === "all";
      }

      function renderMailboxTable() {
        const filteredMailboxes = getFilteredMailboxes();
        const selectedSubdomain = getSelectedSubdomain();
        const paginationState = paginate(filteredMailboxes, currentMailboxPage, MAILBOX_PAGE_SIZE);
        currentMailboxPage = paginationState.currentPage;
        if (selectedMailboxId && !paginationState.items.some((item) => item.id === selectedMailboxId)) {
          selectedMailboxId = "";
        }
        updateMailboxFilterUi(filteredMailboxes.length, allMailboxes.length);
        syncSelectionState();

        mailboxRows.innerHTML = "";
        if (filteredMailboxes.length === 0) {
          mailboxEmpty.hidden = false;
          mailboxEmpty.textContent = selectedSubdomain
            ? text.noMailboxesYetFiltered.replace("{domain}", selectedSubdomain.fullDomain)
            : text.noMailboxesYetAll;
          mailboxPagination.hidden = true;
          mailboxPageIndicator.textContent = formatPageIndicator(1, 1);
          return;
        }

        mailboxEmpty.hidden = true;
        mailboxRows.innerHTML = paginationState.items.map((item) => (
          '<tr data-mailbox-id="' + escapeHtml(item.id) + '" class="' + (item.id === selectedMailboxId ? 'is-selected' : '') + '">' +
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

        const pageText = formatPageIndicator(paginationState.currentPage, paginationState.totalPages);
        mailboxPageIndicator.textContent = pageText;
        mailboxPrevButton.disabled = paginationState.currentPage <= 1;
        mailboxNextButton.disabled = paginationState.currentPage >= paginationState.totalPages;
        mailboxPagination.hidden = filteredMailboxes.length <= MAILBOX_PAGE_SIZE;
      }

      function renderSubdomainList() {
        const subdomainPageSize = getSubdomainPageSize();
        const paginationState = paginate(allSubdomains, currentSubdomainPage, subdomainPageSize);
        currentSubdomainPage = paginationState.currentPage;
        syncSelectionState();

        if (allSubdomains.length === 0) {
          subdomainEmpty.hidden = false;
          subdomainEmpty.textContent = text.noSubdomainsYetAction;
          subdomainList.innerHTML = "";
          subdomainPagination.hidden = true;
          subdomainPageIndicator.textContent = formatPageIndicator(1, 1);
          subdomainSelect.innerHTML = "";
          renderSubdomainStrategyState();
          return;
        }

        subdomainEmpty.hidden = true;
        const autoAssignedSubdomain = getAutoAssignedSubdomain();
        subdomainList.innerHTML = paginationState.items.map((item) => (
          '<div class="list-item list-item--interactive' + (item.id === selectedSubdomainId ? ' is-active is-selected' : '') + '" data-subdomain-id="' + escapeHtml(item.id) + '">' +
            '<div class="row row--start">' +
              '<span class="address-chip">' + escapeHtml(item.fullDomain) + '</span>' +
              '<div class="badge-row">' +
                '<span class="badge">' + (text.status[item.status] || item.status) + '</span>' +
                (autoAssignedSubdomain && autoAssignedSubdomain.id === item.id
                  ? '<span class="badge">' + escapeHtml(text.autoCandidate) + '</span>'
                  : '') +
              '</div>' +
            '</div>' +
            '<div class="subdomain-meta">' +
              '<p class="muted">' + text.mailboxCountLabel + '</p>' +
              '<strong>' + (item.mailboxCount || 0) + '</strong>' +
            '</div>' +
          '</div>'
        )).join("");

        const pageText = formatPageIndicator(paginationState.currentPage, paginationState.totalPages);
        subdomainPageIndicator.textContent = pageText;
        subdomainPrevButton.disabled = paginationState.currentPage <= 1;
        subdomainNextButton.disabled = paginationState.currentPage >= paginationState.totalPages;
        subdomainPagination.hidden = allSubdomains.length <= subdomainPageSize;

        const storedSubdomainId = getStoredSubdomainPreference();
        const currentFormValue = subdomainSelect.value;
        const preferredSubdomainId =
          (storedSubdomainId === AUTO_SUBDOMAIN_VALUE && AUTO_SUBDOMAIN_VALUE) ||
          (currentFormValue === AUTO_SUBDOMAIN_VALUE && AUTO_SUBDOMAIN_VALUE) ||
          (storedSubdomainId && allSubdomains.some((item) => item.id === storedSubdomainId && item.status !== "disabled") && storedSubdomainId) ||
          (currentFormValue && allSubdomains.some((item) => item.id === currentFormValue && item.status !== "disabled") && currentFormValue) ||
          AUTO_SUBDOMAIN_VALUE;

        subdomainSelect.innerHTML = [
          '<option value="' + AUTO_SUBDOMAIN_VALUE + '"' + (preferredSubdomainId === AUTO_SUBDOMAIN_VALUE ? ' selected' : '') + '>' +
            escapeHtml(text.randomSubdomainOption) +
          '</option>',
          ...allSubdomains
            .filter((item) => item.status !== "disabled")
            .map((item) => (
              '<option value="' + item.id + '"' + (item.id === preferredSubdomainId ? ' selected' : '') + '>' + escapeHtml(item.fullDomain) + ' (' + (item.mailboxCount || 0) + ')</option>'
            ))
        ].join("");

        renderSubdomainStrategyState();
        syncSelectionState();
      }

      function setLocalPartMode() {
        localPartInput.disabled = localPartMode.value !== "custom";
        if (localPartInput.disabled) {
          localPartInput.value = "";
        }
      }

      async function deleteSelectedSubdomain() {
        clearMessage();
        const subdomain = getSelectedSubdomain();
        if (!subdomain) {
          showMessage("reminder", text.selectDomainToDelete);
          return;
        }

        const baseConfirm = subdomain.mailboxCount > 0
          ? text.confirmDeleteSelectedDomainWithMailboxes.replace("{count}", String(subdomain.mailboxCount))
          : text.confirmDeleteSelectedDomain;
        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogDeleteTitle,
          title: text.deleteSelectedDomain,
          message: baseConfirm,
          detail: subdomain.fullDomain + "\\n" + text.confirmDialogIrreversible,
          confirmLabel: text.confirmDialogDeleteAction
        });
        if (!confirmed) {
          return;
        }

        const response = await fetch(
          "/api/subdomains/" + encodeURIComponent(subdomain.id) + "/delete?lang=" + encodeURIComponent(currentLang),
          {
            method: "POST",
            headers: {
              "x-app-language": currentLang
            }
          }
        );
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        selectedSubdomainId = "all";
        currentMailboxPage = 1;
        showMessage("success", text.deleteSelectedDomainSuccess.replace("{domain}", payload.fullDomain || subdomain.fullDomain));
        await loadData();
      }

      async function deleteSelectedMailbox() {
        clearMessage();
        const mailbox = getSelectedMailbox();
        if (!mailbox) {
          showMessage("reminder", text.selectMailboxToDelete);
          return;
        }

        const baseConfirm = mailbox.totalEmailCount > 0
          ? text.confirmDeleteSelectedMailboxWithEmails.replace("{count}", String(mailbox.totalEmailCount))
          : text.confirmDeleteSelectedMailbox;
        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogDeleteTitle,
          title: text.deleteSelectedMailbox,
          message: baseConfirm,
          detail: mailbox.fullAddress + "\\n" + text.confirmDialogIrreversible,
          confirmLabel: text.confirmDialogDeleteAction
        });
        if (!confirmed) {
          return;
        }

        const response = await fetch(
          "/api/mailboxes/" + encodeURIComponent(mailbox.id) + "/delete?lang=" + encodeURIComponent(currentLang),
          {
            method: "POST",
            headers: {
              "x-app-language": currentLang
            }
          }
        );
        const payload = await response.json();
        if (!response.ok) {
          showMessage("error", payload.error?.message ?? text.unexpectedError);
          return;
        }

        selectedMailboxId = "";
        showMessage("success", text.deleteSelectedMailboxSuccess.replace("{address}", payload.fullAddress || mailbox.fullAddress));
        await loadData();
      }

      localPartMode.addEventListener("change", setLocalPartMode);
      subdomainSelect.addEventListener("change", () => {
        renderSubdomainStrategyState();
      });
      setLocalPartMode();

      confirmDialogCancel.addEventListener("click", () => {
        resolveConfirmDialog(false);
      });

      confirmDialogConfirm.addEventListener("click", () => {
        resolveConfirmDialog(true);
      });

      confirmBackdrop.addEventListener("click", (event) => {
        if (event.target === confirmBackdrop) {
          resolveConfirmDialog(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !confirmBackdrop.hidden) {
          resolveConfirmDialog(false);
        }
      });

      logoutButton.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login?lang=" + encodeURIComponent(currentLang);
      });

      refreshButton.addEventListener("click", () => {
        clearMessage();
        loadData();
      });

      clearSubdomainFilterButton.addEventListener("click", () => {
        selectedSubdomainId = "all";
        currentMailboxPage = 1;
        renderSubdomainList();
        renderMailboxTable();
      });

      deleteSelectedSubdomainButton.addEventListener("click", () => {
        deleteSelectedSubdomain();
      });

      deleteSelectedMailboxButton.addEventListener("click", () => {
        deleteSelectedMailbox();
      });

      mailboxPrevButton.addEventListener("click", () => {
        currentMailboxPage = Math.max(1, currentMailboxPage - 1);
        renderMailboxTable();
      });

      mailboxNextButton.addEventListener("click", () => {
        currentMailboxPage += 1;
        renderMailboxTable();
      });

      subdomainPrevButton.addEventListener("click", () => {
        currentSubdomainPage = Math.max(1, currentSubdomainPage - 1);
        renderSubdomainList();
      });

      subdomainNextButton.addEventListener("click", () => {
        currentSubdomainPage += 1;
        renderSubdomainList();
      });

      deleteEmptyMailboxesButton.addEventListener("click", async () => {
        clearMessage();
        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogCleanupTitle,
          title: text.deleteEmptyMailboxes,
          message: text.confirmDeleteEmptyMailboxes,
          detail: text.confirmDialogIrreversible,
          confirmLabel: text.confirmDialogCleanupAction
        });
        if (!confirmed) {
          return;
        }
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
        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogCleanupTitle,
          title: text.deleteAllSubdomains,
          message: text.confirmDeleteAllSubdomains,
          detail: text.confirmDialogIrreversible,
          confirmLabel: text.confirmDialogCleanupAction
        });
        if (!confirmed) {
          return;
        }
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
            subdomainId: formData.get("subdomainId") === AUTO_SUBDOMAIN_VALUE ? "" : formData.get("subdomainId"),
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
        setStoredSubdomainPreference(String(formData.get("subdomainId") ?? AUTO_SUBDOMAIN_VALUE));
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

        allMailboxes = Array.isArray(mailboxesPayload.items) ? mailboxesPayload.items : [];
        allSubdomains = Array.isArray(subdomainsPayload.items) ? subdomainsPayload.items : [];

        if (selectedSubdomainId !== "all" && !allSubdomains.some((item) => item.id === selectedSubdomainId)) {
          selectedSubdomainId = "all";
        }

        currentSubdomainPage = 1;
        currentMailboxPage = 1;
        renderSubdomainList();
        renderMailboxTable();
      }

      subdomainList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const item = target.closest("[data-subdomain-id]");
        if (!(item instanceof HTMLElement)) {
          return;
        }
        const nextId = item.getAttribute("data-subdomain-id");
        if (!nextId) {
          return;
        }
        selectedSubdomainId = selectedSubdomainId === nextId ? "all" : nextId;
        currentMailboxPage = 1;
        renderSubdomainList();
        renderMailboxTable();
      });

      window.addEventListener("resize", () => {
        renderSubdomainList();
      });

      mailboxRows.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.closest("a")) {
          return;
        }
        const row = target.closest("[data-mailbox-id]");
        if (!(row instanceof HTMLElement)) {
          return;
        }
        const mailboxId = row.getAttribute("data-mailbox-id");
        if (!mailboxId) {
          return;
        }
        selectedMailboxId = selectedMailboxId === mailboxId ? "" : mailboxId;
        renderMailboxTable();
      });

      loadData();
    </script>`,
    locale
  );
}

function renderMailboxDetailPage(appName: string, locale: Locale, mailboxId: string): string {
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
              <p>${t(locale, "mailboxDetailSubtitle")}</p>
            </div>
            <div class="inline-actions">
              <a class="nav-pill" href="/mailboxes?lang=${locale}">${t(locale, "backToMailboxes")}</a>
              <button id="logout-button" class="secondary" type="button">${t(locale, "logOut")}</button>
            </div>
          </div>
        </div>
        <div class="content stack">
          <div id="page-message" class="notice" hidden></div>
          <div id="mailbox-state" hidden></div>

          <div class="metrics metrics--compact" id="detail-metrics">
            <div class="metric"><strong>-</strong><span>${t(locale, "totalEmails")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "unreadEmails")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "lastReceivedAt")}</span></div>
            <div class="metric"><strong>-</strong><span>${t(locale, "status")}</span></div>
          </div>

          <div class="detail-grid detail-grid--mailbox">
            <div class="sidebar-stack">
              <div class="card">
                <h2>${t(locale, "mailboxInfo")}</h2>
                <div class="list" id="mailbox-overview"></div>
              </div>
              <div class="card">
                <div class="row row--start">
                  <div class="title-block">
                    <h2>${t(locale, "mailboxActivity")}</h2>
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
                    <p id="email-list-lead" class="muted">${t(locale, "emailListHint")}</p>
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
        </div>
      </section>
      <div id="confirm-backdrop" class="confirm-backdrop" hidden>
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
          <div class="confirm-dialog__header">
            <span id="confirm-dialog-eyebrow" class="confirm-dialog__eyebrow">${t(locale, "confirmDialogDeleteTitle")}</span>
            <h2 id="confirm-dialog-title">${t(locale, "confirmDialogDeleteTitle")}</h2>
          </div>
          <div class="confirm-dialog__body">
            <p id="confirm-dialog-message" class="confirm-dialog__message"></p>
            <div id="confirm-dialog-detail" class="confirm-dialog__detail" hidden></div>
          </div>
          <div class="confirm-dialog__actions">
            <button id="confirm-dialog-cancel" class="secondary" type="button">${t(locale, "confirmDialogCancel")}</button>
            <button id="confirm-dialog-confirm" type="button">${t(locale, "confirmDialogDeleteAction")}</button>
          </div>
        </div>
      </div>
    </main>
    <script>
      const currentLang = ${JSON.stringify(locale)};
      const mailboxId = ${JSON.stringify(mailboxId)};
      const text = {
        mailboxNotFound: ${JSON.stringify(t(locale, "mailboxNotFound"))},
        mailboxUnavailableBody: ${JSON.stringify(t(locale, "mailboxUnavailableBody"))},
        noNote: ${JSON.stringify(t(locale, "noNote"))},
        noSubject: ${JSON.stringify(t(locale, "noSubject"))},
        inboxEmpty: ${JSON.stringify(t(locale, "inboxEmpty"))},
        inboxEmptyTitle: ${JSON.stringify(t(locale, "inboxEmptyTitle"))},
        inboxEmptyBody: ${JSON.stringify(t(locale, "inboxEmptyBody"))},
        inboxSummary: ${JSON.stringify(t(locale, "inboxSummary"))},
        emailSearchPlaceholder: ${JSON.stringify(t(locale, "emailSearchPlaceholder"))},
        emailFilterAll: ${JSON.stringify(t(locale, "emailFilterAll"))},
        emailFilterUnread: ${JSON.stringify(t(locale, "emailFilterUnread"))},
        emailFilterAttachments: ${JSON.stringify(t(locale, "emailFilterAttachments"))},
        emailSortNewest: ${JSON.stringify(t(locale, "emailSortNewest"))},
        emailSortOldest: ${JSON.stringify(t(locale, "emailSortOldest"))},
        emailResultsSummary: ${JSON.stringify(t(locale, "emailResultsSummary", { displayed: "{displayed}", total: "{total}" }))},
        noMatchingEmails: ${JSON.stringify(t(locale, "noMatchingEmails"))},
        noMatchingEmailsTitle: ${JSON.stringify(t(locale, "noMatchingEmailsTitle"))},
        noMatchingEmailsBody: ${JSON.stringify(t(locale, "noMatchingEmailsBody"))},
        selectVisible: ${JSON.stringify(t(locale, "selectVisible"))},
        clearSelection: ${JSON.stringify(t(locale, "clearSelection"))},
        selectedCount: ${JSON.stringify(t(locale, "selectedCount", { count: "{count}" }))},
        markSelectedRead: ${JSON.stringify(t(locale, "markSelectedRead"))},
        deleteSelected: ${JSON.stringify(t(locale, "deleteSelected"))},
        bulkMarkReadSuccess: ${JSON.stringify(t(locale, "bulkMarkReadSuccess", { count: "{count}" }))},
        bulkDeleteSuccess: ${JSON.stringify(t(locale, "bulkDeleteSuccess", { count: "{count}" }))},
        confirmDeleteSelected: ${JSON.stringify(t(locale, "confirmDeleteSelected"))},
        confirmDialogDeleteTitle: ${JSON.stringify(t(locale, "confirmDialogDeleteTitle"))},
        confirmDialogCancel: ${JSON.stringify(t(locale, "confirmDialogCancel"))},
        confirmDialogDeleteAction: ${JSON.stringify(t(locale, "confirmDialogDeleteAction"))},
        confirmDialogIrreversible: ${JSON.stringify(t(locale, "confirmDialogIrreversible"))},
        invalidEmailSelection: ${JSON.stringify(t(locale, "invalidEmailSelection"))},
        summaryTotal: ${JSON.stringify(t(locale, "summaryTotal"))},
        totalEmails: ${JSON.stringify(t(locale, "totalEmails"))},
        unreadEmails: ${JSON.stringify(t(locale, "unreadEmails"))},
        lastReceivedAt: ${JSON.stringify(t(locale, "lastReceivedAt"))},
        mailboxReady: ${JSON.stringify(t(locale, "mailboxReady"))},
        noRecentEmail: ${JSON.stringify(t(locale, "noRecentEmail"))},
        emailListHint: ${JSON.stringify(t(locale, "emailListHint"))},
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
        noticeSuccessEyebrow: ${JSON.stringify(t(locale, "noticeSuccessEyebrow"))},
        noticeSuccessTitle: ${JSON.stringify(t(locale, "noticeSuccessTitle"))},
        noticeErrorEyebrow: ${JSON.stringify(t(locale, "noticeErrorEyebrow"))},
        noticeErrorTitle: ${JSON.stringify(t(locale, "noticeErrorTitle"))},
        noticeReminderEyebrow: ${JSON.stringify(t(locale, "noticeReminderEyebrow"))},
        noticeReminderTitle: ${JSON.stringify(t(locale, "noticeReminderTitle"))},
        unexpectedError: ${JSON.stringify(t(locale, "unexpectedError"))},
        badges: {
          active: ${JSON.stringify(t(locale, "statusActive"))},
          paused: ${JSON.stringify(t(locale, "statusPaused"))},
          archived: ${JSON.stringify(t(locale, "statusArchived"))},
          deleted: ${JSON.stringify(t(locale, "statusDeleted"))}
        }
      };

      const addressEl = document.getElementById("mailbox-address");
      const confirmBackdrop = document.getElementById("confirm-backdrop");
      const confirmDialogEyebrow = document.getElementById("confirm-dialog-eyebrow");
      const confirmDialogTitle = document.getElementById("confirm-dialog-title");
      const confirmDialogMessage = document.getElementById("confirm-dialog-message");
      const confirmDialogDetail = document.getElementById("confirm-dialog-detail");
      const confirmDialogCancel = document.getElementById("confirm-dialog-cancel");
      const confirmDialogConfirm = document.getElementById("confirm-dialog-confirm");
      const pageMessage = document.getElementById("page-message");
      const mailboxState = document.getElementById("mailbox-state");
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
      let pendingConfirmResolver = null;

      function showMessage(kind, value) {
        const palette = kind === "success"
          ? { eyebrow: text.noticeSuccessEyebrow, title: text.noticeSuccessTitle, className: "notice notice--success" }
          : kind === "reminder"
            ? { eyebrow: text.noticeReminderEyebrow, title: text.noticeReminderTitle, className: "notice notice--reminder" }
            : { eyebrow: text.noticeErrorEyebrow, title: text.noticeErrorTitle, className: "notice notice--error" };
        pageMessage.hidden = false;
        pageMessage.className = palette.className;
        pageMessage.innerHTML =
          '<p class="notice__eyebrow">' + escapeHtml(palette.eyebrow) + '</p>' +
          '<p class="notice__title">' + escapeHtml(palette.title) + '</p>' +
          '<p class="notice__body">' + escapeHtml(value) + '</p>';
      }

      function clearMessage() {
        pageMessage.hidden = true;
        pageMessage.innerHTML = "";
      }

      function renderStatePanel(title, body, tone = "default", eyebrow = "") {
        const toneClass = tone === "danger" ? " state-panel--danger" : "";
        const eyebrowHtml = eyebrow
          ? '<p class="state-panel__eyebrow">' + escapeHtml(eyebrow) + "</p>"
          : "";
        return '<div class="state-panel state-panel--compact' + toneClass + '">' +
          eyebrowHtml +
          '<p class="state-panel__title">' + escapeHtml(title) + '</p>' +
          '<p class="state-panel__body">' + escapeHtml(body) + '</p>' +
        '</div>';
      }

      function setMailboxState(title, body, tone = "default", eyebrow = "") {
        mailboxState.hidden = false;
        mailboxState.innerHTML = renderStatePanel(title, body, tone, eyebrow);
      }

      function clearMailboxState() {
        mailboxState.hidden = true;
        mailboxState.innerHTML = "";
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

      function resolveConfirmDialog(result) {
        if (!pendingConfirmResolver) {
          return;
        }
        const next = pendingConfirmResolver;
        pendingConfirmResolver = null;
        confirmBackdrop.hidden = true;
        document.body.style.overflow = "";
        next(result);
      }

      function openConfirmDialog(options) {
        confirmDialogEyebrow.textContent = options.eyebrow || text.confirmDialogDeleteTitle;
        confirmDialogTitle.textContent = options.title || text.confirmDialogDeleteTitle;
        confirmDialogMessage.textContent = options.message || "";
        confirmDialogDetail.hidden = !options.detail;
        confirmDialogDetail.textContent = options.detail || "";
        confirmDialogConfirm.textContent = options.confirmLabel || text.confirmDialogDeleteAction;
        confirmBackdrop.hidden = false;
        document.body.style.overflow = "hidden";

        return new Promise((resolve) => {
          pendingConfirmResolver = resolve;
        });
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
          showMessage("reminder", text.invalidEmailSelection);
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
          inboxEmpty.innerHTML = renderStatePanel(text.inboxEmptyTitle, text.inboxEmptyBody);
          updateSelectionUi([]);
          return;
        }

        if (filteredEmails.length === 0) {
          inboxRows.innerHTML = "";
          inboxEmpty.hidden = false;
          inboxEmpty.innerHTML = renderStatePanel(text.noMatchingEmailsTitle, text.noMatchingEmailsBody);
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

      confirmDialogCancel.addEventListener("click", () => {
        resolveConfirmDialog(false);
      });

      confirmDialogConfirm.addEventListener("click", () => {
        resolveConfirmDialog(true);
      });

      confirmBackdrop.addEventListener("click", (event) => {
        if (event.target === confirmBackdrop) {
          resolveConfirmDialog(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !confirmBackdrop.hidden) {
          resolveConfirmDialog(false);
        }
      });

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
        const confirmed = await openConfirmDialog({
          eyebrow: text.confirmDialogDeleteTitle,
          title: text.deleteSelected,
          message: text.confirmDeleteSelected,
          detail: text.confirmDialogIrreversible,
          confirmLabel: text.confirmDialogDeleteAction
        });
        if (!confirmed) {
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
          setMailboxState(text.mailboxNotFound, text.mailboxUnavailableBody, "danger", text.mailboxInfo);
          detailMetrics.innerHTML = "";
          mailboxOverview.innerHTML = renderStatePanel(text.mailboxNotFound, text.mailboxUnavailableBody, "danger");
          inboxSummary.innerHTML = renderStatePanel(text.mailboxNotFound, text.mailboxUnavailableBody, "danger");
          inboxSummaryLead.textContent = text.mailboxUnavailableBody;
          emailListLead.textContent = text.mailboxUnavailableBody;
          emailResultsMeta.textContent = formatResultsSummary(0, 0);
          mailboxEmails = [];
          selectedEmailIds = new Set();
          inboxRows.innerHTML = "";
          inboxEmpty.hidden = false;
          inboxEmpty.innerHTML = renderStatePanel(text.mailboxNotFound, text.mailboxUnavailableBody, "danger");
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
        clearMailboxState();
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

        emailListLead.textContent = text.emailListHint;
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
              <p>${t(locale, "emailDetailSubtitle")}</p>
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
              <div class="row row--start">
                <h2>${t(locale, "messageDetails")}</h2>
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
        emailUnavailableMeta: ${JSON.stringify(t(locale, "emailUnavailableMeta"))},
        emailUnavailableBody: ${JSON.stringify(t(locale, "emailUnavailableBody"))},
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
        noticeSuccessEyebrow: ${JSON.stringify(t(locale, "noticeSuccessEyebrow"))},
        noticeSuccessTitle: ${JSON.stringify(t(locale, "noticeSuccessTitle"))},
        noticeErrorEyebrow: ${JSON.stringify(t(locale, "noticeErrorEyebrow"))},
        noticeErrorTitle: ${JSON.stringify(t(locale, "noticeErrorTitle"))},
        noticeReminderEyebrow: ${JSON.stringify(t(locale, "noticeReminderEyebrow"))},
        noticeReminderTitle: ${JSON.stringify(t(locale, "noticeReminderTitle"))},
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
        const palette = kind === "success"
          ? { eyebrow: text.noticeSuccessEyebrow, title: text.noticeSuccessTitle, className: "notice notice--success" }
          : kind === "reminder"
            ? { eyebrow: text.noticeReminderEyebrow, title: text.noticeReminderTitle, className: "notice notice--reminder" }
            : { eyebrow: text.noticeErrorEyebrow, title: text.noticeErrorTitle, className: "notice notice--error" };
        pageMessage.hidden = false;
        pageMessage.className = palette.className;
        pageMessage.innerHTML =
          '<p class="notice__eyebrow">' + escapeHtml(palette.eyebrow) + '</p>' +
          '<p class="notice__title">' + escapeHtml(palette.title) + '</p>' +
          '<p class="notice__body">' + escapeHtml(value) + '</p>';
      }

      function clearMessage() {
        pageMessage.hidden = true;
        pageMessage.innerHTML = "";
      }

      function renderStatePanel(title, body, tone = "default") {
        const toneClass = tone === "danger" ? " state-panel--danger" : "";
        return '<div class="state-panel' + toneClass + '">' +
          '<p class="state-panel__title">' + escapeHtml(title) + '</p>' +
          '<p class="state-panel__body">' + escapeHtml(body) + '</p>' +
        '</div>';
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
          rawDownloadLink.hidden = true;
          bodyModeSwitch.hidden = true;
          metaEl.innerHTML = renderStatePanel(text.emailNotFound, text.emailUnavailableMeta, "danger");
          attachmentCountEl.textContent = text.noAttachments;
          attachmentListEl.innerHTML = '<div class="empty">' + escapeHtml(text.noAttachments) + "</div>";
          bodySourceEl.textContent = "";
          htmlFrameEl.hidden = true;
          htmlFrameEl.srcdoc = "";
          bodyEl.hidden = false;
          bodyEl.classList.add("is-empty-state");
          bodyEl.textContent = text.emailUnavailableBody;
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
        rawDownloadLink.hidden = false;
        rawDownloadLink.href = email.rawDownloadUrl;
        bodyEl.classList.remove("is-empty-state");
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
          attachmentListEl.innerHTML = '<div class="empty">' + escapeHtml(text.noAttachments) + '</div>';
          return;
        }

        attachmentCountEl.textContent = text.attachmentCount.replace("{count}", String(email.attachments.length));
        attachmentListEl.innerHTML = email.attachments.map((attachment) => (
          '<div class="detail-item">' +
            '<a class="attachment-link" href="' + escapeHtml(attachment.downloadUrl) + '">' +
              '<span class="attachment-name">' + escapeHtml(attachment.filename) + '</span>' +
            '</a>' +
            '<p class="muted">' + escapeHtml(attachment.contentType) + ' | ' + escapeHtml(formatBytes(attachment.sizeBytes)) + '</p>' +
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

async function deleteBucketKeys(bucket: R2Bucket, keys: string[]): Promise<void> {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (uniqueKeys.length === 0) {
    return;
  }

  await bucket.delete(uniqueKeys);
}

async function collectMailboxStorageKeys(db: D1Database, mailboxId: string): Promise<string[]> {
  const [emailKeys, attachmentKeys] = await Promise.all([
    listEmailStorageKeysForMailbox(db, mailboxId),
    listAttachmentKeysForMailbox(db, mailboxId)
  ]);

  return Array.from(new Set([...emailKeys, ...attachmentKeys]));
}

async function deleteMailboxWithStorage(env: Env, mailboxId: string): Promise<boolean> {
  const storageKeys = await collectMailboxStorageKeys(env.DB, mailboxId);
  const deletedCount = await deleteMailboxById(env.DB, mailboxId);
  if (deletedCount > 0) {
    await deleteBucketKeys(env.MAIL_BUCKET, storageKeys);
    return true;
  }

  return false;
}

async function deleteSubdomainWithStorage(env: Env, subdomainId: string): Promise<{
  deletedMailboxCount: number;
  deletedSubdomain: boolean;
}> {
  const mailboxes = await listMailboxDeletionCandidatesBySubdomain(env.DB, subdomainId);
  const storageKeysByMailbox = await Promise.all(mailboxes.map((mailbox) => collectMailboxStorageKeys(env.DB, mailbox.id)));
  const storageKeys = Array.from(new Set(storageKeysByMailbox.flat()));
  const deletedMailboxCount = await deleteMailboxesBySubdomainId(env.DB, subdomainId);
  const deletedSubdomain = (await deleteSubdomainById(env.DB, subdomainId)) > 0;

  if (deletedMailboxCount > 0) {
    await deleteBucketKeys(env.MAIL_BUCKET, storageKeys);
  }

  return {
    deletedMailboxCount,
    deletedSubdomain
  };
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

async function handleAdminOverviewApi(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const [stats, admins, recentSessions, recentLoginAttempts, recentAuditLogs, suspiciousLoginIps, databaseHealth] = await Promise.all([
    getAdminPanelStats(env.DB),
    listAdminSummaries(env.DB, 12),
    listRecentSessions(env.DB, 8),
    listRecentLoginAttempts(env.DB, 10),
    listRecentAuditLogs(env.DB, 10),
    listSuspiciousLoginIps(env.DB, 24, 3, 12),
    getDatabaseHealth(env.DB)
  ]);

  return json({
    stats,
    config: {
      baseDomain: env.BASE_DOMAIN,
      bootstrapAdminUsername: env.BOOTSTRAP_ADMIN_USERNAME,
      cfAccessEnabled: getBooleanVar(env.CF_ACCESS_ENABLED, false),
      sessionTtlHours: getNumberVar(env.SESSION_TTL_HOURS, 24),
      maxLoginFailures: getNumberVar(env.MAX_LOGIN_FAILURES, 10),
      loginBlockMinutes: getNumberVar(env.LOGIN_BLOCK_MINUTES, 15)
    },
    health: {
      database: databaseHealth,
      plainBootstrapPasswordExposed: hasPlainBootstrapPassword(env) && !isLocalRequest(request)
    },
    admins: admins.map((item) => ({
      id: item.id,
      username: item.username,
      isActive: item.is_active === 1,
      lastLoginAt: item.last_login_at,
      lastLoginIp: item.last_login_ip,
      createdAt: item.created_at
    })),
    recentSessions: recentSessions.map((item) => ({
      id: item.id,
      username: item.username,
      ipAddress: item.ip_address,
      createdAt: item.created_at,
      expiresAt: item.expires_at,
      revokedAt: item.revoked_at,
      isCurrent: item.session_token_hash === admin.tokenHash
    })),
    recentLoginAttempts: recentLoginAttempts.map((item) => ({
      ipAddress: item.ip_address,
      username: item.username,
      wasSuccessful: item.was_successful === 1,
      failureReason: item.failure_reason,
      createdAt: item.created_at
    })),
    suspiciousLoginIps: suspiciousLoginIps.map((item) => ({
      ipAddress: item.ip_address,
      failedCount: item.failed_count,
      lastAttemptAt: item.last_attempt_at,
      usernames: item.usernames ? item.usernames.split(",").map((value) => value.trim()).filter(Boolean).join(", ") : ""
    })),
    recentAuditLogs: recentAuditLogs.map((item) => ({
      action: item.action,
      targetType: item.target_type,
      targetId: item.target_id,
      createdAt: item.created_at
    }))
  });
}

async function handleAdminPasswordUpdate(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const body = await parseJsonBody(request);
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return errorResponse(400, "INVALID_INPUT", t(locale, "invalidInput"));
  }
  if (newPassword.length < 10) {
    return errorResponse(400, "PASSWORD_TOO_SHORT", t(locale, "passwordTooShort"));
  }
  if (newPassword !== confirmPassword) {
    return errorResponse(400, "PASSWORD_CONFIRM_MISMATCH", t(locale, "passwordConfirmMismatch"));
  }
  if (currentPassword === newPassword) {
    return errorResponse(400, "PASSWORD_REUSE_NOT_ALLOWED", t(locale, "passwordReuseNotAllowed"));
  }

  const currentAdmin = await getAdminById(env.DB, admin.adminId);
  if (!currentAdmin || currentAdmin.is_active !== 1) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const isCurrentPasswordValid = await verifyPassword(currentPassword, currentAdmin.password_hash);
  if (!isCurrentPasswordValid) {
    return errorResponse(401, "INVALID_CURRENT_PASSWORD", t(locale, "invalidCurrentPassword"));
  }

  const nextPasswordHash = await hashPassword(newPassword);
  await updateAdminPasswordHash(env.DB, admin.adminId, nextPasswordHash);
  const revokedSessionCount = await revokeOtherSessionsForAdmin(env.DB, admin.adminId, admin.tokenHash);

  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "admin.password_updated",
    targetType: "admin",
    targetId: admin.adminId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      revokedOtherSessions: revokedSessionCount
    }
  });

  return json({
    ok: true,
    revokedSessionCount
  });
}

async function handleAdminSessionRevoke(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const session = await getSessionById(env.DB, sessionId);
  if (!session) {
    return errorResponse(404, "SESSION_NOT_FOUND", t(locale, "unexpectedError"));
  }

  const changed = await revokeSessionById(env.DB, sessionId);
  if (changed === 0) {
    return json({
      ok: true,
      signedOutCurrentSession: session.session_token_hash === admin.tokenHash
    });
  }

  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "admin_session.revoked",
    targetType: "admin_session",
    targetId: sessionId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      sessionAdminId: session.admin_id
    }
  });

  const signedOutCurrentSession = session.session_token_hash === admin.tokenHash;
  const response = json({
    ok: true,
    signedOutCurrentSession
  });

  if (signedOutCurrentSession) {
    response.headers.set("set-cookie", await clearSessionCookie(request, env, isSecureRequest(request)));
  }

  return response;
}

async function handleAdminLoginAttemptsClear(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const body = await parseJsonBody(request);
  const ipAddress = String(body.ipAddress ?? "").trim();
  if (!ipAddress) {
    return errorResponse(400, "INVALID_INPUT", t(locale, "invalidInput"));
  }

  const clearedCount = await clearFailedLoginAttemptsByIp(env.DB, ipAddress);
  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "login_attempts.cleared_ip",
    targetType: "ip_address",
    targetId: ipAddress,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      clearedCount
    }
  });

  return json({
    ok: true,
    clearedCount
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
    listSubdomains(env.DB, 500)
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

async function handleDeleteSelectedSubdomain(
  request: Request,
  env: Env,
  subdomainId: string
): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const subdomain = await getSubdomainById(env.DB, subdomainId);
  if (!subdomain) {
    return errorResponse(404, "SUBDOMAIN_NOT_FOUND", t(locale, "noSuchSubdomain"));
  }

  const mailboxCount = await countExistingMailboxForSubdomain(env.DB, subdomainId);
  const result = await deleteSubdomainWithStorage(env, subdomainId);
  if (!result.deletedSubdomain) {
    return errorResponse(409, "SUBDOMAIN_DELETE_FAILED", t(locale, "unexpectedError"));
  }

  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "subdomain.deleted",
    targetType: "subdomain",
    targetId: subdomainId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      fullDomain: subdomain.full_domain,
      mailboxCount,
      deletedMailboxCount: result.deletedMailboxCount
    }
  });

  return json({
    ok: true,
    fullDomain: subdomain.full_domain,
    deletedMailboxCount: result.deletedMailboxCount
  });
}

async function handleMailboxListApi(request: Request, env: Env): Promise<Response> {
  const locale = resolveLocale(request);
  const admin = await getAuthenticatedAdmin(request, env);
  if (!admin) {
    return errorResponse(401, "UNAUTHORIZED", t(locale, "unauthorized"));
  }

  const [items, summary] = await Promise.all([
    listMailboxes(env.DB, 500),
    getMailboxSummary(env.DB)
  ]);

  return json({
    summary,
    items: items.map((item) => ({
      id: item.id,
      subdomainId: item.subdomain_id,
      fullDomain: item.full_domain ?? "",
      fullAddress: item.full_address,
      status: item.status,
      note: item.note,
      createdAt: item.created_at,
      totalEmailCount: item.total_email_count
    }))
  });
}

async function handleDeleteSelectedMailbox(
  request: Request,
  env: Env,
  mailboxId: string
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

  const deleted = await deleteMailboxWithStorage(env, mailboxId);
  if (!deleted) {
    return errorResponse(409, "MAILBOX_DELETE_FAILED", t(locale, "unexpectedError"));
  }

  await writeAuditLog(env.DB, {
    actorType: "admin",
    actorId: admin.adminId,
    action: "mailbox.deleted",
    targetType: "mailbox",
    targetId: mailboxId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      fullAddress: mailbox.full_address,
      totalEmailCount: mailbox.total_email_count
    }
  });

  return json({
    ok: true,
    fullAddress: mailbox.full_address,
    totalEmailCount: mailbox.total_email_count
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
    const message = getErrorMessage(error);
    if (isLegacySubdomainUniqueIndexError(message)) {
      return errorResponse(409, "MAILBOX_SCHEMA_OUTDATED", t(locale, "mailboxSchemaOutdated"));
    }
    if (isMailboxAddressConflictError(message)) {
      return errorResponse(409, "MAILBOX_ALREADY_EXISTS", t(locale, "mailboxAlreadyExists"));
    }

    console.error("Mailbox creation failed", { message });
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
  const adminSessionRevokeMatch =
    request.method === "POST" ? url.pathname.match(/^\/api\/admin\/sessions\/([^/]+)\/revoke$/) : null;
  const mailboxDeleteMatch =
    request.method === "POST" ? url.pathname.match(/^\/api\/mailboxes\/([^/]+)\/delete$/) : null;
  const subdomainDeleteMatch =
    request.method === "POST" ? url.pathname.match(/^\/api\/subdomains\/([^/]+)\/delete$/) : null;
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

  if (request.method === "GET" && url.pathname === "/admin") {
    return admin ? html(renderAdminPage(env.APP_NAME, admin.username, locale)) : redirect(`/login?lang=${locale}`);
  }

  if (request.method === "GET" && url.pathname === "/mailboxes") {
    return admin ? html(renderMailboxesPage(env.APP_NAME, locale)) : redirect(`/login?lang=${locale}`);
  }

  if (emailPageMatch) {
    return admin
      ? html(renderEmailDetailPage(env.APP_NAME, locale, emailPageMatch[1], emailPageMatch[2]))
      : redirect(`/login?lang=${locale}`);
  }

  if (mailboxPageMatch) {
    return admin
      ? html(renderMailboxDetailPage(env.APP_NAME, locale, mailboxPageMatch[1]))
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

  if (request.method === "GET" && url.pathname === "/api/admin/overview") {
    return handleAdminOverviewApi(request, env);
  }

  if (request.method === "POST" && url.pathname === "/api/admin/password") {
    return handleAdminPasswordUpdate(request, env);
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login-attempts/clear") {
    return handleAdminLoginAttemptsClear(request, env);
  }

  if (adminSessionRevokeMatch) {
    return handleAdminSessionRevoke(request, env, adminSessionRevokeMatch[1]);
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

  if (subdomainDeleteMatch) {
    return handleDeleteSelectedSubdomain(request, env, subdomainDeleteMatch[1]);
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

  if (mailboxDeleteMatch) {
    return handleDeleteSelectedMailbox(request, env, mailboxDeleteMatch[1]);
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


