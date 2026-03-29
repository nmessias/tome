/**
 * Base HTML layout wrapper using JSX
 */
import type { PropsWithChildren } from "@kitajs/html";
import type { ReaderSettings } from "../config";
import type { SourceType } from "../services/sources";
import { DEFAULT_READER_SETTINGS, APP_VERSION } from "../config";
import { Header } from "./components";

export interface LayoutProps {
  title: string;
  css?: "base" | "reader";
  bodyClass?: string;
  scripts?: string[];
  settings?: ReaderSettings;
  currentPath?: string;
  enabledSources?: SourceType[];
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
  currentPath = "",
  enabledSources = [],
}: PropsWithChildren<LayoutProps>): JSX.Element {
  const themeClass = settings.theme === 'sepia' ? 'sepia-mode' : (settings.dark ? "dark-mode" : "");
  const kindleClass = settings.isKindle ? "kindle" : "";
  const fullBodyClass = [bodyClass, themeClass, kindleClass].filter(Boolean).join(" ");
  const cssFile = css === "reader" 
    ? `/public/css/reader.css?v=${APP_VERSION}` 
    : `/public/css/base.css?v=${APP_VERSION}`;
  
  const defaultScripts = css === "base" ? [`/public/js/toggle.js?v=${APP_VERSION}`] : [];
  const allScripts = [...defaultScripts, ...scripts];

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title safe>{title} - Tome</title>
          <link rel="stylesheet" href={cssFile} />
          <link rel="icon" type="image/x-icon" href="/public/favicon.ico" />
          <link rel="icon" type="image/png" sizes="16x16" href="/public/favicon-16x16.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/public/favicon-32x32.png" />
          <link rel="apple-touch-icon" href="/public/apple-touch-icon.png" />
        </head>
        <body class={fullBodyClass || undefined}>
          <Header currentPath={currentPath} enabledSources={enabledSources} />
          <main class="main">
            {children}
          </main>
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
  initialPage?: number;
}

/**
 * Layout for reader page (custom structure)
 */
export function ReaderLayout({
  title,
  children,
  settings = DEFAULT_READER_SETTINGS,
  initialPage = 1,
}: PropsWithChildren<ReaderLayoutProps>): JSX.Element {
  const themeClass = settings.theme === 'sepia' ? 'sepia-mode' : (settings.dark ? "dark-mode" : "");
  const kindleClass = settings.isKindle ? "kindle" : "";
  const bodyClass = [themeClass, kindleClass].filter(Boolean).join(" ");
  
  // Inline script to disable browser scroll restoration and set initial page
  // Must run before any content renders to prevent flash
  const initScript = `if('scrollRestoration'in history)history.scrollRestoration='manual';window.__INITIAL_PAGE__=${initialPage};`;
  
  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title safe>{title} - Tome</title>
          <script>{initScript as "safe"}</script>
          <link rel="stylesheet" href={`/public/css/reader.css?v=${APP_VERSION}`} />
          <link rel="icon" type="image/x-icon" href="/public/favicon.ico" />
          <link rel="icon" type="image/png" sizes="16x16" href="/public/favicon-16x16.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/public/favicon-32x32.png" />
          <link rel="apple-touch-icon" href="/public/apple-touch-icon.png" />
        </head>
        <body class={bodyClass || undefined}>
          {children}
          <script src={`/public/js/reader.js?v=${APP_VERSION}`}></script>
        </body>
      </html>
    </>
  );
}
