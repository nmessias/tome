# Tome Reading App - Comprehensive Analysis

## 1. FEATURES CURRENTLY IMPLEMENTED

### Core Reading Features
- **Chapter Reader (Royal Road)** - Paginated, SPA-style navigation with click zones for e-ink devices
- **EPUB Reader** - Full EPUB3 support with built-in progress tracking and IndexedDB caching
- **FreeWebNovel Reader** - Separate reader for Chinese/Asian web novels
- **Paginated Display** - Mobile/e-ink optimized with tap zones and click zones instead of scrolling
- **Three Reading Sources**:
  - Royal Road (web fiction platform)
  - EPUB (personal library uploads)
  - FreeWebNovel (Asian novels)

### Library & Organization
- **Reading Library** - EPUB upload and management with progress tracking
- **Follows/Watchlist** - Syncs with Royal Road account (requires cookies)
- **Reading History** - Tracks read chapters from Royal Road
- **FWN Personal Library** - Local tracking of FreeWebNovel novels with progress

### Navigation Features
- **Home Page** - Shows trending content (Rising Stars, Weekly Popular)
- **Top Lists** - Rising Stars, Best Rated, Weekly Popular, Active Popular
- **Search** - Search Royal Road and FreeWebNovel
- **Bookmarks** - Follow, Favorite, and Read Later buttons on Royal Road fictions

### Reader Settings & Display
- **Font Sizes** - 8 levels: 14px to 32px
- **Line Spacing** - 6 levels: 1.2 to 2.4
- **Theme Support** - Light, Dark, Sepia (Sepia hidden on Kindle)
- **Reading Width** - 11 options: 480px to 1200px
- **Settings Modal** - Persistent settings saved to cookies
- **Device Detection** - Kindle-specific optimizations (pure black/white)

### Offline & Caching
- **Server-side Cache** - SQLite-based with aggressive caching:
  - 5 min generic cache
  - 20 min follows cache
  - 6 hour toplist cache
  - 1 hour fiction cache
  - 30 day chapter/image cache
- **Client-side Storage**:
  - localStorage for reader settings
  - sessionStorage for remote control tokens
  - IndexedDB for EPUB file caching
- **Background Jobs** - Pre-caches follows and next chapters

### User Accounts & Sync
- **Session Cookies** - Syncs reading progress with Royal Road
- **Basic Auth** - Optional username/password protection
- **Multi-user Support** - Per-user cookies and cache
- **Invitations** - Admin can generate invitation links with QR codes

---

## 2. READER.JS KEYBOARD SHORTCUTS & handleKeyboard Function

Located in: `/home/nmessias/kindle-royal-proxy/public/js/reader.js` (lines 545-604)

### Desktop Mode Shortcuts (width >= 768px)
| Key | Action |
|-----|--------|
| ArrowLeft | Go to previous chapter |
| ArrowRight | Go to next chapter |
| ArrowUp | Scroll up 60px |
| ArrowDown | Scroll down 60px |
| Space / PageDown | Scroll down 85% of viewport |
| PageUp | Scroll up 85% of viewport |
| Home | Jump to top of page |
| End | Jump to end of page |

### Mobile/E-ink Mode Shortcuts (width < 768px)
| Key | Action |
|-----|--------|
| ArrowLeft / ArrowUp | Previous page |
| ArrowRight / ArrowDown / Space | Next page |

### Other Shortcuts
- **UI Toggle**: Tap top/bottom zones to show/hide header/footer
- **Click Zones**: Left 40% = prev page, Right 40% = next page
- **Settings**: Click "Aa" button to open settings modal

**Implementation Notes:**
- ES5 compatible (no arrow functions for Kindle compatibility)
- Ignores input when settings modal is open
- Ignores input from INPUT/TEXTAREA fields
- Handles both desktop scroll and mobile pagination

---

## 3. SETTINGS PAGE FEATURES

Location: `/home/nmessias/kindle-royal-proxy/src/templates/pages/settings.tsx`

### Reading Sources
- **Royal Road** - Enable/disable web fiction source
- **EPUB Library** - Enable/disable personal book uploads
- **FreeWebNovel** - Enable/disable Asian novel source

### Display Settings
- **Dark Mode Toggle** (Kindle only) - Binary on/off
- **Theme Selection** (Desktop) - Light, Dark, Sepia options
- **Visual Indication** - Active theme is highlighted

