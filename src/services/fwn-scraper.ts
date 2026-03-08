/**
 * FreeWebNovel scraper
 * Fetches fiction metadata, chapter content, and search results from freewebnovel.com
 * No account/cookies needed - pure HTTP scraping with caching.
 */
import { parseHTML } from "linkedom";
import { getCache, setCache } from "./cache";
import { FREEWEBNOVEL_BASE_URL, CACHE_TTL } from "../config";
import type { Fiction, Chapter, ChapterContent } from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch a page from FreeWebNovel
 */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`FreeWebNovel returned ${response.status} for ${url}`);
  }

  return await response.text();
}

/**
 * Extract the novel slug from a FWN URL
 * e.g. "/novel/immortality-through-array-formations" => "immortality-through-array-formations"
 * e.g. "https://freewebnovel.com/novel/foo/chapter-1" => "foo"
 */
function extractSlug(href: string): string | null {
  const match = href.match(/\/novel\/([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract chapter number from a FWN chapter URL
 * e.g. "/novel/foo/chapter-42" => 42
 */
function extractChapterNum(href: string): number | null {
  const match = href.match(/\/chapter-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Search fictions on FreeWebNovel
 * POST /search with formdata: searchkey=query
 */
export async function searchFictions(query: string): Promise<Fiction[]> {
  const cacheKey = `fwn:search:${query.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const url = `${FREEWEBNOVEL_BASE_URL}/search`;
  const formData = new URLSearchParams();
  formData.set("searchkey", query);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    body: formData.toString(),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`FreeWebNovel search returned ${response.status}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const fictions: Fiction[] = [];

  // Search results use the same card structure as homepage lists
  const items = document.querySelectorAll(".li-row .li");
  for (const item of items) {
    const titleEl =
      item.querySelector(".tit a") || item.querySelector(".txt h3 a");
    if (!titleEl) continue;

    const title = titleEl.textContent?.trim() || "";
    const href = titleEl.getAttribute("href") || "";
    const slug = extractSlug(href);
    if (!slug) continue;

    const imgEl = item.querySelector(".pic img");
    const coverUrl = imgEl
      ? imgEl.getAttribute("src")?.startsWith("http")
        ? imgEl.getAttribute("src")!
        : `${FREEWEBNOVEL_BASE_URL}${imgEl.getAttribute("src")}`
      : undefined;

    // Extract author from the item's info
    const authorEl = item.querySelector(
      '.item .glyphicon-user + .right a, .item [title="Author"] + .right a'
    );
    const author = authorEl?.textContent?.trim() || "";

    // Extract genres
    const genreEls = item.querySelectorAll(
      '.item .glyphicon-th-list + .right a, .item [title="Genre"] + .right a'
    );
    const tags: string[] = [];
    for (const g of genreEls) {
      const tag = g.textContent?.trim();
      if (tag) tags.push(tag);
    }

    fictions.push({
      id: 0,
      slug,
      title,
      author,
      url: `${FREEWEBNOVEL_BASE_URL}/novel/${slug}`,
      coverUrl,
      tags: tags.length > 0 ? tags : undefined,
    });
  }

  // Also try a different selector pattern for search results
  if (fictions.length === 0) {
    const rows = document.querySelectorAll(".col-content .li");
    for (const item of rows) {
      const titleEl =
        item.querySelector(".tit a") || item.querySelector("h3 a");
      if (!titleEl) continue;

      const title = titleEl.textContent?.trim() || "";
      const href = titleEl.getAttribute("href") || "";
      const slug = extractSlug(href);
      if (!slug) continue;

      const imgEl = item.querySelector("img");
      const coverUrl = imgEl
        ? imgEl.getAttribute("src")?.startsWith("http")
          ? imgEl.getAttribute("src")!
          : `${FREEWEBNOVEL_BASE_URL}${imgEl.getAttribute("src")}`
        : undefined;

      fictions.push({
        id: 0,
        slug,
        title,
        author: "",
        url: `${FREEWEBNOVEL_BASE_URL}/novel/${slug}`,
        coverUrl,
      });
    }
  }

  setCache(cacheKey, JSON.stringify(fictions), CACHE_TTL.DEFAULT);
  return fictions;
}

/**
 * Get fiction details and chapter list from FreeWebNovel
 */
export async function getFiction(
  slug: string,
  ttl: number = CACHE_TTL.FICTION
): Promise<Fiction | null> {
  const cacheKey = `fwn:fiction:${slug}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const url = `${FREEWEBNOVEL_BASE_URL}/novel/${slug}`;
  let html: string;
  try {
    html = await fetchPage(url);
  } catch {
    return null;
  }

  const { document } = parseHTML(html);

  // Title from og:novel:novel_name meta tag or h1.tit
  const titleEl =
    document.querySelector(".m-desc .tit") ||
    document.querySelector(".m-desc h1");
  const title = titleEl?.textContent?.trim() || slug;

  // Author
  const authorEl = document.querySelector(
    '.m-imgtxt .item .glyphicon-user + .right a, .m-imgtxt .item [title="Author"] + .right a'
  );
  // fallback: use og:novel:author meta
  const authorMeta = document.querySelector(
    'meta[property="og:novel:author"]'
  );
  const author =
    authorEl?.textContent?.trim() ||
    authorMeta?.getAttribute("content")?.split(",")[0]?.trim() ||
    "";

  // Cover image
  const coverImg = document.querySelector(".m-imgtxt .pic img");
  const coverSrc = coverImg?.getAttribute("src");
  const coverUrl = coverSrc
    ? coverSrc.startsWith("http")
      ? coverSrc
      : `${FREEWEBNOVEL_BASE_URL}${coverSrc}`
    : undefined;

  // Genres
  const genreEls = document.querySelectorAll(
    '.m-imgtxt .item .glyphicon-th-list + .right a, .m-imgtxt .item [title="Genre"] + .right a'
  );
  const tags: string[] = [];
  for (const g of genreEls) {
    const tag = g.textContent?.trim();
    if (tag) tags.push(tag);
  }

  // Status
  const statusMeta = document.querySelector(
    'meta[property="og:novel:status"]'
  );
  const status = statusMeta?.getAttribute("content") || "";

  // Rating
  const voteEl = document.querySelector(".m-desc .vote");
  const voteText = voteEl?.textContent?.trim() || "";
  const ratingMatch = voteText.match(/([\d.]+)\s*\/\s*5/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;

  // Description
  const descEl = document.querySelector(".m-desc .txt .inner");
  let description = "";
  if (descEl) {
    const paragraphs = descEl.querySelectorAll("p");
    const parts: string[] = [];
    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (text) parts.push(text);
    }
    description = parts.join("\n");
  }

  // Chapter list from #idData
  const chapterEls = document.querySelectorAll("#idData li a.con");
  const chapters: Chapter[] = [];
  let order = 1;
  for (const el of chapterEls) {
    const chapterTitle = el.textContent?.trim() || `Chapter ${order}`;
    const chapterHref = el.getAttribute("href") || "";
    const chapterNum = extractChapterNum(chapterHref);

    chapters.push({
      id: chapterNum || order,
      slug: `chapter-${chapterNum || order}`,
      title: chapterTitle,
      url: `/fwn/read/${slug}/${chapterNum || order}`,
      order,
    });
    order++;
  }

  const fiction: Fiction = {
    id: 0,
    slug,
    title,
    author,
    url,
    coverUrl,
    description,
    tags: tags.length > 0 ? tags : undefined,
    stats: {
      rating,
    },
    chapters,
  };

  setCache(cacheKey, JSON.stringify(fiction), ttl);
  return fiction;
}

/**
 * Get chapter content from FreeWebNovel
 */
export async function getChapter(
  slug: string,
  chapterNum: number,
  ttl: number = CACHE_TTL.CHAPTER
): Promise<ChapterContent | null> {
  const cacheKey = `fwn:chapter:${slug}:${chapterNum}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const url = `${FREEWEBNOVEL_BASE_URL}/novel/${slug}/chapter-${chapterNum}`;
  let html: string;
  try {
    html = await fetchPage(url);
  } catch {
    return null;
  }

  const { document } = parseHTML(html);

  // Fiction title from breadcrumb or header
  const fictionTitleEl = document.querySelector(".m-read .top .tit a");
  const fictionTitle = fictionTitleEl?.textContent?.trim() || slug;

  // Chapter title
  const chapterTitleEl = document.querySelector(".m-read .top .chapter");
  const chapterTitle =
    chapterTitleEl?.textContent?.trim() || `Chapter ${chapterNum}`;

  // Chapter content from #article
  const articleEl = document.querySelector("#article");
  if (!articleEl) {
    return null;
  }

  // Clean the content: remove ads, watermarks, and script elements
  const removeSelectors = [
    "subtxt",
    "script",
    ".read-ads",
    '[id^="bg-ssp"]',
    '[id^="pf-"]',
    "style",
  ];
  for (const sel of removeSelectors) {
    const els = articleEl.querySelectorAll(sel);
    for (const el of els) {
      el.remove();
    }
  }

  // Remove ad divs with inline styles containing text-align: center and margin
  const divs = articleEl.querySelectorAll("div");
  for (const div of divs) {
    const style = div.getAttribute("style") || "";
    if (
      style.includes("text-align: center") &&
      style.includes("margin")
    ) {
      div.remove();
    }
  }

  const content = articleEl.innerHTML?.trim() || "";

  // Navigation: prev and next chapter
  // Bottom nav is more reliable
  const prevEl = document.querySelector(
    ".ul-list7 .prev a, #prev_url"
  );
  const nextEl = document.querySelector(
    "#next_url, .ul-list7 li:last-child a[href*='chapter-']"
  );

  const prevHref = prevEl?.getAttribute("href") || "";
  const nextHref = nextEl?.getAttribute("href") || "";

  // Parse prev/next chapter numbers
  const prevChapterNum = extractChapterNum(prevHref);
  const nextChapterNum = extractChapterNum(nextHref);

  // Build our internal URLs
  const prevChapterUrl = prevChapterNum
    ? `/fwn/read/${slug}/${prevChapterNum}`
    : undefined;
  const nextChapterUrl = nextChapterNum
    ? `/fwn/read/${slug}/${nextChapterNum}`
    : undefined;

  const chapter: ChapterContent = {
    id: chapterNum,
    fictionId: 0,
    fictionSlug: slug,
    chapterSlug: `chapter-${chapterNum}`,
    title: chapterTitle,
    content,
    prevChapterUrl,
    nextChapterUrl,
    fictionTitle,
    fictionUrl: `/fwn/fiction/${slug}`,
  };

  setCache(cacheKey, JSON.stringify(chapter), ttl);
  return chapter;
}
