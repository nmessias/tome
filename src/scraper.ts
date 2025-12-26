// Playwright scraper with stealth for Royal Road
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { parseHTML } from "linkedom";
import { getCookiesForPlaywright, getCache, setCache } from "./db";
import type { Fiction, FollowedFiction, Chapter, ChapterContent, ToplistType, HistoryEntry } from "./types";

const BASE_URL = "https://www.royalroad.com";

// Default TTLs (can be overridden)
const DEFAULT_TTL = {
  FOLLOWS: 20 * 60,           // 20 minutes
  NEXT_CHAPTER: 30 * 24 * 60 * 60, // 30 days
  TOPLIST: 6 * 60 * 60,       // 6 hours  
  FICTION: 60 * 60,           // 1 hour
  CHAPTER: 30 * 24 * 60 * 60, // 30 days for chapters
} as const;

let browser: Browser | null = null;
let context: BrowserContext | null = null;

// Initialize browser with stealth settings
export async function initBrowser(): Promise<void> {
  if (browser) return;

  console.log("Initializing browser...");
  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  await createContext();
  await createAnonContext();
  console.log("Browser initialized");
}

// Create or refresh browser context with cookies (for authenticated requests)
export async function createContext(): Promise<void> {
  if (!browser) {
    await initBrowser();
    return;
  }

  if (context) {
    await context.close();
  }

  const cookies = getCookiesForPlaywright();
  
  context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  // Add stealth scripts
  await context.addInitScript(() => {
    // Override webdriver detection
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    
    // Override plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Override languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
    console.log(`Loaded ${cookies.length} cookies into context`);
  }
}

// Anonymous context for caching (no cookies = no "mark as read" tracking)
let anonContext: BrowserContext | null = null;

async function createAnonContext(): Promise<void> {
  if (!browser) {
    await initBrowser();
    return;
  }

  if (anonContext) {
    await anonContext.close();
  }

  anonContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  // Add stealth scripts
  await anonContext.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });
  
  console.log("Anonymous context created (for caching without auth)");
}

// Get a page, handling Cloudflare if needed
// useAnon = true for caching requests (won't trigger "mark as read")
async function getPage(url: string, waitForSelector?: string, useAnon: boolean = false): Promise<{ page: Page; content: string }> {
  if (!context) {
    await initBrowser();
  }

  const ctx = useAnon ? anonContext! : context!;
  const page = await ctx.newPage();
  
  try {
    // Navigate with retry logic for Cloudflare
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Fetching ${url} (attempt ${attempts})`);
      
      await page.goto(url, { 
        waitUntil: "domcontentloaded",
        timeout: 30000 
      });

      // Check for Cloudflare challenge
      const pageContent = await page.content();
      if (pageContent.includes("challenge-running") || pageContent.includes("cf-browser-verification")) {
        console.log("Cloudflare challenge detected, waiting...");
        await page.waitForTimeout(5000);
        continue;
      }

      // Wait for specific selector if provided
      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 10000 });
        } catch {
          console.log(`Selector ${waitForSelector} not found, continuing anyway`);
        }
      }

      // Success
      const content = await page.content();
      return { page, content };
    }

    throw new Error("Failed to bypass Cloudflare after multiple attempts");
  } catch (error) {
    await page.close();
    throw error;
  }
}

// Parse fiction list from HTML (works for toplists)
function parseFictionList(html: string): Fiction[] {
  const { document } = parseHTML(html);
  const fictions: Fiction[] = [];

  // Try different selectors for fiction items
  const items = document.querySelectorAll(".fiction-list-item");
  
  for (const item of items) {
    try {
      const titleEl = item.querySelector("h2.fiction-title a, .fiction-title a");
      if (!titleEl) continue;

      const href = titleEl.getAttribute("href") || "";
      const idMatch = href.match(/\/fiction\/(\d+)/);
      if (!idMatch) continue;

      const id = parseInt(idMatch[1], 10);
      const title = titleEl.textContent?.trim() || "";
      
      // Author is in span.author a
      const authorEl = item.querySelector("span.author a");
      const author = authorEl?.textContent?.trim() || "";

      // Try to get stats
      const ratingEl = item.querySelector(".star, .rating, [data-original-title]");
      const ratingText = ratingEl?.getAttribute("data-original-title") || ratingEl?.textContent || "";
      const ratingMatch = ratingText.match(/([\d.]+)/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;

      // Get description from .hidden-content or .fiction-description
      const descEl = item.querySelector(".hidden-content, .fiction-description, .margin-top-10.col-xs-12");
      const description = descEl?.textContent?.trim() || "";

      // Get cover image
      const coverEl = item.querySelector("img[src*='covers'], img.thumbnail");
      let coverUrl = coverEl?.getAttribute("src") || undefined;
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = `https://www.royalroad.com${coverUrl}`;
      }

      fictions.push({
        id,
        title,
        author,
        url: `${BASE_URL}${href}`,
        coverUrl,
        description,
        stats: rating ? { rating } : undefined,
      });
    } catch (e) {
      console.error("Error parsing fiction item:", e);
    }
  }

  return fictions;
}

