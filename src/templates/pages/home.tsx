/**
 * Home page template
 */
import { Layout } from "../layout";
import { SectionTitle, FictionCardCompact } from "../components";
import type { ReaderSettings } from "../../config";
import type { Fiction } from "../../types";
import type { SourceType } from "../../services/sources";
import { DEFAULT_READER_SETTINGS } from "../../config";

export function HomePage({
  settings = DEFAULT_READER_SETTINGS,
  risingStars = [],
  weeklyPopular = [],
  hasCookies = false,
  enabledSources = [],
}: {
  settings?: ReaderSettings;
  risingStars?: Fiction[];
  weeklyPopular?: Fiction[];
  hasCookies?: boolean;
  enabledSources?: SourceType[];
}): JSX.Element {
  const hasRoyalRoad = enabledSources.includes("royalroad");
  const hasEpub = enabledSources.includes("epub");
  const hasNoSources = enabledSources.length === 0;

  return (
    <Layout title="Home" settings={settings} currentPath="/" enabledSources={enabledSources}>
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

      {hasEpub && (
        <div class="mt-24">
          <SectionTitle>Your Library</SectionTitle>
          <p>
            <a href="/library" class="btn">Open EPUB Library</a>
          </p>
        </div>
      )}

      {hasRoyalRoad && !hasCookies && (
        <div class="mt-24">
          <p><strong>Royal Road Setup:</strong></p>
          <p class="mt-8">
            <a href="/settings">Configure your Royal Road cookies</a> to enable browsing.
          </p>
        </div>
      )}

      {hasRoyalRoad && hasCookies && risingStars.length > 0 && (
        <>
          <SectionTitle>Rising Stars</SectionTitle>
          {risingStars.map((f, i) => (
            <FictionCardCompact fiction={f} rank={i + 1} />
          ))}
          <div class="mt-16">
            <a href="/toplist/rising-stars" class="btn btn-outline btn-small">
              View All
            </a>
          </div>
        </>
      )}

      {hasRoyalRoad && hasCookies && weeklyPopular.length > 0 && (
        <>
          <SectionTitle>Weekly Popular</SectionTitle>
          {weeklyPopular.map((f, i) => (
            <FictionCardCompact fiction={f} rank={i + 1} />
          ))}
          <div class="mt-16">
            <a href="/toplist/weekly-popular" class="btn btn-outline btn-small">
              View All
            </a>
          </div>
        </>
      )}

      {hasRoyalRoad && hasCookies && risingStars.length === 0 && weeklyPopular.length === 0 && (
        <div class="mt-24">
          <p>Popular fictions are loading in the background.</p>
          <p class="mt-8">
            <a href="/toplists">Browse Top Lists</a> or <a href="/search">Search</a> for fictions.
          </p>
          <p class="mt-8 text-muted">
            Refresh this page in a minute to see featured content.
          </p>
        </div>
      )}
    </Layout>
  );
}
