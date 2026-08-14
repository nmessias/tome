import { Layout } from "../layout";
import { FictionCard, Pagination, paginate, DescriptionToggleScript } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS, ITEMS_PER_PAGE } from "../../config";
import type { Fiction } from "../../types";
import type { Source } from "../../services/source-registry";

export function ToplistsPage({
  source,
  settings = DEFAULT_READER_SETTINGS,
  sources = [],
}: {
  source: Source;
  settings?: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const toplistsHref = `/read/${source.name}/toplists`;
  return (
    <Layout title="Top Lists" settings={settings} currentPath={toplistsHref} sources={sources}>
      <h1>Top Lists</h1>
      {(source.toplists || []).map((t) => (
        <div class="card">
          <a href={`${toplistsHref}/${t.slug}`} style="font-weight: bold; font-size: 16px;" safe>
            {t.name}
          </a>
        </div>
      ))}
    </Layout>
  );
}

export function ToplistPage({
  source,
  toplist,
  fictions,
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  sources = [],
}: {
  source: Source;
  toplist: { slug: string; name: string; url: string };
  fictions: Fiction[];
  page?: number;
  settings?: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const toplistsHref = `/read/${source.name}/toplists`;

  if (fictions.length === 0) {
    return (
      <Layout title={toplist.name} settings={settings} currentPath={toplistsHref} sources={sources}>
        <h1 safe>{toplist.name}</h1>
        <p>No fictions found. Try again later.</p>
        <a href={toplistsHref} class="btn btn-outline">
          Back to Top Lists
        </a>
      </Layout>
    );
  }

  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedFictions = paginate(fictions, page);

  return (
    <Layout title={toplist.name} settings={settings} currentPath={toplistsHref} sources={sources}>
      <h1 safe>{toplist.name}</h1>
      {paginatedFictions.map((f, i) => (
        <FictionCard fiction={f} sourceName={source.name} rank={startIndex + i + 1} showDescription={true} />
      ))}
      <Pagination
        currentPage={page}
        totalItems={fictions.length}
        basePath={`${toplistsHref}/${toplist.slug}`}
      />
      <div class="mt-24">
        <a href={toplistsHref} class="btn btn-outline btn-small">
          Back to Top Lists
        </a>
      </div>
      <DescriptionToggleScript />
    </Layout>
  );
}
