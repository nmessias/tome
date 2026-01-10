import type { ReaderSettings } from "../../config";
import type { EpubBook } from "../../services/epub";
import { DEFAULT_READER_SETTINGS, APP_VERSION } from "../../config";

export function EpubReaderPage({
  book,
  settings = DEFAULT_READER_SETTINGS,
}: {
  book: EpubBook;
  settings?: ReaderSettings;
}): JSX.Element {
  const bodyClass = settings.dark ? "dark-mode" : "";
  const fontSizeStyle = `font-size: ${settings.font}px;`;

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title safe>{book.title} - Tome</title>
          <link rel="stylesheet" href={`/public/css/epub-reader.css?v=${APP_VERSION}`} />
        </head>
        <body class={bodyClass || undefined}>
          <header class="epub-header">
            <div class="header-left">
              <a href="/library" class="back-btn">← Library</a>
              <h1 class="book-title" safe>{book.title}</h1>
              {book.author && <span class="book-author" safe>{book.author as string}</span>}
            </div>
            <div class="header-right">
              <span class="progress-display">{book.progress}%</span>
              <button class="settings-btn">Aa</button>
            </div>
          </header>

          <div 
            class="epub-wrapper"
            data-book-id={book.id}
            data-cfi={book.cfi || ""}
            data-progress={book.progress}
          >
            <div class="tap-zone-top"></div>
            <div class="tap-zone-bottom"></div>
            <div class="click-zone click-zone-left"></div>
            <div class="click-zone click-zone-right"></div>
            <div id="epub-container" class="epub-container" style={fontSizeStyle}></div>
            <div class="epub-loading">Loading...</div>
          </div>

          <div class="page-indicator">
            <span class="page-current">-</span>
            <span> / </span>
            <span class="page-total">-</span>
          </div>

          <nav class="nav-fixed">
            <button class="btn nav-prev" disabled>← Prev</button>
            <a href="/library" class="btn btn-outline">Library</a>
            <button class="btn nav-next" disabled>Next →</button>
          </nav>

          <div class="settings-modal">
            <div class="settings-panel">
              <h2>Settings</h2>
              <div class="settings-row">
                <label>Font Size</label>
                <div class="font-controls">
                  <button class="font-decrease">-</button>
                  <span class="font-size-display">{settings.font}px</span>
                  <button class="font-increase">+</button>
                </div>
              </div>
              <div class="settings-row">
                <label>Theme</label>
                <div class="theme-controls">
                  <button class="theme-btn theme-light" data-theme="light">Light</button>
                  <button class="theme-btn theme-dark" data-theme="dark">Dark</button>
                </div>
              </div>
              <button class="settings-close">Close</button>
            </div>
          </div>

          <div class="delete-modal">
            <div class="delete-panel">
              <h2>Delete Book?</h2>
              <p>Are you sure you want to remove this book from your library?</p>
              <div class="delete-actions">
                <button class="btn btn-outline delete-cancel">Cancel</button>
                <form method="POST" action={`/epub/${book.id}/delete`} style="display: inline;">
                  <button type="submit" class="btn delete-confirm">Delete</button>
                </form>
              </div>
            </div>
          </div>

          <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"></script>
          <script src={`/public/js/epub-reader.js?v=${APP_VERSION}`}></script>
        </body>
      </html>
    </>
  );
}
