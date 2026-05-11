import type { Email } from "postal-mime";
import { nowTimestamp, toSqliteTimestamp } from "../lib/time";
import { stripHtml } from "../html-sanitizer/email";

export function buildPreview(email: Email): string | null {
  const source = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
  if (!source) {
    return null;
  }

  return source.slice(0, 240);
}

export function resolveReceivedAt(email: Email): string {
  if (email.date) {
    const parsed = new Date(email.date);
    if (!Number.isNaN(parsed.getTime())) {
      return toSqliteTimestamp(parsed);
    }
  }

  return nowTimestamp();
}

export function sanitizeKeyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "mail";
}

export function buildEmailStoragePrefix(mailboxId: string, emailId: string, receivedAt: string): string {
  const stamp = receivedAt.replace(/[^\d]/g, "").slice(0, 14) || Date.now().toString();
  return `mailboxes/${mailboxId}/${stamp}-${emailId}`;
}

export function toAttachmentBytes(content: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }

  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }

  return new TextEncoder().encode(content);
}
