/**
 * Page routes (HTML responses)
 */
import { html, parseFormData, matchPath, URL_PATTERNS, redirect } from "../server";
import {
  HomePage,
  SettingsPage,
  FollowsPage,
  HistoryPage,
  ToplistsPage,
  ToplistPage,
  FictionPage,
  SearchPage,
  ErrorPage,
  WsTestPage,
  RemotePage,
} from "../templates";
import { ReaderPage } from "../templates/pages/reader";
import {
  clearCache,
  clearCacheByType,
  clearImageCache,
  clearExpiredCache,
  getCacheStats,
} from "../services/cache";
import {
  hasRoyalRoadSession,
  setRoyalRoadCookie,
  clearRoyalRoadCookies,
} from "../services/royalroad-credentials";
import {
  getFollows,
  getHistory,
  getToplist,
  getToplistCached,
  getFiction,
  getChapter,
  validateCookies,
  createContext,
  searchFictions,
  setBookmark,
} from "../services/scraper";
import { triggerCacheWarm } from "../services/jobs";
import { TOPLISTS } from "../config";
import type { ReaderSettings } from "../config";
import type { Fiction } from "../types";
import { isValidToken } from "../services/remote";
import {
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
} from "../services/invitations";
import {
  getUserSources,
  setSourceEnabled,
  getEnabledSources,
  isSourceEnabled,
  type SourceType,
} from "../services/sources";
import {
  uploadEpub,
  getUserLibrary,
  getBook,
  deleteBook,
} from "../services/epub";
import { LibraryPage } from "../templates/pages/library";
import { LibraryUploadPage } from "../templates/pages/library-upload";
import { EpubReaderPage } from "../templates/pages/epub-reader";

/**
 * Handle page routes
 * Returns Response if matched, null otherwise
 */
