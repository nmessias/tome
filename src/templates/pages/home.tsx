/**
 * Home page template
 */
import { Layout } from "../layout";
import { SectionTitle, FictionCardCompact } from "../components";
import type { ReaderSettings } from "../../config";
import type { Fiction } from "../../types";
import { DEFAULT_READER_SETTINGS } from "../../config";

export function HomePage({
  settings = DEFAULT_READER_SETTINGS,
  risingStars = [],
  weeklyPopular = [],
}: {
  settings?: ReaderSettings;
  risingStars?: Fiction[];
  weeklyPopular?: Fiction[];
}): JSX.Element {
  return (
    <Layout title="Home" settings={settings} currentPath="/">
      <h1>Welcome to Tome</h1>
      <p>Read web fiction on your e-ink device.</p>

      {risingStars.length > 0 && (
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

      {weeklyPopular.length > 0 && (
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

      {risingStars.length === 0 && weeklyPopular.length === 0 && (
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
