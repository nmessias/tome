/**
 * Source home page — /read/:source
 */
import { Layout } from "../layout";
import type { ReaderSettings } from "../../config";
import type { Source } from "../../services/source-registry";

export function SourceHomePage({
  source,
  settings,
  sources = [],
}: {
  source: Source;
  settings: ReaderSettings;
  sources?: Source[];
}): JSX.Element {
  const homeHref = `/read/${source.name}`;
  return (
    <Layout title={source.displayName} settings={settings} currentPath={homeHref} sources={sources}>
      <h1>{source.displayName}</h1>
      {source.description && <p safe>{source.description}</p>}
      <div class="mt-16">
        {source.navLinks.map((l) => (
          <div style="margin-bottom: 8px;">
            <a href={l.href} class="btn btn-outline" style="display: block; text-align: center;">
              {l.label}
            </a>
          </div>
        ))}
      </div>
    </Layout>
  );
}
