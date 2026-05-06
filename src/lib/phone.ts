// International phone + email extraction. Uses libphonenumber-js (the
// "min" build, ~80KB) to validate and normalize numbers across every
// country code. Without this, Call/WhatsApp would only work for South
// African numbers.
//
// Default country is derived from navigator.language (e.g. "en-ZA" → ZA)
// so a user typing the local format (no leading +CC) is parsed against
// the country they're actually in. International (+CC) numbers are
// always recognised regardless of locale. Tests pass `defaultCountry`
// explicitly to avoid depending on jsdom's locale.

import {
  findPhoneNumbersInText,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import type { Entry } from "../types";

// Common metadata keys that hold a phone number directly. Tried in order;
// the first one that parses to a valid number wins. More reliable than
// scanning content because users often paste structured data here.
const STRUCTURED_PHONE_KEYS = [
  "phone",
  "cellphone",
  "mobile",
  "landline",
  "tel",
  "telephone",
  "whatsapp",
  "wa",
];

function detectDefaultCountry(): CountryCode | undefined {
  if (typeof navigator === "undefined") return undefined;
  const tag = navigator.language || "";
  const region = tag.split("-")[1];
  return region && /^[A-Z]{2}$/.test(region) ? (region as CountryCode) : undefined;
}

export function extractPhone(entry: Entry, defaultCountry?: CountryCode): string | null {
  const country = defaultCountry ?? detectDefaultCountry();
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;

  // 1. Structured metadata fields. These are the most reliable signal —
  //    a key literally named "phone" beats a regex scan over content.
  for (const key of STRUCTURED_PHONE_KEYS) {
    const raw = meta[key];
    if (typeof raw === "string" && raw.trim()) {
      const parsed = parsePhoneNumberFromString(raw, country);
      if (parsed?.isValid()) return parsed.number;
    }
  }

  // 2. Free-text scan over all metadata values + content. With a default
  //    country, local-format numbers are recognised; without one, only
  //    +CC international numbers match. Either way, returned as E.164.
  const text = JSON.stringify(meta) + " " + (entry.content ?? "");
  const matches = findPhoneNumbersInText(text, country);
  if (matches.length > 0) return matches[0]!.number.number;

  return null;
}

export function extractEmail(entry: Entry): string | null {
  const s = JSON.stringify(entry.metadata || {}) + " " + (entry.content || "");
  const m = s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

export function toWaUrl(phone: string, defaultCountry?: CountryCode): string {
  // wa.me/<digits> takes E.164 without the leading '+'. Parse so users
  // who type the number with formatting (spaces, parens, dashes) still
  // get a valid link.
  const parsed = parsePhoneNumberFromString(phone, defaultCountry ?? detectDefaultCountry());
  if (parsed?.isValid()) {
    return `https://wa.me/${parsed.number.slice(1)}`;
  }
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
