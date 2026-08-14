import { Layout } from "../layout";
import { FictionCard, Pagination, paginate, DescriptionToggleScript } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { Fiction } from "../../types";
import type { Source } from "../../services/source-registry";

export function ReadLaterPage({
  source,
  fictions,
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  sources = [],
}: {
  source: Source;
  fictions: Fiction[];
  page?: number;
  settings?: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const readLaterHref = `/read/${source.name}/read-later`;

  if (fictions.length === 0) {
    return (
      <Layout title="Read Later" settings={settings} currentPath={readLaterHref} sources={sources}>
        <h1>Read Later</h1>
        <p>
          No fictions in your read later list. You can add fictions from their{" "}
          <a href={`/read/${source.name}/search`}>fiction page</a>.
        </p>
      </Layout>
    );
  }

  const paginatedFictions = paginate(fictions, page);

  return (
    <Layout title="Read Later" settings={settings} currentPath={readLaterHref} sources={sources}>
      <h1>Read Later ({fictions.length})</h1>
      {paginatedFictions.map((f) => (
        <FictionCard fiction={f} sourceName={source.name} showDescription={true} />
      ))}
      <Pagination currentPage={page} totalItems={fictions.length} basePath={readLaterHref} />
      <DescriptionToggleScript />
    </Layout>
  );
}
