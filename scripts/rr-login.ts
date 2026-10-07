#!/usr/bin/env bun
/**
 * Refresh the Royal Road session on a remote Tome server.
 *
 * Why this exists: Royal Road sits behind Cloudflare, which challenges *login
 * submissions* from datacenter IPs. A Tome server on Fly can therefore read
 * public pages fine but can never log in - `auto-login` fails there even with a
 * real headful Chromium. Run this from a machine on a network Cloudflare trusts
 * (your laptop) and it logs in for real, then hands the fresh session cookie to
 * the server through Tome's own settings endpoint.
 *
 *   bun run scripts/rr-login.ts              # login + push cookie + verify
 *   bun run scripts/rr-login.ts --check      # only report server-side health
 *
 * Configuration (env or .env):
 *   TOME_URL               default https://tome-in.fly.dev
 *   AUTH_USERNAME          Tome login (same credentials as the server)
 *   AUTH_PASSWORD
 *   ROYAL_ROAD_USERNAME    Royal Road account
 *   ROYAL_ROAD_PASSWORD
 *
 * Secrets are never printed: cookie values are masked in all output.
 */
import { chromium } from "playwright";

const TOME_URL = (process.env.TOME_URL || "https://tome-in.fly.dev").replace(/\/$/, "");
const SOURCE = "royalroad";
const IDENTITY_COOKIE = ".AspNetCore.Identity.Application";

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set. Add it to .env (see .env.example).`);
  return value!;
}

function mask(value: string): string {
  return value.length <= 8 ? "***" : `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

/**
 * Cloudflare catches headless Chromium, so drive a real window. On a headless
 * box that means Xvfb; re-exec under it before doing anything else.
 */
function ensureDisplay(): void {
  if (process.env.DISPLAY) return;
  const hasXvfb = Bun.spawnSync({ cmd: ["sh", "-c", "command -v xvfb-run"] }).exitCode === 0;
  if (!hasXvfb) {
    fail("No DISPLAY and xvfb-run not found. Install xvfb, or run this on a desktop.");
  }
  const self = [process.execPath, import.meta.path, ...args];
  console.log("No DISPLAY - re-running under xvfb-run...");
  const child = Bun.spawnSync({ cmd: ["xvfb-run", "-a", ...self], stdout: "inherit", stderr: "inherit" });
  process.exit(child.exitCode ?? 1);
}

/** Log in to Royal Road in a real browser and return the session cookies. */
async function loginToRoyalRoad(): Promise<{ identity: string; clearance?: string }> {
  const email = requireEnv("ROYAL_ROAD_USERNAME");
  const password = requireEnv("ROYAL_ROAD_PASSWORD");

  let browser;
  try {
    browser = await chromium.launch({
      channel: "chromium",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
  } catch (e: any) {
    if (String(e?.message).includes("Executable doesn't exist")) {
      fail("Chromium is not installed. Run: bunx playwright install --with-deps chromium");
    }
    throw e;
  }

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  const page = await ctx.newPage();

  try {
    await page.goto("https://www.royalroad.com/account/login?returnurl=%2Fhome", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector('input[name="Email"]', { timeout: 25_000 });

    // Scope the click to the credentials form: the social sign-in buttons are
    // also <button type="submit"> and come first in the DOM.
    await page.fill('input[name="Email"]', email);
    await page.fill('input[name="Password"]', password);
    await page
      .locator('form:has(input[name="Password"]) button[type="submit"]:not([name="provider"])')
      .first()
      .click();

    let identity: string | undefined;
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline && !identity) {
      identity = (await ctx.cookies()).find((c) => c.name === IDENTITY_COOKIE)?.value;
      if (!identity) await page.waitForTimeout(1500);
    }

    if (!identity) {
      const title = await page.title().catch(() => "");
      if (/just a moment/i.test(title)) {
        fail(
          "Cloudflare challenged the login submission from this network too.\n" +
            "  This script must run from a network Cloudflare trusts (e.g. your laptop at home)."
        );
      }
      fail(`Login did not produce a session cookie (landed on "${title || page.url()}").`);
    }

    const clearance = (await ctx.cookies()).find((c) => c.name === "cf_clearance")?.value;
    console.log(`✓ Logged in to Royal Road as ${email}`);
    console.log(`  ${IDENTITY_COOKIE} = ${mask(identity)}`);
    return { identity, clearance };
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** Sign in to Tome and return the session cookie header value. */
async function loginToTome(): Promise<string> {
  const username = requireEnv("AUTH_USERNAME");
  const password = requireEnv("AUTH_PASSWORD");

  const res = await fetch(`${TOME_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: "manual",
  });

  // Take the whole "name=value" pair: on HTTPS the cookie is issued as
  // __Secure-better-auth.session_token, and rebuilding the name drops that
  // prefix, which makes the server ignore it and treat us as anonymous.
  const setCookie = res.headers.get("set-cookie") || "";
  const session = setCookie.split(";")[0]?.trim();
  if (!session || !session.includes("session_token=")) {
    fail(
      `Could not sign in to ${TOME_URL} (status ${res.status}). ` +
        "Check AUTH_USERNAME/AUTH_PASSWORD match the server."
    );
  }
  console.log(`✓ Signed in to ${TOME_URL}`);
  return session;
}

async function pushCredentials(cookie: string, values: { identity: string; clearance?: string }): Promise<void> {
  const form = new URLSearchParams({ identity: values.identity });
  if (values.clearance) form.set("cfclearance", values.clearance);

  const res = await fetch(`${TOME_URL}/settings/sources/${SOURCE}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: form.toString(),
    redirect: "manual",
  });

  const body = await res.text();
  if (/Invalid credentials|error/i.test(body) && !/Credentials saved/i.test(body)) {
    fail(`Server rejected the credentials (status ${res.status}).`);
  }
  const warning = body.match(/Cookies saved but validation failed[^<"]*/)?.[0];
  if (warning) {
    console.warn(`⚠ ${warning}`);
  } else {
    console.log("✓ Session cookie stored on the server (cache warming started)");
  }
}

/** Load the follows page and report whether it rendered. */
async function verifyFollows(cookie: string): Promise<void> {
  const started = Date.now();
  const res = await fetch(`${TOME_URL}/read/${SOURCE}/follows`, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(180_000),
  });
  const body = await res.text();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  // Guard against the three ways this "passes" while actually being broken:
  // a login page, an explicit error page, or an empty list.
  if (/<title>Login - Tome/i.test(body) || /name="password"/.test(body)) {
    fail(`Session rejected by ${TOME_URL} - the signed-in cookie is not being accepted.`);
  }
  if (/Error Loading Follows/i.test(body)) {
    fail(`Follows page still failing after ${seconds}s.`);
  }
  // Core links follow rows as /read/<source>/<fictionId>[/<chapterId>], so
  // count the heading instead of guessing at URL shapes.
  const heading = body.match(/<h1>My Follows \((\d+)\)<\/h1>/)?.[1];
  if (!heading) {
    fail(`Follows page rendered in ${seconds}s but showed no follow list.`);
  }
  if (heading === "0") {
    fail("Follows page rendered but the list is empty - the cookie was accepted but returns no follows.");
  }
  console.log(`✓ Follows page rendered in ${seconds}s (${heading} fictions)`);
}

async function main(): Promise<void> {
  ensureDisplay();

  const cookie = await loginToTome();

  if (CHECK_ONLY) {
    await verifyFollows(cookie);
    return;
  }

  const values = await loginToRoyalRoad();
  await pushCredentials(cookie, values);
  await verifyFollows(cookie);

  console.log("\nDone. Royal Road follows is back.");
}

await main();
