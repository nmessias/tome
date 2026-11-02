/**
 * The signed-in user from better-auth's session cookie, without loading
 * better-auth.
 *
 * Every request needs this, and asking better-auth means loading it: ~45MB of
 * modules, measured, on a 256MB machine. The checks are better-call's
 * getSignedCookie (HMAC-SHA256 over the token, 44-char base64 signature) plus
 * better-auth's getSession (the token names an unexpired session row).
 * Sessions are not slid forward here (better-auth's updateAge): one lasts
 * session.expiresIn (a year) from sign-in.
 */

/** better-auth's session cookie; HTTPS deployments use the __Secure- prefix. */
const COOKIE_NAMES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

/** Same fallback chain as better-auth's createAuthContext. */
export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  return env.BETTER_AUTH_SECRET || env.AUTH_SECRET || "better-auth-secret-12345678901234567890";
}

export interface SessionRow {
  userId: string;
  role: string | null;
  expiresAt: string;
}

export type SessionUser = { user: { id: string; role: string | null } };

const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    keys.set(secret, key);
  }
  return key;
}

export async function readSession(
  cookieHeader: string | null,
  secret: string,
  find: (token: string) => SessionRow | null,
  now = Date.now(),
): Promise<SessionUser | null> {
  if (!cookieHeader) return null;
  const cookies = new Bun.CookieMap(cookieHeader);
  const value = COOKIE_NAMES.map((name) => cookies.get(name)).find(Boolean);
  if (!value) return null;

  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const token = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (signature.length !== 44 || !signature.endsWith("=")) return null;

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, new TextEncoder().encode(token)))) return null;

  const row = find(token);
  if (!row || !(Date.parse(row.expiresAt) > now)) return null;
  return { user: { id: row.userId, role: row.role } };
}
