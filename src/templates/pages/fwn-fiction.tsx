/**
 * FreeWebNovel fiction detail page template
 */
import { Layout } from "../layout";
import { CoverImage, Pagination, SectionTitle } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS, CHAPTERS_PER_PAGE } from "../../config";
import type { Fiction } from "../../types";
import type { SourceType } from "../../services/sources";

function formatRating(rating: number | undefined): string {
  if (rating === undefined) return "—";
  return `${rating.toFixed(2)}★`;
}

export function FwnFictionPage({
  fiction,
  chapterPage = 1,
  settings = DEFAULT_READER_SETTINGS,
  enabledSources = [],
  isInLibrary = false,
  lastChapterRead = 0,
}: {
  fiction: Fiction;
  chapterPage?: number;
  settings?: ReaderSettings;
  enabledSources?: SourceType[];
  isInLibrary?: boolean;
  lastChapterRead?: number;
}): JSX.Element {
  const chapters = fiction.chapters || [];
  const slug = fiction.slug || "";
  const totalChapterPages = Math.ceil(chapters.length / CHAPTERS_PER_PAGE);
  const startIdx = (chapterPage - 1) * CHAPTERS_PER_PAGE;
  const paginatedChapters = chapters.slice(startIdx, startIdx + CHAPTERS_PER_PAGE);

  const rating = fiction.stats?.rating;
  const hasLongDesc = fiction.description && fiction.description.length > 300;

  // Determine the continue chapter
  const continueChapterNum = lastChapterRead > 0 ? lastChapterRead + 1 : null;
  const hasContinue = continueChapterNum && continueChapterNum <= chapters.length;

  return (
    <Layout title={fiction.title} settings={settings} enabledSources={enabledSources}>
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
          {rating !== undefined && (
            <div style="margin-top: 8px; font-weight: bold;">
              {formatRating(rating)}
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
      {hasContinue ? (
        <a href={`/fwn/read/${slug}/${continueChapterNum}`} class="btn" style="display: block; text-align: center; margin-bottom: 16px;">
          Continue Reading (Ch. {continueChapterNum})
        </a>
      ) : (
        chapters.length > 0 && (
          <a href={`/fwn/read/${slug}/1`} class="btn btn-outline" style="display: block; text-align: center; margin-bottom: 16px;">
            Start Reading
          </a>
        )
      )}

      {/* Library Action */}
      <div style="margin-bottom: 16px;">
        {isInLibrary ? (
          <form method="POST" action={`/fwn/fiction/${slug}/library`}>
            <input type="hidden" name="action" value="remove" />
            <button type="submit" class="btn" style="width: 100%;">
              Remove from Library
            </button>
          </form>
        ) : (
          <form method="POST" action={`/fwn/fiction/${slug}/library`}>
            <input type="hidden" name="action" value="add" />
            <button type="submit" class="btn btn-outline" style="width: 100%;">
              Add to Library
            </button>
          </form>
        )}
      </div>

      {/* Stats */}
      {rating !== undefined && (
        <>
          <SectionTitle>{"Statistics"}</SectionTitle>
          <div class="card">
            <div><strong>Overall:</strong> {formatRating(rating)}</div>
            <div style="font-size: 14px;"><strong>{chapters.length}</strong> chapters</div>
          </div>
        </>
      )}

      {/* Description */}
      {fiction.description && (
        <>
          <SectionTitle>{"Description"}</SectionTitle>
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
          const chapterNum = c.id;
          const isRead = lastChapterRead > 0 && chapterNum <= lastChapterRead;
          const isNextToRead = chapterNum === continueChapterNum;
          const prefix = isRead ? "✓ " : isNextToRead ? "→ " : "";
          const style = isRead ? "opacity: 0.6;" : isNextToRead ? "font-weight: bold;" : "";

          return (
            <div class="card" style={`padding: 8px 12px; ${style}`}>
              <span safe>{prefix}</span>
              <a href={`/fwn/read/${slug}/${chapterNum}`} safe>
                {c.title || `Chapter ${chapterNum}`}
              </a>
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
          basePath={`/fwn/fiction/${slug}`}
          itemsPerPage={CHAPTERS_PER_PAGE}
        />
      )}

      <div class="mt-24">
        <a href="/fwn/library" class="btn btn-outline btn-small">Back to FWN Library</a>
        {" "}
        <a href="/fwn/search" class="btn btn-outline btn-small">Search</a>
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
