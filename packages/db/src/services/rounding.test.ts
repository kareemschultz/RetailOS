import { describe, expect, it } from "vitest";
import { mulDivRound, ROUNDING_MODES } from "./rounding";

const SAFE_RE = /safe integer/;
const ZERO_RE = /zero/;
const MODE_RE = /rounding mode/;

// mulDivRound(a, b, c, mode) computes round(a*b / c) with EXACT BigInt
// intermediate arithmetic (a*b never loses precision the way JS number would
// past 2^53 — the #6 reason this primitive exists). It is the single seam every
// tax / FX / commission / proportional-allocation division will route through.
describe("mulDivRound — exact BigInt mul-div with rounding policy", () => {
  it("exposes exactly the two supported modes", () => {
    expect([...ROUNDING_MODES].sort()).toEqual(["half_even", "half_up"]);
  });

  it("returns the exact quotient when c divides a*b (no rounding either way)", () => {
    // 30 / 5 = 6 exactly; both modes agree.
    expect(mulDivRound(10, 3, 5, "half_even")).toBe(6n);
    expect(mulDivRound(10, 3, 5, "half_up")).toBe(6n);
    // 100 / 4 = 25
    expect(mulDivRound(25, 4, 4, "half_up")).toBe(25n);
    // zero numerator
    expect(mulDivRound(0, 999, 7, "half_even")).toBe(0n);
  });

  it("rounds toward zero when the remainder is below half", () => {
    // 7 / 3 = 2.333… → 2
    expect(mulDivRound(7, 1, 3, "half_even")).toBe(2n);
    expect(mulDivRound(7, 1, 3, "half_up")).toBe(2n);
    // 14% VAT on 99 minor = 1386/100 = 13.86 → 14? no: 13.86 rounds to 14.
    // 13.86 remainder 86 > 50 ⇒ up. Use a below-half case: 1330/100 = 13.30 → 13
    expect(mulDivRound(1330, 1, 100, "half_up")).toBe(13n);
  });

  it("rounds away from zero when the remainder is above half", () => {
    // 8 / 3 = 2.666… → 3
    expect(mulDivRound(8, 1, 3, "half_even")).toBe(3n);
    expect(mulDivRound(8, 1, 3, "half_up")).toBe(3n);
    // 1386/100 = 13.86 → 14
    expect(mulDivRound(1386, 1, 100, "half_even")).toBe(14n);
  });

  // The owner-requested divergence cases: ties where half_up and half_even
  // produce DIFFERENT results. Divergence happens at a half-integer whose
  // toward-zero neighbour is EVEN (0.5, 2.5, 4.5…); at 1.5/3.5 they agree.
  it("half_up rounds ties AWAY FROM ZERO", () => {
    expect(mulDivRound(1, 1, 2, "half_up")).toBe(1n); // 0.5 → 1
    expect(mulDivRound(5, 1, 2, "half_up")).toBe(3n); // 2.5 → 3
    expect(mulDivRound(3, 1, 2, "half_up")).toBe(2n); // 1.5 → 2
    expect(mulDivRound(9, 1, 2, "half_up")).toBe(5n); // 4.5 → 5
  });

  it("half_even rounds ties to the EVEN neighbour", () => {
    expect(mulDivRound(1, 1, 2, "half_even")).toBe(0n); // 0.5 → 0
    expect(mulDivRound(5, 1, 2, "half_even")).toBe(2n); // 2.5 → 2
    expect(mulDivRound(3, 1, 2, "half_even")).toBe(2n); // 1.5 → 2
    expect(mulDivRound(7, 1, 2, "half_even")).toBe(4n); // 3.5 → 4
    expect(mulDivRound(9, 1, 2, "half_even")).toBe(4n); // 4.5 → 4
  });

  it("the two modes DIVERGE exactly at even-lower-neighbour ties", () => {
    // 0.5, 2.5, 4.5 diverge; 1.5, 3.5 agree.
    for (const odd of [1, 5, 9]) {
      expect(mulDivRound(odd, 1, 2, "half_up")).not.toBe(
        mulDivRound(odd, 1, 2, "half_even")
      );
    }
    for (const odd of [3, 7]) {
      expect(mulDivRound(odd, 1, 2, "half_up")).toBe(
        mulDivRound(odd, 1, 2, "half_even")
      );
    }
  });

  it("handles negatives symmetrically (sign-aware ties)", () => {
    // -0.5 → half_up -1 (away from zero), half_even 0 (even)
    expect(mulDivRound(-1, 1, 2, "half_up")).toBe(-1n);
    expect(mulDivRound(-1, 1, 2, "half_even")).toBe(0n);
    // -2.5 → half_up -3, half_even -2
    expect(mulDivRound(-5, 1, 2, "half_up")).toBe(-3n);
    expect(mulDivRound(-5, 1, 2, "half_even")).toBe(-2n);
    // -2.666… → -3 both
    expect(mulDivRound(-8, 1, 3, "half_up")).toBe(-3n);
    // -2.333… → -2 both
    expect(mulDivRound(-7, 1, 3, "half_even")).toBe(-2n);
  });

  it("normalises a negative divisor (sign of c does not change magnitude rules)", () => {
    // 5 / -2 = -2.5 ⇒ identical to -5 / 2
    expect(mulDivRound(5, 1, -2, "half_up")).toBe(-3n);
    expect(mulDivRound(5, 1, -2, "half_even")).toBe(-2n);
    // -5 / -2 = 2.5 ⇒ identical to 5 / 2
    expect(mulDivRound(-5, 1, -2, "half_up")).toBe(3n);
    expect(mulDivRound(-5, 1, -2, "half_even")).toBe(2n);
  });

  it("is EXACT beyond 2^53 (the whole reason for BigInt — accepts bigint inputs)", () => {
    // a = 2^60, b = 3, c = 7 → (2^60 * 3) / 7, rounded.
    const a = 2n ** 60n;
    const num = a * 3n; // 3458764513820540928
    const q = num / 7n; // 494109216260077275 remainder 3
    // remainder 3 of 7 < 3.5 ⇒ toward zero ⇒ q
    expect(mulDivRound(a, 3n, 7n, "half_even")).toBe(q);
    // a = c ⇒ exact b regardless of size
    expect(mulDivRound(a, a, a, "half_up")).toBe(a);
    // a product a JS number would corrupt: (2^53+1) is unsafe as number, pass bigint
    const big = 2n ** 53n + 1n;
    expect(mulDivRound(big, 2n, 2n, "half_even")).toBe(big);
  });

  it("rejects c == 0", () => {
    expect(() => mulDivRound(5, 1, 0, "half_even")).toThrow(ZERO_RE);
  });

  it("rejects non-safe-integer NUMBER inputs (pass bigint for large values)", () => {
    expect(() => mulDivRound(2 ** 53, 1, 2, "half_even")).toThrow(SAFE_RE);
    expect(() => mulDivRound(1.5, 1, 2, "half_even")).toThrow(SAFE_RE);
    expect(() => mulDivRound(5, 2 ** 53, 2, "half_up")).toThrow(SAFE_RE);
  });

  it("rejects an unknown rounding mode", () => {
    // @ts-expect-error — exercising the runtime guard with a bad mode
    expect(() => mulDivRound(5, 1, 2, "ceil")).toThrow(MODE_RE);
  });
});
