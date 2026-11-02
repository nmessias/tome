/**
 * Home page template
 */
import { Layout } from "../layout";
import { SectionTitle, FictionCard, FictionCardCompact, hasNewChapters } from "../components";
import type { ReaderSettings } from "../../config";
import type { Fiction, FollowedFiction } from "../../types";
import type { Source } from "../../services/source-registry";
import { DEFAULT_READER_SETTINGS } from "../../config";

export function HomePage({
  settings = DEFAULT_READER_SETTINGS,
  risingStars = [],
  weeklyPopular = [],
  follows = [],
  followsSource,
  toplistSource,
  needsSetupSource,
  sources = [],
}: {
  settings?: ReaderSettings;
  risingStars?: Fiction[];
  weeklyPopular?: Fiction[];
  follows?: FollowedFiction[];
  followsSource?: Source | null;
  toplistSource?: Source | null;
  needsSetupSource?: Source | null;
  sources?: Source[];
}): JSX.Element {
  const hasNoSources = sources.length === 0;
  // The home page opens on what there is to read: on the Kindle every extra
  // page is a full e-ink refresh, so Follows should not be a required stop.
  const withNew = follows.filter(hasNewChapters);

  return (
    <Layout title="Home" settings={settings} currentPath="/" sources={sources}>
      {hasNoSources && (
        <>
          <h1>Welcome to Tome</h1>
          <p>
            <a href="/settings">Enable a reading source</a> to get started.
          </p>
        </>
      )}

      {followsSource && withNew.length > 0 && (
        <>
          <SectionTitle>{`New chapters (${withNew.length})`}</SectionTitle>
          {withNew.slice(0, 5).map((f) => (
            <FictionCard
              fiction={f}
              sourceName={followsSource.name}
              showContinue={true}
              showUnread={true}
              showLatestChapter={true}
              showLastRead={true}
            />
          ))}
          {withNew.length > 5 && (
            <a href={`/read/${followsSource.name}/follows?new=1`} class="btn btn-outline btn-small">
              {`All ${withNew.length} with new chapters`}
            </a>
          )}
        </>
      )}

      {needsSetupSource && (
        <div class="mt-24">
          <p><strong>{`${needsSetupSource.displayName} Setup:`}</strong></p>
          <p class="mt-8">
            <a href="/settings">Configure your {needsSetupSource.displayName} credentials</a> to enable browsing.
          </p>
        </div>
      )}

      {toplistSource && risingStars.length > 0 && (
        <>
          <SectionTitle>Rising Stars</SectionTitle>
          {risingStars.map((f, i) => (
            <FictionCardCompact fiction={f} sourceName={toplistSource.name} rank={i + 1} />
          ))}
          <div class="mt-16">
            <a href={`/read/${toplistSource.name}/toplists/rising-stars`} class="btn btn-outline btn-small">
              View All
            </a>
          </div>
        </>
      )}

      {toplistSource && weeklyPopular.length > 0 && (
        <>
          <SectionTitle>Weekly Popular</SectionTitle>
          {weeklyPopular.map((f, i) => (
            <FictionCardCompact fiction={f} sourceName={toplistSource.name} rank={i + 1} />
          ))}
          <div class="mt-16">
            <a href={`/read/${toplistSource.name}/toplists/weekly-popular`} class="btn btn-outline btn-small">
              View All
            </a>
          </div>
        </>
      )}

      {toplistSource && risingStars.length === 0 && weeklyPopular.length === 0 && (
        <div class="mt-24">
          <p>Popular fictions are loading in the background.</p>
          <p class="mt-8">
            <a href={`/read/${toplistSource.name}/toplists`}>Browse Top Lists</a> or{" "}
            <a href={`/read/${toplistSource.name}/search`}>Search</a> for fictions.
          </p>
          <p class="mt-8 text-muted">
            Refresh this page in a minute to see featured content.
          </p>
        </div>
      )}
    </Layout>
  );
}
