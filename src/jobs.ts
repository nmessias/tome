// Background jobs for cache warming
import { hasSessionCookies, isCached } from "./db";
import { TOPLISTS } from "./types";

// TTL constants (in seconds)
export const TTL = {
  FOLLOWS: 20 * 60,           // 20 minutes
  NEXT_CHAPTER: 30 * 24 * 60 * 60, // 30 days
  TOPLIST: 6 * 60 * 60,       // 6 hours
  FICTION: 60 * 60,           // 1 hour (fiction details)
} as const;

// Job state
let jobsRunning = false;
let followsJobInterval: ReturnType<typeof setInterval> | null = null;
let toplistsJobInterval: ReturnType<typeof setInterval> | null = null;

// Import scraper functions dynamically to avoid circular deps
async function getScraperFunctions() {
  const scraper = await import("./scraper");
  return {
    getFollows: scraper.getFollows,
    getToplist: scraper.getToplist,
    getChapter: scraper.getChapter,
    getFiction: scraper.getFiction,
  };
}

// Warm cache for follows and their next chapters
async function warmFollowsCache(): Promise<void> {
  if (!hasSessionCookies()) {
    console.log("[Job] Skipping follows cache - no session cookies");
    return;
  }

  console.log("[Job] Warming follows cache...");
  
  try {
    const { getFollows, getChapter, getFiction } = await getScraperFunctions();
    
    // Check if follows list is already cached
    if (isCached("follows")) {
      console.log("[Job] Follows list already cached, skipping fetch");
    }
    
    // Get follows (returns from cache if valid, otherwise fetches)
    const follows = await getFollows();
    console.log(`[Job] Got ${follows.length} followed fictions`);
    
    // For each follow, cache the next chapter to read (if not already cached)
    let cachedChapters = 0;
    let skippedChapters = 0;
    
    for (const fiction of follows) {
      try {
        // Check if fiction details are cached
        const fictionCacheKey = `fiction:${fiction.id}`;
        if (!isCached(fictionCacheKey)) {
          // Get fiction details to find chapters
          const fictionDetails = await getFiction(fiction.id);
          if (!fictionDetails?.chapters?.length) continue;
          
          // Find next chapter to read
          let nextChapterId: number | undefined;
          
          // If there's a continue chapter from RR, use that
          if (fictionDetails.continueChapterId) {
            nextChapterId = fictionDetails.continueChapterId;
          }
          // Otherwise if there's a lastReadChapterId, find the next one
          else if (fiction.lastReadChapterId) {
            const chapters = fictionDetails.chapters;
            const lastReadIdx = chapters.findIndex(c => c.id === fiction.lastReadChapterId);
            if (lastReadIdx !== -1 && lastReadIdx < chapters.length - 1) {
              nextChapterId = chapters[lastReadIdx + 1].id;
            }
          }
          // If never read, cache first chapter
          else if (fictionDetails.chapters[0]) {
            nextChapterId = fictionDetails.chapters[0].id;
          }
          
          if (nextChapterId) {
            const chapterCacheKey = `chapter:${nextChapterId}`;
            if (isCached(chapterCacheKey)) {
              skippedChapters++;
            } else {
              // Cache the chapter with 30 day TTL
              await getChapter(nextChapterId, TTL.NEXT_CHAPTER);
              cachedChapters++;
              console.log(`[Job] Cached next chapter ${nextChapterId} for "${fiction.title}"`);
            }
          }
          
          // Small delay to avoid hammering the server
          await new Promise(r => setTimeout(r, 1000));
        } else {
          skippedChapters++;
        }
      } catch (err) {
        console.error(`[Job] Error caching chapter for fiction ${fiction.id}:`, err);
      }
    }
    
    console.log(`[Job] Finished warming follows cache. Cached: ${cachedChapters}, Skipped (already cached): ${skippedChapters}`);
  } catch (err) {
    console.error("[Job] Error warming follows cache:", err);
  }
}

// Warm cache for toplists
async function warmToplistsCache(): Promise<void> {
  console.log("[Job] Warming toplists cache...");
  
  try {
    const { getToplist } = await getScraperFunctions();
    
    let cached = 0;
    let skipped = 0;
    
    for (const toplist of TOPLISTS) {
      try {
        const cacheKey = `toplist:${toplist.slug}`;
        if (isCached(cacheKey)) {
          skipped++;
          console.log(`[Job] Toplist already cached: ${toplist.name}`);
        } else {
          await getToplist(toplist, TTL.TOPLIST);
          cached++;
          console.log(`[Job] Cached toplist: ${toplist.name}`);
          // Small delay between requests
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`[Job] Error caching toplist ${toplist.slug}:`, err);
      }
    }
    
    console.log(`[Job] Finished warming toplists cache. Cached: ${cached}, Skipped: ${skipped}`);
  } catch (err) {
    console.error("[Job] Error warming toplists cache:", err);
  }
}

// Start all background jobs
export function startJobs(): void {
  if (jobsRunning) {
    console.log("[Job] Jobs already running");
    return;
  }
  
  jobsRunning = true;
  console.log("[Job] Starting background cache jobs...");
  
  // Run initial cache warming after a short delay (let browser init first)
  setTimeout(async () => {
    await warmToplistsCache();
    await warmFollowsCache();
  }, 10000); // 10 second delay
  
  // Schedule follows cache warming every 20 minutes
  followsJobInterval = setInterval(warmFollowsCache, TTL.FOLLOWS * 1000);
  
  // Schedule toplists cache warming every 6 hours
  toplistsJobInterval = setInterval(warmToplistsCache, TTL.TOPLIST * 1000);
  
  console.log("[Job] Background jobs scheduled");
  console.log(`[Job] - Follows: every ${TTL.FOLLOWS / 60} minutes`);
  console.log(`[Job] - Toplists: every ${TTL.TOPLIST / 60 / 60} hours`);
}

// Stop all background jobs
export function stopJobs(): void {
  if (followsJobInterval) {
    clearInterval(followsJobInterval);
    followsJobInterval = null;
  }
  if (toplistsJobInterval) {
    clearInterval(toplistsJobInterval);
    toplistsJobInterval = null;
  }
  jobsRunning = false;
  console.log("[Job] Background jobs stopped");
}

// Manually trigger cache warming (useful after login)
export async function triggerCacheWarm(): Promise<void> {
  console.log("[Job] Manual cache warm triggered");
  await warmToplistsCache();
  await warmFollowsCache();
}
