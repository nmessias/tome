/**
 * Base HTML layout wrapper using JSX
 */
import type { PropsWithChildren } from "@kitajs/html";
import type { ReaderSettings } from "../config";
import { DEFAULT_READER_SETTINGS } from "../config";

export interface LayoutProps {
  title: string;
  css?: "base" | "reader";
  bodyClass?: string;
  scripts?: string[];
  settings?: ReaderSettings;
}

/**
 * Base document layout for regular pages
 */
export function Layout({
  title,
  children,
  css = "base",
  bodyClass = "",
  scripts = [],
  settings = DEFAULT_READER_SETTINGS,
}: PropsWithChildren<LayoutProps>): JSX.Element {
  const darkClass = settings.dark ? "dark-mode" : "";
  const fullBodyClass = [bodyClass, darkClass].filter(Boolean).join(" ");
  const cssFile = css === "reader" ? "/public/css/reader.css" : "/public/css/base.css";
  
  // Default scripts for base pages
  const defaultScripts = css === "base" ? ["/public/js/toggle.js"] : [];
  const allScripts = [...defaultScripts, ...scripts];

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title safe>{title} - E-ink Royal</title>
          <link rel="stylesheet" href={cssFile} />
        </head>
        <body class={fullBodyClass || undefined}>
          {children}
          {css === "base" && <button class="dark-toggle">Dark</button>}
          {allScripts.map((src) => (
            <script src={src}></script>
          ))}
        </body>
      </html>
    </>
  );
}

export interface ReaderLayoutProps {
  title: string;
  settings?: ReaderSettings;
}

/**
 * Layout for the reader page (custom structure)
 */
export function ReaderLayout({
  title,
  children,
  settings = DEFAULT_READER_SETTINGS,
}: PropsWithChildren<ReaderLayoutProps>): JSX.Element {
  const bodyClass = settings.dark ? "dark-mode" : "";

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title safe>{title} - E-ink Royal</title>
          <link rel="stylesheet" href="/public/css/reader.css" />
        </head>
        <body class={bodyClass || undefined}>
          {children}
          <script src="/public/js/reader.js"></script>
        </body>
      </html>
    </>
  );
}