### Royal Road Session
- **Cookie Management** - Paste `.AspNetCore.Identity.Application` cookie
- **Optional Cloudflare** - `cf_clearance` cookie for blocking bypass
- **Clear Cookies** - Permanently remove stored credentials

### Cache Management
- **Cache Stats** - Shows total entries, images, breakdown by type
- **Granular Clearing** - Clear by type, clear expired, clear all images, clear all
- **Size Display** - Shows cache size in human-readable format (formatBytes)

### Account Management
- **Logout** - If AUTH_ENABLED (requires username/password)
- **Admin Invitations** - Create and manage user invitations with QR codes

---

## 4. EPUB READER DIFFERENCES FROM CHAPTER READER

### EPUB Reader (`epub-reader.js`)
- **Technology**: EPUB.js library (v0.3.93 + JSZip)
- **Rendering**: Div-based rendition with continuous pagination
- **Progress Tracking**: CFI (EPUB Canonical Fragment Identifier) based
- **Storage**: IndexedDB for offline caching of full EPUB files
- **Styling Injection**: Custom fonts (Literata) injected into book content
- **Responsiveness**: Window resize handler triggers rendition resize
- **Features**:
  - Progress percentage display
  - Page indicator (current page / total pages)
  - Line height adjustment (5 levels: 1.4 to 2.2)
  - Scheduled progress saves (2s debounce)
  - Delete confirmation modal with cache cleanup
  - Browser unload handler to save progress

### Chapter Reader (`reader.js`)
- **Technology**: Raw HTML column layout with horizontal scrolling
- **Rendering**: Paginated via CSS columns + JavaScript scroll calculation
- **Progress Tracking**: Simple page number + chapter ID
- **Storage**: Cookie-based settings only
- **Styling**: Direct CSS manipulation
- **Responsiveness**: Manual resize handler recalculates pages
- **E-ink Optimization**: 
  - Flash screen black/white to clear ghosting
  - 100ms stabilization delay before rendering
- **Features**:
  - Touch zones (top/bottom) to toggle UI
  - Click zones (left/right) for navigation
  - Keyboard navigation with fallback for older devices
  - FWN auto-progress on page load
  - Chapter preloading for fast SPA navigation

### Key Differences Summary
| Aspect | EPUB | Chapter |
|--------|------|---------|
| **Caching** | Full file (IndexedDB) | HTML only (CFI-based) |
| **Progress** | Percentage + CFI | Page number + chapter |
| **Styling** | Injected via hooks | Direct CSS |
| **Line Height** | 5 levels | 6 levels |
| **E-ink Refresh** | None | Screen flash + 100ms delay |
| **Delete Support** | Yes, with cleanup | No |

---

## 5. TODO COMMENTS & KNOWN LIMITATIONS

**Search Results:** No explicit TODO comments found in source code.

### Known Limitations Inferred from Code:
1. **FWN Progress Tracking** - Requires workaround on Kindle (FWN chapter navigation fallback at lines 842-856 in reader.js)
2. **Desktop Mode Detection** - Simple viewport width check (768px threshold)
3. **No Keyboard Shortcuts** - EPUB reader lacks keyboard navigation (uses only touch/click)
4. **Limited Accessibility** - No ARIA labels or semantic navigation elements
5. **No Skip-to-Content** - No ability to jump directly to chapter list
6. **Remote Control** - Websocket-based, may have connection issues on slow networks
7. **Voice Control** - Limited to simple keyword matching (no natural language)
8. **EPUB.js Version** - Using older v0.3.93 (archived, no longer maintained)

---

## 6. REMOTE CONTROL FEATURE

Location: `/home/nmessias/kindle-royal-proxy/src/services/remote.ts`

### Architecture
- **Reader Device**: Connects to remote session as "reader" client
- **Phone/Tablet**: Connects as "controller" client
- **WebSocket**: Bidirectional communication via token-based session

### Flow
1. **Enable Remote**: Reader generates QR code via `/api/remote/create`
2. **Scan QR**: Phone opens `/remote?token=xyz&wsUrl=...` page
3. **Connect**: Both devices establish WebSocket connections
4. **Send Commands**: Phone sends `{action: "next"}` or `{action: "prev"}`
5. **Sync Progress**: Reader reports pagination updates

### User Interface
- **Reader Side** (in settings modal):
  - "Enable" button → generates QR code
  - "Disable" button → invalidates session
  - "Reconnect" prompt if session already exists
  - Status display: "Connected", "Disconnected", "Phone connected!"
  - Remote icon appears in header when connected

