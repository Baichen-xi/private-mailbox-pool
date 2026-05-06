export interface Env {
  DB: D1Database;
  MAIL_BUCKET: R2Bucket;
  APP_NAME: string;
  BASE_DOMAIN: string;
  COOKIE_NAME: string;
  SESSION_TTL_HOURS: string;
  MAX_LOGIN_FAILURES: string;
  LOGIN_BLOCK_MINUTES: string;
  CF_ACCESS_ENABLED: string;
  BOOTSTRAP_ADMIN_USERNAME: string;
  BOOTSTRAP_ADMIN_PASSWORD_HASH?: string;
  BOOTSTRAP_ADMIN_PASSWORD_PLAIN?: string;
}

export function getNumberVar(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getBooleanVar(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === "") {
    return fallback;
  }

  return raw === "true";
}
