/**
 * Application configuration
 * Environment variables take precedence over defaults
 */

// Server configuration
export const PORT = parseInt(process.env.PORT || "3000", 10);

// Browser/Playwright (disabled by default for smaller image, set ENABLE_BROWSER=true to enable)
export const ENABLE_BROWSER = process.env.ENABLE_BROWSER === "true";

// Authentication (for production deployment)
export const AUTH_USERNAME = process.env.AUTH_USERNAME || "";
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
export const AUTH_ENABLED = !!(AUTH_USERNAME && AUTH_PASSWORD);
export const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "";

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  DEFAULT: 5 * 60,               // 5 minutes (generic cache)
  FOLLOWS: 20 * 60,              // 20 minutes
  TOPLIST: 6 * 60 * 60,          // 6 hours
  FICTION: 60 * 60,              // 1 hour
  CHAPTER: 30 * 24 * 60 * 60,    // 30 days
  IMAGE: 30 * 24 * 60 * 60,      // 30 days
} as const;

// Pagination
export const ITEMS_PER_PAGE = 10;
export const CHAPTERS_PER_PAGE = 20;

// Database
export const DB_PATH = "./data/sessions.db";

// Royal Road
export const ROYAL_ROAD_BASE_URL = "https://www.royalroad.com";

// Scraper timeouts (hardcoded for reliability - NODE_ENV might not be set)
export const SCRAPER_TIMEOUT = 60000;  // 60 seconds for navigation
export const SCRAPER_SELECTOR_TIMEOUT = 20000;  // 20 seconds for selectors

// Toplists configuration
export interface ToplistType {
  slug: string;
  name: string;
  url: string;
}

export const TOPLISTS: ToplistType[] = [
  { slug: 'rising-stars', name: 'Rising Stars', url: `${ROYAL_ROAD_BASE_URL}/fictions/rising-stars` },
  { slug: 'best-rated', name: 'Best Rated', url: `${ROYAL_ROAD_BASE_URL}/fictions/best-rated` },
  { slug: 'weekly-popular', name: 'Weekly Popular', url: `${ROYAL_ROAD_BASE_URL}/fictions/weekly-popular` },
  { slug: 'active-popular', name: 'Active Popular', url: `${ROYAL_ROAD_BASE_URL}/fictions/active-popular` },
];

// Reader settings
export interface ReaderSettings {
  dark: boolean;
  font: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  dark: false,
  font: 18,
};

// source: null = always shown, "royalroad"/"epub" = only if that source is enabled
export const ALL_NAV_LINKS = [
  { href: "/", label: "Home", source: null },
  { href: "/library", label: "Library", source: "epub" as const },
  { href: "/follows", label: "Follows", source: "royalroad" as const },
  { href: "/history", label: "History", source: "royalroad" as const },
  { href: "/toplists", label: "Top Lists", source: "royalroad" as const },
  { href: "/search", label: "Search", source: "royalroad" as const },
  { href: "/settings", label: "Settings", source: null },
] as const;

export const NAV_LINKS = ALL_NAV_LINKS;

// App version for cache busting
export const APP_VERSION = "1.3.1";
