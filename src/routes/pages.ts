/**
 * Page routes (HTML responses) — Phase 1: unified /read/:source/... (ADR-0002).
 *
 * Every source-specific branch is gone; routes resolve the Source from the
 * registry and gate on its capabilities. Unknown or disabled sources 404.
 */
import { html, parseFormData, redirect } from "../server";
import {
  HomePage,
  SettingsPage,
  FollowsPage,
  HistoryPage,
  ReadLaterPage,
  ToplistsPage,
  ToplistPage,
  FictionPage,
  SearchPage,
  ErrorPage,
  WsTestPage,
  RemotePage,
  SourceHomePage,
} from "../templates";
import { ReaderPage } from "../templates/pages/reader";
import { LibraryPage } from "../templates/pages/library";
import { LibraryUploadPage } from "../templates/pages/library-upload";
import {
  clearCache,
  clearCacheByType,
  clearImageCache,
  clearExpiredCache,
  getCacheStats,
} from "../services/cache";
import {
  getAllSources,
  getSource,
  getSourceByName,
  getEnabledSources,
  getSourceWithCapability,
  getSourcesWithCapability,
  setSourceEnabled,
  type Source,
  type SourceRouteContext,
} from "../services/source-registry";
import type { ReaderSettings } from "../config";
import type { Fiction } from "../types";
import { isValidToken } from "../services/remote";
import {
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
} from "../services/invitations";
import type { Invitation } from "../templates/pages/settings";

// ============ Helpers ============

/** Credential-capable source that has no session yet (drives home/setup UI). */
function needsSession(source: Source, userId: string): boolean {
  return source.capabilities.credentials && !!source.hasSession && !source.hasSession(userId);
}

function notFound(settings: ReaderSettings, message: string): Response {
  return html(ErrorPage({ title: "Not Found", message, settings }), 404);
}

function notConfigured(settings: ReaderSettings, sourceName: string): Response {
  return html(
    ErrorPage({
      title: "Not Configured",
      message: `Please configure your ${sourceName} credentials first.`,
      retryUrl: "/settings",
      settings,
    }),
    404
  );
}

/**
 * Render the settings page with registry-driven props (sources list,
 * enabled state, invitations, cache stats).
 */
function renderSettings(
  req: Request,
  userId: string,
  isAdmin: boolean,
  settings: ReaderSettings,
  extra: {
    message?: string;
    isError?: boolean;
  } = {}
): Response {
  const stats = getCacheStats();
  const invitations: Invitation[] = isAdmin
    ? getPendingInvitations().map((inv) => ({
        id: inv.id,
        email: inv.email,
        token: inv.token,
        expiresAt: inv.expiresAt,
        inviteUrl: `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host") || "localhost:3000"}/invite/${inv.token}`,
      }))
    : [];
  return html(
    SettingsPage({
      ...extra,
      settings,
      stats,
      isAdmin,
      invitations,
      allSources: getAllSources(),
      enabledSources: getEnabledSources(userId),
    })
  );
}

/**
 * Legacy top-level capability pages (/follows, /history, /read-later,
 * /toplists) redirect to the unified /read/:source/... path when exactly one
 * enabled source has the capability; otherwise null (caller renders 404).
 */
function legacyCapabilityRedirect(
  userId: string,
  capability: "follows" | "history" | "readLater" | "toplists",
  subpath: string
): Response | null {
  const sources = getSourcesWithCapability(userId, capability);
  if (sources.length !== 1) return null;
  return redirect(`/read/${sources[0].name}/${subpath}`);
}

// ============ Main handler ============

