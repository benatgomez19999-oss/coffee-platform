# ALLOC-2 — Prisma Snapshot Builder + Internal Allocation Dry Run

Sprint scope: build the adapter layer that turns real DB state into
`LotAllocationSnapshot[]` and expose two read-only internal endpoints behind
`requireDevRoute`. No customer-facing behaviour change. No schema migration.
No write paths.

---

## 1. Files created / changed

| Path | Role |
|---|---|
| [src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts](../../src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts) | Pure mapping + aggregation helpers (Prisma-free at runtime) |
| [src/services/allocation/snapshot/lotAllocationSnapshot.service.ts](../../src/services/allocation/snapshot/lotAllocationSnapshot.service.ts) | `buildAllocationSnapshots(options?)` — three batched queries, no N+1 |
| [app/api/internal/allocation/run/route.ts](../../app/api/internal/allocation/run/route.ts) | `GET` — full dry-run, sorted by surface then lotNumber |
| [app/api/internal/allocation/lot/[id]/route.ts](../../app/api/internal/allocation/lot/[id]/route.ts) | `GET` — single-lot inspection, 404 when not found |
| [src/services/allocation/__tests__/lotAllocationSnapshot.mapper.test.ts](../../src/services/allocation/__tests__/lotAllocationSnapshot.mapper.test.ts) | 19 mapper / aggregation / integration tests |
| [src/services/allocation/domain/types.ts](../../src/services/allocation/domain/types.ts) | Added optional `committedContractMonthlyGreenKg` and `committedContractHorizonGreenKg` for downstream display (engine ignores them) |

**Untouched** — verified by hand: Prisma schema, migrations, marketplace UI,
client dashboard, EU partner dashboard, contract / demand-intent / supply /
shipment services, pricing, engine/core, CoffeeAssistant.

---

## 2. Snapshot builder behaviour

`buildAllocationSnapshots(options?)` runs **exactly three queries** regardless
of lot count:

```
db.greenLot.findMany   ── lots in DRAFT | PUBLISHED | RESERVED | SOLD
db.contract.findMany   ── status in AWAITING_SIGNATURE | SIGNED | ACTIVE,
                          greenLotId in lotIds
db.demandIntent.groupBy ── status OPEN, expiresAt > now, deltaKg > 0,
                          greenLotId in lotIds, _sum.deltaKg
```

In-memory aggregation:

