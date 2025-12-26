// Main entry point - Bun HTTP server with routes
import { setCookie, clearCookies, hasSessionCookies, clearCache, getCacheStats, clearCacheByType, clearImageCache, getImageCache, setImageCache } from "./db";
import { initBrowser, getFollows, getHistory, getToplist, getFiction, getChapter, validateCookies, createContext, searchFictions } from "./scraper";
import { TOPLISTS } from "./types";
import * as templates from "./templates";
import { startJobs, stopJobs, triggerCacheWarm } from "./jobs";

const PORT = process.env.PORT || 3000;
const MDNS_HOSTNAME = "royal.local";

// mDNS alias process
let mdnsProcess: ReturnType<typeof Bun.spawn> | null = null;

async function startMdns() {
  try {
    // Get local IP
    const ipProc = Bun.spawn(["hostname", "-I"], { stdout: "pipe" });
    const ipOutput = await new Response(ipProc.stdout).text();
    const localIp = ipOutput.trim().split(" ")[0];
    
    if (localIp) {
      mdnsProcess = Bun.spawn(["avahi-publish", "-a", MDNS_HOSTNAME, "-R", localIp], {
        stdout: "inherit",
        stderr: "inherit",
      });
      console.log(`mDNS: Publishing ${MDNS_HOSTNAME} -> ${localIp}`);
    }
  } catch (e) {
    console.log("mDNS: avahi-publish not available, skipping");
  }
}

// Initialize browser on startup
console.log("Starting E-ink Road Proxy...");
initBrowser().then(() => {
  // Start background cache jobs after browser is ready
  startJobs();
}).catch(console.error);
startMdns();

// URL pattern matchers
const FICTION_PATTERN = /^\/fiction\/(\d+)$/;
const CHAPTER_PATTERN = /^\/chapter\/(\d+)$/;
const CHAPTER_API_PATTERN = /^\/api\/chapter\/(\d+)$/;
const TOPLIST_PATTERN = /^\/toplist\/([\w-]+)$/;
const COVER_IMAGE_PATTERN = /^\/img\/cover\/(\d+)$/;

// Parse form data from POST body
async function parseFormData(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";
  
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }
  
  return {};
}

