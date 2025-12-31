/**
 * Playwright scraper with stealth for Royal Road
 */
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { parseHTML } from "linkedom";
import { getCookiesForPlaywright, getCache, setCache, deleteCache } from "./cache";
import { ROYAL_ROAD_BASE_URL, CACHE_TTL, SCRAPER_TIMEOUT, SCRAPER_SELECTOR_TIMEOUT } from "../config";
import type { Fiction, FollowedFiction, Chapter, ChapterContent, ToplistType, HistoryEntry } from "../types";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let anonContext: BrowserContext | null = null;

// ============ Browser Management ============

/**
 * Initialize browser with stealth settings
 */
export async function initBrowser(): Promise<void> {
  if (browser) return;

  console.log("Initializing browser...");
  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // Memory optimization for Docker/low-RAM environments
      "--disable-dev-shm-usage",           // Use /tmp instead of /dev/shm (critical in Docker)
      "--disable-gpu",                      // No GPU in containers
      "--single-process",                   // Reduces memory ~50%
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-translate",
      "--no-first-run",
      "--disable-features=IsolateOrigins,site-per-process,TranslateUI",
      "--js-flags=--max-old-space-size=128", // Limit V8 heap to 128MB
    ],
  });

  await createContext();
  await createAnonContext();
  console.log("Browser initialized");
}

/**
 * Create or refresh browser context with cookies (for authenticated requests)
 */
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
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
    console.log(`Loaded ${cookies.length} cookies into context`);
  }
}

/**
 * Create anonymous context for caching (no cookies = no "mark as read" tracking)
 */
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

  await anonContext.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });
  
  console.log("Anonymous context created (for caching without auth)");
}

/**
 * Get a page, handling Cloudflare if needed
 * useAnon = true for caching requests (won't trigger "mark as read")
 */
async function getPage(
  url: string,
  waitForSelector?: string,
  useAnon: boolean = false
): Promise<{ page: Page; content: string }> {
  if (!context) {
    await initBrowser();
  }

  const ctx = useAnon ? anonContext! : context!;
  const page = await ctx.newPage();
  
  try {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Fetching ${url} (attempt ${attempts})`);
      
      await page.goto(url, { 
        waitUntil: "domcontentloaded",
        timeout: SCRAPER_TIMEOUT 
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
          await page.waitForSelector(waitForSelector, { timeout: SCRAPER_SELECTOR_TIMEOUT });
        } catch {
          console.log(`Selector ${waitForSelector} not found, continuing anyway`);
        }
      }

      const content = await page.content();
      return { page, content };
    }

    throw new Error("Failed to bypass Cloudflare after multiple attempts");
  } catch (error) {
    await page.close();
    throw error;
  }
}

/**
 * Resolve a redirect URL to get the final URL (used for /chapter/next/ URLs)
 * Returns the final URL after redirects, or null if failed
 * useAnon = true to avoid marking chapters as read (for cache warming)
 */
async function resolveRedirectUrl(url: string, useAnon: boolean = false): Promise<string | null> {
  if (!context || !anonContext) {
    await initBrowser();
  }

  const ctx = useAnon ? anonContext! : context!;
  const page = await ctx.newPage();
  
  try {
    // Navigate and wait for the redirect to complete
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: SCRAPER_TIMEOUT 
    });
    
    // Get the final URL after redirects
    const finalUrl = page.url();
    await page.close();
    
    return finalUrl;
  } catch (error) {
    console.error(`Failed to resolve redirect for ${url}:`, error);
    await page.close();
    return null;
  }
}

/**
 * Cleanup browser resources
 */
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

// Handle process exit
process.on("exit", () => {
  closeBrowser();
});

// ============ Parsing Helpers ============

/**
 * Parse fiction list from HTML (works for toplists)
 */
function parseFictionList(html: string): Fiction[] {
  const { document } = parseHTML(html);
  const fictions: Fiction[] = [];

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
      
      // Tags (first 3 genre tags)
      const tagEls = item.querySelectorAll(".fiction-tag");
      const tags: string[] = [];
      for (let i = 0; i < Math.min(tagEls.length, 3); i++) {
        const tagText = tagEls[i].textContent?.trim();
        if (tagText) tags.push(tagText);
      }

      // Rating from star span's title attribute (e.g., title="4.75")
      const starEl = item.querySelector(".star[title]");
      const rating = starEl ? parseFloat(starEl.getAttribute("title") || "0") : undefined;

      // Stats from the stats row - parse by icon class
      let followers: number | undefined;
      let pages: number | undefined;
      
      const statsRow = item.querySelector(".row.stats");
      if (statsRow) {
        const statDivs = statsRow.querySelectorAll(".col-sm-6");
        for (const div of statDivs) {
          const text = div.textContent?.trim() || "";
          const icon = div.querySelector("i");
          const iconClass = icon?.getAttribute("class") || "";
          
          // Parse number from text (e.g., "2,857 Followers" -> 2857)
          const numMatch = text.match(/([\d,]+)/);
          const num = numMatch ? parseInt(numMatch[1].replace(/,/g, ""), 10) : undefined;
          
          if (iconClass.includes("fa-users") && num !== undefined) {
            followers = num;
          } else if (iconClass.includes("fa-book") && num !== undefined) {
            pages = num;
          }
        }
      }

      // Description (hidden by default in toplist HTML)
      const descEl = item.querySelector(".hidden-content, .fiction-description, .margin-top-10.col-xs-12, [id^='description-']");
      const description = descEl?.textContent?.trim() || "";

      // Cover
      const coverEl = item.querySelector("img[src*='covers'], img.thumbnail, img[data-type='cover']");
      let coverUrl = coverEl?.getAttribute("src") || undefined;
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = `https://www.royalroad.com${coverUrl}`;
      }

      fictions.push({
        id,
        title,
        author: "", // Not available in toplist HTML
        url: `${ROYAL_ROAD_BASE_URL}${href}`,
        coverUrl,
        description,
        tags,
        stats: {
          rating,
          followers,
          pages,
        },
      });
    } catch (e) {
      console.error("Error parsing fiction item:", e);
    }
  }

  return fictions;
}

