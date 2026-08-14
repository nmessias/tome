/**
 * Unified fiction detail page (ADR-0002)
 * Parameterized by the Source object; ref formats are opaque.
 */
import { Layout } from "../layout";
import { CoverImage, Pagination, SectionTitle, fictionHref, chapterHref } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS, CHAPTERS_PER_PAGE } from "../../config";
import type { Fiction } from "../../types";
import type { Source } from "../../services/source-registry";

function formatNumber(num: number | undefined): string {
  if (num === undefined) return "—";
  return num.toLocaleString();
}

function formatRating(rating: number | undefined): string {
  if (rating === undefined) return "—";
  return `${rating.toFixed(1)}★`;
}

export function FictionPage({
  fiction,
  source,
  chapterPage = 1,
  settings = DEFAULT_READER_SETTINGS,
  error,
  sources = [],
  from,
}: {
  fiction: Fiction;
  source: Source;
  chapterPage?: number;
  settings?: ReaderSettings;
  error?: string;
  sources?: Source[];
  from?: string;
}): JSX.Element {
  const chapters = fiction.chapters || [];
  const fictionRef = fiction.slug ?? String(fiction.id);
  const totalChapterPages = Math.ceil(chapters.length / CHAPTERS_PER_PAGE);
  const startIdx = (chapterPage - 1) * CHAPTERS_PER_PAGE;
  const paginatedChapters = chapters.slice(startIdx, startIdx + CHAPTERS_PER_PAGE);

  const stats = fiction.stats;
  const hasRatings = stats?.rating !== undefined;
  const hasDetailedStats = stats && (
    stats.views !== undefined || 
    stats.followers !== undefined || 
    stats.favorites !== undefined ||
    stats.pages !== undefined
  );

  const hasLongDesc = fiction.description && fiction.description.length > 300;

  // Continue/Start target
  const continueHref = fiction.continueChapterId
    ? chapterHref(source.name, fiction, fiction.continueChapterId)
    : fiction.continueChapterSlug
      ? chapterHref(source.name, fiction, fiction.continueChapterSlug)
      : chapters.length > 0
        ? chapterHref(source.name, fiction, chapters[0].slug ?? chapters[0].id)
        : null;

  const backLabel = from === "follows" ? "Back to Follows"
    : from === "toplists" ? "Back to Top Lists"
    : from === "search" ? "Back to Search"
    : "Back to Follows";
  const backUrl = from === "toplists" ? `/read/${source.name}/toplists`
    : from === "search" ? `/read/${source.name}/search`
    : `/read/${source.name}/follows`;

  return (
    <Layout title={fiction.title} settings={settings} currentPath={fictionHref(source.name, fiction)} sources={sources}>
      {/* Fiction Header */}
      <div style="display: flex; gap: 16px; margin-bottom: 16px;">
        <CoverImage url={fiction.coverUrl} alt={fiction.title} size="large" />
        <div style="flex: 1;">
          <h1 style="margin: 0 0 8px 0; border: none; padding: 0;" safe>
            {fiction.title}
          </h1>
          <div style="font-size: 14px;">
            by <span safe>{fiction.author || "Unknown"}</span>
          </div>
          {hasRatings && (
            <div style="margin-top: 8px; font-weight: bold;">
              {formatRating(stats?.rating)}
            </div>
          )}
          {fiction.tags && fiction.tags.length > 0 && (
            <div style="margin-top: 4px; font-size: 12px;" safe>
              {fiction.tags.join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/* Continue/Start Button */}
      {continueHref ? (
        <a href={continueHref} class="btn" style="display: block; text-align: center; margin-bottom: 16px;">
          {fiction.continueChapterId || fiction.continueChapterSlug ? "Continue Reading" : "Start Reading"}
          {fiction.continueChapterLabel ? ` (${fiction.continueChapterLabel})` : ""}
        </a>
      ) : null}

      {/* Bookmark Actions (Follow, Favorite, Read Later) — bookmarks capability */}
      {source.capabilities.bookmarks && fiction.csrfToken && (
        <>
          {error && (
            <div class="card" style="background: #fee2e2; color: #991b1b; margin-bottom: 8px; padding: 8px 12px;">
              {error}
            </div>
          )}
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <form method="POST" action={`/read/${source.name}/${fictionRef}/bookmark`} style="flex: 1;">
              <input type="hidden" name="type" value="follow" />
              <input type="hidden" name="mark" value={fiction.isFollowing ? "false" : "true"} />
              <input type="hidden" name="csrf" value={fiction.csrfToken} />
              <button type="submit" class={`btn ${fiction.isFollowing ? "" : "btn-outline"}`} style="width: 100%;">
                {fiction.isFollowing ? "Unfollow" : "Follow"}
              </button>
            </form>
            
            <form method="POST" action={`/read/${source.name}/${fictionRef}/bookmark`} style="flex: 1;">
              <input type="hidden" name="type" value="favorite" />
              <input type="hidden" name="mark" value={fiction.isFavorite ? "false" : "true"} />
              <input type="hidden" name="csrf" value={fiction.csrfToken} />
              <button type="submit" class={`btn ${fiction.isFavorite ? "" : "btn-outline"}`} style="width: 100%;">
                {fiction.isFavorite ? "Unfavorite" : "Favorite"}
              </button>
            </form>
            
            <form method="POST" action={`/read/${source.name}/${fictionRef}/bookmark`} style="flex: 1;">
              <input type="hidden" name="type" value="ril" />
              <input type="hidden" name="mark" value={fiction.isReadLater ? "false" : "true"} />
              <input type="hidden" name="csrf" value={fiction.csrfToken} />
              <button type="submit" class={`btn ${fiction.isReadLater ? "" : "btn-outline"}`} style="width: 100%;">
                {fiction.isReadLater ? "Remove Later" : "Read Later"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Library toggle — library capability */}
      {source.capabilities.library && fiction.isInLibrary !== undefined && (
        <div style="margin-bottom: 16px;">
          <form method="POST" action={`/read/${source.name}/${fictionRef}/library`}>
            <input type="hidden" name="action" value={fiction.isInLibrary ? "remove" : "add"} />
            <button type="submit" class={`btn ${fiction.isInLibrary ? "" : "btn-outline"}`} style="width: 100%;">
              {fiction.isInLibrary ? "Remove from Library" : "Add to Library"}
            </button>
          </form>
        </div>
      )}

      {/* Stats Section */}
      {(hasRatings || hasDetailedStats) && (
        <>
          <SectionTitle>Statistics</SectionTitle>
          <div class="card">
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              {hasRatings && (
                <div style="flex: 1; min-width: 120px;">
                  <div style="margin-bottom: 4px;"><strong>Overall:</strong> {formatRating(stats?.rating)}</div>
                  {stats?.styleScore !== undefined && <div style="font-size: 14px;">Style: {formatRating(stats.styleScore)}</div>}
                  {stats?.storyScore !== undefined && <div style="font-size: 14px;">Story: {formatRating(stats.storyScore)}</div>}
                  {stats?.grammarScore !== undefined && <div style="font-size: 14px;">Grammar: {formatRating(stats.grammarScore)}</div>}
                  {stats?.characterScore !== undefined && <div style="font-size: 14px;">Character: {formatRating(stats.characterScore)}</div>}
                  {chapters.length > 0 && <div style="font-size: 14px;"><strong>{chapters.length}</strong> chapters</div>}
                </div>
              )}
              {hasDetailedStats && (
                <div style="flex: 1; min-width: 120px; font-size: 14px;">
                  {stats?.pages !== undefined && <div><strong>{formatNumber(stats.pages)}</strong> pages</div>}
                  {stats?.views !== undefined && <div><strong>{formatNumber(stats.views)}</strong> views</div>}
                  {stats?.followers !== undefined && <div><strong>{formatNumber(stats.followers)}</strong> followers</div>}
                  {stats?.favorites !== undefined && <div><strong>{formatNumber(stats.favorites)}</strong> favorites</div>}
                  {stats?.ratings !== undefined && <div><strong>{formatNumber(stats.ratings)}</strong> ratings</div>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Description */}
      {fiction.description && (
        <>
          <SectionTitle>Description</SectionTitle>
          <div class="card">
            {hasLongDesc ? (
              <>
                <div id="desc-short">
                  <span safe>{fiction.description.slice(0, 300)}</span>...
                  <button id="desc-expand" class="btn btn-outline btn-small" style="margin-left: 8px;">
                    More
                  </button>
                </div>
                <div id="desc-full" class="hidden">
                  <span safe>{fiction.description}</span>
                  <button id="desc-collapse" class="btn btn-outline btn-small" style="margin-left: 8px;">
                    Less
                  </button>
                </div>
              </>
            ) : (
              <span safe>{fiction.description}</span>
            )}
          </div>
        </>
      )}

      {/* Chapters */}
      <SectionTitle>{`Chapters (${chapters.length})`}</SectionTitle>
      {paginatedChapters.length > 0 ? (
        paginatedChapters.map((c, i) => {
          const isRead = c.isRead === true;
          const chapterRef = c.slug ?? c.id;
          const isNextToRead = !isRead && (chapterRef === fiction.continueChapterId || chapterRef === fiction.continueChapterSlug);
          const prefix = isNextToRead ? "→ " : isRead ? "✓ " : "";
          const style = isNextToRead ? "font-weight: bold;" : isRead ? "opacity: 0.6;" : "";

          return (
            <div class="card" style={`padding: 8px 12px; ${style}`}>
              <span safe>{prefix}</span>
              <a href={chapterHref(source.name, fiction, chapterRef)} safe>
                {c.title || `Chapter ${startIdx + i + 1}`}
              </a>
              {c.date && <span style="font-size: 12px;"> · <span safe>{c.date}</span></span>}
            </div>
          );
        })
      ) : (
        <p>No chapters found</p>
      )}

      {totalChapterPages > 1 && (
        <Pagination
          currentPage={chapterPage}
          totalItems={chapters.length}
          basePath={`/read/${source.name}/${fictionRef}`}
          itemsPerPage={CHAPTERS_PER_PAGE}
        />
      )}

      <div class="mt-24">
        <a href={backUrl} class="btn btn-outline btn-small">{backLabel}</a>
      </div>

      {hasLongDesc && (
        <script>
          {`(function() {
  var expandBtn = document.getElementById('desc-expand');
  var collapseBtn = document.getElementById('desc-collapse');
  var shortDesc = document.getElementById('desc-short');
  var fullDesc = document.getElementById('desc-full');
  if (expandBtn) {
    expandBtn.onclick = function() {
      shortDesc.classList.add('hidden');
      fullDesc.classList.remove('hidden');
    };
  }
  if (collapseBtn) {
    collapseBtn.onclick = function() {
      shortDesc.classList.remove('hidden');
      fullDesc.classList.add('hidden');
    };
  }
})();`}
        </script>
      )}
    </Layout>
  );
}
