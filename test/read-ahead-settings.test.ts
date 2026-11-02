import { describe, expect, test } from "bun:test";
import { parseReaderSettings } from "../src/server";

function cookie(value: unknown): string {
  return "reader_settings=" + encodeURIComponent(JSON.stringify({ readAheadDepth: value }));
}

describe("per-device read-ahead settings", () => {
  test("accepts the bounded range including zero", () => {
    expect(parseReaderSettings(cookie(0)).readAheadDepth).toBe(0);
    expect(parseReaderSettings(cookie(10)).readAheadDepth).toBe(10);
  });

  test("ignores invalid or out-of-range settings", () => {
    for (const value of [-1, 11, 1.5, "3", null]) {
      expect(parseReaderSettings(cookie(value)).readAheadDepth).toBeUndefined();
    }
  });
});
