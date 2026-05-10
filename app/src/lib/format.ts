const LOCALE = process.env.CLUB_LOCALE ?? "en-US";
const CURRENCY = process.env.CLUB_CURRENCY ?? "USD";
const TZ = process.env.CLUB_TIMEZONE ?? "America/New_York";

export function formatMoney(cents: number, currency: string = CURRENCY) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
