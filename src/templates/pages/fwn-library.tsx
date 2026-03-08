/**
 * FreeWebNovel library page template
 * Shows all fictions the user has added to their local FWN library.
 */
import { Layout } from "../layout";
import { CoverImage, SectionTitle } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { SourceType } from "../../services/sources";
import type { FwnLibraryEntry } from "../../services/fwn-library";

function FwnBookCard({ entry }: { entry: FwnLibraryEntry }): JSX.Element {
  const progress =
    entry.totalChapters > 0
      ? Math.round((entry.lastChapterRead / entry.totalChapters) * 100)
      : 0;
  const continueChapter = entry.lastChapterRead > 0 ? entry.lastChapterRead + 1 : 1;
  const canContinue = entry.totalChapters === 0 || continueChapter <= entry.totalChapters;

  return (
    <div class="card" style="display: flex; gap: 12px;">
      <CoverImage url={entry.coverUrl || undefined} alt={entry.title} />
      <div style="flex: 1; min-width: 0;">
        <div class="card-title">
          <a href={`/fwn/fiction/${entry.slug}`} safe>
            {entry.title}
          </a>
        </div>
        {entry.author && (
          <div class="card-meta">
            by <span safe>{entry.author}</span>
          </div>
        )}
        <div class="card-meta">
          {entry.lastChapterRead > 0
            ? `Chapter ${entry.lastChapterRead}`
            : "Not started"}
          {entry.totalChapters > 0 && ` of ${entry.totalChapters}`}
          {progress > 0 && ` (${progress}%)`}
        </div>
        <div class="card-actions">
          {canContinue ? (
            <a href={`/fwn/read/${entry.slug}/${continueChapter}`} class="btn btn-small">
              {entry.lastChapterRead > 0 ? "Continue" : "Start Reading"}
            </a>
          ) : (
            <span class="btn btn-small btn-outline" style="opacity: 0.5;">Completed</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function FwnLibraryPage({
  entries,
  settings = DEFAULT_READER_SETTINGS,
  enabledSources = [],
}: {
  entries: FwnLibraryEntry[];
  settings?: ReaderSettings;
  enabledSources?: SourceType[];
}): JSX.Element {
  return (
    <Layout title="FWN Library" settings={settings} currentPath="/fwn/library" enabledSources={enabledSources}>
      <h1>FreeWebNovel Library</h1>

      <div style="margin-bottom: 20px;">
        <a href="/fwn/search" class="btn">Search Novels</a>
      </div>

      {entries.length === 0 ? (
        <div class="card">
          <p>Your FreeWebNovel library is empty.</p>
          <p>Search for novels and add them to your library to track reading progress.</p>
        </div>
      ) : (
        <>
          <SectionTitle>{`Reading (${entries.length})`}</SectionTitle>
          {entries.map((entry) => (
            <FwnBookCard entry={entry} />
          ))}
        </>
      )}
    </Layout>
  );
}
