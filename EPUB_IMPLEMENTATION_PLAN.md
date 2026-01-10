# EPUB Support Implementation Plan

## Overview

Add EPUB file support to Tome as an optional reading source alongside Royal Road. Users can upload EPUB files, view them in a Kindle-style cover grid library, and read them using epub.js with server-synced progress.

**Decisions Made:**
- Cover images: Preserve original format (PNG/JPEG)
- Library sorting: Last read (most recent first)
- Book deletion: Show confirmation dialog
- Progress display: Percentage in library grid

---

## Phase 1: Database & Core Infrastructure

### Task 1.1: Database Migrations
**File:** `src/lib/migrate.ts`

Add three new tables:

```sql
-- Track which sources each user has enabled
CREATE TABLE IF NOT EXISTS "user_sources" (
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,  -- 'royalroad', 'epub'
  "enabled" INTEGER DEFAULT 0,
  PRIMARY KEY ("userId", "source"),
  FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

-- Deduplicated EPUB file storage (content-addressable)
CREATE TABLE IF NOT EXISTS "epub_files" (
  "hash" TEXT PRIMARY KEY,           -- SHA-256 of file content
  "size" INTEGER NOT NULL,
  "uploadedAt" INTEGER NOT NULL,
  "refCount" INTEGER DEFAULT 1       -- decremented on delete, file removed when 0
);

-- User's EPUB library (many-to-one with epub_files via hash)
CREATE TABLE IF NOT EXISTS "epub_books" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,          -- references epub_files.hash
  "title" TEXT NOT NULL,
  "author" TEXT,
  "coverPath" TEXT,                  -- path to extracted cover image
  "cfi" TEXT,                        -- epub.js reading position (CFI string)
  "progress" INTEGER DEFAULT 0,      -- percentage for display (0-100)
  "addedAt" INTEGER NOT NULL,
  "lastReadAt" INTEGER,
  FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("fileHash") REFERENCES "epub_files" ("hash")
);

-- Index for efficient library queries
CREATE INDEX IF NOT EXISTS "idx_epub_books_user" ON "epub_books" ("userId", "lastReadAt" DESC);
```

**Migration logic:**
- Auto-enable Royal Road for users who already have RR credentials

---

### Task 1.2: Sources Service
**File:** `src/services/sources.ts` (NEW)

```typescript
export type SourceType = 'royalroad' | 'epub';

export interface UserSource {
  source: SourceType;
  enabled: boolean;
}

// Get all sources and their enabled state for a user
export function getUserSources(userId: string): UserSource[];

// Enable or disable a specific source for a user
export function setSourceEnabled(userId: string, source: SourceType, enabled: boolean): void;

// Check if a specific source is enabled for a user
export function isSourceEnabled(userId: string, source: SourceType): boolean;

// Get list of enabled sources for a user
export function getEnabledSources(userId: string): SourceType[];
```

---

### Task 1.3: Dynamic Navigation
**File:** `src/config.ts` + `src/templates/components.tsx`

Update navigation to be dynamically generated based on enabled sources:

```typescript
// config.ts - Define all possible nav items with source requirements
export const ALL_NAV_LINKS = [
  { href: "/", label: "Home", source: null },           // Always shown
  { href: "/library", label: "Library", source: "epub" },
  { href: "/follows", label: "Follows", source: "royalroad" },
  { href: "/history", label: "History", source: "royalroad" },
  { href: "/toplists", label: "Top Lists", source: "royalroad" },
  { href: "/search", label: "Search", source: "royalroad" },
  { href: "/settings", label: "Settings", source: null }, // Always shown
] as const;
```

**Layout changes:**
- `Layout` component receives `enabledSources` prop
- `Header` filters nav links based on enabled sources

---

## Phase 2: Settings UI Updates

### Task 2.1: Source Toggles in Settings
**File:** `src/templates/pages/settings.tsx`

Add new "Reading Sources" section at the top with toggles for:
- Royal Road (with description)
- EPUB Library (with description)

Only show "Royal Road Session" cookies section if Royal Road is enabled.

---

### Task 2.2: Source Toggle Routes
**File:** `src/routes/pages.ts`

```typescript
// POST /settings/sources/:source
```

---

## Phase 3: EPUB Service

### Task 3.1: EPUB Processing Service
**File:** `src/services/epub.ts` (NEW)

```typescript
export interface EpubBook {
  id: string;
  userId: string;
  fileHash: string;
  title: string;
  author: string | null;
  coverPath: string | null;
  cfi: string | null;
  progress: number;
  addedAt: number;
  lastReadAt: number | null;
}

// Upload and process an EPUB file
export async function uploadEpub(userId: string, fileBuffer: Buffer, originalFilename: string): Promise<Result>;

// Get user's library (sorted by lastReadAt DESC)
export function getUserLibrary(userId: string): EpubBook[];

// Get single book
export function getBook(bookId: string, userId: string): EpubBook | null;

// Update reading progress
export function updateProgress(bookId: string, userId: string, cfi: string, progress: number): void;

// Delete book from user's library (with ref count handling)
export function deleteBook(bookId: string, userId: string): boolean;

// Get file path for streaming
export function getEpubFilePath(fileHash: string): string | null;
```

**Implementation details:**
1. Hash calculation: SHA-256 of entire file content
2. Deduplication: Check `epub_files` for existing hash before writing file
3. Metadata extraction: Use JSZip to read `META-INF/container.xml` → find OPF → parse metadata
4. Cover extraction: Find cover image in OPF manifest, extract and save (preserve original format)
5. Reference counting: Increment `refCount` when same hash uploaded, decrement on delete, remove file when 0