export async function handlePageRoute(
  req: Request,
  path: string,
  url: URL,
  settings: ReaderSettings,
  userId: string,
  isAdmin: boolean
): Promise<Response | null> {
  const method = req.method;
  const enabledSources = getEnabledSources(userId);

  // WebSocket diagnostic test page
  if (path === "/ws-test" && method === "GET") {
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${host}/ws/test`;
    
    return html(WsTestPage({ settings, wsUrl }));
  }

  const remoteMatch = path.match(/^\/remote\/([a-z0-9]+)$/);
  if (remoteMatch && method === "GET") {
    const token = remoteMatch[1];
    
    if (!isValidToken(token)) {
      return html(ErrorPage({ 
        title: "Invalid Session", 
        message: "This remote control session has expired or is invalid.", 
        settings 
      }), 404);
    }
    
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${host}/ws/remote/${token}?role=controller`;
    
    return new Response(RemotePage({ token, wsUrl }) as string, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (path === "/" && method === "GET") {
    const hasCookies = hasRoyalRoadSession(userId);
    
    // Only show toplists if cookies are configured
    let risingStars: Fiction[] = [];
    let weeklyPopular: Fiction[] = [];
    
    if (hasCookies) {
      const risingStarsToplist = TOPLISTS.find(t => t.slug === 'rising-stars');
      const weeklyPopularToplist = TOPLISTS.find(t => t.slug === 'weekly-popular');
      
      // Use cache-only to avoid blocking the homepage on slow scraping
      risingStars = (risingStarsToplist ? getToplistCached(risingStarsToplist) : null)?.slice(0, 10) || [];
      weeklyPopular = (weeklyPopularToplist ? getToplistCached(weeklyPopularToplist) : null)?.slice(0, 10) || [];
    }
    
    return html(HomePage({ 
      settings, 
      risingStars,
      weeklyPopular,
      hasCookies,
      enabledSources,
    }));
  }

  // Settings - GET
  if (path === "/settings" && method === "GET") {
    const stats = getCacheStats();
    const userSources = getUserSources(userId);
    const sources = {
      royalroad: userSources.find(s => s.source === "royalroad")?.enabled ?? false,
      epub: userSources.find(s => s.source === "epub")?.enabled ?? false,
    };
    const invitations = isAdmin ? getPendingInvitations().map(inv => ({
      id: inv.id,
      email: inv.email,
      token: inv.token,
      expiresAt: inv.expiresAt,
      inviteUrl: `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host") || "localhost:3000"}/invite/${inv.token}`,
    })) : [];
    return html(SettingsPage({ settings, stats, isAdmin, invitations, sources, enabledSources }));
  }

  // Settings - POST cookies
  if (path === "/settings/cookies" && method === "POST") {
    const form = await parseFormData(req);
    const identity = form.identity?.trim();
    const cfclearance = form.cfclearance?.trim();

    const getSourcesState = () => {
      const userSources = getUserSources(userId);
      return {
        royalroad: userSources.find(s => s.source === "royalroad")?.enabled ?? false,
        epub: userSources.find(s => s.source === "epub")?.enabled ?? false,
      };
    };

    if (!identity) {
      const stats = getCacheStats();
      return html(
        SettingsPage({ message: "The .AspNetCore.Identity.Application cookie is required.", isError: true, settings, stats, sources: getSourcesState(), enabledSources })
      );
    }

    setRoyalRoadCookie(userId, ".AspNetCore.Identity.Application", identity);
    if (cfclearance) {
      setRoyalRoadCookie(userId, "cf_clearance", cfclearance);
    }

    const valid = await validateCookies(userId);
    const stats = getCacheStats();

    if (valid) {
      triggerCacheWarm().catch(console.error);
      return html(
        SettingsPage({
          message: "Cookies saved and validated! Cache warming started.",
          isError: false,
          settings,
          stats,
          sources: getSourcesState(),
          enabledSources,
        })
      );
    } else {
      return html(
        SettingsPage({ message: "Cookies saved but validation failed. Check your cookie values.", isError: true, settings, stats, sources: getSourcesState(), enabledSources })
      );
    }
  }

  if (path === "/settings/cookies/clear" && method === "GET") {
    clearRoyalRoadCookies(userId);
    clearCache();
    await createContext(userId);
    const stats = getCacheStats();
    const userSources = getUserSources(userId);
    const sources = {
      royalroad: userSources.find(s => s.source === "royalroad")?.enabled ?? false,
      epub: userSources.find(s => s.source === "epub")?.enabled ?? false,
    };
    return html(SettingsPage({ message: "Cookies and cache cleared.", isError: false, settings, stats, isAdmin, sources, enabledSources }));
  }

  if (path === "/settings/invitations" && method === "POST") {
    if (!isAdmin) {
      return redirect("/settings");
    }
    
    const form = await parseFormData(req);
    const email = form.email?.trim();
    const stats = getCacheStats();
    
    if (!email) {
      const invitations = getPendingInvitations().map(inv => ({
        id: inv.id,
        email: inv.email,
        token: inv.token,
        expiresAt: inv.expiresAt,
        inviteUrl: `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host") || "localhost:3000"}/invite/${inv.token}`,
      }));
      return html(SettingsPage({ message: "Email is required", isError: true, settings, stats, isAdmin, invitations }));
    }
    
    createInvitation(email, userId);
    return redirect("/settings");
  }

  const revokeMatch = path.match(/^\/settings\/invitations\/revoke\/([a-f0-9-]+)$/);
  if (revokeMatch && method === "POST") {
    if (!isAdmin) {
      return redirect("/settings");
    }
    
    const invitationId = revokeMatch[1];
    revokeInvitation(invitationId);
    return redirect("/settings");
  }

  if (path === "/settings/theme" && method === "POST") {
    return new Response(null, {
      status: 303,
      headers: { Location: "/settings" },
    });
  }

  const sourceToggleMatch = path.match(/^\/settings\/sources\/(royalroad|epub)$/);
  if (sourceToggleMatch && method === "POST") {
    const source = sourceToggleMatch[1] as SourceType;
    const form = await parseFormData(req);
    const enabled = form.enabled === "1";
    
    setSourceEnabled(userId, source, enabled);
    return redirect("/settings");
  }

  const settingsCacheMatch = path.match(/^\/settings\/cache\/clear\/(.+)$/);
  if (settingsCacheMatch && method === "GET") {
    const type = settingsCacheMatch[1];
    let message: string;

    if (type === "images") {
      const deleted = clearImageCache();
      message = `Cleared ${deleted} cached images.`;
    } else if (type === "expired") {
      clearExpiredCache();
      message = "Cleared expired cache entries.";
    } else if (type === "all") {
      clearCache();
      clearImageCache();
      message = "Cleared all cache.";
    } else {
      const deleted = clearCacheByType(type);
      message = `Cleared ${deleted} ${type} cache entries.`;
    }

    const stats = getCacheStats();
    const userSources = getUserSources(userId);
    const sources = {
      royalroad: userSources.find(s => s.source === "royalroad")?.enabled ?? false,
      epub: userSources.find(s => s.source === "epub")?.enabled ?? false,
    };
    return html(SettingsPage({ message, settings, stats, sources, enabledSources }));
  }

  // Legacy /setup redirect to /settings
  if (path === "/setup" && method === "GET") {
    return new Response(null, {
      status: 301,
      headers: { Location: "/settings" },
    });
  }

  // Legacy /cache redirect to /settings
  if (path === "/cache" && method === "GET") {
    return new Response(null, {
      status: 301,
      headers: { Location: "/settings" },
    });
  }

  if (path === "/follows" && method === "GET") {
    if (!hasRoyalRoadSession(userId)) {
      return html(
        ErrorPage({ title: "Not Configured", message: "Please configure your session cookies first.", retryUrl: "/settings", settings })
      );
    }

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const fictions = await getFollows(userId);
      return html(FollowsPage({ fictions, page, settings }));
    } catch (error: any) {
      console.error("Error fetching follows:", error);
      return html(
        ErrorPage({
          title: "Error Loading Follows",
          message: error.message || "Failed to load follows. Try again.",
          retryUrl: "/follows",
          settings,
        })
      );
    }
  }

  if (path === "/history" && method === "GET") {
    if (!hasRoyalRoadSession(userId)) {
      return html(
        ErrorPage({ title: "Not Configured", message: "Please configure your session cookies first.", retryUrl: "/settings", settings })
      );
    }

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const history = await getHistory(userId);
      return html(HistoryPage({ history, page, settings }));
    } catch (error: any) {
      console.error("Error fetching history:", error);
      return html(
        ErrorPage({
          title: "Error Loading History",
          message: error.message || "Failed to load history. Try again.",
          retryUrl: "/history",
          settings,
        })
      );
    }
  }

  // Toplists index
  if (path === "/toplists" && method === "GET") {
    return html(ToplistsPage({ settings }));
  }

  // Search
  if (path === "/search" && method === "GET") {
    const query = url.searchParams.get("q")?.trim() || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    if (!query) {
      return html(SearchPage({ settings }));
    }

    if (!hasRoyalRoadSession(userId)) {
      return html(
        ErrorPage({ title: "Not Configured", message: "Please configure your session cookies first.", retryUrl: "/settings", settings })
      );
    }

    try {
      const results = await searchFictions(query);
      return html(SearchPage({ query, results, page, settings }));
    } catch (error: any) {
      console.error(`Error searching for "${query}":`, error);
      return html(
        ErrorPage({ title: "Search Error", message: error.message || "Failed to search. Try again.", retryUrl: "/search", settings })
      );
    }
  }

  // Toplist detail
  const toplistMatch = matchPath(path, URL_PATTERNS.toplist);
  if (toplistMatch && method === "GET") {
    const slug = toplistMatch[0];
    const toplist = TOPLISTS.find(t => t.slug === slug);

    if (!toplist) {
      return html(ErrorPage({ title: "Not Found", message: `Toplist "${slug}" not found.`, settings }), 404);
    }

    if (!hasRoyalRoadSession(userId)) {
      return html(
        ErrorPage({ title: "Not Configured", message: "Please configure your session cookies first.", retryUrl: "/settings", settings })
      );
    }

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const fictions = await getToplist(toplist);
      return html(ToplistPage({ toplist, fictions, page, settings }));
    } catch (error: any) {
      console.error(`Error fetching toplist ${slug}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Toplist",
          message: error.message || "Failed to load toplist. Try again.",
          retryUrl: `/toplist/${slug}`,
          settings,
        })
      );
    }
  }

  // Fiction bookmark action (Follow, Favorite, Read Later)
  const bookmarkMatch = path.match(/^\/fiction\/(\d+)\/bookmark$/);
  if (bookmarkMatch && method === "POST") {
    const id = parseInt(bookmarkMatch[1], 10);
    
    if (!hasRoyalRoadSession(userId)) {
      return redirect(`/fiction/${id}?error=${encodeURIComponent("Not logged in")}`);
    }
    
    try {
      const formData = await parseFormData(req);
      const type = formData.type as "follow" | "favorite" | "ril";
      const mark = formData.mark === "true";
      const csrfToken = formData.csrf;
      
      if (!type || !csrfToken) {
        return redirect(`/fiction/${id}?error=${encodeURIComponent("Invalid request")}`);
      }
      
      const result = await setBookmark(userId, id, type, mark, csrfToken);
      
      if (result.success) {
        return redirect(`/fiction/${id}`);
      } else {
        return redirect(`/fiction/${id}?error=${encodeURIComponent(result.error || "Action failed")}`);
      }
    } catch (error: any) {
      console.error(`Error setting bookmark for fiction ${id}:`, error);
      return redirect(`/fiction/${id}?error=${encodeURIComponent("Something went wrong")}`);
    }
  }

  // Fiction detail
  const fictionMatch = matchPath(path, URL_PATTERNS.fiction);
  if (fictionMatch && method === "GET") {
    const id = parseInt(fictionMatch[0], 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const error = url.searchParams.get("error") || undefined;

    if (!hasRoyalRoadSession(userId)) {
      return html(
        ErrorPage({ title: "Not Configured", message: "Please configure your session cookies first.", retryUrl: "/settings", settings })
      );
    }

    try {
      const fiction = await getFiction(id);
      if (!fiction) {
        return html(ErrorPage({ title: "Not Found", message: `Fiction ${id} not found.`, settings }), 404);
      }
      return html(FictionPage({ fiction, chapterPage: page, settings, error }));
    } catch (error: any) {
      console.error(`Error fetching fiction ${id}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Fiction",
          message: error.message || "Failed to load fiction. Try again.",
          retryUrl: `/fiction/${id}`,
          settings,
        })
      );
    }
  }

  // Chapter reader
  const chapterMatch = matchPath(path, URL_PATTERNS.chapter);
  if (chapterMatch && method === "GET") {
    const id = parseInt(chapterMatch[0], 10);

    if (!hasRoyalRoadSession(userId)) {
      return html(
        ErrorPage({ title: "Not Configured", message: "Please configure your session cookies first.", retryUrl: "/settings", settings })
      );
    }

    try {
      const chapter = await getChapter(id, userId);
      if (!chapter) {
        return html(ErrorPage({ title: "Not Found", message: `Chapter ${id} not found.`, settings }), 404);
      }
      return html(ReaderPage({ chapter, settings }));
    } catch (error: any) {
      console.error(`Error fetching chapter ${id}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Chapter",
          message: error.message || "Failed to load chapter. Try again.",
          retryUrl: `/chapter/${id}`,
          settings,
        })
      );
    }
  }

  if (path === "/library" && method === "GET") {
    if (!isSourceEnabled(userId, "epub")) {
      return html(
        ErrorPage({ title: "EPUB Not Enabled", message: "Enable EPUB source in settings to use the library.", retryUrl: "/settings", settings })
      );
    }
    
    const books = getUserLibrary(userId);
    return html(LibraryPage({ books, settings, enabledSources }));
  }

  if (path === "/library/upload" && method === "GET") {
    if (!isSourceEnabled(userId, "epub")) {
      return html(
        ErrorPage({ title: "EPUB Not Enabled", message: "Enable EPUB source in settings to upload books.", retryUrl: "/settings", settings })
      );
    }
    
    return html(LibraryUploadPage({ settings, enabledSources }));
  }

  if (path === "/library/upload" && method === "POST") {
    if (!isSourceEnabled(userId, "epub")) {
      return redirect("/settings");
    }
    
    try {
      const formData = await req.formData();
      const file = formData.get("epub") as File | null;
      
      if (!file || file.size === 0) {
        return html(LibraryUploadPage({ settings, enabledSources, message: "Please select an EPUB file.", isError: true }));
      }
      
      if (!file.name.toLowerCase().endsWith(".epub")) {
        return html(LibraryUploadPage({ settings, enabledSources, message: "Only EPUB files are supported.", isError: true }));
      }
      
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadEpub(userId, buffer, file.name);
      
      if (!result.success) {
        return html(LibraryUploadPage({ settings, enabledSources, message: result.error, isError: true }));
      }
      
      return redirect("/library");
    } catch (error: any) {
      console.error("Error uploading EPUB:", error);
      return html(LibraryUploadPage({ settings, enabledSources, message: "Failed to upload file. Please try again.", isError: true }));
    }
  }

  const epubReaderMatch = path.match(/^\/epub\/([a-f0-9-]+)$/);
  if (epubReaderMatch && method === "GET") {
    const bookId = epubReaderMatch[1];
    
    if (!isSourceEnabled(userId, "epub")) {
      return html(
        ErrorPage({ title: "EPUB Not Enabled", message: "Enable EPUB source in settings to read books.", retryUrl: "/settings", settings })
      );
    }
    
    const book = getBook(bookId, userId);
    if (!book) {
      return html(ErrorPage({ title: "Not Found", message: "Book not found in your library.", retryUrl: "/library", settings }), 404);
    }
    
    return html(EpubReaderPage({ book, settings }));
  }

  const epubDeleteMatch = path.match(/^\/epub\/([a-f0-9-]+)\/delete$/);
  if (epubDeleteMatch && method === "POST") {
    const bookId = epubDeleteMatch[1];
    
    if (!isSourceEnabled(userId, "epub")) {
      return redirect("/settings");
    }
    
    deleteBook(bookId, userId);
    return redirect("/library");
  }

  return null;
}
