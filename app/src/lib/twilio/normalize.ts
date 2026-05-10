import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "US";

export function toE164(raw: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

export function formatHuman(e164: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.isValid()) return e164;
  if (parsed.country === country) return parsed.formatNational();
  return parsed.formatInternational();
}
