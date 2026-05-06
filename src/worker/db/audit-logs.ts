import { createId } from "../lib/ids";

export async function writeAuditLog(
  db: D1Database,
  args: {
    actorType: "admin" | "system" | "access" | "mailbox_token";
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (
         id, actor_type, actor_id, action, target_type, target_id, ip_address, user_agent, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId(),
      args.actorType,
      args.actorId ?? null,
      args.action,
      args.targetType,
      args.targetId ?? null,
      args.ipAddress ?? null,
      args.userAgent ?? null,
      args.metadata ? JSON.stringify(args.metadata) : null
    )
    .run();
}
