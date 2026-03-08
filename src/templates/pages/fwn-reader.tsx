/**
 * FreeWebNovel chapter reader page template
 * Uses the same ReaderLayout and reading experience as Royal Road reader.
 */
import { ReaderLayout } from "../layout";
import type { ChapterContent } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";

export function FwnReaderPage({
  chapter,
  settings = DEFAULT_READER_SETTINGS,
  initialPage = 1,
}: {
  chapter: ChapterContent;
  settings?: ReaderSettings;
  initialPage?: number;
}): JSX.Element {
  const slug = chapter.fictionSlug || "";
  const chapterNum = chapter.id;

  // Extract prev/next chapter numbers from URLs
  const prevMatch = chapter.prevChapterUrl?.match(/\/fwn\/read\/[\w-]+\/(\d+)/);
  const nextMatch = chapter.nextChapterUrl?.match(/\/fwn\/read\/[\w-]+\/(\d+)/);
  const prevChapterNum = prevMatch ? prevMatch[1] : "";
  const nextChapterNum = nextMatch ? nextMatch[1] : "";

  const fontSizeStyle = `font-size: ${settings.font}px;`;
  const fontSizeDisplay = settings.font + "px";

  return (
    <ReaderLayout title={chapter.title} settings={settings} initialPage={initialPage}>
      <header class="reader-header">
        <div class="header-left">
          <h1 class="chapter-title" safe>
            {chapter.title}
          </h1>
          {chapter.fictionTitle && (
            <a href={`/fwn/fiction/${slug}`} class="fiction-link" safe>
              {chapter.fictionTitle}
            </a>
          )}
        </div>
        <div class="header-right">
          <div class="header-nav">
            <a href="/">Home</a>
            <a href="/fwn/library">Library</a>
            <a href="/fwn/search">Search</a>
          </div>
          <button class="settings-btn">Aa</button>
        </div>
      </header>

      <div
        class="reader-wrapper"
        data-chapter-id={chapterNum}
        data-fiction-id={slug}
        data-source="fwn"
        data-fiction-slug={slug}
        data-chapter-num={chapterNum}
      >
        <div class="tap-zone-top"></div>
        <div class="tap-zone-bottom"></div>
        <div class="click-zone click-zone-left"></div>
        <div class="click-zone click-zone-right"></div>
        <div class="reader-content" style={fontSizeStyle}>
          {chapter.content as "safe"}
        </div>
      </div>

      <div class="page-indicator">1 / 1</div>

      <nav class="nav-fixed">
        <button
          class="btn nav-prev"
          data-chapter-id={prevChapterNum || ""}
          data-fwn-url={chapter.prevChapterUrl || ""}
          disabled={!prevChapterNum}
        >
          ← Prev Ch
        </button>
        <a href={`/fwn/fiction/${slug}`} class="btn btn-outline">
          Index
        </a>
        <button
          class="btn nav-next"
          data-chapter-id={nextChapterNum || ""}
          data-fwn-url={chapter.nextChapterUrl || ""}
          disabled={!nextChapterNum}
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

      {/* Auto-update reading progress */}
      <script>
        {`(function() {
  var wrapper = document.querySelector('.reader-wrapper');
  if (!wrapper) return;
  var slug = wrapper.getAttribute('data-fiction-slug');
  var chapterNum = wrapper.getAttribute('data-chapter-num');
  if (!slug || !chapterNum) return;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/fwn/progress/' + encodeURIComponent(slug));
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({ chapter: parseInt(chapterNum, 10) }));
})();`}
      </script>
    </ReaderLayout>
  );
}
