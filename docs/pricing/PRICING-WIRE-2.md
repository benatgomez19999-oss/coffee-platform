# PRICING-WIRE-2 — MarketSignal-aware B2B refresh + pricing inspector

Sprint scope: operational tooling that lets a developer **inspect** persisted
client B2B prices vs the recomputed target-anchored values, and **refresh**
them when market signals or target tables change. Read-only by default;
explicit confirmation required to write.

No external commodity API ingestion. No background jobs. No allocation
engine changes. No payment / signature flow.

---

## 1. Purpose

`PRICING-B2B-3` persisted `PricingSnapshot.clientB2BPricePerKg` so that
contracts and demand intents lock at the same value the marketplace shows.
But:

- When `MarketSignalSnapshot` changes, persisted B2B does NOT update.
- When pricing target tables / calibration change, persisted B2B does NOT update.

This sprint adds the operational hooks to **see** and **fix** that drift on
demand, without ever touching historical contracts or demand intents.

---

## 2. Files changed

### Created — service layer

| Path | Role |
|---|---|
| [src/services/pricing/clientB2BPriceRefresh.pure.ts](../../src/services/pricing/clientB2BPriceRefresh.pure.ts) | Pure helpers (`recomputeClientB2BPriceForLot`, `summarizeClientB2BRefresh`, `normaliseStatuses`, `normaliseLimit`, types). No Prisma. |
| [src/services/pricing/clientB2BPriceRefresh.service.ts](../../src/services/pricing/clientB2BPriceRefresh.service.ts) | Prisma wrapper: `previewClientB2BRefresh`, `applyClientB2BRefresh`, market-signal loader. |
| [src/services/pricing/__tests__/clientB2BPriceRefresh.test.ts](../../src/services/pricing/__tests__/clientB2BPriceRefresh.test.ts) | 18 pure tests. |

### Created — internal API

| Path | Role |
|---|---|
| [app/api/internal/pricing/client-b2b-refresh/route.ts](../../app/api/internal/pricing/client-b2b-refresh/route.ts) | `GET` (dry-run) + `POST` (apply with confirm token). |
| [app/api/internal/pricing/lot/[id]/route.ts](../../app/api/internal/pricing/lot/[id]/route.ts) | Single-lot pricing inspector. |

### Created — dev page

| Path | Role |
|---|---|
| [app/dev/pricing/page.tsx](../../app/dev/pricing/page.tsx) | Shell. |
| [src/components/dev/pricing/PricingInspectorPanel.tsx](../../src/components/dev/pricing/PricingInspectorPanel.tsx) | Cream/beige inspector UI: market signal block, summary KPIs, per-lot table, Preview / Apply controls. |

### Modified

| Path | Change |
|---|---|
| [package.json](../../package.json) | (already) `test:allocation` runs `src/services/pricing/__tests__/*.test.ts`. |

### Untouched (verified)

Pricing target tables, allocation engine, marketplace UI layout, client
dashboard layout, contract creation, contract amend, demand intent service,
existing `Contract.lockedPricePerKg`, existing `DemandIntent.previewPricePerKg`,
Stripe, signature flow, Prisma schema (sprint did NOT add columns), CoffeeAssistant.

---

## 3. Refresh service API

### Pure layer (`clientB2BPriceRefresh.pure.ts`)

```ts
recomputeClientB2BPriceForLot(lot, deps): ClientB2BRefreshResult
summarizeClientB2BRefresh({ results, mode, applied, marketSignal }): ClientB2BRefreshSummary
normaliseStatuses(raw): ReadonlyArray<ClientB2BRefreshLotStatus>
normaliseLimit(raw): number
```

`recomputeClientB2BPriceForLot` is exhaustive about skip cases — it never
throws for a per-lot defect. Skip reasons:

| Code | When |
|---|---|
| `MISSING_PRICING_SNAPSHOT` | Lot has no `PricingSnapshot` row |
| `MISSING_SCA` | `scaScore` is null/non-finite |
| `MISSING_ALTITUDE` | Farm altitude null |
| `MISSING_VARIETY` | Empty variety string |
| `MISSING_PROCESS` | Empty process string |
| `B2B_ENGINE_ERROR` | `calculateMarketplaceB2BPricing` threw |
| `RECOMPUTED_PRICE_NOT_USABLE` | Recomputed `pricePerKgRoasted` was null/≤0 (apply layer only) |
| `DB_UPDATE_FAILED` | Persistence threw (apply layer only) |

### Prisma layer (`clientB2BPriceRefresh.service.ts`)

```ts
previewClientB2BRefresh(scope?): Promise<ClientB2BRefreshSummary>   // dry-run
applyClientB2BRefresh(scope?):   Promise<ClientB2BRefreshSummary>   // persists
```

