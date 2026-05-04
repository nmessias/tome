import {
  ROYAL_ROAD_BASE_URL,
  ROYAL_ROAD_USERNAME,
  ROYAL_ROAD_PASSWORD,
  ROYAL_ROAD_AUTO_LOGIN_ENABLED,
} from "../config";
import { setRoyalRoadCookie } from "./royalroad-credentials";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export { ROYAL_ROAD_AUTO_LOGIN_ENABLED };

export async function performAutoLogin(userId: string): Promise<boolean> {
  if (!ROYAL_ROAD_AUTO_LOGIN_ENABLED) {
    return false;
  }

  console.log("[AutoLogin] Starting auto-login to Royal Road...");
  const startTime = Date.now();

  try {
    const { firefox } = await import("playwright");
    const browser = await firefox.launch({
      headless: true,
      firefoxUserPrefs: {
        "browser.cache.disk.enable": false,
        "browser.cache.memory.enable": true,
        "browser.cache.memory.capacity": 32768,
        "browser.sessionhistory.max_entries": 2,
        "browser.sessionstore.max_tabs_undo": 0,
        "media.autoplay.enabled": false,
        "media.peerconnection.enabled": false,
        "dom.webnotifications.enabled": false,
        "geo.enabled": false,
      },
    });

    try {
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 720 },
        locale: "en-US",
        timezoneId: "America/New_York",
      });

      const page = await context.newPage();

      await page.goto(`${ROYAL_ROAD_BASE_URL}/account/login?returnurl=%2Fhome`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      const currentUrl = page.url();
      if (!currentUrl.includes("/account/login")) {
        console.log("[AutoLogin] Already logged in, refreshing cookies");
        const cookies = await context.cookies();
        for (const cookie of cookies) {
          if (cookie.name === ".AspNetCore.Identity.Application" || cookie.name === "cf_clearance") {
            setRoyalRoadCookie(userId, cookie.name, cookie.value);
          }
        }
        return true;
      }

      await page.fill('input[type="email"]', ROYAL_ROAD_USERNAME);
      await page.fill('input[type="password"]', ROYAL_ROAD_PASSWORD);

      const rememberCheckbox = page.locator('input[type="checkbox"]');
      if (await rememberCheckbox.isVisible()) {
        await rememberCheckbox.check();
      }

      await page.click('button[type="submit"]');

      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");

      if (page.url().includes("/account/login")) {
        console.error("[AutoLogin] Still on login page - credentials may be invalid");
        return false;
      }

      const cookies = await context.cookies();

      let savedCount = 0;
      for (const cookie of cookies) {
        if (cookie.name === ".AspNetCore.Identity.Application" || cookie.name === "cf_clearance") {
          setRoyalRoadCookie(userId, cookie.name, cookie.value);
          savedCount++;
        }
      }

      console.log(`[AutoLogin] Successfully logged in and saved ${savedCount} cookies in ${Date.now() - startTime}ms`);
      return savedCount > 0;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(`[AutoLogin] Failed after ${Date.now() - startTime}ms:`, error);
    return false;
  }
}
