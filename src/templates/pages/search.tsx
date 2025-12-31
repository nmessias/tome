/**
 * Search page template
 */
import { Layout } from "../layout";
import { FictionCard, Pagination, paginate } from "../components";
import type { Fiction } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";

/**
 * Search page with form and results
 */
export function SearchPage({
  query = "",
  results = [],
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
}: {
  query?: string;
  results?: Fiction[];
  page?: number;
  settings?: ReaderSettings;
}): JSX.Element {
  const searchForm = (
    <form method="GET" action="/search" style="margin-bottom: 20px;">
      <label for="q">Search fictions:</label>
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

  // No query - show empty search form
  if (!query) {
    return (
      <Layout title="Search" settings={settings} currentPath="/search">
        <h1>Search</h1>
        {searchForm}
        <p>Enter a title to search Royal Road.</p>
      </Layout>
    );
  }

  // Query but no results
  if (results.length === 0) {
    return (
      <Layout title="Search" settings={settings} currentPath="/search">
        <h1>Search</h1>
        {searchForm}
        <p>
          No results found for "<span safe>{query}</span>".
        </p>
      </Layout>
    );
  }

  // Results found
  const paginatedResults = paginate(results, page);

  return (
    <Layout title="Search Results" settings={settings} currentPath="/search">
      <h1>Search Results</h1>
      {searchForm}
      <p>
        Found {results.length} results for "<span safe>{query}</span>"
      </p>
      {paginatedResults.map((f) => (
        <FictionCard fiction={f} showDescription={false} />
      ))}
      <Pagination
        currentPage={page}
        totalItems={results.length}
        basePath={`/search?q=${encodeURIComponent(query)}`}
      />
    </Layout>
  );
}
