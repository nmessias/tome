import { describe, expect, test } from "bun:test";
import { hasSameOrigin, mayManageCache } from "../src/services/cache-access";

describe("cache settings access", () => {
  test("requires an administrator when authentication is enabled", () => {
    const request = new Request("https://tome.example/settings/cache/clear/all", { method: "POST" });
    expect(mayManageCache(request, false, true)).toBe(false);
    expect(mayManageCache(request, true, true)).toBe(true);
    expect(mayManageCache(request, false, false)).toBe(true);
  });

  test("rejects mismatched or invalid origins", () => {
    const crossSite = new Request("https://tome.example/settings", { headers: { Origin: "https://other.example" } });
    const sameSite = new Request("https://tome.example/settings", { headers: { Origin: "https://tome.example" } });
    expect(hasSameOrigin(crossSite)).toBe(false);
    expect(hasSameOrigin(sameSite)).toBe(true);
  });
});
