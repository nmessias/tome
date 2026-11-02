import { describe, expect, test } from "bun:test";
import { serializeSignedCookie } from "better-call";
import { readSession, sessionSecret, type SessionRow } from "../src/lib/session";

const SECRET = "test-secret-0123456789abcdef0123456789";
const TOKEN = "abcDEF0123456789abcDEF0123456789";
const future = new Date(Date.now() + 86_400_000).toISOString();
const rows = new Map<string, SessionRow>([[TOKEN, { userId: "u1", role: "admin", expiresAt: future }]]);
const find = (token: string) => rows.get(token) ?? null;

/** The exact header better-auth sets, from better-call's own signer. */
async function cookie(name = "better-auth.session_token", token = TOKEN, secret = SECRET) {
  return (await serializeSignedCookie(name, token, secret)).split(";")[0];
}

describe("readSession (better-auth session cookie without better-auth)", () => {
  test("a cookie better-auth signed resolves to its user, with or without __Secure-", async () => {
    expect(await readSession(`theme=dark; ${await cookie()}`, SECRET, find)).toEqual({ user: { id: "u1", role: "admin" } });
    expect(await readSession(await cookie("__Secure-better-auth.session_token"), SECRET, find)).toEqual({ user: { id: "u1", role: "admin" } });
  });

  test("a wrong secret, tampered token or malformed signature is rejected", async () => {
    expect(await readSession(await cookie(undefined, TOKEN, "another-secret-0123456789abcdef0123"), SECRET, find)).toBeNull();
    const forged = (await cookie()).replace(TOKEN, TOKEN.replace("a", "b"));
    expect(await readSession(forged, SECRET, find)).toBeNull();
    expect(await readSession(`better-auth.session_token=${TOKEN}.short`, SECRET, find)).toBeNull();
    expect(await readSession(`better-auth.session_token=${TOKEN}`, SECRET, find)).toBeNull();
    expect(await readSession(null, SECRET, find)).toBeNull();
  });

  test("a signed token with no session row, or an expired one, is no session", async () => {
    expect(await readSession(await cookie(undefined, "zzzDEF0123456789abcDEF0123456789"), SECRET, find)).toBeNull();
    const later = Date.parse(future) + 1;
    expect(await readSession(await cookie(), SECRET, find, later)).toBeNull();
  });

  test("secret fallback matches better-auth", () => {
    expect(sessionSecret({ BETTER_AUTH_SECRET: "a", AUTH_SECRET: "b" })).toBe("a");
    expect(sessionSecret({ AUTH_SECRET: "b" })).toBe("b");
    expect(sessionSecret({})).toBe("better-auth-secret-12345678901234567890");
  });
});
