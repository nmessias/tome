/**
 * FreeWebNovel chapter reader page template
 * Uses the same ReaderLayout and reading experience as Royal Road reader.
 */
import { ReaderLayout } from "../layout";
import type { ChapterContent } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import {
  ReaderHeader,
  TapZones,
  PageIndicator,
  ReaderNav,
  SettingsModal,
  ProgressBar,
} from "../reader-components";

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

  const readingWidth = settings.readingWidth || 650;
  const fontSizeStyle = `font-size: ${settings.font}px; line-height: ${settings.lineHeight || 1.6}; max-width: ${readingWidth}px;`;

  return (
    <ReaderLayout title={chapter.title} settings={settings} initialPage={initialPage}>
      <ProgressBar />
      <ReaderHeader
        title={chapter.title}
        subtitle={
          chapter.fictionTitle ? (
            <a href={`/fwn/fiction/${slug}`} class="fiction-link" safe>
              {chapter.fictionTitle}
            </a>
          ) : undefined
        }
        navLinks={[
          { href: "/", label: "Home" },
          { href: "/fwn/library", label: "Library" },
          { href: "/fwn/search", label: "Search" },
        ]}
      />

      <div
        class="reader-wrapper"
        data-chapter-id={chapterNum}
        data-fiction-id={slug}
        data-source="fwn"
        data-fiction-slug={slug}
        data-chapter-num={chapterNum}
      >
        <TapZones />
        <div class="reader-content" style={fontSizeStyle}>
          {chapter.content as "safe"}
        </div>
      </div>

      <PageIndicator />

      <ReaderNav
        indexLabel="Index"
        indexHref={`/fwn/fiction/${slug}`}
        prevAttrs={{
          "data-chapter-id": prevChapterNum || "",
          "data-fwn-url": chapter.prevChapterUrl || "",
          disabled: !prevChapterNum,
        }}
        nextAttrs={{
          "data-chapter-id": nextChapterNum || "",
          "data-fwn-url": chapter.nextChapterUrl || "",
          disabled: !nextChapterNum,
        }}
      />

      <SettingsModal
        fontSizeDisplay={settings.font + "px"}
        lineHeightDisplay={(settings.lineHeight || 1.6).toFixed(1)}
        dark={settings.dark}
        readingWidth={settings.readingWidth || 650}
      />

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
