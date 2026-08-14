/**
 * Home page template
 */
import { Layout } from "../layout";
import { SectionTitle, FictionCardCompact } from "../components";
import type { ReaderSettings } from "../../config";
import type { Fiction } from "../../types";
import type { Source } from "../../services/source-registry";
import { DEFAULT_READER_SETTINGS } from "../../config";

export function HomePage({
  settings = DEFAULT_READER_SETTINGS,
  risingStars = [],
  weeklyPopular = [],
  toplistSource,
  needsSetupSource,
  sources = [],
}: {
  settings?: ReaderSettings;
  risingStars?: Fiction[];
  weeklyPopular?: Fiction[];
  toplistSource?: Source | null;
  needsSetupSource?: Source | null;
  sources?: Source[];
}): JSX.Element {
  const hasNoSources = sources.length === 0;
  const librarySource = sources.find((s) => s.capabilities.library);

  return (
    <Layout title="Home" settings={settings} currentPath="/" sources={sources}>
      <h1>Welcome to Tome</h1>
      <p>Read web fiction on your e-ink device.</p>

      {hasNoSources && (
        <div class="mt-24">
          <p><strong>Get started:</strong></p>
          <p class="mt-8">
            <a href="/settings">Enable a reading source</a> to get started.
          </p>
        </div>
      )}

      {librarySource && (
        <div class="mt-24">
          <SectionTitle>Your Library</SectionTitle>
          <p>
            <a href={`/read/${librarySource.name}/library`} class="btn">Open ${librarySource.displayName} Library</a>
          </p>
        </div>
      )}

      {needsSetupSource && (
        <div class="mt-24">
          <p><strong>{`${needsSetupSource.displayName} Setup:`}</strong></p>
          <p class="mt-8">
            <a href="/settings">Configure your ${needsSetupSource.displayName} credentials</a> to enable browsing.
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