`scope` shape:
```ts
{
  greenLotId?: string
  includeStatuses?: Array<"PUBLISHED" | "RESERVED" | "SOLD" | "DRAFT">
  limit?: number   // clamped to [1, 500]; default 100
}
```

Defaults:
- statuses → `["PUBLISHED", "RESERVED"]` (SOLD and DRAFT excluded by default)
- limit → 100

Result shape (`ClientB2BRefreshResult`) includes `persistedClientB2BPricePerKg`,
`recomputedClientB2BPricePerKg`, `legacyGreenEquivalentPricePerKg`,
`deltaAbsolute`, `deltaPercent` (rounded to 2 decimals), `pricingSourceBefore`,
`pricingSourceAfter`, `recomputedPricingVersion`, `recomputedPricingMode`,
`recomputedCommercialModel`, `marketSignal`, `applied`, `skipped`, `skipReason`,
`warnings`.

Summary shape (`ClientB2BRefreshSummary`) totals lots, updated, skipped,
average and max-by-magnitude delta percent, plus the active market signal.

---

## 4. Internal routes

All three are guarded by `requireDevRoute({ requireUser: true })` and run
on `runtime: nodejs` with `dynamic: force-dynamic`.

### `GET /api/internal/pricing/client-b2b-refresh`

Dry-run preview. Query params: `greenLotId`, `limit`,
`includeStatuses` (comma-separated). Returns `ClientB2BRefreshSummary`
with `mode: "dry_run"`, `applied: false`.

### `POST /api/internal/pricing/client-b2b-refresh`

Body:
```json
{
  "apply": false,
  "confirm": "REFRESH_CLIENT_B2B_PRICES",
  "greenLotId": "…",
  "limit": 100,
  "includeStatuses": ["PUBLISHED", "RESERVED"]
}
```

- `apply: false` (or omitted) → dry-run.
- `apply: true` requires `confirm: "REFRESH_CLIENT_B2B_PRICES"` exactly,
  otherwise returns **400**.
- Apply mode persists ONLY:
  - `clientB2BPricePerKg`
  - `clientB2BPricingVersion`
  - `clientB2BPricingMode`
  - `clientB2BPriceComputedAt`

### `GET /api/internal/pricing/lot/[id]`

Single-lot inspector. Reuses the dry-run path with `greenLotId` scoped to one
lot. Returns a focused payload (`lot`, `persisted`, `recomputed`, `delta`,
`marketSignal`, `warnings`, `skipped`, `skipReason`). 404 if not found.

---

## 5. Dev pricing inspector page

Path: `/dev/pricing` ([app/dev/pricing/page.tsx](../../app/dev/pricing/page.tsx))

Sections:

- **Active market signal** — id, cPrice, demandIndex, source, validFrom,
  expiresAt. Empty-state copy when no usable signal.
- **Summary** — lots evaluated, updated / would-update, skipped, average and
  max delta %, current mode. Two action buttons:
  - `Preview refresh` → re-runs `GET`.
  - `Apply refresh` → browser-confirm dialog, then `POST` with
    `apply: true` + the confirm token.
- **Per-lot results** — table with: lot #, variety, status, SCA, altitude,
  persisted B2B, recomputed, Δ €/kg, Δ %, after-source, pricing mode, state
  badge (`applied` / `would update` / skip reason). Delta cells coloured
  green / red / muted by sign.

Visual style matches the rest of `/dev/*` (cream / amber).

---

## 6. Market signal handling

`loadActiveMarketSignal()` reads `MarketSignalSnapshot` directly with the
**full** row (id, cPrice, demandIndex, source, validFrom, expiresAt) so the
UI / API can audit which snapshot was active at refresh time.

The same in-band check used by `lotVerification.service` (`cPrice ∈ [50, 600]`,
`demandIndex ∈ [0.8, 1.2]`, not expired) decides whether the signal is
**usable** — when not usable, the engine receives `marketData: null` and
the recompute runs deterministic. The full signal metadata is still surfaced
in the result for transparency.

No external commodity-feed ingestion. The MarketSignalSnapshot remains
manually curated through whatever existing partner / internal route the
project already uses.

---

## 7. What refresh updates / does not update

| Updated by `apply: true` | Untouched |
|---|---|
| `PricingSnapshot.clientB2BPricePerKg` | `producerPricePerKg` |
| `PricingSnapshot.clientB2BPricingVersion` | `clientPricePerKg` (legacy GREEN) |
| `PricingSnapshot.clientB2BPricingMode` | `marginPerKg` |
| `PricingSnapshot.clientB2BPriceComputedAt` | `pricingVersion` (top-level) |
| | `breakdown` |
| | `GreenLot.pricePerKg` |
| | `Contract.lockedPricePerKg` (every existing row) |
| | `DemandIntent.previewPricePerKg` (every existing row) |
| | `DemandIntent.priceLocked` |
| | Allocation engine output |

