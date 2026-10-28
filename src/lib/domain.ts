/** Shared validation for the UI and future server adapters. No browser state. */
export const SHOP_TIMEZONE = "America/Sao_Paulo";

export function shopNow(at = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const get = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  // A calendar/display value, not an instant to persist as created_at.
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : null;
}

export function validServiceDuration(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const minutes = Number(value);
  return minutes >= 15 && minutes <= 480 && minutes % 15 === 0 ? minutes : null;
}

export function validHours(open: string, close: string, breakStart: string, breakEnd: string): boolean {
  const isTime = (s: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
  return isTime(open) && isTime(close) && open < close &&
    ((!breakStart && !breakEnd) || (isTime(breakStart) && isTime(breakEnd) &&
      open <= breakStart && breakStart < breakEnd && breakEnd <= close));
}
