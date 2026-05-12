import { createId } from "../lib/ids";
import { nowTimestamp } from "../lib/time";

export type MailBlockRuleType = "sender_email" | "sender_domain" | "subject_keyword" | "attachment_type";
export type MailBlockRuleAction = "reject";

export interface MailBlockRuleRecord {
  id: string;
  rule_type: MailBlockRuleType;
  value: string;
  action: MailBlockRuleAction;
  note: string | null;
  is_active: number;
  hit_count: number;
  last_hit_at: string | null;
  created_at: string;
}

export interface MailBlockRuleInsertArgs {
  ruleType: MailBlockRuleType;
  value: string;
  note?: string | null;
}

export interface MailBlockCandidateAttachment {
  filename?: string | null;
  mimeType?: string | null;
}

export interface MailBlockEvaluationInput {
  fromAddress: string;
  subject?: string | null;
  attachments?: MailBlockCandidateAttachment[];
}

export interface MailBlockMatch {
  rule: MailBlockRuleRecord;
  reason: string;
}

function isMissingRulesTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table: mail_block_rules/i.test(message);
}

export function normalizeMailBlockRuleValue(ruleType: MailBlockRuleType, rawValue: string): string {
  const value = rawValue.trim().toLowerCase();
  if (ruleType === "sender_email") {
    return value;
  }
  if (ruleType === "sender_domain") {
    return value.replace(/^@+/, "");
  }
  if (ruleType === "attachment_type") {
    if (!value) {
      return "";
    }
    if (value.startsWith(".") || value.includes("/") || value.endsWith("*")) {
      return value;
    }
    return `.${value}`;
  }
  return value;
}

export function isValidMailBlockRuleType(value: string): value is MailBlockRuleType {
  return ["sender_email", "sender_domain", "subject_keyword", "attachment_type"].includes(value);
}

export async function listMailBlockRules(db: D1Database, limit = 100): Promise<MailBlockRuleRecord[]> {
  try {
    const result = await db
      .prepare(
        `SELECT
           id,
           rule_type,
           value,
           action,
           note,
           is_active,
           hit_count,
           last_hit_at,
           created_at
         FROM mail_block_rules
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<MailBlockRuleRecord>();

    return result.results ?? [];
  } catch (error) {
    if (isMissingRulesTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listActiveMailBlockRules(db: D1Database): Promise<MailBlockRuleRecord[]> {
  try {
    const result = await db
      .prepare(
        `SELECT
           id,
           rule_type,
           value,
           action,
           note,
           is_active,
           hit_count,
           last_hit_at,
           created_at
         FROM mail_block_rules
         WHERE is_active = 1
         ORDER BY created_at DESC`
      )
      .all<MailBlockRuleRecord>();

    return result.results ?? [];
  } catch (error) {
    if (isMissingRulesTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function createMailBlockRule(
  db: D1Database,
  args: MailBlockRuleInsertArgs
): Promise<{ id: string }> {
  const id = createId();
  const timestamp = nowTimestamp();

  await db
    .prepare(
      `INSERT INTO mail_block_rules (
         id, rule_type, value, action, note, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, 'reject', ?, 1, ?, ?)`
    )
    .bind(id, args.ruleType, args.value, args.note ?? null, timestamp, timestamp)
    .run();

  return { id };
}

export async function deleteMailBlockRuleById(db: D1Database, ruleId: string): Promise<MailBlockRuleRecord | null> {
  const existing = await db
    .prepare(
      `SELECT
         id,
         rule_type,
         value,
         action,
         note,
         is_active,
         hit_count,
         last_hit_at,
         created_at
       FROM mail_block_rules
       WHERE id = ?
       LIMIT 1`
    )
    .bind(ruleId)
    .first<MailBlockRuleRecord>();

  if (!existing) {
    return null;
  }

  await db
    .prepare(`DELETE FROM mail_block_rules WHERE id = ?`)
    .bind(ruleId)
    .run();

  return existing;
}

export async function recordMailBlockRuleHit(db: D1Database, ruleId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE mail_block_rules
       SET hit_count = hit_count + 1,
           last_hit_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(nowTimestamp(), nowTimestamp(), ruleId)
    .run();
}

function getEmailDomain(address: string): string {
  const atIndex = address.lastIndexOf("@");
  return atIndex >= 0 ? address.slice(atIndex + 1).toLowerCase() : "";
}

function domainMatches(candidateDomain: string, ruleDomain: string): boolean {
  return candidateDomain === ruleDomain || candidateDomain.endsWith(`.${ruleDomain}`);
}

function attachmentTypeMatches(attachment: MailBlockCandidateAttachment, ruleValue: string): boolean {
  const mimeType = (attachment.mimeType ?? "").toLowerCase();
  const filename = (attachment.filename ?? "").toLowerCase();

  if (ruleValue.endsWith("/*")) {
    return mimeType.startsWith(ruleValue.slice(0, -1));
  }
  if (ruleValue.includes("/")) {
    return mimeType === ruleValue;
  }
  if (ruleValue.startsWith(".")) {
    return filename.endsWith(ruleValue);
  }
  return false;
}

export function evaluateMailBlockRules(
  rules: MailBlockRuleRecord[],
  input: MailBlockEvaluationInput
): MailBlockMatch | null {
  const fromAddress = input.fromAddress.trim().toLowerCase();
  const fromDomain = getEmailDomain(fromAddress);
  const subject = (input.subject ?? "").toLowerCase();
  const attachments = input.attachments ?? [];

  for (const rule of rules) {
    if (rule.is_active !== 1) {
      continue;
    }

    if (rule.rule_type === "sender_email" && fromAddress === rule.value) {
      return { rule, reason: "sender_email" };
    }
    if (rule.rule_type === "sender_domain" && fromDomain && domainMatches(fromDomain, rule.value)) {
      return { rule, reason: "sender_domain" };
    }
    if (rule.rule_type === "subject_keyword" && rule.value && subject.includes(rule.value)) {
      return { rule, reason: "subject_keyword" };
    }
    if (
      rule.rule_type === "attachment_type" &&
      attachments.some((attachment) => attachmentTypeMatches(attachment, rule.value))
    ) {
      return { rule, reason: "attachment_type" };
    }
  }

  return null;
}
