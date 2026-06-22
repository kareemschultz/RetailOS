import { describe, expect, it } from "vitest";
import { hashPayload } from "./idempotency";

describe("hashPayload (canonical, payload-hash protection)", () => {
  it("is stable across object key order", () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
    expect(hashPayload({ x: { p: 1, q: 2 } })).toBe(
      hashPayload({ x: { q: 2, p: 1 } })
    );
  });

  it("differs for different payloads", () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload([1, 2])).not.toBe(hashPayload([2, 1]));
    expect(hashPayload(null)).not.toBe(hashPayload({}));
  });
});