// ============ Scraper Functions ============

/**
 * Get followed fictions
 */
export async function getFollows(ttl: number = CACHE_TTL.FOLLOWS): Promise<FollowedFiction[]> {
  const cacheKey = "follows";
  const cached = getCache(cacheKey);
  if (cached) {
    console.log("Returning cached follows");
    return JSON.parse(cached);
  }

  const { page, content } = await getPage(`${ROYAL_ROAD_BASE_URL}/my/follows`, ".fiction-list-item");
  await page.close();

  const { document } = parseHTML(content);
  const fictions: FollowedFiction[] = [];

  const rows = document.querySelectorAll(".fiction-list-item");
  console.log(`Found ${rows.length} fiction items`);
  
  for (const row of rows) {
    try {
      const titleEl = row.querySelector("h2.fiction-title a");
      if (!titleEl) continue;

      const href = titleEl.getAttribute("href") || "";
      const idMatch = href.match(/\/fiction\/(\d+)/);
      if (!idMatch) continue;

      const id = parseInt(idMatch[1], 10);
      const title = titleEl.textContent?.trim() || "";
      
      // Author
      let author = "";
      const authorEl = row.querySelector("span.author a[href*='/profile/']");
      if (authorEl) {
        author = authorEl.textContent?.trim() || "";
      } else {
        const profileLink = row.querySelector("a[href*='/profile/']");
        if (profileLink) {
          author = profileLink.textContent?.trim() || "";
        }
      }
      
      // Unread indicator
      const hasUnread = !!row.querySelector("i.fa-circle");
      
      // Cover
      const coverEl = row.querySelector("img[src*='covers'], img.thumbnail");
      let coverUrl = coverEl?.getAttribute("src") || undefined;
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = `https://www.royalroad.com${coverUrl}`;
      }
      
      // Chapter info
      const listItems = row.querySelectorAll("li.list-item");
      let latestChapter = "";
      let latestChapterId: number | undefined;
      let lastReadChapter = "";
      let lastReadChapterId: number | undefined;
      let nextChapterId: number | undefined;
      let nextChapterTitle: string | undefined;
      
      for (const li of listItems) {
        const text = li.textContent || "";
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
      
      // Read button (next unread chapter)
      // Royal Road uses /chapter/next/{fictionId} which redirects to actual chapter
      let nextChapterUrl: string | undefined;
      const readButton = row.querySelector("a.btn[href*='/chapter/']");
      if (readButton) {
        const readHref = readButton.getAttribute("href") || "";
        // Try direct chapter ID first (e.g., /chapter/123456)
        const directMatch = readHref.match(/\/chapter\/(\d+)$/);
        if (directMatch) {
          nextChapterId = parseInt(directMatch[1], 10);
          nextChapterTitle = readButton.textContent?.trim() || undefined;
        } else if (readHref.includes("/chapter/next/")) {
          // Store the redirect URL to resolve later
          nextChapterUrl = readHref.startsWith("http") ? readHref : `${ROYAL_ROAD_BASE_URL}${readHref}`;
          nextChapterTitle = readButton.textContent?.trim() || undefined;
        }
      }

      fictions.push({
        id,
        title,
        author,
        url: `${ROYAL_ROAD_BASE_URL}${href}`,
        coverUrl,
        hasUnread,
        latestChapter,
        latestChapterId,
        lastRead: lastReadChapter,
        lastReadChapterId,
        nextChapterId,
        nextChapterTitle,
        _nextChapterUrl: nextChapterUrl, // Temporary field for redirect resolution
      } as FollowedFiction & { _nextChapterUrl?: string });
    } catch (e) {
      console.error("Error parsing follow item:", e);
    }
  }

  // Resolve /chapter/next/ redirect URLs to get actual chapter IDs
  const fictionsNeedingResolution = fictions.filter(
    (f) => (f as FollowedFiction & { _nextChapterUrl?: string })._nextChapterUrl && !f.nextChapterId
  );
  
  if (fictionsNeedingResolution.length > 0) {
    console.log(`Resolving ${fictionsNeedingResolution.length} next chapter redirect URLs...`);
    
    for (const fiction of fictionsNeedingResolution) {
      const f = fiction as FollowedFiction & { _nextChapterUrl?: string };
      if (!f._nextChapterUrl) continue;
      
      try {
        // Use anonymous context to avoid marking chapter as read
        const finalUrl = await resolveRedirectUrl(f._nextChapterUrl, true);
        if (finalUrl) {
          const chapterIdMatch = finalUrl.match(/\/chapter\/(\d+)/);
          if (chapterIdMatch) {
            f.nextChapterId = parseInt(chapterIdMatch[1], 10);
            console.log(`Resolved next chapter for "${f.title}": ${f.nextChapterId}`);
          }
        }
      } catch (e) {
        console.error(`Failed to resolve next chapter URL for "${fiction.title}":`, e);
      }
      
      // Clean up temporary field
      delete f._nextChapterUrl;
    }
  }

  if (fictions.length > 0) {
    setCache(cacheKey, JSON.stringify(fictions), ttl);
  }

  return fictions;
}

