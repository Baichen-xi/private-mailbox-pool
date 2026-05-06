import type { Env } from "../env";
import { parseCookies, serializeCookie } from "../lib/cookies";
import { createOpaqueToken, sha256Hex } from "../lib/ids";
import { hoursToSeconds, plusHoursTimestamp } from "../lib/time";
import { createSessionRecord, getSessionByTokenHash, revokeSessionByTokenHash } from "../db/sessions";

export interface AuthenticatedAdmin {
  adminId: string;
  username: string;
  tokenHash: string;
}

export async function getAuthenticatedAdmin(
  request: Request,
  env: Env
): Promise<AuthenticatedAdmin | null> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[env.COOKIE_NAME];
  if (!token) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const session = await getSessionByTokenHash(env.DB, tokenHash);
  if (!session) {
    return null;
  }

  return {
    adminId: session.admin_id,
    username: session.username,
    tokenHash
  };
}

export async function createSessionCookie(
  env: Env,
  args: {
    adminId: string;
    ipAddress: string | null;
    userAgent: string | null;
    secure: boolean;
  }
): Promise<string> {
  const token = createOpaqueToken("sess_");
  const tokenHash = await sha256Hex(token);
  const ttlHours = Number(env.SESSION_TTL_HOURS || "24");

  await createSessionRecord(env.DB, {
    adminId: args.adminId,
    tokenHash,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
    expiresAt: plusHoursTimestamp(ttlHours)
  });

  return serializeCookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: args.secure,
    sameSite: "Lax",
    path: "/",
    maxAge: hoursToSeconds(ttlHours)
  });
}

export async function clearSessionCookie(
  request: Request,
  env: Env,
  secure: boolean
): Promise<string> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[env.COOKIE_NAME];

  if (token) {
    const tokenHash = await sha256Hex(token);
    await revokeSessionByTokenHash(env.DB, tokenHash);
  }

  return serializeCookie(env.COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  });
}