// HTML response helper
function html(content: string, status: number = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Redirect helper
function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

// Main request handler
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  try {
    // Serve font files
    if (path.startsWith("/fonts/") && method === "GET") {
      const fontFile = path.replace("/fonts/", "");
      const fontPath = `${import.meta.dir}/../fonts/${fontFile}`;
      const file = Bun.file(fontPath);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": "font/ttf",
            "Cache-Control": "public, max-age=31536000",
          },
        });
      }
      return new Response("Font not found", { status: 404 });
    }

    // Static routes
    if (path === "/" && method === "GET") {
      return html(templates.homePage());
    }

    if (path === "/setup" && method === "GET") {
      return html(templates.setupPage());
    }

    if (path === "/setup" && method === "POST") {
      const form = await parseFormData(req);
      const identity = form.identity?.trim();
      const cfclearance = form.cfclearance?.trim();

      if (!identity) {
        return html(templates.setupPage("The .AspNetCore.Identity.Application cookie is required.", true));
      }

      // Save cookies
      setCookie(".AspNetCore.Identity.Application", identity);
      if (cfclearance) {
        setCookie("cf_clearance", cfclearance);
      }

      // Validate by trying to fetch follows
      const valid = await validateCookies();
      
      if (valid) {
        // Trigger cache warming in background after successful login
        triggerCacheWarm().catch(console.error);
        return html(templates.setupPage("Cookies saved and validated successfully! Cache warming started. You can now access your follows.", false));
      } else {
        return html(templates.setupPage("Cookies saved but validation failed. Please check your cookie values.", true));
      }
    }

    if (path === "/setup/clear" && method === "GET") {
      clearCookies();
      clearCache();
      await createContext(); // Refresh context without cookies
      return html(templates.setupPage("Cookies and cache cleared.", false));
    }

    if (path === "/cache/clear" && method === "GET") {
      clearCache();
      return redirect("/cache");
    }

    // Cache management UI
    if (path === "/cache" && method === "GET") {
      const stats = getCacheStats();
      return html(templates.cachePage(stats));
    }

    // Clear cache by type
    if (path.startsWith("/cache/clear/") && method === "GET") {
      const type = path.replace("/cache/clear/", "");
      if (type === "images") {
        const deleted = clearImageCache();
        return html(templates.cachePage(getCacheStats(), `Cleared ${deleted} cached images.`));
      } else if (type === "expired") {
        const { clearExpiredCache } = await import("./db");
        clearExpiredCache();
        return html(templates.cachePage(getCacheStats(), "Cleared expired cache entries."));
      } else if (type === "all") {
        clearCache();
        clearImageCache();
        return html(templates.cachePage(getCacheStats(), "Cleared all cache."));
      } else {
        const deleted = clearCacheByType(type);
        return html(templates.cachePage(getCacheStats(), `Cleared ${deleted} ${type} cache entries.`));
      }
    }

    // Cover image proxy (fetches and caches images from Royal Road)
    const coverMatch = path.match(COVER_IMAGE_PATTERN);
    if (coverMatch && method === "GET") {
      const fictionId = parseInt(coverMatch[1], 10);
      const cacheKey = `cover:${fictionId}`;
      
      // Check if we have it cached
      const cached = getImageCache(cacheKey);
      if (cached) {
        return new Response(new Uint8Array(cached.data), {
          headers: {
            "Content-Type": cached.contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
      
      // Need to fetch - get fiction details first to get cover URL
      try {
        const fiction = await getFiction(fictionId);
        if (!fiction?.coverUrl) {
          return new Response("Cover not found", { status: 404 });
        }
        
        // Fetch the image from Royal Road
        const imageResponse = await fetch(fiction.coverUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        
        if (!imageResponse.ok) {
          return new Response("Failed to fetch cover", { status: 502 });
        }
        
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        const imageData = Buffer.from(await imageResponse.arrayBuffer());
        
        // Cache for 30 days
        setImageCache(cacheKey, imageData, contentType);
        
        return new Response(new Uint8Array(imageData), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (error: any) {
        console.error(`Error fetching cover for fiction ${fictionId}:`, error);
        return new Response("Error fetching cover", { status: 500 });
      }
    }

    if (path === "/follows" && method === "GET") {
      if (!hasSessionCookies()) {
        return html(templates.errorPage(
          "Not Configured",
          "Please configure your session cookies first.",
          "/setup"
        ));
      }

      try {
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const fictions = await getFollows();
        return html(templates.followsPage(fictions, page));
      } catch (error: any) {
        console.error("Error fetching follows:", error);
        return html(templates.errorPage(
          "Error Loading Follows",
          error.message || "Failed to load follows. Try again.",
          "/follows"
        ));
      }
    }

    if (path === "/history" && method === "GET") {
      if (!hasSessionCookies()) {
        return html(templates.errorPage(
          "Not Configured",
          "Please configure your session cookies first.",
          "/setup"
        ));
      }

      try {
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const history = await getHistory();
        return html(templates.historyPage(history, page));
      } catch (error: any) {
        console.error("Error fetching history:", error);
        return html(templates.errorPage(
          "Error Loading History",
          error.message || "Failed to load history. Try again.",
          "/history"
        ));
      }
    }

    if (path === "/toplists" && method === "GET") {
      return html(templates.toplistsPage());
    }

    if (path === "/search" && method === "GET") {
      const query = url.searchParams.get("q")?.trim() || "";
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      
      if (!query) {
        return html(templates.searchPage());
      }
      
      try {
        const results = await searchFictions(query);
        return html(templates.searchPage(query, results, page));
      } catch (error: any) {
        console.error(`Error searching for "${query}":`, error);
        return html(templates.errorPage(
          "Search Error",
          error.message || "Failed to search. Try again.",
          "/search"
        ));
      }
    }

    // Toplist routes
    const toplistMatch = path.match(TOPLIST_PATTERN);
    if (toplistMatch && method === "GET") {
      const slug = toplistMatch[1];
      const toplist = TOPLISTS.find(t => t.slug === slug);
      
      if (!toplist) {
        return html(templates.errorPage("Not Found", `Toplist "${slug}" not found.`), 404);
      }

      try {
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const fictions = await getToplist(toplist);
        return html(templates.toplistPage(toplist, fictions, page));
      } catch (error: any) {
        console.error(`Error fetching toplist ${slug}:`, error);
        return html(templates.errorPage(
          "Error Loading Toplist",
          error.message || "Failed to load toplist. Try again.",
          `/toplist/${slug}`
        ));
      }
    }

    // Fiction detail routes
    const fictionMatch = path.match(FICTION_PATTERN);
    if (fictionMatch && method === "GET") {
      const id = parseInt(fictionMatch[1], 10);
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      
      try {
        const fiction = await getFiction(id);
        if (!fiction) {
          return html(templates.errorPage("Not Found", `Fiction ${id} not found.`), 404);
        }
        return html(templates.fictionPage(fiction, page));
      } catch (error: any) {
        console.error(`Error fetching fiction ${id}:`, error);
        return html(templates.errorPage(
          "Error Loading Fiction",
          error.message || "Failed to load fiction. Try again.",
          `/fiction/${id}`
        ));
      }
    }

    // Chapter API (JSON) for SPA navigation
    const chapterApiMatch = path.match(CHAPTER_API_PATTERN);
    if (chapterApiMatch && method === "GET") {
      const id = parseInt(chapterApiMatch[1], 10);
      
      try {
        // Use TTL to indicate this is for pre-caching (uses anonymous context)
        const chapter = await getChapter(id, 30 * 24 * 60 * 60);
        if (!chapter) {
          return new Response(JSON.stringify({ error: "Chapter not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Extract chapter IDs from URLs for easier client-side handling
        const prevChapterId = chapter.prevChapterUrl 
          ? parseInt(chapter.prevChapterUrl.replace("/chapter/", ""), 10) 
          : null;
        const nextChapterId = chapter.nextChapterUrl 
          ? parseInt(chapter.nextChapterUrl.replace("/chapter/", ""), 10) 
          : null;
        
        return new Response(JSON.stringify({
          id: chapter.id,
          title: chapter.title,
          content: chapter.content,
          fictionId: chapter.fictionId,
          fictionTitle: chapter.fictionTitle,
          prevChapterId,
          nextChapterId,
        }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error(`Error fetching chapter API ${id}:`, error);
        return new Response(JSON.stringify({ error: error.message || "Failed to load chapter" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Mark chapter as read - triggers authenticated request to Royal Road
    // This is called by SPA navigation to ensure reading progress is tracked
    if (chapterApiMatch && method === "POST") {
      const id = parseInt(chapterApiMatch[1], 10);
      
      try {
        // Call getChapter WITHOUT TTL = uses authenticated context = triggers "mark as read"
        await getChapter(id);
        return new Response(JSON.stringify({ success: true, chapterId: id }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error(`Error marking chapter ${id} as read:`, error);
        return new Response(JSON.stringify({ error: error.message || "Failed to mark as read" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Chapter routes
    const chapterMatch = path.match(CHAPTER_PATTERN);
    if (chapterMatch && method === "GET") {
      const id = parseInt(chapterMatch[1], 10);
      
      try {
        const chapter = await getChapter(id);
        if (!chapter) {
          return html(templates.errorPage("Not Found", `Chapter ${id} not found.`), 404);
        }
        return html(templates.chapterPage(chapter));
      } catch (error: any) {
        console.error(`Error fetching chapter ${id}:`, error);
        return html(templates.errorPage(
          "Error Loading Chapter",
          error.message || "Failed to load chapter. Try again.",
          `/chapter/${id}`
        ));
      }
    }

    // 404
    return html(templates.errorPage("Not Found", "The page you're looking for doesn't exist."), 404);

  } catch (error: any) {
    console.error("Unhandled error:", error);
    return html(templates.errorPage(
      "Server Error",
      "An unexpected error occurred. Please try again.",
      "/"
    ), 500);
  }
}

// Start server
const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`E-ink Road Proxy running at http://localhost:${server.port}`);
console.log(`Access from Kindle: http://${MDNS_HOSTNAME}:${server.port}`);
console.log("Press Ctrl+C to stop");

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  stopJobs();
  if (mdnsProcess) {
    mdnsProcess.kill();
  }
  const { closeBrowser } = await import("./scraper");
  await closeBrowser();
  process.exit(0);
});
