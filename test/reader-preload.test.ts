import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function makeReader() {
  const source = readFileSync("public/js/reader.js", "utf8");
  const cache = source.slice(source.indexOf("  var CACHE_LIMIT = 5;"), source.indexOf("  function updateNavButtons"));
  const navigation = source.slice(source.indexOf("  function navigateToChapter("), source.indexOf("  function onPopState("));
  if (!cache || !navigation) throw new Error("Reader functions not found");
  const requests: any[] = [];
  const progress: string[] = [];
  const renders: unknown[] = [];
  const attributes: Record<string, string> = {};
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  class Xhr {
    readyState = 0;
    status = 0;
    responseText = "";
    onreadystatechange = () => {};
    onerror = () => {};
    ontimeout = () => {};
    timeout = 0;
    constructor() { requests.push(this); }
    open() {}
    send() {}
    complete(status: number, body: string) {
      this.status = status;
      this.responseText = body;
      this.readyState = 4;
      this.onreadystatechange();
    }
  }
  const context: any = {
    S: { cache: {}, els: { content: {
      setAttribute: (key: string, value: string) => { attributes[key] = value; },
      removeAttribute: (key: string) => { delete attributes[key]; },
    } }, source: "royalroad", fictionRef: "1", chapterRef: "1" },
    XMLHttpRequest: Xhr,
    chapterApiUrl: (ref: string) => "/api/" + ref,
    chapterUrl: (ref: string) => "/chapter/" + ref,
    reportProgress: (ref: string) => progress.push(ref),
    renderChapter: (chapter: unknown) => renders.push(chapter),
    window: { location: { href: "" }, history: { replaceState() {} } },
    setTimeout: (callback: () => void) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
    console,
  };
  runInNewContext(cache + "\n" + navigation, context);
  return { context, requests, progress, renders, attributes, timers };
}

describe("reader chapter preload", () => {
  test("joins an in-flight preload and reports progress only on navigation", () => {
    const { context, requests, progress, renders, attributes } = makeReader();
    context.fetchChapter("2", () => {});
    context.navigateToChapter("2", false);
    expect(requests).toHaveLength(1);
    expect(attributes["aria-busy"]).toBe("true");
    expect(progress).toEqual([]);
    requests[0].complete(200, JSON.stringify({ ref: "2", content: "chapter" }));
    expect(progress).toEqual(["2"]);
    expect(renders).toHaveLength(1);
    expect(attributes["aria-busy"]).toBeUndefined();
  });

  test("failed preload falls back to a chapter page", () => {
    const { context, requests, progress } = makeReader();
    context.fetchChapter("2", () => {});
    context.navigateToChapter("2", false);
    requests[0].complete(503, "");
    expect(context.window.location.href).toBe("/chapter/2");
    expect(progress).toEqual([]);
  });

  test("repeated taps reuse one request and report progress once", () => {
    const { context, requests, progress } = makeReader();
    context.fetchChapter("2", () => {});
    context.navigateToChapter("2", false);
    context.navigateToChapter("2", false);
    requests[0].complete(200, JSON.stringify({ ref: "2", content: "chapter" }));
    expect(requests).toHaveLength(1);
    expect(progress).toEqual(["2"]);
  });

  test("timeout and later completions do not navigate twice", () => {
    const { context, requests, progress, timers } = makeReader();
    context.fetchChapter("2", () => {});
    context.navigateToChapter("2", false);
    [...timers.values()][0]();
    expect(context.window.location.href).toBe("/chapter/2");
    requests[0].complete(200, JSON.stringify({ ref: "2", content: "chapter" }));
    expect(progress).toEqual([]);
  });

  test("an older preload does not override a newer navigation", () => {
    const { context, requests, progress } = makeReader();
    context.fetchChapter("2", () => {});
    context.navigateToChapter("2", false);
    context.navigateToChapter("3", false);
    requests[0].complete(200, JSON.stringify({ ref: "2", content: "chapter" }));
    expect(context.window.location.href).toBe("/chapter/3");
    expect(progress).toEqual([]);
  });
});

test("saving reader display settings preserves read-ahead depth", () => {
  const source = readFileSync("public/js/reader.js", "utf8");
  const start = source.indexOf("  function setCookie(");
  const end = source.indexOf("  // UI VISIBILITY", start);
  if (start < 0 || end < 0) throw new Error("Reader settings functions not found");
  const document: any = {
    cookie: "reader_settings=" + encodeURIComponent(JSON.stringify({ readAheadDepth: 7 })),
    body: { classList: { contains: () => false } },
  };
  const context: any = {
    document,
    localStorage: { setItem() {} },
    S: { fontSizes: [18], fontIndex: 0, lineHeights: [1.6], lineHeightIndex: 0, widths: [650], widthIndex: 0, mode: "paged" },
  };
  runInNewContext(source.slice(start, end), context);
  context.saveSettings();
  const value = decodeURIComponent(document.cookie.split(";")[0].split("=")[1]);
  expect(JSON.parse(value).readAheadDepth).toBe(7);
});
