/**
 * Error and loading page templates
 */
import { Layout } from "../layout";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";

/**
 * Error page
 */
export function ErrorPage({
  title,
  message,
  retryUrl,
  settings = DEFAULT_READER_SETTINGS,
}: {
  title: string;
  message: string;
  retryUrl?: string;
  settings?: ReaderSettings;
}): JSX.Element {
  return (
    <Layout title={title} settings={settings}>
      <h1 safe>{title}</h1>
      <div class="error">
        <span safe>{message}</span>
      </div>
      <div class="mt-16" style="display: flex; gap: 8px;">
        {retryUrl && (
          <a href={retryUrl} class="btn">
            Retry
          </a>
        )}
        <a href="/" class="btn btn-outline">
          Home
        </a>
      </div>
    </Layout>
  );
}

/**
 * Loading page (for slow operations)
 */
export function LoadingPage({
  message = "Loading...",
  settings = DEFAULT_READER_SETTINGS,
}: {
  message?: string;
  settings?: ReaderSettings;
}): JSX.Element {
  return (
    <Layout title="Loading" settings={settings}>
      <h1 safe>{message}</h1>
      <p>Please wait...</p>
    </Layout>
  );
}