- **Phone Side** (`/remote` page):
  - Large left/right tap zones (≈50% each)
  - Visual feedback: flash animation on button press
  - Status bar: indicator dot (red/orange/green) + status text
  - Voice control: optional, with microphone button
  - Settings panel for voice language/keywords

### Session Management
- **Token Generation**: 16-character random alphanumeric
- **Storage**: In-memory Map<token, session>
- **Lifetime**: Until invalidated or reader disconnects
- **Validation**: `/api/remote/validate/{token}` returns `{valid: bool}`
- **Cleanup**: `/api/remote/invalidate/{token}` closes all connections

### Voice Control (Remote Page Only)
- **Browser API**: Web Speech API (SpeechRecognition)
- **Continuous Mode**: Listens until manually disabled
- **Debouncing**: 800ms cooldown between actions
- **Auto-Restart**: Restarts if Chrome stops recognition
- **Settings**: Configurable language + custom keywords
- **Persistence**: Settings saved to cookie

---

## 7. FOLLOWS/HISTORY PAGES & READING PROGRESS

Location: 
- Follows: `/home/nmessias/kindle-royal-proxy/src/templates/pages/follows.tsx`
- History: `/home/nmessias/kindle-royal-proxy/src/templates/pages/history.tsx`

### Follows Page Features
- **Data Source**: Scraped from Royal Road `/my/follows`
- **Display Format**: FictionCard components with:
  - Title, Author, Cover image
  - **"Continue Reading" button** - Links to last read chapter
  - **Unread indicator** - Shows if new chapters available
  - **Latest Chapter display** - Shows most recent chapter
  - **Last Read indicator** - Shows which chapter you're on
- **Progress Tracking**: Shows `lastReadChapterId` on each fiction
- **Pagination**: 100 items per page
- **Cache**: 20-minute server-side cache

### History Page Features
- **Data Source**: Scraped from Royal Road `/my/history`
- **Display Format**: Card list with:
  - Chapter title (clickable)
  - Fiction title (clickable to detail page)
  - **Read timestamp** - Formatted date/time when chapter was read
- **Progress Display**: Yes - shows exactly when you read each chapter
- **No Continue Button**: Direct links only
- **Pagination**: 100 items per page
- **Cache**: Default 5-minute cache

### Reading Progress Tracking
- **Auto-Save**: When navigating chapters (fire-and-forget POST)
- **API Endpoint**: 
  - Royal Road: `POST /api/chapter/{id}` (marks as read)
  - FWN: `POST /api/fwn/progress/{slug}` with `{chapter: number}`
- **Display**: Progress shown as:
  - "Continue Reading" button on fiction cards
  - Checkmarks (✓) on read chapters
  - Arrows (→) on next-to-read chapter
  - Opacity (60%) on read chapters

---

## 8. OFFLINE/PWA SUPPORT

### Current State: LIMITED

#### What Exists:
1. **Client-side Storage**:
   - `localStorage` for reader settings (font size persists)
   - `sessionStorage` for remote control session tokens
   - `IndexedDB` for full EPUB file caching (TomeEpubCache database)

2. **Server-side Cache**:
   - SQLite cache for chapters, fictions, images (30-day TTL)
   - Aggressive caching on home page (cache-only strategy)
   - Pre-caching of follows via background jobs

3. **Resilience**:
   - No required external dependencies (CSS/JS inline when possible)
   - Graceful fallbacks for IndexedDB unsupported
   - Error messages but app continues

#### What Does NOT Exist:
- **No Service Worker**: No offline page serving
- **No Web App Manifest**: Not installable as PWA
- **No Offline Mode Indicator**: Users don't know if device is offline
- **No Sync Queue**: Failed requests aren't queued
- **Limited Offline Reading**: 
  - EPUB works (cached in IndexedDB)
  - Chapters work if already cached (30-day TTL)
  - Follows/History don't work offline (need live scraping)

#### README Claims vs Reality:
- **README claims**: "Offline-First - Aggressive caching for low-bandwidth situations"
- **Reality**: Low-bandwidth friendly, but not true offline-first (requires active connection for most features)

---

## 9. FICTION DETAIL PAGE FORMAT

Location: `/home/nmessias/kindle-royal-proxy/src/templates/pages/fiction.tsx` (241 lines)

### Page Layout
1. **Header Section**:
   - Cover image (large)
   - Title (large heading)
   - Author name
   - Star rating (if available)

2. **Action Buttons** (3-column grid):
   - Follow/Unfollow
   - Favorite/Unfavorite
   - Read Later/Remove Later

