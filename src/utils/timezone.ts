/**
 * All "today" / day-boundary logic must go through these helpers.
 * Always pass the user's IANA timezone (e.g. "Asia/Kolkata", "America/New_York").
 * Default falls back to IST when no preference is stored.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Returns the UTC offset in milliseconds for a given timezone at a given moment. */
function getOffsetMs(timezone: string, date: Date): number {
  const inTZ  = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  const inUTC = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return inTZ.getTime() - inUTC.getTime();
}

/** Returns "YYYY-MM-DD" in the user's local timezone for a given UTC instant. */
export function toLocalDateStr(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

/**
 * Returns the UTC Date that corresponds to 00:00:00.000 in the user's timezone
 * on the calendar day that `date` falls in.
 *
 * Example — IST (UTC+5:30):
 *   date = 2026-02-26T00:25:00+05:30 => 2026-02-25T18:55:00Z
 *   returns  2026-02-25T18:30:00Z  (midnight IST on Feb 26, expressed in UTC)
 */
export function startOfDayInTZ(timezone: string, date: Date = new Date()): Date {
  const localDateStr = toLocalDateStr(date, timezone);          // "2026-02-26"
  const offsetMs     = getOffsetMs(timezone, date);             // +19800000 for IST
  const midnightUTC  = new Date(localDateStr + "T00:00:00.000Z"); // treat local date as UTC first
  return new Date(midnightUTC.getTime() - offsetMs);            // shift back by offset
}

/** Returns the UTC Date for 23:59:59.999 in the user's timezone on the same calendar day. */
export function endOfDayInTZ(timezone: string, date: Date = new Date()): Date {
  const start = startOfDayInTZ(timezone, date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Shorthand: start of today in the user's timezone. */
export function todayInTZ(timezone: string): Date {
  return startOfDayInTZ(timezone);
}

/** Shorthand: start of tomorrow in the user's timezone. */
export function tomorrowInTZ(timezone: string): Date {
  const today = todayInTZ(timezone);
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Strips a stored Date to "day precision" by normalising to the start of that
 * calendar day in UTC.  Used only for grouping / comparing log dates against
 * each other (not against "now" — use todayInTZ for that).
 */
export function toDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** Validate that a string is a recognised IANA timezone. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
