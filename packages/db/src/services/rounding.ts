// BigInt mul-div with an explicit rounding policy (charter §19 "define one
// rounding policy and apply it consistently"; Phase-4 #6). Computes
// round(a*b / c) with EXACT BigInt intermediate arithmetic, so the product a*b
// never loses precision past 2^53 — the failure mode #6 records for large-tenant
// valuation, where a JS-number multiply would silently corrupt the result.
//
// This is the single primitive every tax / FX / commission / proportional-
// allocation division MUST route through. The per-currency / per-tax /
// per-jurisdiction POLICY that selects the mode is resolved elsewhere (the
// settings resolver, §6) and passed in — this primitive is policy-neutral; it
// only does correct arithmetic for the mode it is given.

export const ROUNDING_MODES = ["half_even", "half_up"] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

// number inputs must be exact (safe integers); for magnitudes beyond 2^53 the
// caller passes a bigint, which is accepted as-is.
function toBigInt(value: bigint | number, label: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `mulDivRound: ${label} must be a safe integer number or a bigint (got ${value})`
    );
  }
  return BigInt(value);
}

export function mulDivRound(
  a: bigint | number,
  b: bigint | number,
  c: bigint | number,
  mode: RoundingMode
): bigint {
  if (!ROUNDING_MODES.includes(mode)) {
    throw new Error(`mulDivRound: unknown rounding mode "${mode}"`);
  }
  const aa = toBigInt(a, "a");
  const bb = toBigInt(b, "b");
  let cc = toBigInt(c, "c");
  if (cc === 0n) {
    throw new Error("mulDivRound: divisor c must not be zero");
  }

  let num = aa * bb;
  // Normalise so the divisor is positive; the sign rides on num. This keeps the
  // tie/round logic in one direction regardless of the sign of c.
  if (cc < 0n) {
    num = -num;
    cc = -cc;
  }

  const q = num / cc; // BigInt division truncates toward zero
  const r = num % cc; // remainder sign follows num
  if (r === 0n) {
    return q;
  }

  // The exact value lies between q (toward zero) and q + sign (away from zero).
  // Distance to q is |r|/cc; distance to q+sign is (cc - |r|)/cc. Compare |r|*2
  // to cc to decide which is nearer, with the tie at |r|*2 == cc.
  const sign = num < 0n ? -1n : 1n;
  const absR2 = (r < 0n ? -r : r) * 2n;
  if (absR2 > cc) {
    return q + sign;
  }
  if (absR2 < cc) {
    return q;
  }
  // Exact tie.
  if (mode === "half_up") {
    return q + sign; // half away from zero (commercial rounding)
  }
  // half_even (banker's): pick the even neighbour. q is toward zero, q+sign away.
  return q % 2n === 0n ? q : q + sign;
}