/**
 * Get reading history - NO CACHING (always fresh)
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  const { page, content } = await getPage(`${ROYAL_ROAD_BASE_URL}/my/history`, ".fiction-list");
  await page.close();

  const { document } = parseHTML(content);
  const history: HistoryEntry[] = [];

  const rows = document.querySelectorAll(".fiction-list > .row");
  console.log(`Found ${rows.length} history items`);
  
  for (const row of rows) {
    try {
      const links = row.querySelectorAll("a[href*='/fiction/']");
      if (links.length < 2) continue;
      
      const fictionLink = row.querySelector("a[href*='/fiction/']:not([href*='/chapter/'])");
      if (!fictionLink) continue;

      const fictionHref = fictionLink.getAttribute("href") || "";
      const fictionIdMatch = fictionHref.match(/\/fiction\/(\d+)/);
      if (!fictionIdMatch) continue;

      const fictionId = parseInt(fictionIdMatch[1], 10);
      const fictionTitle = fictionLink.textContent?.trim() || "";

      const chapterLink = row.querySelector("a[href*='/chapter/']");
      if (!chapterLink) continue;

      const chapterHref = chapterLink.getAttribute("href") || "";
      const chapterIdMatch = chapterHref.match(/\/chapter\/(\d+)/);
      if (!chapterIdMatch) continue;

      const chapterId = parseInt(chapterIdMatch[1], 10);
      const chapterTitle = chapterLink.textContent?.trim() || "";

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
  return history;
}

/**
 * Get toplist fictions
 */
