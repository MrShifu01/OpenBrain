// Tiny vCard 3.0/4.0 parser. Handles the property shapes we care about for
// contact-import: FN (formatted name), N (structured), TEL, EMAIL, ORG, NOTE,
// BDAY, ADR. Ignores everything else (PHOTO, X-*, SOUND, etc.). Designed to
// be lenient — Apple/Google/Microsoft each emit slightly different headers
// and casings, so we lower-case the property name and tolerate minor
// whitespace / line-folding quirks.

export interface ParsedContact {
  /** Stable per-import id so the modal checkboxes don't get confused if two contacts share a name. */
  uid: string;
  name: string;
  phones: string[];
  emails: string[];
  org?: string;
  title?: string;
  note?: string;
  birthday?: string;
  address?: string;
  /** Kept for write-through into the entry's content body. */
  rawSummary: string;
}

export function parseVCardFile(text: string): ParsedContact[] {
  // Unfold continuation lines: vCard wraps long values onto continuation
  // lines that start with a space or tab. Standard before any further
  // splitting.
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const out: ParsedContact[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const endIdx = blocks[i].search(/END:VCARD/i);
    const body = endIdx >= 0 ? blocks[i].slice(0, endIdx) : blocks[i];
    const contact = parseBlock(body, i);
    if (contact && (contact.name || contact.phones.length || contact.emails.length)) {
      out.push(contact);
    }
  }
  return out;
}

function parseBlock(body: string, idx: number): ParsedContact | null {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let fn: string | undefined;
  let nStruct: string | undefined;
  const phones: string[] = [];
  const emails: string[] = [];
  let org: string | undefined;
  let title: string | undefined;
  let note: string | undefined;
  let birthday: string | undefined;
  let address: string | undefined;

  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1).trim();
    if (!value) continue;
    const propName = head.split(";")[0].toLowerCase();

    switch (propName) {
      case "fn":
        fn = decodeQuoted(value);
        break;
      case "n": {
        // N is structured: Family;Given;Additional;Prefix;Suffix
        const parts = value
          .split(";")
          .map((p) => decodeQuoted(p.trim()))
          .filter(Boolean);
        if (parts.length >= 2) nStruct = `${parts[1]} ${parts[0]}`.trim();
        else if (parts[0]) nStruct = parts[0];
        break;
      }
      case "tel": {
        const cleaned = value.replace(/[^0-9+()\- .]/g, "").trim();
        if (cleaned) phones.push(cleaned);
        break;
      }
      case "email": {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) emails.push(value);
        break;
      }
      case "org":
        org = decodeQuoted(value.split(";")[0]?.trim() || value);
        break;
      case "title":
        title = decodeQuoted(value);
        break;
      case "note":
        note = decodeQuoted(value).replace(/\\n/g, "\n");
        break;
      case "bday":
        birthday = value;
        break;
      case "adr": {
        // ADR is structured: PO;Extended;Street;City;Region;Postal;Country
        const parts = value
          .split(";")
          .map((p) => decodeQuoted(p.trim()))
          .filter(Boolean);
        address = parts.join(", ");
        break;
      }
      default:
        break;
    }
  }

  const name = fn || nStruct || phones[0] || emails[0] || "";
  if (!name) return null;

  const summaryLines: string[] = [];
  if (org && title) summaryLines.push(`${title} at ${org}`);
  else if (org) summaryLines.push(org);
  else if (title) summaryLines.push(title);
  for (const p of phones) summaryLines.push(`Tel: ${p}`);
  for (const e of emails) summaryLines.push(`Email: ${e}`);
  if (birthday) summaryLines.push(`Birthday: ${birthday}`);
  if (address) summaryLines.push(`Address: ${address}`);
  if (note) summaryLines.push(`Note: ${note}`);

  return {
    uid: `vcard-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    name,
    phones,
    emails,
    org,
    title,
    note,
    birthday,
    address,
    rawSummary: summaryLines.join("\n"),
  };
}

function decodeQuoted(s: string): string {
  return s
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\n/g, " ")
    .replace(/\\\\/g, "\\")
    .trim();
}
