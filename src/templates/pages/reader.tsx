/**
 * Unified chapter reader page (ADR-0002)
 * Uses SPA-style navigation with click-based pagination.
 */
import { ReaderLayout } from "../layout";
import type { ChapterContent } from "../../types";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";
import type { Source } from "../../services/source-registry";
import {
  ReaderHeader,
  TapZones,
  PageIndicator,
  ReaderNav,
  SettingsModal,
  ProgressBar,
  ModeSelector,
  ScrollSmoothSelector,
} from "../reader-components";

const SAVE_IN_BACKGROUND =
  "var x=new XMLHttpRequest();x.open('POST',this.action,true);" +
  "x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');" +
  "x.setRequestHeader('X-Requested-With','XMLHttpRequest');x.send('');" +
  "var b=this.getElementsByTagName('button')[0];b.disabled=true;b.innerHTML='Saving in the background';return false";

/**
 * Chapter reader page - paginated for e-ink (SPA-style navigation)
 */
export function ReaderPage({
  chapter,
  source,
  fictionRef,
  settings = DEFAULT_READER_SETTINGS,
  initialPage = 1,
  trackProgress = false,
}: {
  chapter: ChapterContent;
  source: Source;
  fictionRef: string;
  settings?: ReaderSettings;
  initialPage?: number;
  trackProgress?: boolean;
}): JSX.Element {
  const prevRef = chapter.prevRef || "";
  const nextRef = chapter.nextRef || "";
  const readingWidth = settings.readingWidth || 650;
  const fontSizeStyle = `font-size: ${settings.font}px; line-height: ${settings.lineHeight || 1.6}; max-width: ${readingWidth}px;`;
  const indexHref = `/read/${source.name}/${fictionRef}`;
  // Only where a reader goes next: Royal Road's seven list links made a
  // cramped row of 11px buttons too small to hit on the Kindle. The chapter
  // list is the footer's "Chapters" button.
  const navLinks = [
    { href: "/", label: "Home" },
    ...(source.capabilities.follows ? [{ href: `/read/${source.name}/follows`, label: "Follows" }] : []),
  ];

  return (
    <ReaderLayout title={chapter.title} settings={settings} initialPage={initialPage}>
      <ProgressBar />
      <ReaderHeader
        title={chapter.title}
        subtitle={
          <div class="header-sub">
            {chapter.fictionTitle && (
              <a href={indexHref} class="fiction-link" safe>
                {chapter.fictionTitle}
              </a>
            )}
            {/* Updated by reader.js on in-page chapter turns. */}
            <span class="chapter-position" safe>
              {chapter.chapterNumber && chapter.chapterCount
                ? `Chapter ${chapter.chapterNumber} of ${chapter.chapterCount}`
                : ""}
            </span>
          </div>
        }
        navLinks={navLinks}
      />

      <div id="chapter-stale-notice" role="status" style={chapter.cacheStale ? "padding: 8px;" : "display: none; padding: 8px;"}>
        Showing a saved copy; the source could not be reached.
      </div>

      <div
        class="reader-wrapper"
        data-source={source.name}
        data-fiction-ref={fictionRef}
        data-chapter-ref={chapter.ref ?? ""}
        data-track-progress={trackProgress ? "1" : undefined}
      >
        <TapZones />
        <div class="reader-content" style={fontSizeStyle}>
          {chapter.content as "safe"}
        </div>
      </div>

      <PageIndicator />

      <ReaderNav
        indexLabel="Chapters"
        indexHref={indexHref}
        prevAttrs={{
          "data-ref": prevRef || "",
          disabled: !prevRef,
        }}
        nextAttrs={{
          "data-ref": nextRef || "",
          disabled: !nextRef,
        }}
      />

      <SettingsModal
        fontSizeDisplay={settings.font + "px"}
        lineHeightDisplay={(settings.lineHeight || 1.6).toFixed(1)}
        dark={settings.dark}
        theme={settings.theme}
        isKindle={settings.isKindle}
        readingWidth={settings.readingWidth || 650}
      >
        <ModeSelector mode={settings.mode ?? "paged"} />
        <ScrollSmoothSelector />
        {source.saveForOffline && (
          <div class="settings-row">
            <label>Offline</label>
            {/* Saves in the background so the reader keeps its page; without
                JS the form posts and comes back to this chapter. */}
            <form
              method="POST"
              action={`/read/${source.name}/${fictionRef}/offline`}
              onsubmit={SAVE_IN_BACKGROUND}
            >
              <input type="hidden" name="back" value={`/read/${source.name}/${fictionRef}/${chapter.ref ?? ""}`} />
              <button type="submit" class="remote-btn">Save unread chapters</button>
            </form>
          </div>
        )}
      </SettingsModal>
    </ReaderLayout>
  );
}