**File Storage:**
```
data/
├── sessions.db
├── epubs/
│   └── {sha256-hash}.epub
└── covers/
    └── {book-id}.{jpg|png}
```

**Dependencies:**
```bash
bun add jszip
```

---

## Phase 4: Library UI

### Task 4.1: Library Page
**File:** `src/templates/pages/library.tsx` (NEW)

Kindle-style cover grid with:
- Upload button at top
- Flexbox grid with inline-block fallback for old Kindles
- Book cards showing: cover, title, author, progress bar

---

### Task 4.2: Library CSS
**File:** `public/css/base.css` (additions)

```css
.book-grid { /* flexbox with inline-block fallback */ }
.book-card { /* 120px wide cards */ }
.book-cover { /* 120x180px covers */ }
.book-progress { /* progress bar */ }
```

---

### Task 4.3: Upload Page
**File:** `src/templates/pages/library-upload.tsx` (NEW)

Simple form with file input, 50MB limit note, upload/cancel buttons.

---

## Phase 5: EPUB Reader

### Task 5.1: Reader Page Template
**File:** `src/templates/pages/epub-reader.tsx` (NEW)

Structure:
- Header: back button, title, progress percentage
- Reader container for epub.js
- Bottom nav: prev/next buttons

CDN dependencies:
- JSZip 3.10.1
- epub.js 0.3.93

---

### Task 5.2: EPUB Reader CSS
**File:** `public/css/epub-reader.css` (NEW)

E-ink optimized styles with dark mode support.

---

### Task 5.3: EPUB Reader JavaScript
**File:** `public/js/epub-reader.js` (NEW)

ES5 compatible for Kindle browser:
- Initialize epub.js with paginated flow
- Restore position from CFI
- Navigation: buttons, keyboard (PageUp/PageDown), tap zones
- Progress tracking with 2-second debounced save
- Dark mode theme application

---

## Phase 6: Routes

### Task 6.1: Library Page Routes
**File:** `src/routes/pages.ts`

- `GET /library` - Library grid
- `GET /library/upload` - Upload form
- `POST /library/upload` - Handle upload
- `GET /epub/:id` - Reader page
- `GET /epub/:id/download` - Download file
- `POST /epub/:id/delete` - Delete book (after confirmation)

---

### Task 6.2: API Routes
**File:** `src/routes/api.ts`

- `GET /api/epub/:id/file` - Stream EPUB to epub.js
- `POST /api/epub/:id/progress` - Save reading position
- `GET /covers/:id` - Serve cover images

---

## Phase 7: Home Page & Polish

### Task 7.1: Adaptive Home Page
**File:** `src/templates/pages/home.tsx`

Show content based on enabled sources:
- No sources: Welcome message pointing to Settings
- EPUB enabled: "Continue Reading" section with recent books
- Royal Road enabled: Existing toplist sections

---

### Task 7.2: Version Bump & Exports
- `src/config.ts`: APP_VERSION = "1.3.0"
- `src/templates/index.ts`: Export new page components

---

## Implementation Checklist

### Phase 1: Database & Core Infrastructure
- [ ] 1.1 Add database migrations for user_sources, epub_files, epub_books
- [ ] 1.2 Create src/services/sources.ts
- [ ] 1.3 Update config.ts with ALL_NAV_LINKS
- [ ] 1.3 Update components.tsx Header to filter by enabled sources
- [ ] 1.3 Update layout.tsx to pass enabledSources

### Phase 2: Settings UI
- [ ] 2.1 Add Reading Sources section to settings.tsx
- [ ] 2.2 Add source toggle routes to pages.ts

### Phase 3: EPUB Service
- [ ] 3.1 Add jszip dependency
- [ ] 3.1 Create src/services/epub.ts with all functions
- [ ] 3.1 Ensure data/epubs and data/covers directories created

### Phase 4: Library UI
- [ ] 4.1 Create src/templates/pages/library.tsx
- [ ] 4.2 Add book-grid CSS to public/css/base.css
- [ ] 4.3 Create src/templates/pages/library-upload.tsx

### Phase 5: EPUB Reader
- [ ] 5.1 Create src/templates/pages/epub-reader.tsx
- [ ] 5.2 Create public/css/epub-reader.css
- [ ] 5.3 Create public/js/epub-reader.js

### Phase 6: Routes
- [ ] 6.1 Add library routes to pages.ts
- [ ] 6.2 Add API routes to api.ts
- [ ] 6.2 Add cover serving route

### Phase 7: Polish
- [ ] 7.1 Update home.tsx for adaptive content
- [ ] 7.2 Update templates/index.ts exports
- [ ] 7.2 Bump APP_VERSION to 1.3.0

### Final
- [ ] Run TypeScript check (npx tsc --noEmit)
- [ ] Test upload flow
- [ ] Test reader with progress sync
- [ ] Test deduplication
- [ ] Test deletion with ref count

---

## New Files Summary

```
src/services/sources.ts
src/services/epub.ts
src/templates/pages/library.tsx
src/templates/pages/library-upload.tsx
src/templates/pages/epub-reader.tsx
public/css/epub-reader.css
public/js/epub-reader.js
```

## Modified Files Summary

```
src/lib/migrate.ts
src/config.ts
src/templates/components.tsx
src/templates/layout.tsx
src/templates/pages/settings.tsx
src/templates/pages/home.tsx
src/templates/index.ts
src/routes/pages.ts
src/routes/api.ts
public/css/base.css
package.json (jszip dependency)
```