export async function handlePageRoute(
  req: Request,
  path: string,
  url: URL,
  settings: ReaderSettings,
  userId: string,
  isAdmin: boolean
): Promise<Response | null> {
  const method = req.method;
  const ctx: SourceRouteContext = { req, path, url, settings, userId, isAdmin };

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
      return html(
        ErrorPage({
          title: "Invalid Session",
          message: "This remote control session has expired or is invalid.",
          settings,
        }),
        404
      );
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${host}/ws/remote/${token}?role=controller`;

    return new Response(RemotePage({ token, wsUrl }) as string, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ============ Home ============

  if (path === "/" && method === "GET") {
    const toplistSource = getSourceWithCapability(userId, "toplists");
    const hasSession = !toplistSource || !toplistSource.hasSession || toplistSource.hasSession(userId);

    let risingStars: Fiction[] = [];
    let weeklyPopular: Fiction[] = [];
    if (toplistSource && hasSession && toplistSource.getToplistCached && toplistSource.toplists) {
      const risingStarsToplist = toplistSource.toplists.find((t) => t.slug === "rising-stars");
      const weeklyPopularToplist = toplistSource.toplists.find((t) => t.slug === "weekly-popular");
      // Cache-only to avoid blocking the homepage on slow scraping
      risingStars = (risingStarsToplist ? toplistSource.getToplistCached(risingStarsToplist) : null)?.slice(0, 10) || [];
      weeklyPopular = (weeklyPopularToplist ? toplistSource.getToplistCached(weeklyPopularToplist) : null)?.slice(0, 10) || [];
    }

    const needsSetupSource =
      getSourcesWithCapability(userId, "credentials").find((s) => s.hasSession && !s.hasSession(userId)) || null;

    return html(
      HomePage({
        settings,
        risingStars,
        weeklyPopular,
        toplistSource: hasSession ? toplistSource : null,
        needsSetupSource,
        sources: getEnabledSources(userId),
      })
    );
  }

  // ============ Settings ============

  if (path === "/settings" && method === "GET") {
    return renderSettings(req, userId, isAdmin, settings);
  }

  // Settings - source toggle (any registered source)
  if (path === "/settings/sources" && method === "POST") {
    const form = await parseFormData(req);
    const name = form.source;
    if (name && getSourceByName(name)) {
      setSourceEnabled(userId, name, form.enabled === "1");
    }
    return redirect("/settings");
  }

  // Settings - credentials form (capability-gated, rendered from credentialFields)
  const credentialsMatch = path.match(/^\/settings\/sources\/([\w-]+)\/credentials$/);
  if (credentialsMatch && method === "POST") {
    const source = getSource(userId, credentialsMatch[1]);
    if (!source || !source.capabilities.credentials || !source.saveCredentials) {
      return redirect("/settings");
    }
    const values = await parseFormData(req);
    const result = await source.saveCredentials(userId, values);
    return renderSettings(req, userId, isAdmin, settings, {
      message: result.error || result.warning || "Credentials saved.",
      isError: !!result.error,
    });
  }

  // Settings - clear credentials
  const credentialsClearMatch = path.match(/^\/settings\/sources\/([\w-]+)\/credentials\/clear$/);
  if (credentialsClearMatch && method === "GET") {
    const source = getSource(userId, credentialsClearMatch[1]);
    if (source?.clearCredentials) {
      await source.clearCredentials(userId);
    }
    return redirect("/settings");
  }

  // Settings - auto-login refresh (source.autoLogin)
  const autoLoginMatch = path.match(/^\/settings\/sources\/([\w-]+)\/auto-login$/);
  if (autoLoginMatch && method === "POST") {
    const source = getSource(userId, autoLoginMatch[1]);
    if (!source?.autoLogin?.enabled) {
      return renderSettings(req, userId, isAdmin, settings, {
        message: "Auto-login not configured.",
        isError: true,
      });
    }
    const success = await source.autoLogin.refresh(userId);
    return renderSettings(req, userId, isAdmin, settings, {
      message: success ? "Auto-login successful! Session refreshed." : "Auto-login failed. Check your credentials.",
      isError: !success,
    });
  }

  if (path === "/settings/invitations" && method === "POST") {
    if (!isAdmin) {
      return redirect("/settings");
    }

    const form = await parseFormData(req);
    const email = form.email?.trim();

    if (!email) {
      return renderSettings(req, userId, isAdmin, settings, { message: "Email is required", isError: true });
    }

    createInvitation(email, userId);
    return redirect("/settings");
  }

  const revokeMatch = path.match(/^\/settings\/invitations\/revoke\/([a-f0-9-]+)$/);
  if (revokeMatch && method === "POST") {
    if (!isAdmin) {
      return redirect("/settings");
    }
    revokeInvitation(revokeMatch[1]);
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

    return renderSettings(req, userId, isAdmin, settings, { message });
  }

  // Legacy /setup and /cache redirects
  if (path === "/setup" && method === "GET") {
    return new Response(null, { status: 301, headers: { Location: "/settings" } });
  }
  if (path === "/cache" && method === "GET") {
    return new Response(null, { status: 301, headers: { Location: "/settings" } });
  }

  // ============ Legacy capability pages → unified redirects (ADR-0002) ============

  if (path === "/follows" && method === "GET") {
    const r = legacyCapabilityRedirect(userId, "follows", "follows");
    if (r) return r;
    return notFound(settings, "No enabled source provides follows.");
  }
  if (path === "/history" && method === "GET") {
    const r = legacyCapabilityRedirect(userId, "history", "history");
    if (r) return r;
    return notFound(settings, "No enabled source provides history.");
  }
  if (path === "/read-later" && method === "GET") {
    const r = legacyCapabilityRedirect(userId, "readLater", "read-later");
    if (r) return r;
    return notFound(settings, "No enabled source provides read later.");
  }
  if (path === "/toplists" && method === "GET") {
    const r = legacyCapabilityRedirect(userId, "toplists", "toplists");
    if (r) return r;
    return notFound(settings, "No enabled source provides toplists.");
  }

  // ============ Unified /read/:source/... routes (ADR-0002) ============

  const readMatch = path.match(/^\/read\/([\w-]+)(\/.*)?$/);
  if (!readMatch) return null;
  const sourceName = readMatch[1];
  const rest = readMatch[2] || "";
  const source = getSource(userId, sourceName);
  if (!source) return notFound(settings, `Source "${sourceName}" not found or disabled.`);

  // ---- /read/:source — source home ----
  if (rest === "" && method === "GET") {
    return html(SourceHomePage({ source, settings, sources: getEnabledSources(userId) }));
  }

  // ---- /read/:source/search ----
  if (rest === "/search" && method === "GET") {
    if (!source.capabilities.search || !source.search) {
      return notFound(settings, `${source.displayName} does not support search.`);
    }
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    const query = url.searchParams.get("q")?.trim() || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    if (!query) {
      return html(SearchPage({ source, settings, sources: getEnabledSources(userId) }));
    }

    try {
      const results = await source.search(query, userId);
      return html(SearchPage({ source, query, results, page, settings, sources: getEnabledSources(userId) }));
    } catch (error: any) {
      console.error(`Error searching ${source.name} for "${query}":`, error);
      return html(
        ErrorPage({
          title: "Search Error",
          message: error.message || `Failed to search ${source.displayName}. Try again.`,
          retryUrl: `/read/${source.name}/search`,
          settings,
        })
      );
    }
  }

  // ---- /read/:source/follows ----
  if (rest === "/follows" && method === "GET") {
    if (!source.capabilities.follows || !source.getFollows) {
      return notFound(settings, `${source.displayName} does not provide follows.`);
    }
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const fictions = await source.getFollows(userId);
      return html(FollowsPage({ source, fictions, page, settings, sources: getEnabledSources(userId) }));
    } catch (error: any) {
      console.error(`Error fetching follows for ${source.name}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Follows",
          message: error.message || "Failed to load follows. Try again.",
          retryUrl: `/read/${source.name}/follows`,
          settings,
        })
      );
    }
  }

  // ---- /read/:source/history ----
  if (rest === "/history" && method === "GET") {
    if (!source.capabilities.history || !source.getHistory) {
      return notFound(settings, `${source.displayName} does not provide history.`);
    }
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const history = await source.getHistory(userId);
      return html(HistoryPage({ source, history, page, settings, sources: getEnabledSources(userId) }));
    } catch (error: any) {
      console.error(`Error fetching history for ${source.name}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading History",
          message: error.message || "Failed to load history. Try again.",
          retryUrl: `/read/${source.name}/history`,
          settings,
        })
      );
    }
  }

  // ---- /read/:source/read-later ----
  if (rest === "/read-later" && method === "GET") {
    if (!source.capabilities.readLater || !source.getReadLater) {
      return notFound(settings, `${source.displayName} does not provide read later.`);
    }
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const fictions = await source.getReadLater(userId);
      return html(ReadLaterPage({ source, fictions, page, settings, sources: getEnabledSources(userId) }));
    } catch (error: any) {
      console.error(`Error fetching read later for ${source.name}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Read Later",
          message: error.message || "Failed to load read later list. Try again.",
          retryUrl: `/read/${source.name}/read-later`,
          settings,
        })
      );
    }
  }

  // ---- /read/:source/toplists and /read/:source/toplists/:slug ----
  if (rest === "/toplists" && method === "GET") {
    if (!source.capabilities.toplists || !source.getToplist) {
      return notFound(settings, `${source.displayName} does not provide toplists.`);
    }
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);
    return html(ToplistsPage({ source, settings, sources: getEnabledSources(userId) }));
  }

  const toplistMatch = rest.match(/^\/toplists\/([\w-]+)$/);
  if (toplistMatch && method === "GET") {
    if (!source.capabilities.toplists || !source.getToplist) {
      return notFound(settings, `${source.displayName} does not provide toplists.`);
    }
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    const slug = toplistMatch[1];
    const toplist = (source.toplists || []).find((t) => t.slug === slug);
    if (!toplist) {
      return notFound(settings, `Toplist "${slug}" not found.`);
    }

    try {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const fictions = await source.getToplist(toplist, userId);
      return html(ToplistPage({ source, toplist, fictions, page, settings, sources: getEnabledSources(userId) }));
    } catch (error: any) {
      console.error(`Error fetching toplist ${slug} for ${source.name}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Toplist",
          message: error.message || "Failed to load toplist. Try again.",
          retryUrl: `/read/${source.name}/toplists/${slug}`,
          settings,
        })
      );
    }
  }

  // ---- /read/:source/library ----
  if (rest === "/library" && method === "GET") {
    if (!source.capabilities.library || !source.getLibrary) {
      return notFound(settings, `${source.displayName} does not provide a library.`);
    }
    const entries = await source.getLibrary(userId);
    return html(LibraryPage({ source, entries, settings, sources: getEnabledSources(userId) }));
  }

  // ---- /read/:source/upload (GET form, POST upload) ----
  if (rest === "/upload" && method === "GET") {
    if (!source.canUpload || !source.upload) {
      return notFound(settings, `${source.displayName} does not support uploads.`);
    }
    return html(LibraryUploadPage({ source, settings, sources: getEnabledSources(userId) }));
  }

  if (rest === "/upload" && method === "POST") {
    if (!source.canUpload || !source.upload) {
      return notFound(settings, `${source.displayName} does not support uploads.`);
    }
    try {
      const formData = await req.formData();
      const file = formData.get("epub") as File | null;

      if (!file || file.size === 0) {
        return html(
          LibraryUploadPage({ source, settings, sources: getEnabledSources(userId), message: "Please select a file.", isError: true })
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await source.upload(userId, buffer, file.name);

      if (!result.success) {
        return html(LibraryUploadPage({ source, settings, sources: getEnabledSources(userId), message: result.error, isError: true }));
      }

      return redirect(`/read/${source.name}/library`);
    } catch (error: any) {
      console.error(`Error uploading to ${source.name}:`, error);
      return html(
        LibraryUploadPage({ source, settings, sources: getEnabledSources(userId), message: "Failed to upload file. Please try again.", isError: true })
      );
    }
  }

  // ---- /read/:source/:fictionRef/bookmark (POST) ----
  const bookmarkMatch = rest.match(/^\/([^/]+)\/bookmark$/);
  if (bookmarkMatch && method === "POST") {
    const fictionRef = bookmarkMatch[1];
    if (!source.capabilities.bookmarks || !source.setBookmark) {
      return notFound(settings, `${source.displayName} does not support bookmarks.`);
    }
    if (needsSession(source, userId)) {
      return redirect(`/read/${source.name}/${fictionRef}?error=${encodeURIComponent("Not logged in")}`);
    }

    try {
      const formData = await parseFormData(req);
      const type = formData.type;
      const mark = formData.mark === "true";
      const csrfToken = formData.csrf;

      if (!type || !csrfToken) {
        return redirect(`/read/${source.name}/${fictionRef}?error=${encodeURIComponent("Invalid request")}`);
      }

      const result = await source.setBookmark(userId, fictionRef, type, mark, csrfToken);
      if (result.success) {
        return redirect(`/read/${source.name}/${fictionRef}`);
      }
      return redirect(`/read/${source.name}/${fictionRef}?error=${encodeURIComponent(result.error || "Action failed")}`);
    } catch (error: any) {
      console.error(`Error setting bookmark for ${source.name}/${fictionRef}:`, error);
      return redirect(`/read/${source.name}/${fictionRef}?error=${encodeURIComponent("Something went wrong")}`);
    }
  }

  // ---- /read/:source/:fictionRef/library (POST) ----
  const libraryActionMatch = rest.match(/^\/([^/]+)\/library$/);
  if (libraryActionMatch && method === "POST") {
    const fictionRef = libraryActionMatch[1];
    if (!source.capabilities.library || !source.addToLibrary || !source.removeFromLibrary) {
      return notFound(settings, `${source.displayName} does not support a library.`);
    }

    const form = await parseFormData(req);
    if (form.action === "remove") {
      source.removeFromLibrary(userId, fictionRef);
    } else {
      await source.addToLibrary(userId, fictionRef);
    }
    return redirect(`/read/${source.name}/${fictionRef}`);
  }

  // ---- /read/:source/:fictionRef — fiction detail ----
  const fictionMatch = rest.match(/^\/([^/]+)$/);
  if (fictionMatch && method === "GET") {
    const fictionRef = fictionMatch[1];
    if (!source.getFiction) return notFound(settings, `${source.displayName} has no fiction pages.`);
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const error = url.searchParams.get("error") || undefined;
    const from = url.searchParams.get("from") || undefined;

    try {
      const fiction = await source.getFiction(fictionRef, userId);
      if (!fiction) {
        return notFound(settings, `Fiction "${fictionRef}" not found.`);
      }
      return html(
        FictionPage({
          fiction,
          source,
          chapterPage: page,
          settings,
          error,
          sources: getEnabledSources(userId),
          from,
        })
      );
    } catch (error: any) {
      console.error(`Error fetching fiction ${source.name}/${fictionRef}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Fiction",
          message: error.message || "Failed to load fiction. Try again.",
          retryUrl: `/read/${source.name}/${fictionRef}`,
          settings,
        })
      );
    }
  }

  // ---- /read/:source/:fictionRef/:chapterRef — reader ----
  const chapterMatch = rest.match(/^\/([^/]+)\/([^/]+)$/);
  if (chapterMatch && method === "GET") {
    const fictionRef = chapterMatch[1];
    const chapterRef = chapterMatch[2];
    if (!source.getChapter) return notFound(settings, `${source.displayName} has no chapter pages.`);
    if (needsSession(source, userId)) return notConfigured(settings, source.displayName);

    const initialPage = Math.max(1, parseInt(url.searchParams.get("p") || "1", 10));

    try {
      const chapter = await source.getChapter(fictionRef, chapterRef, userId);
      if (!chapter) {
        return notFound(settings, `Chapter "${chapterRef}" not found.`);
      }
      return html(
        ReaderPage({
          chapter,
          source,
          fictionRef,
          settings,
          initialPage,
          trackProgress: !!source.updateProgress,
        })
      );
    } catch (error: any) {
      console.error(`Error fetching chapter ${source.name}/${fictionRef}/${chapterRef}:`, error);
      return html(
        ErrorPage({
          title: "Error Loading Chapter",
          message: error.message || "Failed to load chapter. Try again.",
          retryUrl: `/read/${source.name}/${fictionRef}/${chapterRef}`,
          settings,
        })
      );
    }
  }

  return null;
}
