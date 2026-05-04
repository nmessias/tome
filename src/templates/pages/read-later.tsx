import { Layout } from "../layout";
import { FictionCard, Pagination, paginate, DescriptionToggleScript } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { Fiction } from "../../types";
import type { SourceType } from "../../services/sources";

export function ReadLaterPage({
  fictions,
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  enabledSources = [],
}: {
  fictions: Fiction[];
  page?: number;
  settings?: ReaderSettings;
  enabledSources?: SourceType[];
}): JSX.Element {
  if (fictions.length === 0) {
    return (
      <Layout title="Read Later" settings={settings} currentPath="/read-later" enabledSources={enabledSources}>
        <h1>Read Later</h1>
        <p>
          No fictions in your read later list. You can add fictions from their{" "}
          <a href="/search">fiction page</a>.
        </p>
      </Layout>
    );
  }

  const paginatedFictions = paginate(fictions, page);

  return (
    <Layout title="Read Later" settings={settings} currentPath="/read-later" enabledSources={enabledSources}>
      <h1>Read Later ({fictions.length})</h1>
      {paginatedFictions.map((f) => (
        <FictionCard fiction={f} showDescription={true} />
      ))}
      <Pagination currentPage={page} totalItems={fictions.length} basePath="/read-later" />
      <DescriptionToggleScript />
    </Layout>
  );
}