export async function getToplist(toplist: ToplistType, ttl: number = CACHE_TTL.TOPLIST): Promise<Fiction[]> {
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

/**
 * Get toplist from cache only (no fetch) - for non-blocking homepage
 */
export function getToplistCached(toplist: ToplistType): Fiction[] | null {
  const cacheKey = `toplist:${toplist.slug}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

/**
 * Get fiction details with chapters
 * When useAnon is true: use anonymous context (for pre-caching, won't trigger tracking)
 * When useAnon is false: use authenticated context (for live browsing)
 */
export async function getFiction(id: number, ttl: number = CACHE_TTL.FICTION, useAnon: boolean = false): Promise<Fiction | null> {
  const cacheKey = `fiction:${id}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`Returning cached fiction: ${id}`);
    return JSON.parse(cached);
  }

  const url = `${ROYAL_ROAD_BASE_URL}/fiction/${id}`;
  const { page, content } = await getPage(url, ".fic-title", useAnon);
  
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

  // Title
  const titleEl = document.querySelector(".fic-title h1, h1.font-white");
  
  // Author
  let author = "Unknown";
  const authorEl = document.querySelector(".fic-title a[href*='/profile/']");
  if (authorEl) {
    author = authorEl.textContent?.trim() || "Unknown";
  } else {
    const headerProfileLink = document.querySelector(".fic-header a[href*='/profile/']");
    if (headerProfileLink) {
      author = headerProfileLink.textContent?.trim() || "Unknown";
    }
  }
  
  // Description
  const descEl = document.querySelector(".description, .fiction-description");
  
  // Cover
  const coverEl = document.querySelector(".fic-header img[src*='covers'], .cover-art-container img, img.cover-art, .thumbnail img");
  let coverUrl = coverEl?.getAttribute("src") || undefined;
  if (coverUrl && !coverUrl.startsWith("http")) {
    coverUrl = `https://www.royalroad.com${coverUrl}`;
  }
  
  // Stats
  const statsContainer = document.querySelector(".fiction-stats");
  let rating: number | undefined;
  let styleScore: number | undefined;
  let storyScore: number | undefined;
  let grammarScore: number | undefined;
  let characterScore: number | undefined;
  let views: number | undefined;
  let averageViews: number | undefined;
  let followers: number | undefined;
  let favorites: number | undefined;
  let ratings: number | undefined;
  let pages: number | undefined;

  if (statsContainer) {
    // Parse star ratings from data-content attribute (e.g., "4.66 / 5")
    const parseRating = (el: Element | null): number | undefined => {
      if (!el) return undefined;
      const content = el.getAttribute("data-content") || el.getAttribute("aria-label") || "";
      const match = content.match(/([\d.]+)/);
      return match ? parseFloat(match[1]) : undefined;
    };

    // Find ratings by their labels
    const listItems = statsContainer.querySelectorAll("li.list-item, li");
    let currentLabel = "";
    
    for (const li of listItems) {
      const text = li.textContent?.trim() || "";
      const starEl = li.querySelector(".star, [data-content]");
      
      if (text.includes("Overall Score")) {
        currentLabel = "overall";
      } else if (text.includes("Style Score")) {
        currentLabel = "style";
      } else if (text.includes("Story Score")) {
        currentLabel = "story";
      } else if (text.includes("Grammar Score")) {
        currentLabel = "grammar";
      } else if (text.includes("Character Score")) {
        currentLabel = "character";
      } else if (starEl) {
        const score = parseRating(starEl);
        if (currentLabel === "overall") rating = score;
        else if (currentLabel === "style") styleScore = score;
        else if (currentLabel === "story") storyScore = score;
        else if (currentLabel === "grammar") grammarScore = score;
        else if (currentLabel === "character") characterScore = score;
        currentLabel = "";
      }
    }

    // Parse numeric stats from the right column
    const statsListItems = statsContainer.querySelectorAll(".col-sm-6:last-child li, .stats-content li");
    let nextStatType = "";
    
    for (const li of statsListItems) {
      const text = li.textContent?.trim().toUpperCase() || "";
      
      if (text.includes("TOTAL VIEWS")) {
        nextStatType = "views";
      } else if (text.includes("AVERAGE VIEWS")) {
        nextStatType = "avgViews";
      } else if (text.includes("FOLLOWERS")) {
        nextStatType = "followers";
      } else if (text.includes("FAVORITES")) {
        nextStatType = "favorites";
      } else if (text.includes("RATINGS")) {
        nextStatType = "ratings";
      } else if (text.includes("PAGES")) {
        nextStatType = "pages";
      } else if (nextStatType && li.classList.contains("font-red-sunglo")) {
        const num = parseInt(text.replace(/,/g, ""), 10);
        if (!isNaN(num)) {
          if (nextStatType === "views") views = num;
          else if (nextStatType === "avgViews") averageViews = num;
          else if (nextStatType === "followers") followers = num;
          else if (nextStatType === "favorites") favorites = num;
          else if (nextStatType === "ratings") ratings = num;
          else if (nextStatType === "pages") pages = num;
        }
        nextStatType = "";
      }
    }
  } else {
    // Fallback: try to get at least the overall rating
    const ratingEl = document.querySelector(".star[data-content], [data-original-title*='Score']");
    rating = ratingEl ? parseFloat(ratingEl.getAttribute("data-content") || "0") : undefined;
  }

  // Parse chapters from HTML if not from JS
  let lastReadChapterIdx = -1;
  
  if (chapters.length === 0) {
    const chapterRows = document.querySelectorAll("tr[data-url], .chapter-row");
    let idx = 0;
    
    for (const row of chapterRows) {
      const href = row.getAttribute("data-url") || row.querySelector("a")?.getAttribute("href") || "";
      const chapterMatch = href.match(/\/chapter\/(\d+)/);
      if (!chapterMatch) continue;

      const chapterTitle = row.querySelector("a")?.textContent?.trim() || "";
      const dateEl = row.querySelector("time, .chapter-date");
      
      // Check for reading progress indicator (marks last read chapter)
      const hasReadingProgress = !!row.querySelector("i.fa-caret-right[data-original-title*='Reading Progress']");
      if (hasReadingProgress) {
        lastReadChapterIdx = idx;
      }
      
      chapters.push({
        id: parseInt(chapterMatch[1], 10),
        title: chapterTitle,
        url: `/chapter/${chapterMatch[1]}`,
        date: dateEl?.textContent?.trim(),
      });
      idx++;
    }
  }

  // Continue Reading link
  const continueLink = document.querySelector("a.btn[href*='/chapter/'][class*='continue'], a.btn-primary[href*='/chapter/']");
  let continueChapterId: number | undefined;
  if (continueLink) {
    const continueHref = continueLink.getAttribute("href") || "";
    const continueMatch = continueHref.match(/\/chapter\/(\d+)/);
    if (continueMatch) {
      continueChapterId = parseInt(continueMatch[1], 10);
    }
  }

  // Mark chapters as read based on reading progress indicator
  if (lastReadChapterIdx >= 0) {
    // Reading progress icon found - mark all chapters up to and including it as read
    for (let i = 0; i <= lastReadChapterIdx; i++) {
      chapters[i].isRead = true;
    }
  } else if (continueChapterId) {
    // Fallback: use continueChapterId as boundary
    // Chapters before continueChapterId are considered read
    const continueIdx = chapters.findIndex(c => c.id === continueChapterId);
    if (continueIdx > 0) {
      for (let i = 0; i < continueIdx; i++) {
        chapters[i].isRead = true;
      }
    }
  }

  const fiction: Fiction = {
    id,
    title: titleEl?.textContent?.trim() || `Fiction ${id}`,
    author,
    url,
    coverUrl,
    description: descEl?.textContent?.trim(),
    stats: {
      rating,
      styleScore,
      storyScore,
      grammarScore,
      characterScore,
      views,
      averageViews,
      followers,
      favorites,
      ratings,
      pages,
    },
    chapters,
    continueChapterId,
  };

  setCache(cacheKey, JSON.stringify(fiction), ttl);
  return fiction;
}

