/**
 * Reusable UI components using JSX
 */
import { NAV_LINKS, ITEMS_PER_PAGE } from "../config";
import type { Fiction, FollowedFiction } from "../types";

/**
 * Header with navigation
 */
export function Header({ currentPath = "" }: { currentPath?: string }): JSX.Element {
  return (
    <header class="header">
      <a href="/" class="header-title">Tome</a>
      <nav class="nav">
        {NAV_LINKS.map((l) => (
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
  const sizes = {
    small: { width: 50, height: 70 },
    medium: { width: 80, height: 110 },
    large: { width: 120, height: 160 },
  };
  const { width, height } = sizes[size];

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        class="cover-img"
        style={`width: ${width}px; height: ${height}px; object-fit: cover;`}
      />
    );
  }
  return (
    <div
      class="cover-placeholder"
      style={`width: ${width}px; height: ${height}px;`}
    ></div>
  );
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
 * Fiction card props
 */
export interface FictionCardProps {
  fiction: Fiction | FollowedFiction;
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

  return (
    <div class="card" style="display: flex; gap: 12px;">
      <CoverImage url={fiction.coverUrl} alt={fiction.title} />
      <div style="flex: 1; min-width: 0;">
        <div class="card-title">
          <span safe>{titlePrefix}</span>
          <a href={`/fiction/${fiction.id}`} safe>
            {fiction.title}
          </a>
          {showUnread && f.hasUnread && <strong> [NEW]</strong>}
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

        {showLatestChapter && f.latestChapter && (
          <div class="card-meta">
            <span safe>Latest: </span>
            {f.latestChapterId ? (
              <a href={`/chapter/${f.latestChapterId}`} safe>
                {f.latestChapter}
              </a>
            ) : (
              <span safe>{f.latestChapter}</span>
            )}
          </div>
        )}

        {showLastRead && f.lastRead && (
          <div class="card-meta">
            <span safe>Last read: </span>
            {f.lastReadChapterId ? (
              <a href={`/chapter/${f.lastReadChapterId}`} safe>
                {f.lastRead}
              </a>
            ) : (
              <span safe>{f.lastRead}</span>
            )}
          </div>
        )}

        {showContinue && (
          <div class="card-actions">
            {f.nextChapterId ? (
              <a href={`/chapter/${f.nextChapterId}`} class="btn btn-small">
                Continue
              </a>
            ) : f.lastReadChapterId ? (
              <a href={`/fiction/${fiction.id}`} class="btn btn-outline btn-small">
                View Chapters
              </a>
            ) : (
              <a href={`/fiction/${fiction.id}`} class="btn btn-outline btn-small">
                Start Reading
              </a>
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
  rank,
}: {
  fiction: Fiction;
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
    <div class="card" style="display: flex; gap: 10px; padding: 10px;">
      <CoverImage url={fiction.coverUrl} alt={fiction.title} size="small" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: bold; font-size: 14px;">
          <span safe>{titlePrefix}</span>
          <a href={`/fiction/${fiction.id}`} safe>
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
