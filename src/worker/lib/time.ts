export function hoursToSeconds(hours: number): number {
  return Math.max(1, Math.floor(hours * 60 * 60));
}

export function toSqliteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function minutesAgoTimestamp(minutes: number): string {
  return toSqliteTimestamp(new Date(Date.now() - minutes * 60 * 1000));
}

export function plusHoursTimestamp(hours: number): string {
  return toSqliteTimestamp(new Date(Date.now() + hours * 60 * 60 * 1000));
}

export function nowTimestamp(): string {
  return toSqliteTimestamp(new Date());
}
