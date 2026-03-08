/**
 * FreeWebNovel search page template
 */
import { Layout } from "../layout";
import { CoverImage, Pagination, paginate } from "../components";
import type { Fiction } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { SourceType } from "../../services/sources";

/**
 * FWN Fiction card for search/list results
 */
function FwnFictionCard({ fiction }: { fiction: Fiction }): JSX.Element {
  const slug = fiction.slug || "";

  return (
    <div class="card" style="display: flex; gap: 12px;">
      <CoverImage url={fiction.coverUrl} alt={fiction.title} />
      <div style="flex: 1; min-width: 0;">
        <div class="card-title">
          <a href={`/fwn/fiction/${slug}`} safe>
            {fiction.title}
          </a>
        </div>
        {fiction.author && (
          <div class="card-meta">
            by <span safe>{fiction.author}</span>
          </div>
        )}
        {fiction.tags && fiction.tags.length > 0 && (
          <div class="card-meta" safe>
            {fiction.tags.slice(0, 4).join(" · ")}
          </div>
        )}
        {fiction.stats?.rating && (
          <div class="card-meta">
            {fiction.stats.rating.toFixed(1)}★
          </div>
        )}
      </div>
    </div>
  );
}

export function FwnSearchPage({
  query = "",
  results = [],
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  enabledSources = [],
}: {
  query?: string;
  results?: Fiction[];
  page?: number;
  settings?: ReaderSettings;
  enabledSources?: SourceType[];
}): JSX.Element {
  const searchForm = (
    <form method="GET" action="/fwn/search" style="margin-bottom: 20px;">
      <label for="q">Search FreeWebNovel:</label>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <input
          type="text"
          name="q"
          id="q"
          value={query}
          placeholder="Enter title..."
          style="flex: 1;"
        />
        <button type="submit" class="btn">
          Search
        </button>
      </div>
    </form>
  );

  if (!query) {
    return (
      <Layout title="FWN Search" settings={settings} currentPath="/fwn/search" enabledSources={enabledSources}>
        <h1>FreeWebNovel Search</h1>
        {searchForm}
        <p>Enter a title to search FreeWebNovel.</p>
      </Layout>
    );
  }

  if (results.length === 0) {
    return (
      <Layout title="FWN Search" settings={settings} currentPath="/fwn/search" enabledSources={enabledSources}>
        <h1>FreeWebNovel Search</h1>
        {searchForm}
        <p>
          No results found for "<span safe>{query}</span>".
        </p>
      </Layout>
    );
  }

  const paginatedResults = paginate(results, page);

  return (
    <Layout title="FWN Search Results" settings={settings} currentPath="/fwn/search" enabledSources={enabledSources}>
      <h1>FreeWebNovel Search</h1>
      {searchForm}
      <p>
        Found {results.length} results for "<span safe>{query}</span>"
      </p>
      {paginatedResults.map((f) => (
        <FwnFictionCard fiction={f} />
      ))}
      <Pagination
        currentPage={page}
        totalItems={results.length}
        basePath={`/fwn/search?q=${encodeURIComponent(query)}`}
      />
    </Layout>
  );
}
