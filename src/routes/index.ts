/**
 * Routes index - main request router
 */
import { html, serveStatic, parseReaderSettings, redirect } from "../server";
import { handlePageRoute } from "./pages";
import { handleApiRoute } from "./api";
import { ErrorPage, LoginPage } from "../templates";
import { auth, getSession, AUTH_ENABLED } from "../lib/auth";

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/health",
  "/login",
  "/api/auth",
  "/public",
  "/fonts",
];

/**
 * Check if a path is public (doesn't require auth)
 */
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Main request handler
 */
export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Health check endpoint (always public)
  if (path === "/health") {
    return new Response("OK", { status: 200 });
  }

  // Handle Better Auth routes
  if (path.startsWith("/api/auth")) {
    return auth.handler(req);
  }

  // Handle login page
  if (path === "/login") {
    if (method === "GET") {
      const settings = parseReaderSettings(req.headers.get("cookie"));
      const error = url.searchParams.get("error");
      return html(LoginPage({ settings, error: error || undefined }));
    }
    
    if (method === "POST") {
      return handleLoginPost(req);
    }
  }

  // Handle logout
  if (path === "/logout" && method === "POST") {
    return handleLogout(req);
  }

  // Handle theme toggle
  if (path === "/settings/theme" && method === "POST") {
    return handleThemeToggle(req);
  }

  // Check session for protected routes
  if (AUTH_ENABLED && !isPublicPath(path)) {
    const session = await getSession(req);
    if (!session) {
      return redirect("/login");
    }
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

/**
 * Handle login form POST
 * Since Kindle doesn't support JS, we handle form submission server-side
 */
async function handleLoginPost(req: Request): Promise<Response> {
  const formData = await req.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return redirect("/login?error=Username and password are required");
  }

  try {
    // Use Better Auth's sign-in endpoint with returnHeaders to get cookies
    const { headers: authHeaders, response: authResponse } = await auth.api.signInUsername({
      body: {
        username,
        password,
      },
      headers: req.headers,
      returnHeaders: true,
    });

    if (authResponse?.token) {
      // Create response with session cookie from Better Auth
      const redirectResponse = redirect("/");
      
      // Forward the set-cookie header from Better Auth
      const setCookie = authHeaders.get("set-cookie");
      if (setCookie) {
        redirectResponse.headers.set("Set-Cookie", setCookie);
      }
      
      return redirectResponse;
    }

    return redirect("/login?error=Invalid credentials");
  } catch (error: any) {
    console.error("Login error:", error);
    const message = error?.message || "Login failed";
    return redirect(`/login?error=${encodeURIComponent(message)}`);
  }
}

/**
 * Handle logout POST
 */
async function handleLogout(req: Request): Promise<Response> {
  try {
    // Call Better Auth's sign-out endpoint
    await auth.api.signOut({
      headers: req.headers,
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  // Clear the session cookie and redirect to login
  const response = redirect("/login");
  response.headers.set(
    "Set-Cookie",
    "better-auth.session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
  return response;
}

/**
 * Handle theme toggle POST
 */
async function handleThemeToggle(req: Request): Promise<Response> {
  const formData = await req.formData();
  const dark = formData.get("dark") === "1";
  
  const currentSettings = parseReaderSettings(req.headers.get("cookie"));
  const newSettings = { ...currentSettings, dark };
  
  const response = redirect("/settings");
  response.headers.set(
    "Set-Cookie",
    `reader_settings=${encodeURIComponent(JSON.stringify(newSettings))}; Path=/; SameSite=Lax; Max-Age=31536000`
  );
  return response;
}
