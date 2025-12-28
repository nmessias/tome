/**
 * Chapter reader page template
 * Uses SPA-style navigation with click-based pagination
 */
import { ReaderLayout } from "../layout";
import type { ChapterContent } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";

/**
 * Chapter reader page - paginated for e-ink (SPA-style navigation)
 */
export function ReaderPage({
  chapter,
  settings = DEFAULT_READER_SETTINGS,
}: {
  chapter: ChapterContent;
  settings?: ReaderSettings;
}): JSX.Element {
  // Extract chapter IDs from URLs
  const prevChapterId = chapter.prevChapterUrl
    ? chapter.prevChapterUrl.replace("/chapter/", "")
    : "";
  const nextChapterId = chapter.nextChapterUrl
    ? chapter.nextChapterUrl.replace("/chapter/", "")
    : "";

  // Pre-render settings for no-flash display
  const fontSizeStyle = `font-size: ${settings.font}px;`;
  const fontSizeDisplay = settings.font + "px";

  return (
    <ReaderLayout title={chapter.title} settings={settings}>
      <header class="reader-header">
        <div class="header-left">
          <h1 class="chapter-title" safe>
            {chapter.title}
          </h1>
          {chapter.fictionTitle && (
            <a href={`/fiction/${chapter.fictionId}`} class="fiction-link" safe>
              {chapter.fictionTitle}
            </a>
          )}
        </div>
        <div class="header-right">
          <div class="header-nav">
            <a href="/">Home</a>
            <a href="/follows">Follows</a>
            <a href="/history">History</a>
          </div>
          <button class="settings-btn">Aa</button>
        </div>
      </header>

      <div
        class="reader-wrapper"
        data-chapter-id={chapter.id}
        data-fiction-id={chapter.fictionId}
      >
        <div class="tap-zone-top"></div>
        <div class="tap-zone-bottom"></div>
        <div class="click-zone click-zone-left"></div>
        <div class="click-zone click-zone-right"></div>
        <div class="reader-content" style={fontSizeStyle}>
          {/* Content is already HTML, render as-is */}
          {chapter.content as "safe"}
        </div>
      </div>

      <div class="page-indicator">1 / 1</div>

      <nav class="nav-fixed">
        <button
          class="btn nav-prev"
          data-chapter-id={prevChapterId || ''}
          disabled={!prevChapterId}
        >
          ← Prev Ch
        </button>
        <a href={`/fiction/${chapter.fictionId}`} class="btn btn-outline">
          Index
        </a>
        <button
          class="btn nav-next"
          data-chapter-id={nextChapterId || ''}
          disabled={!nextChapterId}
        >
          Next Ch →
        </button>
      </nav>

      <div class="settings-modal">
        <div class="settings-panel">
          <h2>Settings</h2>
          <div class="settings-row">
            <label>Font Size</label>
            <div class="font-controls">
              <button class="font-decrease">-</button>
              <span class="font-size-display">{fontSizeDisplay}</span>
              <button class="font-increase">+</button>
            </div>
          </div>

          <button class="settings-close">Close</button>
        </div>
      </div>
    </ReaderLayout>
  );
}
