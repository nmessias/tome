import { describe, expect, test } from "bun:test";
import { patchEdgeNav } from "../src/services/source-registry";

describe("chapter navigation discovery", () => {
  test("uses cached fiction metadata without starting a live scrape", async () => {
    let calls = 0;
    const source: any = {
      getFictionCached: () => ({ chapters: [{ id: 1 }, { id: 2 }] }),
      getFiction: async () => { calls++; throw new Error("must not fetch"); },
    };
    const chapter: any = { id: 1, ref: "1", content: "", title: "One" };
    expect((await patchEdgeNav(source, "u", "f", "1", chapter)).nextRef).toBe("2");
    expect(calls).toBe(0);
  });

  test("does not fetch when cached metadata is unavailable", async () => {
    let calls = 0;
    const source: any = {
      getFictionCached: () => null,
      getFiction: async () => { calls++; return null; },
    };
    const chapter: any = { id: 1, ref: "1", content: "", title: "One" };
    expect((await patchEdgeNav(source, "u", "f", "1", chapter)).nextRef).toBeUndefined();
    expect(calls).toBe(0);
  });
});