3. **Statistics Section** (optional):
   - Overall rating + subscores (Style/Story/Grammar/Character)
   - Pages, Views, Followers, Favorites, Ratings count

4. **Description Section** (expandable):
   - First 300 characters visible by default
   - "More" button expands to full description
   - "Less" button collapses

5. **Chapters Section** (paginated):
   - Header: "Chapters (total)"
   - Each chapter shows:
     - **✓ prefix** if read
     - **→ prefix** if next to read
     - Chapter title (clickable)
     - Release date (if available)
     - **Opacity 60%** if read, **bold** if next to read
   - 20 chapters per page

6. **Footer**:
   - Back to Follows button
   - "Start Reading" button (first unread chapter)
   - "Continue Reading" button (to progress point)

### Chapter List Features
- **Status Indicators**:
  - Checkmark (✓) = read
  - Arrow (→) = next to read
  - Faded = read
  - Bold = next to read
- **Date Display**: Optional chapter release date
- **Read/Unread Tracking**: `isRead` flag from server
- **Progress Tracking**: `continueChapterId` marks where to resume

### Interactivity
- **Bookmark Toggles**: Form submissions to `/fiction/{id}/bookmark`
- **Description Expand/Collapse**: Inline JavaScript with CSS classes
- **Chapter Navigation**: Direct links to `/chapter/{id}`

---

## 10. ACCESSIBILITY GAPS & ISSUES

### Major Gaps
1. **No ARIA Labels**:
   - Buttons lack `aria-label` or `aria-describedby`
   - Navigation menu has no `role="navigation"`
   - Settings modal has no `role="dialog"` or `aria-modal`
   - Modal lacks `aria-labelledby` or `aria-describedby`

2. **No Skip Navigation**:
   - No skip-to-content link
   - No skip-to-main-content landmark
   - No ability to bypass header/navigation

3. **Semantic Issues**:
   - Navigation elements are divs, not nav
   - Settings panel is a div, not proper form landmarks
   - No h1 tag hierarchy in some pages
   - Remote icon just says "Remote" (ambiguous)

4. **Keyboard Issues**:
   - Reader.js ignores INPUT/TEXTAREA (prevents focus in search)
   - EPUB reader has no keyboard shortcuts
   - Tab navigation not optimized for e-ink devices
   - Focus indicators not visible

5. **Image Accessibility**:
   - Cover images use `alt=""` (empty, marked as decorative)
   - Should describe book title/author
   - Book library uses `alt=""` for cover images

6. **Color Contrast** (e-ink specific):
   - Settings modal OK on Kindle (pure black/white)
   - Desktop theme colors (light gray/dark gray) may have insufficient contrast

### Minor Issues
- Touch zones have no text labels (visual only)
- Click zones unlabeled
- Progress bar has no associated text
- Page indicator not connected to content semantically
- Remote control QR code description minimal

### What IS Good
- Proper `<main>` element usage
- Heading hierarchy generally correct
- Form labels present on settings forms
- Image alt attributes where needed (most cases)
- Minimal animations (good for e-ink)

---

## SUMMARY TABLE

| Category | Status | Notes |
|----------|--------|-------|
| **E-ink Optimization** | ✅ Excellent | High contrast, tap zones, column layout |
| **Reading Sources** | ✅ 3 sources | Royal Road, EPUB, FreeWebNovel |
| **Reader Settings** | ✅ Comprehensive | Font, line height, width, themes |
| **Offline Support** | ⚠️ Partial | Caching good, no service worker |
| **Accessibility** | ⚠️ Poor | No ARIA, no skip nav, keyboard gaps |
| **Remote Control** | ✅ Full | Phone control + voice support |
| **Progress Sync** | ✅ Complete | Follows, history, bookmarks |
| **Keyboard Nav** | ⚠️ Partial | Good mobile/e-ink, weak desktop |
| **Performance** | ✅ Good | Aggressive caching, lightweight JS (ES5) |
| **Mobile First** | ✅ Yes | Designed for Kindle/Kobo |

---

## DEPLOYMENT & TECH STACK

- **Runtime**: Bun (ES5/TypeScript compiled)
- **Database**: SQLite (embedded)
- **Browser Automation**: Playwright (optional)
- **Client JS**: ES5 (no dependencies, Kindle compatible)
- **EPUB.js**: v0.3.93 (via CDN)
- **Deployment**: Docker, Railway, Fly.io support