Future contracts and demand intents — those signed AFTER an apply — read the
refreshed `clientB2BPricePerKg` via `resolveClientB2BPriceForLot`. Existing
commercial commitments stay historical.

---

## 8. Tests added

`npm run test:allocation` — **336/336 pass** (18 new over the 318 baseline).

Covered cases (from `clientB2BPriceRefresh.test.ts`):

- **Happy path** (3): recomputed price + delta vs persisted; pricing version /
  mode / commercial model propagated; legacy green equivalent computed.
- **Skip rules** (7): missing pricing snapshot, SCA, altitude, variety, process;
  engine throws → skipped not crash; null/zero recomputed → after-source
  `NO_PRICE` (apply layer marks skipped).
- **Delta math** (3): identity ⇒ 0; rounded to 2 decimals; null when persisted null.
- **Summary** (5): updated / skipped counts; average ignores nulls; max picks
  largest absolute (signed); null deltas when none; market signal preserved.

Existing 318 tests untouched.

---

## 9. Commands run

| Command | Result |
|---|---|
| `npx prisma generate --no-engine` *(initial, DLL was locked)* | ✓ types regenerated |
| `npx prisma generate` *(after dev server closed)* | ✓ Library engine restored — required to undo Data Proxy mode |
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **336/336 pass** |
| `npm run build` | ✓ Compiled successfully |

If you previously used `--no-engine` and see "the URL must start with the
protocol `prisma://`" at build/runtime, run `npx prisma generate` (without
the flag) to restore the library engine.

---

## 10. Manual validation steps

1. **Migration**: `npx prisma migrate deploy` — applies the PRICING-B2B-3 migration if not already applied.
2. **Seed**: `/dev/scenarios/lots` → seed `4. Exclusive microlots` jittered with seed `pricing-geisha-1`.
3. **Inspector**: `/dev/pricing`
   - Confirm market signal block displays (or empty-state if no signal).
   - Confirm rows show persisted vs recomputed; deltas should be near zero immediately after seeding (the dev factory persists the same value the recompute returns when `marketData: null`).
4. **Drift simulation**:
   - Create a `MarketSignalSnapshot` (active, in-band) via the existing partner / admin route.
   - Reload `/dev/pricing` → recomputed values now diverge from persisted; deltas are non-zero for premium/microlot rows.
5. **Dry-run**: `GET /api/internal/pricing/client-b2b-refresh` — no DB writes; summary returned.
6. **Apply**:
   ```
   POST /api/internal/pricing/client-b2b-refresh
   { "apply": true, "confirm": "REFRESH_CLIENT_B2B_PRICES" }
   ```
   Returns `mode: "apply"`, `applied: true`, lots with `applied: true`.
7. **Marketplace re-render**: `/platform/marketplace` → cards now show the refreshed prices; `/api/marketplace/lots` → `pricingSource === "PERSISTED_CLIENT_B2B"`.
8. **Contract immutability**: existing contracts keep their original `lockedPricePerKg`. Existing demand intents keep their original `previewPricePerKg`.
9. **Single-lot inspector**: `GET /api/internal/pricing/lot/<greenLotId>` — focused payload with `persisted`, `recomputed`, `delta`, `marketSignal`, `warnings`.

---

## 11. Known limitations

- **No external commodity API ingestion** — `MarketSignalSnapshot` remains manually curated.
- **No scheduled / background refresh job** — apply must be triggered explicitly through the route or UI.
- **No automatic backfill** of historical lots until apply is run (or a re-verification path is built).
- **Existing contracts keep historical locked prices.** Refresh never modifies them.
- **Existing demand intents keep historical preview prices.** Refresh never modifies them.
- **No admin override** for `clientB2BPricePerKg`. The next sprint can add a per-lot manual override route.
- **Dev scenario seeds remain deterministic** (`marketData: null`). Optional `useActiveMarketSignal?: boolean` flag was deliberately scoped out of this sprint to keep the diff small.
- **`clientPricePerKg` remains misnamed legacy GREEN** — schema rename is still deferred.
- **`--no-engine` quirk**: `npx prisma generate --no-engine` switches the client to Data Proxy mode (`prisma://` URL required). If this sprint's snapshot was generated that way, run `npx prisma generate` (without the flag) before building.

---

## 12. Recommended next sprint

Three viable next directions, in priority order:

1. **PRICING-ADMIN-1** — richer per-lot pricing breakdown inspector with target / cost-plus / market-anchored side-by-side, plus a manual `clientB2BPricePerKg` override (with audit row).
2. **PRICING-FEED-1** — external C-price ingestion adapter (NYC C / ICE) → `MarketSignalSnapshot` writes, with confidence + provenance fields.
3. **CLIENT-NAV-1** — vertical sidebar navigation for the final client dashboard polish (matches the original target mock).
