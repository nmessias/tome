import { Layout } from "../layout";
import { SectionTitle } from "../components";
import type { ReaderSettings } from "../../config";
import type { SourceType } from "../../services/sources";
import type { EpubBook } from "../../services/epub";

function BookCard({ book }: { book: EpubBook }): JSX.Element {
  return (
    <a href={`/epub/${book.id}`} class="book-card">
      {book.coverPath ? (
        <img src={`/covers/${book.id}`} alt="" class="book-cover" loading="lazy" />
      ) : (
        <div class="book-cover book-cover-placeholder">
          <span safe>{book.title.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div class="book-title" safe>{book.title}</div>
      {book.author && <div class="book-author" safe>{book.author}</div>}
      {book.progress > 0 && (
        <div class="book-progress">
          <div class="book-progress-bar" style={`width: ${book.progress}%`}></div>
        </div>
      )}
    </a>
  );
}

export function LibraryPage({
  books,
  settings,
  enabledSources = [],
}: {
  books: EpubBook[];
  settings: ReaderSettings;
  enabledSources?: SourceType[];
}): JSX.Element {
  return (
    <Layout title="Library" settings={settings} currentPath="/library" enabledSources={enabledSources}>
      <h1>Library</h1>
      
      <div style="margin-bottom: 20px;">
        <a href="/library/upload" class="btn">Upload EPUB</a>
      </div>
      
      {books.length === 0 ? (
        <div class="card">
          <p>Your library is empty. Upload an EPUB to get started.</p>
        </div>
      ) : (
        <div class="book-grid">
          {books.map((book) => (
            <BookCard book={book} />
          ))}
        </div>
      )}
    </Layout>
  );
}
