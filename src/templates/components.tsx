/**
 * Reusable UI components using JSX
 */
import { ITEMS_PER_PAGE } from "../config";
import type { Fiction, FollowedFiction } from "../types";
import type { Source } from "../services/source-registry";

/**
 * Build the internal URL for a fiction detail page under the unified scheme.
 */
export function fictionHref(sourceName: string, fiction: Fiction | FollowedFiction): string {
  const ref = fiction.slug ?? String(fiction.id);
  return `/read/${sourceName}/${ref}`;
}

/**
 * Build the internal URL for a chapter page under the unified scheme.
 */
export function chapterHref(
  sourceName: string,
  fiction: Fiction | FollowedFiction,
  chapterRef?: number | string
): string {
  if (chapterRef === undefined || chapterRef === null || chapterRef === "") {
    return fictionHref(sourceName, fiction);
  }
  const ref = fiction.slug ?? String(fiction.id);
  return `/read/${sourceName}/${ref}/${chapterRef}`;
}

/**
 * Header: nav driven by the enabled sources' navLinks — no hardcoded source
 * names (ADR-0001).
 */
export function Header({
  currentPath = "",
  sources = [],
}: {
  currentPath?: string;
  sources?: Source[];
}): JSX.Element {
  // No "Home" link: the "Tome" title is the home link, and every button cut
  // here is a row saved on a phone.
  const links: { href: string; label: string }[] = [
    ...sources.flatMap((s) => s.navLinks),
    { href: "/settings", label: "Settings" },
  ];

  // Every source contributes its own links, so the same labels repeat once per
  // source — "Search · Library · Search · Library" — and the bar wraps over
  // three rows above every list page. Keep the first link per label: with
  // several sources enabled the rest are siblings behind the same word, and a
  // mis-tap on a duplicate is worse than one extra tap to reach the source home.
  const seenLabels = new Set<string>();
  const uniqueLinks = links.filter((l) => {
    const key = l.label.toLowerCase();
    if (seenLabels.has(key)) return false;
    seenLabels.add(key);
    return true;
  });

  return (
    <header class="header">
      <a href="/" class="header-title">Tome</a>
      <nav class="nav">
        {uniqueLinks.map((l) => (
          <a
            href={l.href}
            class={`nav-link${currentPath === l.href ? " active" : ""}`}
          >
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

/**
 * Section title component
 */
export function SectionTitle({ children }: { children: string }): JSX.Element {
  return <h2 class="section-title" safe>{children}</h2>;
}

/**
 * Pagination controls
 */
export function Pagination({
  currentPage,
  totalItems,
  basePath,
  itemsPerPage = ITEMS_PER_PAGE,
}: {
  currentPage: number;
  totalItems: number;
  basePath: string;
  itemsPerPage?: number;
}): JSX.Element {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return <></>;

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const separator = basePath.includes("?") ? "&" : "?";

  return (
    <div class="pagination">
      {prevPage ? (
        <a href={`${basePath}${separator}page=${prevPage}`} class="btn btn-outline btn-small">
          Prev
        </a>
      ) : (
        <span class="btn btn-outline btn-small" style="opacity: 0.3;">
          Prev
        </span>
      )}
      <span class="page-info">
        {currentPage} / {totalPages}
      </span>
      {nextPage ? (
        <a href={`${basePath}${separator}page=${nextPage}`} class="btn btn-outline btn-small">
          Next
        </a>
      ) : (
        <span class="btn btn-outline btn-small" style="opacity: 0.3;">
          Next
        </span>
      )}
    </div>
  );
}

/**
 * Get paginated slice of items
 */
export function paginate<T>(items: T[], page: number, itemsPerPage: number = ITEMS_PER_PAGE): T[] {
  const start = (page - 1) * itemsPerPage;
  return items.slice(start, start + itemsPerPage);
}

/**
 * Alert/message box
 */
export function Alert({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}): JSX.Element {
  return (
    <div class={isError ? "error" : "success"} safe>
      {message}
    </div>
  );
}

/**
 * Cover image with fallback
 */
export function CoverImage({
  url,
  alt = "",
  size = "medium",
}: {
  url?: string;
  alt?: string;
  size?: "small" | "medium" | "large";
}): JSX.Element {
  // Sized by class, not inline style, so phones can shrink them in CSS.
  if (url) {
    return <img src={url} alt={alt} class={`cover-img cover-${size}`} />;
  }
  return <div class={`cover-placeholder cover-${size}`}></div>;
}

/**
 * Truncate text to specified length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Format number with commas (e.g., 2857 -> "2,857")
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Whether a followed fiction has chapters past the last one read. The source's
 * own flag misses some (Royal Road's unread markup drifts, and every row then
 * read "Up to date" with 70 chapters waiting), so a latest chapter that is not
 * the last-read one counts too.
 */
export function hasNewChapters(f: FollowedFiction): boolean {
  return (
    !!f.hasUnread ||
    (!!f.latestChapterId && !!f.lastReadChapterId && f.latestChapterId !== f.lastReadChapterId)
  );
}

/**
 * Fiction card props
 */
export interface FictionCardProps {
  fiction: Fiction | FollowedFiction;
  sourceName: string;
  rank?: number;
  showContinue?: boolean;
  showDescription?: boolean;
  showUnread?: boolean;
  showLatestChapter?: boolean;
  showLastRead?: boolean;
}

/**
 * Fiction card for lists (follows, toplists, search results)
 */
export function FictionCard({
  fiction,
  sourceName,
  rank,
  showContinue = false,
  showDescription = false,
  showUnread = false,
  showLatestChapter = false,
  showLastRead = false,
}: FictionCardProps): JSX.Element {
  const f = fiction as FollowedFiction;

  // Build title prefix
  const titlePrefix = rank !== undefined ? `${rank}. ` : "";
  
  // Build stats line: rating, pages, followers
  const statsItems: string[] = [];
  if (fiction.stats?.rating) {
    statsItems.push(`${fiction.stats.rating.toFixed(1)}★`);
  }
  if (fiction.stats?.pages) {
    statsItems.push(`${formatNumber(fiction.stats.pages)} pages`);
  }
  if (fiction.stats?.followers) {
    statsItems.push(`${formatNumber(fiction.stats.followers)} followers`);
  }
  const statsLine = statsItems.join(" · ");

  // Tags line (first 3 tags)
  const tagsLine = fiction.tags?.slice(0, 3).join(" · ") || "";

  // Truncated description for preview
  const truncatedDesc = fiction.description ? truncateText(fiction.description, 150) : "";
  const hasMoreDesc = fiction.description && fiction.description.length > 150;

  // Caught up needs a last read: a never-opened follow is not "up to date".
  const isUnread = showUnread && hasNewChapters(f);
  const isCaughtUp = showUnread && !isUnread && !!f.lastReadChapterId;
  // Caught up means latest and last read are the same chapter; one line says it.
  const hideLatest = isCaughtUp && f.latestChapterId === f.lastReadChapterId;

  return (
    <div class={`card${isUnread ? " card-unread" : ""}`} style="display: flex;">
      {/* The cover is the biggest tap target on the card; on e-ink it beats
          aiming for a wrapped, underlined title. */}
      <a href={fictionHref(sourceName, fiction)} class="card-cover">
        <CoverImage url={fiction.coverUrl} alt={fiction.title} />
      </a>
      <div style="flex: 1; min-width: 0;">
        <div class="card-title">
          <span safe>{titlePrefix}</span>
          {/* Leads the title rather than trailing it: long fiction titles wrap,
              and a marker parked at the end lands on line 2 where a scanning
              eye never lands. */}
          {isUnread && <strong class="badge-new" safe> NEW </strong>}
          <a href={fictionHref(sourceName, fiction)} safe>
            {fiction.title}
          </a>
        </div>
        
        {tagsLine && (
          <div class="card-meta" safe>
            {tagsLine}
          </div>
        )}
        
        {statsLine && (
          <div class="card-meta" safe>
            {statsLine}
          </div>
        )}

        {showLatestChapter && f.latestChapter && !hideLatest && (
          <div class="card-meta">
            <span safe>Latest: </span>
            {f.latestChapterId ? (
              <a href={chapterHref(sourceName, fiction, f.latestChapterId)} safe>
                {f.latestChapter}
              </a>
            ) : (
              <span safe>{f.latestChapter}</span>
            )}
            {f.lastUpdateAgo && <span class="card-ago" safe>{`  ·  ${f.lastUpdateAgo}`}</span>}
          </div>
        )}

        {showLastRead && f.lastRead && (
          <div class="card-meta">
            <span safe>Last read: </span>
            {f.lastReadChapterId ? (
              <a href={chapterHref(sourceName, fiction, f.lastReadChapterId)} safe>
                {f.lastRead}
              </a>
            ) : (
              <span safe>{f.lastRead}</span>
            )}
            {f.lastReadAgo && <span class="card-ago" safe>{`  ·  ${f.lastReadAgo}`}</span>}
            {isCaughtUp && <span class="card-ago">{"  ·  up to date"}</span>}
          </div>
        )}

        {/* Buttons only where there is something to read: a row of identical
            "Up to date" buttons doubled every card's height on a 50-row list,
            and the cover already opens the chapter list. */}
        {showContinue && !isCaughtUp && (
          <div class="card-actions">
            {f.nextChapterId ? (
              <>
                <a href={chapterHref(sourceName, fiction, f.nextChapterId)} class="btn btn-small">
                  Continue
                </a>
                <a href={fictionHref(sourceName, fiction)} class="btn btn-outline btn-small">
                  Chapters
                </a>
              </>
            ) : (
              // No resolved next chapter: ?next= has the fiction route open the
              // chapter after the last-read one, straight into the reader.
              f.lastReadChapterId ? (
                <a href={`${fictionHref(sourceName, fiction)}?next=${f.lastReadChapterId}`} class="btn btn-small">
                  Continue
                </a>
              ) : (
                <a href={fictionHref(sourceName, fiction)} class="btn btn-small">
                  Start Reading
                </a>
              )
            )}
          </div>
        )}

        {showDescription && truncatedDesc && (
          <div class="fiction-desc-container" style="margin-top: 8px;">
            <div class="fiction-desc-preview" safe>
              {truncatedDesc}
            </div>
            {hasMoreDesc && (
              <>
                <div
                  id={`desc-${fiction.id}`}
                  class="fiction-desc-full hidden"
                  safe
                >
                  {fiction.description}
                </div>
                <button class="desc-toggle" data-target={`desc-${fiction.id}`}>
                  Show more
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact fiction card (for home page lists)
 */
export function FictionCardCompact({
  fiction,
  sourceName,
  rank,
}: {
  fiction: Fiction;
  sourceName: string;
  rank?: number;
}): JSX.Element {
  const titlePrefix = rank !== undefined ? `${rank}. ` : "";
  
  // Build compact stats: rating, pages
  const statsItems: string[] = [];
  if (fiction.stats?.rating) {
    statsItems.push(`${fiction.stats.rating.toFixed(1)}★`);
  }
  if (fiction.stats?.pages) {
    statsItems.push(`${formatNumber(fiction.stats.pages)} pages`);
  }
  const statsLine = statsItems.join(" · ");

  return (
    <div class="card" style="display: flex; padding: 10px;">
      <CoverImage url={fiction.coverUrl} alt={fiction.title} size="small" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: bold; font-size: 14px;">
          <span safe>{titlePrefix}</span>
          <a href={fictionHref(sourceName, fiction)} safe>
            {fiction.title}
          </a>
        </div>
        {statsLine && (
          <div style="font-size: 12px;" safe>
            {statsLine}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Description toggle script (ES5 compatible)
 * Include once per page that uses description toggles
 */
export function DescriptionToggleScript(): JSX.Element {
  return (
    <script>
      {`(function() {
  var toggles = document.querySelectorAll('.desc-toggle');
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].onclick = function() {
      var targetId = this.getAttribute('data-target');
      var target = document.getElementById(targetId);
      var preview = this.previousElementSibling && this.previousElementSibling.previousElementSibling;
      if (target) {
        if (target.classList.contains('hidden')) {
          target.classList.remove('hidden');
          if (preview) preview.style.display = 'none';
          this.textContent = 'Show less';
        } else {
          target.classList.add('hidden');
          if (preview) preview.style.display = '';
          this.textContent = 'Show more';
        }
      }
    };
  }
})();`}
    </script>
  );
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Legacy Nav export for backwards compatibility during migration
export { Header as Nav };
