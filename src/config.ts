/**
 * Application configuration
 * Environment variables take precedence over defaults
 */

// Server configuration
export const PORT = parseInt(process.env.PORT || "3000", 10);

// Authentication (for production deployment)
export const AUTH_USERNAME = process.env.AUTH_USERNAME || "";
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
export const AUTH_ENABLED = !!(AUTH_USERNAME && AUTH_PASSWORD);

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

// Scraper timeouts (longer in production for low-RAM environments)
export const SCRAPER_TIMEOUT = process.env.NODE_ENV === "production" ? 60000 : 30000;
export const SCRAPER_SELECTOR_TIMEOUT = process.env.NODE_ENV === "production" ? 20000 : 10000;

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

// Navigation links
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/follows", label: "Follows" },
  { href: "/history", label: "History" },
  { href: "/toplists", label: "Top Lists" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
] as const;
