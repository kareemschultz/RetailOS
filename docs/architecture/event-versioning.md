# RetailOS — Event Versioning Policy

- **Status:** PLAN / governing contract policy — applies to every domain event in the outbox (charter §13 "upcast older payload versions", §24 "events versioned, replayable"). Short by design. Read alongside the per-phase `event-map-phase{2,3,4}.md` and `cross-phase-dependencies.md`.
- **Why:** RetailOS is heavily event-driven and events are **durable, replayable, cross-phase contracts** (a `sale.created` written today may be consumed by Accounting tomorrow and replayed by Analytics next year). Once an event shape ships, changing it is expensive. This policy makes change **additive and safe** by default.

## 1. The `version` field

- Every event envelope carries `version` (integer, **default 1**) — already on the outbox (`emitEvent`).
- `version` is **per event type** (`sale.created` v1, v2 … independent of `payment.received`'s version).
- **Bump `version` ONLY for a breaking change** (a field removed, renamed, retyped, or a semantic change to an existing field). An additive change does **NOT** bump the version (see §2).
- The producer always writes the **current** version. Consumers must tolerate **any** version ≤ current (via upcasting, §4).

## 2. Additive fields (the default — no version bump)

- **Adding a field is NOT a breaking change** and does **not** bump `version`, IF the field is **reserved present-but-null** until populated (the Phase-2 lesson: *reserve deferred fields nullable, don't ship them absent*).
- A consumer bound to v1 ignores fields it doesn't know; a consumer wanting the new field treats `null`/absent as "not provided".
- **Rule:** prefer additive evolution. Reserve a field as nullable in the contract the moment you know a future consumer will need it (e.g. `salesRepId: null`, `restockLocationId: null`), even before any producer populates it. Adding `present-but-null → present-with-value` later is additive; `absent → present` is breaking. Assert key PRESENCE in the producer's contract test (`toHaveProperty`) so an additive field can't silently regress to absent.

## 3. Deprecated fields

- **Never hard-delete a field from a shipped event type.** Mark it deprecated in the event-map (`// DEPRECATED vN — replaced by X`), keep emitting it (or `null`) until **every** consumer has migrated off it, then remove it in a **version bump** with an upcaster (§4) that maps old→new.
- Deprecation is a two-release dance (expand/contract, mirroring the migration rule): (1) add the replacement field (additive); (2) consumers migrate; (3) later release stops emitting the old field and bumps `version`.

## 4. Upcasting strategy

- A consumer reads events of **any** version ≤ current by running them through an **upcaster chain**: `upcast_v1_to_v2`, `upcast_v2_to_v3`, … each a pure function `(payload) -> payload` that fills/renames fields to the next shape. The consumer always operates on the **latest** shape after upcasting.
- Upcasters live with the **consumer** (Accounting/Analytics own how they interpret history), keyed by `(type, fromVersion)`. They must be **pure and deterministic** (replay-safe — §5).
- An upcaster may only **add or transform** to reach the newer shape from older data; it must never require data the old event didn't carry. If a v2 field genuinely cannot be derived from a v1 payload, the upcaster sets it to a documented default/`null` — never invents a value (the "don't fabricate" discipline).
- Producers do **not** upcast — they always emit current. Only consumers upcast on read/replay.

## 5. Replay behavior

- Events are **append-only and replayable** (outbox, §24). A consumer MUST be **idempotent**: replaying an event produces the same end state, never a double effect. The mechanism is the consumer dedup key `(tenant_id, outbox_event_id, posting_kind)` written in the same tx as the side effect (Phase-5 INV-P5-7) — a redelivery returns the existing result, it does not re-post.
- Replay is **upcast-then-apply**: an old-version event is upcast (§4) to the current shape, then applied through the same idempotent path as a live event. Because upcasters are pure, a replay of a historical event yields the same result every time.
- **Server time is authoritative** for posting (`occurredAt` is server-injected; device clocks untrusted, §14) — replay does not change an event's `occurredAt`, so re-posting lands in the same period.
- **Ordering on replay:** events that depend on others (a `sale.refunded` needs its `sale.created`) carry stable source/original IDs (`originalSaleId`) and the consumer **parks** an event whose dependency hasn't been applied (Phase-5 INV-P5-8), draining when it arrives — replay-order-independent.

## 6. Checklist when changing an event

1. Additive + reservable as nullable? → add it, reserve null, **no version bump**, assert presence in the contract test. Done.
2. Removing/renaming/retyping/semantic change? → **breaking**: bump `version`, write the consumer upcaster `vN→vN+1`, deprecate (don't delete) the old field through the expand/contract dance.
3. New event TYPE? → add to `DomainEventType` ONLY if something emits it (don't enumerate an unemitted event — Phase-2 lesson); add its contract to the phase `event-map` + a row in `cross-phase-dependencies.md`.
4. Always: keep money a triple (`*Minor`+currency+scale), carry stable source/reversal IDs, keep the payload **self-sufficient for the consumer to post from the event alone** (no re-reading mutable OLTP at consume time).
