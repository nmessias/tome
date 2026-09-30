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
  unreadOnly = false,
}: {
  source: Source;
  fictions: FollowedFiction[];
  page?: number;
  settings?: ReaderSettings;
  sources?: Source[];
  unreadOnly?: boolean;
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

  // Filter before paginating, so page 1 of "new only" is not just page 1 of
  // everything. Scanning 50 rows to find the 8 with new chapters is the whole
  // cost of this page.
  const unreadCount = fictions.filter((f) => f.hasUnread).length;
  const visible = unreadOnly ? fictions.filter((f) => f.hasUnread) : fictions;

  // Carry the filter through pagination; Pagination already appends with "&"
  // when the base path has a query string.
  const basePath = unreadOnly ? `${followsHref}?new=1` : followsHref;

  return (
    <Layout title="My Follows" settings={settings} currentPath={followsHref} sources={sources}>
      <h1>
        My Follows ({unreadOnly ? visible.length : fictions.length})
        {unreadOnly && <span class="filter-note" safe>{` of ${fictions.length} with new chapters`}</span>}
      </h1>

      {unreadCount > 0 && (
        <div class="filter-bar">
          {unreadOnly ? (
            <a href={followsHref} class="btn btn-small">
              Show all {fictions.length}
            </a>
          ) : (
            <a href={`${followsHref}?new=1`} class="btn btn-small">
              New only ({unreadCount})
            </a>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p>Nothing new. You are caught up on every followed fiction.</p>
      ) : (
        paginate(visible, page).map((f) => (
          <FictionCard
            fiction={f}
            sourceName={source.name}
            showContinue={true}
            showUnread={true}
            showLatestChapter={true}
            showLastRead={true}
          />
        ))
      )}

      <Pagination currentPage={page} totalItems={visible.length} basePath={basePath} />
    </Layout>
  );
}
