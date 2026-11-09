// Login IDs look like "name@companyname": a name, then @, then the
// company's slug. They look like an email but are NOT one: nothing is ever
// sent to them. Real emails (for reset links) are kept in "email".

// Name part: letters, numbers, dot, dash, underscore. Company part: the slug.
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

export type ParsedLoginId = {
  ok: boolean;
  username?: string;
  slug?: string;
  reason?: 'domain' | 'format';
  domain?: string; // e.g. ".com" when someone typed name@company.com
};

export function parseLoginId(input: unknown): ParsedLoginId {
  const v = String(input ?? '').trim().toLowerCase();
  const at = v.lastIndexOf('@');
  if (at <= 0 || at === v.length - 1) return { ok: false, reason: 'format' };
  const username = v.slice(0, at);
  const slug = v.slice(at + 1);
  // "name@companyname.com" → refused before anything is looked up
  if (slug.includes('.')) return { ok: false, reason: 'domain', domain: slug.slice(slug.indexOf('.')) };
  if (!USERNAME_RE.test(username) || !SLUG_RE.test(slug)) return { ok: false, reason: 'format' };
  return { ok: true, username, slug };
}

// Turns "First.Last+work@gmail.com" or "First Last" into "first.last"
export function baseUsername(source: unknown): string {
  let s = String(source ?? '').trim().toLowerCase();
  if (s.includes('@')) s = s.slice(0, s.indexOf('@'));
  s = s
    .replace(/\+.*$/, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 34)
    .replace(/[._-]+$/g, '');
  return s || 'user';
}

// Validates a name typed by the owner (the part before @)
export function cleanUsername(input: unknown): string | null {
  const v = String(input ?? '').trim().toLowerCase();
  return USERNAME_RE.test(v) ? v : null;
}

// "ali", then "ali2", "ali3" ... whichever is free in this company
export async function freeUsername(db: any, base: string, exceptUserId?: string): Promise<string> {
  const rows = (await db.$queryRawUnsafe(
    `SELECT LOWER("username") AS "u" FROM "users"
     WHERE "isDeleted" = false AND "username" IS NOT NULL
       AND (LOWER("username") = $1 OR LOWER("username") ~ ('^' || $2 || '[0-9]+$'))
       AND ($3::uuid IS NULL OR "id" <> $3::uuid)`,
    base,
    base.replace(/[.\-]/g, (c) => '\\' + c),
    exceptUserId || null,
  )) as any[];
  const taken = new Set(rows.map((r) => r.u));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10000; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  return `${base}${Date.now()}`;
}

export function domainMessage(domain?: string) {
  const d = domain && domain.length <= 20 ? domain : '.com';
  return `Remove "${d}" from your login ID. It ends with your company name, like name@companyname.`;
}
