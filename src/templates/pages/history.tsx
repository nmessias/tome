import { Layout } from "../layout";
import { Pagination, paginate } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { HistoryEntry } from "../../types";
import type { Source } from "../../services/source-registry";

export function HistoryPage({
  source,
  history,
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  sources = [],
}: {
  source: Source;
  history: HistoryEntry[];
  page?: number;
  settings?: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const historyHref = `/read/${source.name}/history`;

  if (history.length === 0) {
    return (
      <Layout title="History" settings={settings} currentPath={historyHref} sources={sources}>
        <h1>History</h1>
        <p>
          No reading history found. Make sure your credentials are configured in{" "}
          <a href="/settings">Settings</a>.
        </p>
      </Layout>
    );
  }

  const paginatedHistory = paginate(history, page);

  return (
    <Layout title="History" settings={settings} currentPath={historyHref} sources={sources}>
      <h1>History ({history.length})</h1>
      {paginatedHistory.map((h) => (
        <div class="card">
          <div class="card-title">
            <a href={`/read/${source.name}/${h.fictionId}/${h.chapterId}`} safe>
              {h.chapterTitle}
            </a>
          </div>
          <div class="card-meta">
            <a href={`/read/${source.name}/${h.fictionId}`} safe>
              {h.fictionTitle}
            </a>
          </div>
          <div class="card-meta" safe>
            {h.readAt}
          </div>
        </div>
      ))}
      <Pagination currentPage={page} totalItems={history.length} basePath={historyHref} />
    </Layout>
  );
}
