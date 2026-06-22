// Money value type (charter §19/§33): integer minor units + currency + scale,
// always travelling together; never a float. VS#1 needs only EXACT integer
// arithmetic (add line totals, multiply a unit price by an integer quantity), so
// there is deliberately NO division and NO rounding policy here yet. The single
// rounding policy is a flagged business decision introduced when division first
// appears (tax — Phase 5 — and FX); see the deferred-decisions log.

export interface Money {
  readonly currency: string;
  readonly minor: number;
  readonly scale: number;
}

export function money(minor: number, currency: string, scale = 2): Money {
  // Safe-integer (not just integer): add/subtract/multiply funnel through here,
  // so this guards against silent precision loss beyond 2^53. DB columns are
  // bigint(mode:number), whose safe range matches.
  if (!Number.isSafeInteger(minor)) {
    throw new Error("Money.minor must be a safe integer number of minor units");
  }
  if (!(Number.isInteger(scale) && scale >= 0)) {
    throw new Error("Money.scale must be a non-negative integer");
  }
  if (!currency) {
    throw new Error("Money.currency is required");
  }
  return { minor, currency, scale };
}

export function zeroMoney(currency: string, scale = 2): Money {
  return money(0, currency, scale);
}

function assertSameUnit(a: Money, b: Money): void {
  if (a.currency !== b.currency || a.scale !== b.scale) {
    throw new Error(
      `Money unit mismatch: ${a.currency}/${a.scale} vs ${b.currency}/${b.scale}`
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameUnit(a, b);
  return money(a.minor + b.minor, a.currency, a.scale);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameUnit(a, b);
  return money(a.minor - b.minor, a.currency, a.scale);
}

// Multiply by an INTEGER quantity only — exact, no rounding (VS#1 invariant).
export function multiplyMoney(m: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new Error(
      "Money can only be multiplied by an integer quantity (no rounding in VS#1)"
    );
  }
  return money(m.minor * quantity, m.currency, m.scale);
}

export function formatMoney(m: Money): string {
  const sign = m.minor < 0 ? "-" : "";
  const abs = Math.abs(m.minor);
  if (m.scale === 0) {
    return `${sign}${abs} ${m.currency}`;
  }
  const padded = abs.toString().padStart(m.scale + 1, "0");
  const whole = padded.slice(0, -m.scale);
  const frac = padded.slice(-m.scale);
  return `${sign}${whole}.${frac} ${m.currency}`;
}