// Get followed fictions
export async function getFollows(ttl: number = DEFAULT_TTL.FOLLOWS): Promise<FollowedFiction[]> {
  const cacheKey = "follows";
  const cached = getCache(cacheKey);
  if (cached) {
    console.log("Returning cached follows");
    return JSON.parse(cached);
  }

  const { page, content } = await getPage(`${BASE_URL}/my/follows`, ".fiction-list-item");
  await page.close();

  const { document } = parseHTML(content);
  const fictions: FollowedFiction[] = [];

  // Parse follows list - each fiction is in a .fiction-list-item div
  const rows = document.querySelectorAll(".fiction-list-item");
  
  console.log(`Found ${rows.length} fiction items`);
  
  for (const row of rows) {
    try {
      // Title link is in h2.fiction-title a
      const titleEl = row.querySelector("h2.fiction-title a");
      if (!titleEl) continue;

      const href = titleEl.getAttribute("href") || "";
      const idMatch = href.match(/\/fiction\/(\d+)/);
      if (!idMatch) continue;

      const id = parseInt(idMatch[1], 10);
      const title = titleEl.textContent?.trim() || "";
      
      // Author is in span.author a (link to profile)
      const authorEl = row.querySelector("span.author a");
      const author = authorEl?.textContent?.trim() || "";
      
      // Check for unread - red circle icon indicates new chapters
      const hasUnread = !!row.querySelector("i.fa-circle");
      
      // Get chapter info from li.list-item elements
      const listItems = row.querySelectorAll("li.list-item");
      let latestChapter = "";
      let latestChapterId: number | undefined;
      let lastReadChapter = "";
      let lastReadChapterId: number | undefined;
      
      for (const li of listItems) {
        const text = li.textContent || "";
        // Chapter link and name
        const chapterLink = li.querySelector("a[href*='/chapter/']");
        const chapterNameEl = li.querySelector("a span.col-xs-8");
        const chapterName = chapterNameEl?.textContent?.trim() || "";
        const chapterHref = chapterLink?.getAttribute("href") || "";
        const chapterIdMatch = chapterHref.match(/\/chapter\/(\d+)/);
        const chapterId = chapterIdMatch ? parseInt(chapterIdMatch[1], 10) : undefined;
        
        if (text.includes("Last Update:")) {
          latestChapter = chapterName;
          latestChapterId = chapterId;
        } else if (text.includes("Last Read Chapter:")) {
          lastReadChapter = chapterName;
          lastReadChapterId = chapterId;
        }
      }

      fictions.push({
        id,
        title,
        author,
        url: `${BASE_URL}${href}`,
        hasUnread,
        latestChapter,
        latestChapterId,
        lastRead: lastReadChapter,
        lastReadChapterId,
      });
    } catch (e) {
      console.error("Error parsing follow item:", e);
    }
  }

  if (fictions.length > 0) {
    setCache(cacheKey, JSON.stringify(fictions), ttl);
  }

  return fictions;
}

// Get reading history - NO CACHING (always fresh)
export async function getHistory(): Promise<HistoryEntry[]> {
  const { page, content } = await getPage(`${BASE_URL}/my/history`, ".fiction-list");
  await page.close();

  const { document } = parseHTML(content);
  const history: HistoryEntry[] = [];

  // History uses .fiction-list > .row structure (not a table)
  // Each .row has: col for fiction link, col for chapter link, col for time, col for Read button
  const rows = document.querySelectorAll(".fiction-list > .row");
  
  console.log(`Found ${rows.length} history items`);
  
  for (const row of rows) {
    try {
      // Get all links in this row
      const links = row.querySelectorAll("a[href*='/fiction/']");
      if (links.length < 2) continue; // Need at least fiction and chapter links
      
      // First link is fiction (without /chapter/)
      const fictionLink = row.querySelector("a[href*='/fiction/']:not([href*='/chapter/'])");
      if (!fictionLink) continue;

      const fictionHref = fictionLink.getAttribute("href") || "";
      const fictionIdMatch = fictionHref.match(/\/fiction\/(\d+)/);
      if (!fictionIdMatch) continue;

      const fictionId = parseInt(fictionIdMatch[1], 10);
      const fictionTitle = fictionLink.textContent?.trim() || "";

      // Chapter link contains /chapter/
      const chapterLink = row.querySelector("a[href*='/chapter/']");
      if (!chapterLink) continue;

      const chapterHref = chapterLink.getAttribute("href") || "";
      const chapterIdMatch = chapterHref.match(/\/chapter\/(\d+)/);
      if (!chapterIdMatch) continue;

      const chapterId = parseInt(chapterIdMatch[1], 10);
      const chapterTitle = chapterLink.textContent?.trim() || "";

      // Time is in a <time> element
      const timeEl = row.querySelector("time");
      const readAt = timeEl?.textContent?.trim() || "";

      history.push({
        fictionId,
        fictionTitle,
        chapterId,
        chapterTitle,
        readAt,
      });
    } catch (e) {
      console.error("Error parsing history item:", e);
    }
  }

  console.log(`Parsed ${history.length} history entries`);
  
  // No caching for history - always fresh
  return history;
}

