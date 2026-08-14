// TypeScript interfaces for Tome

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
  slug?: string;       // String-based ID for sources like FreeWebNovel
  title: string;
  author: string;
  url: string;
  coverUrl?: string;
  description?: string;
  tags?: string[];  // Genre tags like ["LitRPG", "Fantasy", "Progression"]
  stats?: FictionStats;
  chapters?: Chapter[];
  continueChapterId?: number; // Next chapter to read (from RR progress)
  continueChapterSlug?: string; // Next chapter slug (for FWN progress)
  continueChapterLabel?: string; // Short label shown next to Continue (e.g. "Ch. 42")
  // Bookmark state (from Royal Road)
  isFollowing?: boolean;
  isFavorite?: boolean;
  isReadLater?: boolean;
  isInLibrary?: boolean; // Whether fiction is in local library (FWN)
  csrfToken?: string;  // Required for bookmark actions
}

export interface FictionStats {
  // Ratings (out of 5)
  rating?: number;        // Overall score
  styleScore?: number;
  storyScore?: number;
  grammarScore?: number;
  characterScore?: number;
  // Counts
  pages?: number;
  followers?: number;
  favorites?: number;
  views?: number;
  averageViews?: number;
  ratings?: number;       // Number of ratings
}

export interface Chapter {
  id: number;
  slug?: string;     // String-based chapter identifier (e.g., "chapter-1")
  title: string;
  url: string;
  date?: string;
  order?: number;
  isRead?: boolean;  // true if chapter has been read
}

export interface ChapterContent {
  id: number;
  fictionId: number;
  fictionSlug?: string;    // Fiction slug for FWN navigation
  chapterSlug?: string;    // Chapter slug (e.g., "chapter-1") for FWN
  title: string;
  content: string;
  prevChapterUrl?: string;
  nextChapterUrl?: string;
  fictionTitle?: string;
  fictionUrl?: string;
  // Unified-reader fields (set by Source adapters)
  ref?: string;            // chapter ref as it appears in URLs
  fictionRef?: string;     // fiction ref as it appears in URLs
  prevRef?: string | null; // previous chapter ref (null = none)
  nextRef?: string | null; // next chapter ref (null = none)
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

// Reader settings stored in cookie
export interface ReaderSettings {
  dark: boolean;  // dark mode enabled
  font: number;   // font size in pixels
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  dark: false,
  font: 18
};

// Unified library entry (normalized across sources; see Source.getLibrary)
export interface LibraryEntry {
  ref: string;
  kind?: "series" | "book";
  title: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  totalChapters?: number;
  lastChapterRead?: number;
  progress?: number;
  continueChapterRef?: string;
  completed?: boolean;
}
