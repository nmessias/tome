// TypeScript interfaces for the E-ink-Road Proxy

export interface Cookie {
  id?: number;
  name: string;
  value: string;
  updated_at?: number;
}

export interface CacheEntry {
  url: string;
  content: string;
  expires_at: number;
}

export interface Fiction {
  id: number;
  title: string;
  author: string;
  url: string;
  coverUrl?: string;
  description?: string;
  stats?: FictionStats;
  chapters?: Chapter[];
  continueChapterId?: number; // Next chapter to read (from RR progress)
}

export interface FictionStats {
  pages?: number;
  followers?: number;
  favorites?: number;
  views?: number;
  rating?: number;
}

export interface Chapter {
  id: number;
  title: string;
  url: string;
  date?: string;
  order?: number;
}

export interface ChapterContent {
  id: number;
  fictionId: number;
  title: string;
  content: string;
  prevChapterUrl?: string;
  nextChapterUrl?: string;
  fictionTitle?: string;
  fictionUrl?: string;
}

export interface FollowedFiction extends Fiction {
  latestChapter?: string;
  latestChapterId?: number;
  lastRead?: string;
  lastReadChapterId?: number;
  hasUnread?: boolean;
  nextChapterId?: number; // Next chapter to read (after lastRead, or first chapter)
  nextChapterTitle?: string;
}

export interface HistoryEntry {
  fictionId: number;
  fictionTitle: string;
  chapterId: number;
  chapterTitle: string;
  readAt: string;
}

export interface ToplistType {
  slug: string;
  name: string;
  url: string;
}

export const TOPLISTS: ToplistType[] = [
  { slug: 'rising-stars', name: 'Rising Stars', url: 'https://www.royalroad.com/fictions/rising-stars' },
  { slug: 'best-rated', name: 'Best Rated', url: 'https://www.royalroad.com/fictions/best-rated' },
  { slug: 'weekly-popular', name: 'Weekly Popular', url: 'https://www.royalroad.com/fictions/weekly-popular' },
  { slug: 'active-popular', name: 'Active Popular', url: 'https://www.royalroad.com/fictions/active-popular' },
];
