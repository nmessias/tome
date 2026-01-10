import { Layout } from "../layout";
import { Alert } from "../components";
import type { ReaderSettings } from "../../config";
import type { SourceType } from "../../services/sources";

export function LibraryUploadPage({
  settings,
  enabledSources = [],
  message,
  isError,
}: {
  settings: ReaderSettings;
  enabledSources?: SourceType[];
  message?: string;
  isError?: boolean;
}): JSX.Element {
  return (
    <Layout title="Upload EPUB" settings={settings} currentPath="/library" enabledSources={enabledSources}>
      <h1>Upload EPUB</h1>
      
      {message && <Alert message={message} isError={isError} />}
      
      <form method="POST" action="/library/upload" enctype="multipart/form-data">
        <div class="form-group">
          <label for="epub">Select EPUB File</label>
          <input type="file" name="epub" id="epub" accept=".epub,application/epub+zip" required />
          <div class="hint">Maximum file size: 50MB</div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn">Upload</button>
          <a href="/library" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </Layout>
  );
}
