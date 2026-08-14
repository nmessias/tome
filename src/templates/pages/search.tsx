/**
 * Unified search page (ADR-0002) — one search page per source.
 */
import { Layout } from "../layout";
import { FictionCard, Pagination, paginate } from "../components";
import type { Fiction } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { Source } from "../../services/source-registry";

export function SearchPage({
  source,
  query = "",
  results = [],
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  sources = [],
}: {
  source: Source;
  query?: string;
  results?: Fiction[];
  page?: number;
  settings?: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const searchHref = `/read/${source.name}/search`;
  const searchForm = (
    <form method="GET" action={searchHref} style="margin-bottom: 20px;">
      <label for="q">{`Search ${source.displayName}:`}</label>
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
      <Layout title={`${source.displayName} Search`} settings={settings} currentPath={searchHref} sources={sources}>
        <h1>{`${source.displayName} Search`}</h1>
        {searchForm}
        <p>Enter a title to search {source.displayName}.</p>
      </Layout>
    );
  }

  if (results.length === 0) {
    return (
      <Layout title={`${source.displayName} Search`} settings={settings} currentPath={searchHref} sources={sources}>
        <h1>{`${source.displayName} Search`}</h1>
        {searchForm}
        <p>
          No results found for "<span safe>{query}</span>".
        </p>
      </Layout>
    );
  }

  const paginatedResults = paginate(results, page);

  return (
    <Layout title={`${source.displayName} Search Results`} settings={settings} currentPath={searchHref} sources={sources}>
      <h1>{`${source.displayName} Search Results`}</h1>
      {searchForm}
      <p>
        Found {results.length} results for "<span safe>{query}</span>"
      </p>
      {paginatedResults.map((f) => (
        <FictionCard fiction={f} sourceName={source.name} showDescription={false} />
      ))}
      <Pagination
        currentPage={page}
        totalItems={results.length}
        basePath={`${searchHref}?q=${encodeURIComponent(query)}`}
      />
    </Layout>
  );
}