/**
 * Get chapter content
 * When ttl is provided: use anonymous context (for pre-caching, won't trigger "mark as read")
 * When ttl is NOT provided: use authenticated context (for live reading, triggers "mark as read")
 */
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
  
  const useAnon = isPreCaching;
  
  const { page, content } = await getPage(
    `${ROYAL_ROAD_BASE_URL}/fiction/0/chapter/${chapterId}`, 
    ".chapter-content",
    useAnon
  );

  // Wait for "Mark as Read" when reading live
  if (!isPreCaching) {
    await page.waitForTimeout(2000);
  }

  // Get navigation info
  const navInfo = await page.evaluate(() => {
    let prevUrl = null;
    let nextUrl = null;
    
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

  // Get fiction info
  const fictionInfo = await page.evaluate(() => {
    const urlMatch = window.location.href.match(/\/fiction\/(\d+)/);
    const fictionIdFromUrl = urlMatch ? parseInt(urlMatch[1], 10) : 0;
    
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

  // Chapter title
  const titleEl = document.querySelector("h1.font-white, .chapter-title h1, h1");
  const title = titleEl?.textContent?.trim() || `Chapter ${chapterId}`;

  // Extract clean content
  const contentEl = document.querySelector(".chapter-inner.chapter-content, .chapter-content");
  
  let cleanContent = "";
  if (contentEl) {
    const cloned = contentEl.cloneNode(true) as Element;
    
    // Extract hidden classes (anti-piracy text)
    const hiddenClasses: string[] = [];
    const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const styleBlock of styleMatches) {
      const ruleMatches = styleBlock.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{[^}]*display\s*:\s*none[^}]*\}/gi);
      for (const match of ruleMatches) {
        hiddenClasses.push(match[1]);
      }
    }
    
    if (hiddenClasses.length > 0) {
      console.log(`Found ${hiddenClasses.length} hidden classes to remove (anti-piracy)`);
    }
    for (const className of hiddenClasses) {
      cloned.querySelectorAll(`.${className}`).forEach(el => el.remove());
    }
    
    // Remove unwanted elements
    cloned.querySelectorAll(".author-note, .ad, .portlet, script, .hidden, .ads, iframe, noscript").forEach(el => el.remove());
    
    // Clean obfuscated classes
    cloned.querySelectorAll('[class]').forEach(el => {
      const classList = el.getAttribute('class') || '';
      const cleanClasses = classList.split(' ').filter(c => c.length < 20 && !/^[a-z]{20,}$/i.test(c)).join(' ');
      if (cleanClasses) {
        el.setAttribute('class', cleanClasses);
      } else {
        el.removeAttribute('class');
      }
    });
    
    // Keep only safe styles
    cloned.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const safeStyles: string[] = [];
      
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

  // Convert nav URLs to proxy URLs
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

  // Cache the chapter
  setCache(cacheKey, JSON.stringify(result), CACHE_TTL.CHAPTER);

  // Invalidate fiction cache when reading live (read status changed on RR)
  if (!isPreCaching && fictionInfo.fictionId) {
    const fictionCacheKey = `fiction:${fictionInfo.fictionId}`;
    if (deleteCache(fictionCacheKey)) {
      console.log(`Invalidated fiction cache: ${fictionCacheKey}`);
    }
  }

  // Pre-cache next chapter when reading live
  if (nextChapterId && !isPreCaching) {
    console.log(`Pre-caching next chapter: ${nextChapterId}`);
    setTimeout(async () => {
      try {
        await getChapter(nextChapterId, CACHE_TTL.CHAPTER);
      } catch (e) {
        console.error(`Failed to pre-cache chapter ${nextChapterId}:`, e);
      }
    }, 100);
  }

  return result;
}

/**
 * Validate cookies by attempting to fetch follows
 */
export async function validateCookies(): Promise<boolean> {
  try {
    await createContext();
    const { page, content } = await getPage(`${ROYAL_ROAD_BASE_URL}/my/follows`);
    await page.close();
    
    return !content.includes('action="/account/login"') && !content.includes("Sign In");
  } catch (e) {
    console.error("Cookie validation failed:", e);
    return false;
  }
}

/**
 * Search for fictions
 */
export async function searchFictions(query: string): Promise<Fiction[]> {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `${ROYAL_ROAD_BASE_URL}/fictions/search?title=${encodedQuery}`;
  
  const { page, content } = await getPage(searchUrl, ".fiction-list-item");
  await page.close();
  
  return parseFictionList(content);
}
