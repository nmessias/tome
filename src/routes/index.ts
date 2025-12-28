/**
 * Routes index - main request router
 */
import { html, serveStatic, parseReaderSettings, checkBasicAuth, unauthorized } from "../server";
import { handlePageRoute } from "./pages";
import { handleApiRoute } from "./api";
import { ErrorPage } from "../templates";

/**
 * Main request handler
 */
export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Health check endpoint (unauthenticated for Railway)
  if (path === "/health") {
    return new Response("OK", { status: 200 });
  }

  // Check Basic Auth for all other routes
  if (!checkBasicAuth(req)) {
    return unauthorized();
  }

  const settings = parseReaderSettings(req.headers.get("cookie"));

  console.log(`${method} ${path}`);

  try {
    // Serve static files from /public/*
    if (path.startsWith("/public/") && (method === "GET" || method === "HEAD")) {
      const response = await serveStatic(path);
      if (response) return response;
      return new Response("Not found", { status: 404 });
    }

    // Legacy font path support (redirect /fonts/* to /public/fonts/*)
    if (path.startsWith("/fonts/") && (method === "GET" || method === "HEAD")) {
      const fontFile = path.replace("/fonts/", "");
      const response = await serveStatic(`/fonts/${fontFile}`);
      if (response) return response;
      return new Response("Font not found", { status: 404 });
    }

    // Try API routes
    const apiResponse = await handleApiRoute(req, path);
    if (apiResponse) return apiResponse;

    // Try page routes
    const pageResponse = await handlePageRoute(req, path, url, settings);
    if (pageResponse) return pageResponse;

    // 404
    return html(
      ErrorPage({ title: "Not Found", message: "The page you're looking for doesn't exist.", settings }),
      404
    );
  } catch (error: any) {
    console.error("Unhandled error:", error);
    return html(
      ErrorPage({ title: "Server Error", message: "An unexpected error occurred. Please try again.", retryUrl: "/", settings }),
      500
    );
  }
}