// Get toplist fictions
export async function getToplist(toplist: ToplistType, ttl: number = DEFAULT_TTL.TOPLIST): Promise<Fiction[]> {
  const cacheKey = `toplist:${toplist.slug}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`Returning cached toplist: ${toplist.slug}`);
    return JSON.parse(cached);
  }

  const { page, content } = await getPage(toplist.url, ".fiction-list");
  await page.close();

  const fictions = parseFictionList(content);
  
  if (fictions.length > 0) {
    setCache(cacheKey, JSON.stringify(fictions), ttl);
  }

  return fictions;
}

// Get fiction details with chapters
export async function getFiction(id: number, ttl: number = DEFAULT_TTL.FICTION): Promise<Fiction | null> {
  const cacheKey = `fiction:${id}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`Returning cached fiction: ${id}`);
    return JSON.parse(cached);
  }

  const url = `${BASE_URL}/fiction/${id}`;
  const { page, content } = await getPage(url, ".fic-title");
  
  // Try to get chapters from window.chapters variable
  let chapters: Chapter[] = [];
  try {
    const chaptersData = await page.evaluate(() => {
      return (window as any).chapters || [];
    });
    
    chapters = chaptersData.map((c: any) => ({
      id: c.id,
      title: c.title,
      url: `/chapter/${c.id}`,
      date: c.date,
      order: c.order,
    }));
  } catch (e) {
    console.log("Could not get chapters from JS, parsing HTML");
  }

  await page.close();

  const { document } = parseHTML(content);

  // Parse fiction metadata
  const titleEl = document.querySelector(".fic-title h1, h1.font-white");
  const authorEl = document.querySelector(".author, a[href*='/user/']");
  const descEl = document.querySelector(".description, .fiction-description");
  
  // Cover image - look for the main fiction cover
  const coverEl = document.querySelector(".fic-header img[src*='covers'], .cover-art-container img, img.cover-art, .thumbnail img");
  let coverUrl = coverEl?.getAttribute("src") || undefined;
  // Ensure absolute URL
  if (coverUrl && !coverUrl.startsWith("http")) {
    coverUrl = `https://www.royalroad.com${coverUrl}`;
  }
  
  // Stats
  const ratingEl = document.querySelector(".star, [data-content*='rating']");
  const rating = ratingEl ? parseFloat(ratingEl.getAttribute("data-content") || ratingEl.textContent || "0") : undefined;

  // If no chapters from JS, parse from HTML
  if (chapters.length === 0) {
    const chapterRows = document.querySelectorAll("tr[data-url], .chapter-row");
    for (const row of chapterRows) {
      const href = row.getAttribute("data-url") || row.querySelector("a")?.getAttribute("href") || "";
      const chapterMatch = href.match(/\/chapter\/(\d+)/);
      if (!chapterMatch) continue;

      const chapterTitle = row.querySelector("a")?.textContent?.trim() || "";
      const dateEl = row.querySelector("time, .chapter-date");
      
      chapters.push({
        id: parseInt(chapterMatch[1], 10),
        title: chapterTitle,
        url: `/chapter/${chapterMatch[1]}`,
        date: dateEl?.textContent?.trim(),
      });
    }
  }

  // Look for "Continue Reading" link (shows when logged in and have progress)
  const continueLink = document.querySelector("a.btn[href*='/chapter/'][class*='continue'], a.btn-primary[href*='/chapter/']");
  let continueChapterId: number | undefined;
  if (continueLink) {
    const continueHref = continueLink.getAttribute("href") || "";
    const continueMatch = continueHref.match(/\/chapter\/(\d+)/);
    if (continueMatch) {
      continueChapterId = parseInt(continueMatch[1], 10);
    }
  }

  const fiction: Fiction = {
    id,
    title: titleEl?.textContent?.trim() || `Fiction ${id}`,
    author: authorEl?.textContent?.trim() || "Unknown",
    url,
    coverUrl,
    description: descEl?.textContent?.trim(),
    stats: { rating },
    chapters,
    continueChapterId,
  };

  setCache(cacheKey, JSON.stringify(fiction), ttl);
  return fiction;
}

