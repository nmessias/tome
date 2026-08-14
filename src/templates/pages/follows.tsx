import { Layout } from "../layout";
import { FictionCard, Pagination, paginate } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { FollowedFiction } from "../../types";
import type { Source } from "../../services/source-registry";

export function FollowsPage({
  source,
  fictions,
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
  sources = [],
}: {
  source: Source;
  fictions: FollowedFiction[];
  page?: number;
  settings?: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const followsHref = `/read/${source.name}/follows`;

  if (fictions.length === 0) {
    return (
      <Layout title="My Follows" settings={settings} currentPath={followsHref} sources={sources}>
        <h1>My Follows</h1>
        <p>
          No followed fictions found. Make sure your credentials are configured in{" "}
          <a href="/settings">Settings</a>.
        </p>
      </Layout>
    );
  }

  const paginatedFictions = paginate(fictions, page);

  return (
    <Layout title="My Follows" settings={settings} currentPath={followsHref} sources={sources}>
      <h1>My Follows ({fictions.length})</h1>
      {paginatedFictions.map((f) => (
        <FictionCard
          fiction={f}
          sourceName={source.name}
          showContinue={true}
          showUnread={true}
          showLatestChapter={true}
          showLastRead={true}
        />
      ))}
      <Pagination currentPage={page} totalItems={fictions.length} basePath={followsHref} />
    </Layout>
  );
}
