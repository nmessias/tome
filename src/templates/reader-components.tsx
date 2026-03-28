/**
 * Shared reader UI components
 * Used by all reader pages (Royal Road, EPUB, FreeWebNovel)
 * to avoid duplication and ensure new features (like remote control)
 * are automatically available to all sources.
 */
import type { PropsWithChildren } from "@kitajs/html";

/**
 * Tap and click zones for page navigation
 * Identical across all reader types.
 */
export function TapZones(): JSX.Element {
  return (
    <>
      <div class="tap-zone-top"></div>
      <div class="tap-zone-bottom"></div>
      <div class="click-zone click-zone-left"></div>
      <div class="click-zone click-zone-right"></div>
    </>
  );
}

/**
 * Page position indicator (e.g. "1 / 5")
 */
export function PageIndicator({ dynamic = false }: { dynamic?: boolean }): JSX.Element {
  if (dynamic) {
    return (
      <div class="page-indicator">
        <span class="page-current">-</span>
        <span> / </span>
        <span class="page-total">-</span>
      </div>
    );
  }
  return <div class="page-indicator">1 / 1</div>;
}

/**
 * Reader navigation bar (prev/next chapter + index link)
 */
export function ReaderNav({
  prevLabel = "← Prev Ch",
  nextLabel = "Next Ch →",
  indexLabel,
  indexHref,
  prevAttrs = {},
  nextAttrs = {},
}: {
  prevLabel?: string;
  nextLabel?: string;
  indexLabel: string;
  indexHref: string;
  prevAttrs?: Record<string, string | boolean>;
  nextAttrs?: Record<string, string | boolean>;
}): JSX.Element {
  return (
    <nav class="nav-fixed">
      <button class="btn nav-prev" {...prevAttrs} safe>
        {prevLabel}
      </button>
      <a href={indexHref} class="btn btn-outline" safe>
        {indexLabel}
      </a>
      <button class="btn nav-next" {...nextAttrs} safe>
        {nextLabel}
      </button>
    </nav>
  );
}

export function FontSizeRow({ display }: { display: string }): JSX.Element {
  return (
    <div class="settings-row">
      <label>Font Size</label>
      <div class="font-controls">
        <button class="font-decrease">-</button>
        <span class="font-size-display" safe>{display}</span>
        <button class="font-increase">+</button>
      </div>
    </div>
  );
}

export function LineHeightRow({ display }: { display: string }): JSX.Element {
  return (
    <div class="settings-row">
      <label>Line Spacing</label>
      <div class="line-controls">
        <button class="line-decrease">-</button>
        <span class="line-height-display" safe>{display}</span>
        <button class="line-increase">+</button>
      </div>
    </div>
  );
}

export function ThemeToggle({ dark }: { dark: boolean }): JSX.Element {
  return (
    <div class="settings-row">
      <label>Theme</label>
      <div class="theme-controls">
        <button class={"theme-btn theme-light" + (!dark ? " active" : "")} data-theme="light">Light</button>
        <button class={"theme-btn theme-dark" + (dark ? " active" : "")} data-theme="dark">Dark</button>
      </div>
    </div>
  );
}

export function WidthSelector({ display = "650px" }: { display?: string }): JSX.Element {
  return (
    <div class="settings-row">
      <label>Width</label>
      <div class="width-controls">
        <button class="width-decrease">-</button>
        <span class="width-display" safe>{display}</span>
        <button class="width-increase">+</button>
      </div>
    </div>
  );
}

export function ProgressBar(): JSX.Element {
  return <div class="progress-bar"></div>;
}

/**
 * Remote control UI — enable/disable buttons, reconnect prompt, and QR code.
 * Shared identically across all reader types.
 */
export function RemoteControlSection(): JSX.Element {
  return (
    <>
      <div class="settings-row">
        <label>Remote Control</label>
        <div class="remote-controls">
          <button class="remote-btn" id="remote-btn">Enable</button>
          <button class="remote-btn remote-disable" id="remote-disable-btn" style="display: none;">Disable</button>
        </div>
      </div>

      <div class="remote-reconnect" id="remote-reconnect" style="display: none;">
        <p>Previous remote session found</p>
        <button class="remote-btn" id="remote-reconnect-btn">Tap to reconnect</button>
      </div>

      <div class="remote-qr" id="remote-qr" style="display: none;">
        <p style="margin-bottom: 10px; font-size: 14px;">Scan with your phone:</p>
        <img id="remote-qr-img" alt="QR Code" style="width: 200px; height: 200px; background: #eee;" />
        <p class="remote-status" id="remote-status">Waiting for connection...</p>
      </div>
    </>
  );
}

/**
 * Settings modal with font size and remote control.
 * Pass additional settings rows as children — they render between
 * the font size row and the remote control section.
 */
export function SettingsModal({
  fontSizeDisplay,
  lineHeightDisplay = "1.6",
  dark = false,
  readingWidth = 650,
  children,
}: PropsWithChildren<{
  fontSizeDisplay: string;
  lineHeightDisplay?: string;
  dark?: boolean;
  readingWidth?: number;
}>): JSX.Element {
  return (
    <div class="settings-modal">
      <div class="settings-panel">
        <h2>Settings</h2>
        <FontSizeRow display={fontSizeDisplay} />
        <LineHeightRow display={lineHeightDisplay} />
        <ThemeToggle dark={dark} />
        <WidthSelector display={(readingWidth || 650) + "px"} />
        {children}
        <RemoteControlSection />
        <button class="settings-close">Close</button>
      </div>
    </div>
  );
}

/**
 * Reader page header.
 * Renders remote icon, title, optional subtitle, nav links, and settings button.
 */
export function ReaderHeader({
  title,
  subtitle,
  navLinks,
  headerClass = "reader-header",
  remoteIconVisible = true,
  extraRight,
}: {
  title: string;
  subtitle?: JSX.Element;
  navLinks?: { href: string; label: string }[];
  headerClass?: string;
  remoteIconVisible?: boolean;
  extraRight?: JSX.Element;
}): JSX.Element {
  return (
    <header class={headerClass}>
      <div class="header-left">
        <span
          class="remote-icon"
          id="remote-icon"
          style={remoteIconVisible ? undefined : "display: none;"}
        >
          Remote
        </span>
        <h1 class="chapter-title" safe>
          {title}
        </h1>
        {subtitle as "safe"}
      </div>
      <div class="header-right">
        {navLinks && (
          <div class="header-nav">
            {navLinks.map((l) => (
              <a href={l.href} safe>{l.label}</a>
            ))}
          </div>
        )}
        {extraRight as "safe"}
        <button class="settings-btn">Aa</button>
      </div>
    </header>
  );
}
