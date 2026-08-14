/**
 * Unified library page (ADR-0002)
 * Entries are normalized LibraryEntry objects; "book" entries render as the
 * EPUB-style grid, "series" entries as the FWN-style list with continue.
 */
import { Layout } from "../layout";
import { SectionTitle, CoverImage } from "../components";
import type { ReaderSettings } from "../../config";
import type { Source } from "../../services/source-registry";
import type { LibraryEntry } from "../../types";

function SeriesCard({ entry, sourceName }: { entry: LibraryEntry; sourceName: string }): JSX.Element {
  const progress =
    entry.totalChapters && entry.totalChapters > 0
      ? Math.round(((entry.lastChapterRead || 0) / entry.totalChapters) * 100)
      : 0;
  const canContinue = !entry.completed && !!entry.continueChapterRef;

  return (
    <div class="card" style="display: flex; gap: 12px;">
      <CoverImage url={entry.coverUrl} alt={entry.title} size="small" />
      <div style="flex: 1; min-width: 0;">
        <div class="card-title">
          <a href={`/read/${sourceName}/${entry.ref}`} safe>
            {entry.title}
          </a>
        </div>
        {entry.author && (
          <div class="card-meta">
            by <span safe>{entry.author}</span>
          </div>
        )}
        <div class="card-meta">
          {(entry.lastChapterRead || 0) > 0
            ? `Chapter ${entry.lastChapterRead}`
            : "Not started"}
          {entry.totalChapters && entry.totalChapters > 0 && ` of ${entry.totalChapters}`}
          {progress > 0 && ` (${progress}%)`}
        </div>
        <div class="card-actions">
          {canContinue ? (
            <a href={`/read/${sourceName}/${entry.ref}/${entry.continueChapterRef}`} class="btn btn-small">
              {(entry.lastChapterRead || 0) > 0 ? "Continue" : "Start Reading"}
            </a>
          ) : (
            <span class="btn btn-small btn-outline" style="opacity: 0.5;">Completed</span>
          )}
        </div>
      </div>
    </div>
  );
}

function BookCard({ entry, sourceName }: { entry: LibraryEntry; sourceName: string }): JSX.Element {
  return (
    <a href={`/read/${sourceName}/${entry.ref}`} class="book-card">
      {entry.coverUrl ? (
        <img src={entry.coverUrl} alt="" class="book-cover" loading="lazy" />
      ) : (
        <div class="book-cover book-cover-placeholder">
          <span safe>{entry.title.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div class="book-title" safe>{entry.title}</div>
      {entry.author && <div class="book-author" safe>{entry.author}</div>}
      {(entry.progress || 0) > 0 && (
        <div class="book-progress">
          <div class="book-progress-bar" style={`width: ${entry.progress}%`}></div>
        </div>
      )}
    </a>
  );
}

export function LibraryPage({
  source,
  entries,
  settings,
  sources = [],
}: {
  source: Source;
  entries: LibraryEntry[];
  settings: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const libraryHref = `/read/${source.name}/library`;
  const bookEntries = entries.filter((e) => e.kind === "book");
  const seriesEntries = entries.filter((e) => e.kind !== "book");

  return (
    <Layout title={`${source.displayName} Library`} settings={settings} currentPath={libraryHref} sources={sources}>
      <h1>{`${source.displayName} Library`}</h1>

      {source.libraryActions && source.libraryActions.length > 0 && (
        <div style="margin-bottom: 20px;">
          {source.libraryActions.map((a) => (
            <a href={a.href} class="btn" style="margin-right: 8px;">{a.label}</a>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div class="card">
          <p>Your library is empty.</p>
        </div>
      ) : (
        <>
          {bookEntries.length > 0 && (
            <div class="book-grid">
              {bookEntries.map((entry) => (
                <BookCard entry={entry} sourceName={source.name} />
              ))}
            </div>
          )}
          {seriesEntries.length > 0 && (
            <>
              <SectionTitle>{`Reading (${seriesEntries.length})`}</SectionTitle>
              {seriesEntries.map((entry) => (
                <SeriesCard entry={entry} sourceName={source.name} />
              ))}
            </>
          )}
        </>
      )}
    </Layout>
  );
}
