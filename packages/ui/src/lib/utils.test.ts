import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// Smoke test — proves the Vitest gate runs (charter §46). Real coverage grows per module.
describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "text-sm")).toContain("px-2");
  });

  it("dedupes conflicting tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "c")).toBe("a c");
  });
});
