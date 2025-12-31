/**
 * Fiction detail page template
 */
import { Layout } from "../layout";
import { CoverImage, Pagination, SectionTitle } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS, CHAPTERS_PER_PAGE } from "../../config";
import type { Fiction } from "../../types";

/**
 * Format a number with commas (e.g., 1234567 -> "1,234,567")
 */
function formatNumber(num: number | undefined): string {
  if (num === undefined) return "—";
  return num.toLocaleString();
}

/**
 * Format a rating as stars (e.g., 4.5 -> "4.5★")
 */
function formatRating(rating: number | undefined): string {
  if (rating === undefined) return "—";
  return `${rating.toFixed(2)}★`;
}

export function FictionPage({
  fiction,
  chapterPage = 1,
  settings = DEFAULT_READER_SETTINGS,
}: {
  fiction: Fiction;
  chapterPage?: number;
  settings?: ReaderSettings;
}): JSX.Element {
  const chapters = fiction.chapters || [];
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

  return (
    <Layout title={fiction.title} settings={settings}>
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
        </div>
      </div>

      {/* Continue/Start Button */}
      {fiction.continueChapterId ? (
        <a href={`/chapter/${fiction.continueChapterId}`} class="btn" style="display: block; text-align: center; margin-bottom: 16px;">
          Continue Reading
        </a>
      ) : (
        chapters.length > 0 && (
          <a href={`/chapter/${chapters[0].id}`} class="btn btn-outline" style="display: block; text-align: center; margin-bottom: 16px;">
            Start Reading
          </a>
        )
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
          const isNextToRead = c.id === fiction.continueChapterId;
          const prefix = isRead ? "✓ " : isNextToRead ? "→ " : "";
          const style = isRead ? "opacity: 0.6;" : isNextToRead ? "font-weight: bold;" : "";

          return (
            <div class="card" style={`padding: 8px 12px; ${style}`}>
              <span safe>{prefix}</span>
              <a href={`/chapter/${c.id}`} safe>
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
          basePath={`/fiction/${fiction.id}`}
          itemsPerPage={CHAPTERS_PER_PAGE}
        />
      )}

      <div class="mt-24">
        <a href="/follows" class="btn btn-outline btn-small">Back to Follows</a>
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
