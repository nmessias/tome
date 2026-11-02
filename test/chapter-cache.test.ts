import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { deleteChapterCacheBook, listChapterCacheBooks } from "../src/services/chapter-cache";

function setup() {
  const db = new Database(":memory:");
  db.run("CREATE TABLE cache (url TEXT PRIMARY KEY, content TEXT NOT NULL, expires_at INTEGER NOT NULL)");
  const put = (key: string, content: string) => db.run("INSERT INTO cache VALUES (?, ?, 9999999999)", [key, content]);
  const metadata = (fictionRef: string, chapterRef: string) => JSON.stringify({
    source: "royalroad", fictionRef, chapterRef, fictionTitle: "Book " + fictionRef, cacheKey: "chapter:" + chapterRef,
  });
  put("chapter:1", "é");
  put("stale:chapter:1", "é");
  put("chapter-meta:royalroad:10:1", metadata("10", "1"));
  put("chapter:2", "other");
  put("chapter-meta:royalroad:20:2", metadata("20", "2"));
  put("unrelated", "keep");
  return db;
}

describe("per-novel chapter cache metadata", () => {
  test("counts chapters once and measures both cached copies in bytes", () => {
    const db = setup();
    expect(listChapterCacheBooks(db, 0)).toEqual([
      { source: "royalroad", fictionRef: "10", title: "Book 10", chapterCount: 1, size: 4 },
      { source: "royalroad", fictionRef: "20", title: "Book 20", chapterCount: 1, size: 5 },
    ]);
    db.close();
  });

  test("deletes only the selected novel and ignores forged metadata", () => {
    const db = setup();
    db.run("INSERT INTO cache VALUES (?, ?, 9999999999)", ["chapter-meta:royalroad:10:3", JSON.stringify({ source: "royalroad", fictionRef: "10", fictionTitle: "bad", chapterRef: "3", cacheKey: "unrelated" })]);
    expect(deleteChapterCacheBook(db, "royalroad", "10")).toBe(1);
    expect(db.query("SELECT content FROM cache WHERE url = 'chapter:2'").get()).toBeTruthy();
    expect(db.query("SELECT content FROM cache WHERE url = 'unrelated'").get()).toBeTruthy();
    expect(db.query("SELECT content FROM cache WHERE url = 'stale:chapter:1'").get()).toBeNull();
    db.close();
  });
});
