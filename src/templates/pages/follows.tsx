/**
 * Follows page template
 */
import { Layout } from "../layout";
import { FictionCard, Pagination, paginate } from "../components";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { FollowedFiction } from "../../types";

export function FollowsPage({
  fictions,
  page = 1,
  settings = DEFAULT_READER_SETTINGS,
}: {
  fictions: FollowedFiction[];
  page?: number;
  settings?: ReaderSettings;
}): JSX.Element {
  if (fictions.length === 0) {
    return (
      <Layout title="My Follows" settings={settings} currentPath="/follows">
        <h1>My Follows</h1>
        <p>
          No followed fictions found. Make sure your cookies are configured in{" "}
          <a href="/settings">Settings</a>.
        </p>
      </Layout>
    );
  }

  const paginatedFictions = paginate(fictions, page);

  return (
    <Layout title="My Follows" settings={settings} currentPath="/follows">
      <h1>My Follows ({fictions.length})</h1>
      {paginatedFictions.map((f) => (
        <FictionCard
          fiction={f}
          showContinue={true}
          showUnread={true}
          showLatestChapter={true}
          showLastRead={true}
        />
      ))}
      <Pagination currentPage={page} totalItems={fictions.length} basePath="/follows" />
    </Layout>
  );
}
