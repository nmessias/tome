/**
 * Chapter reader page template (Royal Road)
 * Uses SPA-style navigation with click-based pagination
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

/**
 * Chapter reader page - paginated for e-ink (SPA-style navigation)
 */
export function ReaderPage({
  chapter,
  settings = DEFAULT_READER_SETTINGS,
  initialPage = 1,
}: {
  chapter: ChapterContent;
  settings?: ReaderSettings;
  initialPage?: number;
}): JSX.Element {
  // Extract chapter IDs from URLs
  const prevChapterId = chapter.prevChapterUrl
    ? chapter.prevChapterUrl.replace("/chapter/", "")
    : "";
  const nextChapterId = chapter.nextChapterUrl
    ? chapter.nextChapterUrl.replace("/chapter/", "")
    : "";

  const readingWidth = settings.readingWidth || 650;
  const fontSizeStyle = `font-size: ${settings.font}px; line-height: ${settings.lineHeight || 1.6}; max-width: ${readingWidth}px;`;

  return (
    <ReaderLayout title={chapter.title} settings={settings} initialPage={initialPage}>
      <ProgressBar />
      <ReaderHeader
        title={chapter.title}
        subtitle={
          chapter.fictionTitle ? (
            <a href={`/fiction/${chapter.fictionId}`} class="fiction-link" safe>
              {chapter.fictionTitle}
            </a>
          ) : undefined
        }
        navLinks={[
          { href: "/", label: "Home" },
          { href: "/follows", label: "Follows" },
          { href: "/history", label: "History" },
        ]}
      />

      <div
        class="reader-wrapper"
        data-chapter-id={chapter.id}
        data-fiction-id={chapter.fictionId}
      >
        <TapZones />
        <div class="reader-content" style={fontSizeStyle}>
          {chapter.content as "safe"}
        </div>
      </div>

      <PageIndicator />

      <ReaderNav
        indexLabel="Index"
        indexHref={`/fiction/${chapter.fictionId}`}
        prevAttrs={{
          "data-chapter-id": prevChapterId || "",
          disabled: !prevChapterId,
        }}
        nextAttrs={{
          "data-chapter-id": nextChapterId || "",
          disabled: !nextChapterId,
        }}
      />

      <SettingsModal
        fontSizeDisplay={settings.font + "px"}
        lineHeightDisplay={(settings.lineHeight || 1.6).toFixed(1)}
        dark={settings.dark}
        theme={settings.theme}
        isKindle={settings.isKindle}
        readingWidth={settings.readingWidth || 650}
      />
    </ReaderLayout>
  );
}