| Per-lot field | Source | Formula |
|---|---|---|
| `committedContractMonthlyGreenKg` | sum of `monthlyGreenKg` | falls back to `monthlyVolumeKg` for legacy contracts (mirrors [supply.service.ts:82-84](../../src/services/system/supply.service.ts#L82-L84)) |
| `committedContractHorizonGreenKg` | sum of `monthlyGreenKg × max(remainingMonths, 1)` | the conservative obligation a marketplace residual must respect |
| `committedContractMonthsRemaining` | longest remaining months across contracts on this lot | used as audit context |
| `committedContractGreenKg` (engine input) | **= horizon** | so the pure engine deducts the full obligation from `availableGreenKg` |
| `reservedIntentGreenKg` | `_sum.deltaKg` from groupBy | matches OPEN-only filter in [supply.service.ts:93-99](../../src/services/system/supply.service.ts#L93-L99) |

Roast yield resolution uses the canonical helper at
[src/lib/roastYield.ts](../../src/lib/roastYield.ts) — never re-implemented.
`usedDefaultRoastYield` is set when the GreenLot row carries
`estimatedRoastYield === null` (the helper's own clamping is invisible to us
on purpose — only the upstream null is signal).

### Numeric guards (mapper-local)

| Input | Guard |
|---|---|
| `monthlyGreenKg` null | falls through to `monthlyVolumeKg` |
| both monthly fields null/0/negative/non-finite | row dropped (no commitment) |
| `remainingMonths` null | treated as 1 |
| `remainingMonths < 0` or non-finite | treated as 0, but horizon multiplier floors at 1 (`max(1, x)`) so an "ending this month" contract still owes one delivery |
| `deltaKg` null/negative/non-finite | row dropped |
| numeric snapshot fields negative | clamped to 0 in mapper |

### Why the engine sees `committedContractGreenKg = horizon`, not monthly

ALLOC-1 deducts `committedContractGreenKg` from `availableGreenKg` once. If we
fed it monthly, a 5-tonne lot with a 12-month / 100 kg-per-month contract
would be considered to have ~4 900 kg "free" — even though 1 200 kg of that
is already promised to deliveries we haven't yet drawn. That would cause the
engine to release future contract obligations to marketplace.

The snapshot builder fills the engine-facing field with the full horizon. We
also ship `committedContractMonthlyGreenKg` and `committedContractHorizonGreenKg`
on the snapshot so the dry-run dashboard can show both numbers without a
second computation.

`getContractableSupply` in `src/services/system/supply.service.ts` is **untouched** —
it still deducts monthly, which is the right floor for "can a new contract
sign one more monthly delivery against this lot today?". That's a different
question from "how much can we strategically release to marketplace?".

---

## 3. Endpoint response shapes

### `GET /api/internal/allocation/run`

```jsonc
{
  "snapshotsTakenAt": "2026-05-08T12:34:56.789Z",
  "policyVersion": "allocation-policy-v0",
  "count": 12,
  "decisions": [
    {
      "snapshot": { /* LotAllocationSnapshot */ },
      "decision": { /* LotAllocationDecision */ }
    }
    /* … */
  ]
}
```

Sort order is deterministic:

```
recommendedSurface rank: CONTRACT_CATALOG → SPLIT → EXCLUSIVE_MICROLOT
                       → OPEN_MARKETPLACE → HOLD
then lotNumber.localeCompare()
```

### `GET /api/internal/allocation/lot/[id]`

```jsonc
{
  "snapshot": { /* LotAllocationSnapshot */ },
  "decision": { /* LotAllocationDecision */ },
  "policyVersion": "allocation-policy-v0",
  "snapshotsTakenAt": "2026-05-08T12:34:56.789Z"
}
```

`404 { error: "Lot not found" }` when the id matches no GreenLot in any of the
four lifecycle states.

### Auth on both endpoints

```ts
const guard = await requireDevRoute({ requireUser: true })
if (!guard.ok) return guard.response
```

Hard-killed on Vercel Production (`VERCEL_ENV === "production"`), requires
`INTERNAL_DEV_TOOLS_ENABLED === "true"`, plus a logged-in user. Same gate as
`/api/internal/agents/founder-briefing/run` and the supply-commitment-health
monitor. Both routes are `runtime = "nodejs"` and `dynamic = "force-dynamic"`
— same shape as the rest of `/api/internal/*`.

---

## 4. Query count / performance notes

| Action | Queries | Notes |
|---|---|---|
| `buildAllocationSnapshots()` (full sweep) | 3 | greenLot.findMany + contract.findMany + demandIntent.groupBy |
| `buildAllocationSnapshots({ greenLotId })` | 3 | same shape, scoped via `WHERE id = ?` and `WHERE greenLotId IN (lotIds)` |
| `GET /api/internal/allocation/run` | 3 | + 1 auth read inside `requireDevRoute` |
| `GET /api/internal/allocation/lot/[id]` | 3 | + 1 auth read |

Crucially, **no per-lot Prisma calls**:

- `getContractableSupply` is **not** invoked in a loop (the existing N+1 in
  [market.service.ts:97-102](../../src/services/clients/market.service.ts#L97-L102)
  is intentionally untouched in this sprint — ALLOC-3 is where the marketplace
  read path migrates).
- `getDisplayableSupply` is **not** invoked at all.
- `getMarketView` is **not** invoked.

Aggregation across contracts uses `findMany` (not `groupBy`) deliberately:
horizon requires multiplying `monthlyGreenKg × remainingMonths` per row before
summing, which `groupBy` cannot express without falling back to raw SQL or a
second pass. With three queries total, the cost difference is negligible.

---

## 5. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (no output) |
| `npm run test:allocation` | ✅ **53 / 53 pass** in ~0.6 s — 12 golden + 4 invariants + 18 partition + 19 mapper |
| `npm run build` | ✅ Next.js build green; both internal routes registered (`/api/internal/allocation/run`, `/api/internal/allocation/lot/[id]`) as dynamic Node routes |

Test output excerpts:

```
▶ aggregateCommitments
  ✔ sums monthly and horizon for the same lot               (monthly=150, horizon=700)
  ✔ falls back to monthlyVolumeKg when monthlyGreenKg is null (legacy contracts)
  ✔ treats null monthly as zero (ignored)
  ✔ treats null remainingMonths as 1
  ✔ clamps negative remainingMonths but keeps horizon ≥ monthly (1-month floor)
  ✔ ignores rows without greenLotId
  ✔ treats negative monthly as zero (ignored)

▶ aggregateIntentReservations
  ✔ sums deltaKg per lot
  ✔ ignores null / negative / non-finite deltas
  ✔ ignores rows without greenLotId

▶ mapGreenLotToAllocationSnapshot
  ✔ maps a hydrated row to a complete snapshot
  ✔ falls back to GreenLot.pricePerKg when pricingSnapshot is missing
  ✔ returns null pricing when neither source is set
  ✔ preserves shipmentId for reserved lots
  ✔ clamps negative numeric inputs to zero

▶ mapper → engine integration
  ✔ RESERVED lot with shipmentId yields HOLD + SHIPMENT_ALREADY_RESERVED
  ✔ default-yield mapping flows the warning into the decision
```

ALLOC-1 golden + invariants + partition tests are all still green — no
regressions from the type extension.

---

## 6. Known limitations

1. **Engine sees horizon, not monthly.** `committedContractGreenKg` in the
   snapshot is now the full obligation. This means `decideLotAllocation` will
   reserve more aggressively than `getContractableSupply` would. That is the
   intended split: supply is "what can ship next month", allocation is "what
   can strategically be released to marketplace". They are both correct
   answers to different questions, but downstream consumers must be careful
   not to compare the two as if they were interchangeable.

2. **`committedContractMonthsRemaining` is the longest across contracts on a
   lot, not a weighted average.** A lot with one 6-month contract and one
   12-month contract will report `monthsRemaining = 12`. This is intentionally
   conservative for v0; ALLOC-5 admin inspector can show the full per-contract
   breakdown.

3. **`marketDemandIndex` is hard-coded to `null`.** `MarketSignalSnapshot`
   exists in the schema but is not wired into the snapshot yet. Risk-based
   reasons (`RISK_HOLD`, `PRICING_HOLD`) remain unused. ALLOC-2 deliberately
   does not bring market signals into the picture; that is reserved for a
   later sprint once the founder-briefing monitor's metrics are validated.

4. **`harvestYear` and `scaScore` come from `GreenLot`, not
   `ProducerLotDraft`.** The schema makes both authoritative on `GreenLot`
   itself; the draft relation isn't read here. If the partner overrides
   harvest year or SCA at lot validation time, that's the value the engine
   sees — same source as the existing market view.

5. **`_req` parameter is unused in the lot-by-id route.** It exists because
   the App Router signature is `(req, ctx)`. ESLint may flag it locally; the
   build passes. Renamed to `_req` to make the intent explicit.

6. **Process-type narrowing falls back to `WASHED`.** When a lot's `process`
   string doesn't match any of the four ProcessType values (shouldn't happen
   in practice — Prisma enforces the enum), `resolveRoastYield` is called
   with `WASHED` and the helper's own clamps prevent any out-of-range yield.
   No reason code is emitted for this fallback because it's a defence against
   a state the schema makes impossible.

7. **No transaction on the dry-run.** The three queries are fired in
   sequence, not inside a single `$transaction`. This means a contract that
   gets created between queries 1 and 2 could in theory show up as
   "committed" without its lot being in the snapshot. Acceptable for a dev
   inspection tool; a later sprint can wrap in `$transaction` if the
   downstream consumers require strict consistency.

8. **Spanish strings absent.** All operator-facing text in error responses
   and console logs is English. UI translation is the consumer's job.

---

## 7. Next recommended sprint — ALLOC-3

Wire `/api/marketplace/lots` to allocation decisions and **replace the
marketplace mock data** with real read-only data.

Concrete scope:

1. New route `app/api/marketplace/lots/route.ts`:
   - `requireAuth()` (not `requireDevRoute` — this is customer-facing).
   - Calls `buildAllocationSnapshots()` then `decideLotAllocation` per
     snapshot.
   - Filters to decisions with
     `marketplaceEligibleGreenKg > 0 || exclusiveMicrolotGreenKg > 0`.
   - Returns a payload shaped to match the existing
     `MarketplaceLot` type used by
     [src/components/platform/marketplace/mock-marketplace-data.ts](../../src/components/platform/marketplace/mock-marketplace-data.ts).
2. Replace `MARKETPLACE_LOTS` import in
   [src/components/platform/marketplace/MarketplacePage.tsx](../../src/components/platform/marketplace/MarketplacePage.tsx)
   with a server fetch (or pass from the page-level server component).
3. Map `recommendedSurface = "EXCLUSIVE_MICROLOT"` to a UI badge so the
   marketplace UI can show "premium / exclusive" tagging without a second
   data trip.
4. Delete `mock-marketplace-data.ts` (or strip it down to type definitions
   only) once the page no longer imports the array.
5. Keep the contract-catalog read path (trading desk) on `/api/market`
   untouched — that's ALLOC-4.

**Non-goals for ALLOC-3**: no schema changes, no contract-creation logic
change, no admin UI, no persistence of decisions, no `/api/market`
deprecation, no `MarketSignalSnapshot` wiring.