// Get chapter content
// When ttl is provided: use anonymous context (for pre-caching, won't trigger "mark as read")
// When ttl is NOT provided: use authenticated context (for live reading, triggers "mark as read")
export async function getChapter(chapterId: number, ttl?: number): Promise<ChapterContent | null> {
  const cacheKey = `chapter:${chapterId}`;
  const isPreCaching = ttl !== undefined;
  
  // Only use cache if TTL is provided (for pre-warming)
  if (isPreCaching) {
    const cached = getCache(cacheKey);
    if (cached) {
      console.log(`Returning cached chapter: ${chapterId}`);
      return JSON.parse(cached);
    }
  }
  
  // Use anonymous context for pre-caching (no cookies = no "mark as read")
  // Use authenticated context for live reading (triggers "mark as read")
  const useAnon = isPreCaching;
  
  // We need to find the actual URL - Royal Road redirects
  const { page, content } = await getPage(
    `${BASE_URL}/fiction/0/chapter/${chapterId}`, 
    ".chapter-content",
    useAnon
  );

  // Only wait for "Mark as Read" when reading live (not pre-caching)
  if (!isPreCaching) {
    await page.waitForTimeout(2000);
  }

  // Get navigation info from .nav-buttons
  const navInfo = await page.evaluate(() => {
    let prevUrl = null;
    let nextUrl = null;
    
    // Find nav-buttons container
    const navButtons = document.querySelector('.nav-buttons');
    if (navButtons) {
      const links = navButtons.querySelectorAll('a.btn[href*="/chapter/"]');
      for (const link of links) {
        const text = link.textContent || '';
        if (text.includes('Previous')) {
          prevUrl = link.getAttribute('href');
        }
        if (text.includes('Next')) {
          nextUrl = link.getAttribute('href');
        }
      }
    }
    
    return { prevUrl, nextUrl };
  });

  // Get fiction info from page URL and breadcrumb/title link
  const fictionInfo = await page.evaluate(() => {
    // Try to get fiction ID from current URL (Royal Road redirects to full URL)
    const urlMatch = window.location.href.match(/\/fiction\/(\d+)/);
    const fictionIdFromUrl = urlMatch ? parseInt(urlMatch[1], 10) : 0;
    
    // Get fiction title from the breadcrumb or header link
    // Be specific to avoid matching nav elements like "Surprise me!"
    const fictionLink = document.querySelector(".fic-title a, a.fic-title, .fiction-title a, .fic-header a[href*='/fiction/']") ||
                        document.querySelector(".row a[href*='/fiction/']:not([href*='/chapter/']):not(.btn)");
    const href = fictionLink?.getAttribute("href") || "";
    const hrefMatch = href.match(/\/fiction\/(\d+)/);
    
    return {
      fictionId: fictionIdFromUrl || (hrefMatch ? parseInt(hrefMatch[1], 10) : 0),
      fictionTitle: fictionLink?.textContent?.trim() || "",
      fictionUrl: href,
    };
  });

  await page.close();

  const { document } = parseHTML(content);

  // Get chapter title
  const titleEl = document.querySelector("h1.font-white, .chapter-title h1, h1");
  const title = titleEl?.textContent?.trim() || `Chapter ${chapterId}`;

  // Extract clean content using Readability
  const contentEl = document.querySelector(".chapter-inner.chapter-content, .chapter-content");
  
  let cleanContent = "";
  if (contentEl) {
    // Clone and clean the content, preserving styles
    const cloned = contentEl.cloneNode(true) as Element;
    
    // Extract hidden classes from <style> tags (anti-piracy text removal)
    // Royal Road injects hidden spans with CSS like: .randomClassName { display: none; }
    const hiddenClasses: string[] = [];
    const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const styleBlock of styleMatches) {
      // Match patterns like: .className { display: none; } or .className{display:none}
      const ruleMatches = styleBlock.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{[^}]*display\s*:\s*none[^}]*\}/gi);
      for (const match of ruleMatches) {
        hiddenClasses.push(match[1]);
      }
    }
    
    // Remove elements with hidden classes (anti-piracy spans)
    if (hiddenClasses.length > 0) {
      console.log(`Found ${hiddenClasses.length} hidden classes to remove (anti-piracy)`);
    }
    for (const className of hiddenClasses) {
      cloned.querySelectorAll(`.${className}`).forEach(el => el.remove());
    }
    
    // Remove unwanted elements
    cloned.querySelectorAll(".author-note, .ad, .portlet, script, .hidden, .ads, iframe, noscript").forEach(el => el.remove());
    
    // Remove the obfuscated class names but keep the elements and styles
    cloned.querySelectorAll('[class]').forEach(el => {
      const classList = el.getAttribute('class') || '';
      // Remove classes that look like obfuscation (long random strings)
      const cleanClasses = classList.split(' ').filter(c => c.length < 20 && !/^[a-z]{20,}$/i.test(c)).join(' ');
      if (cleanClasses) {
        el.setAttribute('class', cleanClasses);
      } else {
        el.removeAttribute('class');
      }
    });
    
    // Keep only safe inline styles (text-align, font-weight, font-style)
    cloned.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const safeStyles: string[] = [];
      
      // Extract and keep only safe style properties
      const textAlign = style.match(/text-align:\s*([^;]+)/i);
      const fontWeight = style.match(/font-weight:\s*([^;]+)/i);
      const fontStyle = style.match(/font-style:\s*([^;]+)/i);
      
      if (textAlign) safeStyles.push(`text-align: ${textAlign[1].trim()}`);
      if (fontWeight) safeStyles.push(`font-weight: ${fontWeight[1].trim()}`);
      if (fontStyle) safeStyles.push(`font-style: ${fontStyle[1].trim()}`);
      
      if (safeStyles.length > 0) {
        el.setAttribute('style', safeStyles.join('; '));
      } else {
        el.removeAttribute('style');
      }
    });
    
    cleanContent = cloned.innerHTML;
  }

  // Convert prev/next URLs to our proxy URLs
  const prevChapterUrl = navInfo.prevUrl ? navInfo.prevUrl.replace(/.*\/chapter\/(\d+).*/, "/chapter/$1") : undefined;
  const nextChapterUrl = navInfo.nextUrl ? navInfo.nextUrl.replace(/.*\/chapter\/(\d+).*/, "/chapter/$1") : undefined;

  // Extract next chapter ID for pre-caching
  const nextChapterIdMatch = nextChapterUrl?.match(/\/chapter\/(\d+)/);
  const nextChapterId = nextChapterIdMatch ? parseInt(nextChapterIdMatch[1], 10) : undefined;

  const result: ChapterContent = {
    id: chapterId,
    fictionId: fictionInfo.fictionId,
    title,
    content: cleanContent,
    prevChapterUrl,
    nextChapterUrl,
    fictionTitle: fictionInfo.fictionTitle,
    fictionUrl: `/fiction/${fictionInfo.fictionId}`,
  };

  // Cache the chapter content (30 days)
  setCache(cacheKey, JSON.stringify(result), DEFAULT_TTL.CHAPTER);

  // Pre-cache next chapter ONLY when reading live (not when already pre-caching)
  // This prevents recursive pre-caching of entire fictions
  if (nextChapterId && !isPreCaching) {
    console.log(`Pre-caching next chapter: ${nextChapterId}`);
    // Use setTimeout to make it non-blocking
    setTimeout(async () => {
      try {
        await getChapter(nextChapterId, DEFAULT_TTL.NEXT_CHAPTER);
      } catch (e) {
        console.error(`Failed to pre-cache chapter ${nextChapterId}:`, e);
      }
    }, 100);
  }

  return result;
}

// Validate cookies by attempting to fetch follows
export async function validateCookies(): Promise<boolean> {
  try {
    await createContext(); // Refresh context with new cookies
    const { page, content } = await getPage(`${BASE_URL}/my/follows`);
    await page.close();
    
    // Check if we're logged in (not redirected to login page)
    return !content.includes('action="/account/login"') && !content.includes("Sign In");
  } catch (e) {
    console.error("Cookie validation failed:", e);
    return false;
  }
}

// Cleanup
export async function closeBrowser(): Promise<void> {
  if (anonContext) {
    await anonContext.close();
    anonContext = null;
  }
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Search for fictions
export async function searchFictions(query: string): Promise<Fiction[]> {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `${BASE_URL}/fictions/search?title=${encodedQuery}`;
  
  const { page, content } = await getPage(searchUrl, ".fiction-list-item");
  await page.close();
  
  return parseFictionList(content);
}

// Handle process exit
process.on("exit", () => {
  closeBrowser();
});
