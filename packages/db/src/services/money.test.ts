import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  money,
  multiplyMoney,
  subtractMoney,
  zeroMoney,
} from "./money";

const INTEGER_RE = /integer/;
const SAFE_RE = /safe integer/;
const SCALE_RE = /scale/;
const CURRENCY_RE = /currency/;
const MISMATCH_RE = /mismatch/;

describe("Money (integer minor units, no rounding in VS#1)", () => {
  it("rejects non-integer minor units and negative scale", () => {
    expect(() => money(1.5, "USD")).toThrow(INTEGER_RE);
    expect(() => money(100, "USD", -1)).toThrow(SCALE_RE);
    expect(() => money(100, "")).toThrow(CURRENCY_RE);
  });

  it("adds and subtracts amounts of the same unit", () => {
    const total = addMoney(money(1999, "USD"), money(1, "USD"));
    expect(total.minor).toBe(2000);
    expect(subtractMoney(money(2000, "USD"), money(1, "USD")).minor).toBe(1999);
  });

  it("refuses to mix currencies or scales", () => {
    expect(() => addMoney(money(100, "USD"), money(100, "GYD"))).toThrow(
      MISMATCH_RE
    );
    expect(() => addMoney(money(100, "USD", 2), money(100, "USD", 3))).toThrow(
      MISMATCH_RE
    );
  });

  it("rejects values beyond the safe-integer range", () => {
    expect(() => money(2 ** 53, "USD")).toThrow(SAFE_RE);
  });

  it("multiplies by an integer quantity only (exact, no rounding)", () => {
    expect(multiplyMoney(money(1999, "USD"), 3).minor).toBe(5997);
    expect(() => multiplyMoney(money(1999, "USD"), 1.5)).toThrow(INTEGER_RE);
  });

  it("formats by scale, including zero-decimal currencies", () => {
    expect(formatMoney(money(1999, "USD"))).toBe("19.99 USD");
    expect(formatMoney(money(-5, "USD"))).toBe("-0.05 USD");
    expect(formatMoney(money(1000, "JPY", 0))).toBe("1000 JPY");
    expect(formatMoney(zeroMoney("USD"))).toBe("0.00 USD");
  });
});
