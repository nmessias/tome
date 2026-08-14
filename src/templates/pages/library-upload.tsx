/**
 * Upload page for sources with canUpload (EPUB).
 */
import { Layout } from "../layout";
import { Alert } from "../components";
import type { ReaderSettings } from "../../config";
import type { Source } from "../../services/source-registry";

export function LibraryUploadPage({
  source,
  settings,
  sources = [],
  message,
  isError,
}: {
  source: Source;
  settings: ReaderSettings;
  sources?: Source[];
  message?: string;
  isError?: boolean;
}): JSX.Element {
  const uploadHref = `/read/${source.name}/upload`;
  return (
    <Layout title={`Upload to ${source.displayName}`} settings={settings} currentPath={`/read/${source.name}/library`} sources={sources}>
      <h1>Upload</h1>

      {message && <Alert message={message} isError={isError} />}

      <form method="POST" action={uploadHref} enctype="multipart/form-data">
        <div class="form-group">
          <label for="epub">Select File</label>
          <input type="file" name="epub" id="epub" accept=".epub,application/epub+zip" required />
          <div class="hint">Maximum file size: 50MB</div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn">Upload</button>
          <a href={`/read/${source.name}/library`} class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </Layout>
  );
}
