/**
 * HTTP server utilities and helpers
 */
import { DEFAULT_READER_SETTINGS, type ReaderSettings } from "./config";

// ============ Response Helpers ============

/**
 * Create HTML response from JSX element or string
 */
export function html(content: JSX.Element, status: number = 200): Response {
  // JSX.Element is string | Promise<string> in @kitajs/html
  // For our sync components, it's always a string
  return new Response(content as string, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Create JSON response
 */
export function json(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create redirect response
 */
export function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

// ============ Request Helpers ============

/**
 * Parse form data from POST body
 */
export async function parseFormData(req: Request): Promise<Record<string, string>> {
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

/**
 * Parse reader settings from cookie
 */
export function parseReaderSettings(cookieHeader: string | null): ReaderSettings {
  if (!cookieHeader) return DEFAULT_READER_SETTINGS;
  
  const match = cookieHeader.match(/reader_settings=([^;]+)/);
  if (!match) return DEFAULT_READER_SETTINGS;
  
  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded);
    return {
      dark: parsed.dark === true,
      font: typeof parsed.font === "number" ? parsed.font : 18,
    };
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

// ============ Static File Serving ============

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".js": "application/javascript",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/**
 * Serve static files from public directory
 * Returns null if file not found
 */
export async function serveStatic(path: string): Promise<Response | null> {
  // Remove /public prefix if present
  const filePath = path.startsWith("/public/") ? path.slice(7) : path;
  const fullPath = `./public${filePath}`;
  
  const file = Bun.file(fullPath);
  if (!(await file.exists())) {
    return null;
  }

  // Get MIME type
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Long cache for fonts and assets
  const cacheControl = ext === ".ttf" || ext === ".woff" || ext === ".woff2"
    ? "public, max-age=31536000" // 1 year
    : "public, max-age=86400";   // 1 day

  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });
}

// ============ URL Pattern Helpers ============

export const URL_PATTERNS = {
  fiction: /^\/fiction\/(\d+)$/,
  chapter: /^\/chapter\/(\d+)$/,
  chapterApi: /^\/api\/chapter\/(\d+)$/,
  toplist: /^\/toplist\/([\w-]+)$/,
  coverImage: /^\/img\/cover\/(\d+)$/,
  cacheType: /^\/cache\/clear\/(.+)$/,
} as const;

/**
 * Match a URL path against a pattern and return captured groups
 */
export function matchPath(path: string, pattern: RegExp): string[] | null {
  const match = path.match(pattern);
  return match ? match.slice(1) : null;
}
