# PRICING-B2B-3 — Persisted client B2B price + contracts/intents rewire

Sprint scope: close the marketplace ↔ contract pricing gap by persisting
the target-anchored adaptive B2B roasted price into `PricingSnapshot` and
making contracts, demand intents, marketplace and contract catalog all
read from the same persisted value.

No allocation engine changes. No target table recalibration. No marketplace
visual changes. No contract lifecycle changes. No payment / signature flow.

---

## 1. Purpose

Pre-sprint state:

| Surface | Source of price |
|---|---|
| Marketplace card | `calculateMarketplaceB2BPricing` recomputed at request time → ~€200–€500/kg roasted (Geisha) |
| Client dashboard catalog | same recompute → matches marketplace |
| Contract creation | `computeRoastedPrice(PricingSnapshot.clientPricePerKg, yield)` → ~€20–€30/kg roasted |
| Demand intent preview | same legacy formula → ~€20–€30/kg roasted |

The buyer saw €200+ in the UI and signed at €23. Not acceptable.

Post-sprint state:

| Surface | Source of price |
|---|---|
| Marketplace card | `PricingSnapshot.clientB2BPricePerKg` (persisted), with adaptive recompute fallback for un-migrated rows |
| Client dashboard catalog | same |
| Contract creation | `resolveClientB2BPriceForLot(lot)` → persisted, with legacy green/yield fallback |
| Demand intent preview | same |

Marketplace price and contract lock price now agree for every new lot.

---

## 2. Migration / schema fields

`PricingSnapshot` gains 5 nullable fields:

```prisma
model PricingSnapshot {
  // ... existing
  clientB2BPricePerKg       Float?
  clientB2BPricingVersion   String?
  clientB2BPricingMode      String?
  clientB2BPricingBreakdown Json?
  clientB2BPriceComputedAt  DateTime?
}
```

Migration: `prisma/migrations/20260509180000_add_client_b2b_price_to_pricing_snapshot/migration.sql`

```sql
ALTER TABLE "PricingSnapshot"
  ADD COLUMN "clientB2BPricePerKg"       DOUBLE PRECISION,
  ADD COLUMN "clientB2BPricingVersion"   TEXT,
  ADD COLUMN "clientB2BPricingMode"      TEXT,
  ADD COLUMN "clientB2BPricingBreakdown" JSONB,
  ADD COLUMN "clientB2BPriceComputedAt"  TIMESTAMP(3);
```

All columns are nullable. No defaults. Non-destructive `ADD COLUMN` only.
Existing rows keep `clientB2BPricePerKg = NULL` and the read path falls back
to legacy green/yield via `resolveClientB2BPriceForLot`.

`clientPricePerKg` keeps its name (sprint policy: do not rename in this
sprint). It still stores **GREEN** €/kg despite the misleading name. This
is documented at the schema level.

---

## 3. Files changed

### Schema + migration

- `prisma/schema.prisma` — `PricingSnapshot` gains 5 nullable B2B fields + clarifying comments.
- `prisma/migrations/20260509180000_add_client_b2b_price_to_pricing_snapshot/migration.sql`

### New helper + tests

- `src/services/pricing/clientB2BPrice.ts` — `resolveClientB2BPriceForLot(lot)` + `ClientB2BPriceError`.
- `src/services/pricing/__tests__/clientB2BPrice.test.ts` — 9 tests.

### Production write paths

- `src/services/partner/lotVerification.service.ts` — also runs `calculateMarketplaceB2BPricing` and persists the 5 B2B fields. Best-effort: if the B2B step fails, verification still succeeds and `clientB2BPricePerKg` stays null.
- `src/services/dev/scenarios/devLotScenario.service.ts` — same B2B persistence on dev seed (deterministic, `marketData = null`).

### Read paths (rewired through resolver)

- `src/services/clients/contracts.service.ts` — `createContractWithSupplyValidation` and the **switch-coffee** branch of amend both call `resolveClientB2BPriceForLot(lot)`. `Contract.lockedPricePerKg` now equals the persisted B2B price for new rows.
- `src/services/clients/demandIntent.service.ts` — `previewPricePerKg` resolved through the same helper.

### Allocation snapshot pipeline

- `src/services/allocation/domain/types.ts` — `LotAllocationSnapshot` adds `clientB2BPricePerKg?`, `clientB2BPricingVersion?`, `clientB2BPricingMode?`.
- `src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts` — input row type extended; mapper propagates persisted B2B fields onto the snapshot.
- `src/services/allocation/snapshot/lotAllocationSnapshot.service.ts` — Prisma `select` includes the new fields.

### Marketplace & contract catalog

- `src/services/allocation/marketplace/marketplaceLot.mapper.ts` — DTO adds `clientB2BPricePerKg` + `pricingSource`. Persisted B2B wins over recomputed adaptive on both engine-injected and no-engine paths. New `MarketplacePricingSource` union: `PERSISTED_CLIENT_B2B | ADAPTIVE_RECOMPUTE_FALLBACK | LEGACY_ORIGIN_EQUIVALENT_FALLBACK`.
- `src/services/allocation/contracts/contractCatalog.mapper.ts` — DTO adds `clientB2BPricePerKg` + `pricingSource` (`ContractCatalogPricingSource`). Same priority order.

### Tests updated

- `src/services/allocation/__tests__/marketplaceLot.mapper.test.ts` — 3 new tests under "PRICING-B2B-3".
- `src/services/allocation/__tests__/lotAllocationSnapshot.mapper.test.ts` — 2 new tests for B2B field propagation.
- `src/services/allocation/contracts/__tests__/contractCatalog.mapper.test.ts` — fixtures updated (`pricingSource`, `clientB2BPricePerKg`).
- `src/services/client-dashboard/__tests__/clientDashboard.test.ts` — fixture updated.
- `package.json` — `test:allocation` glob adds `src/services/pricing/__tests__/*.test.ts`.

---

## 4. New price resolution rule

`resolveClientB2BPriceForLot(lot)` in `src/services/pricing/clientB2BPrice.ts`:

```text
if pricingSnapshot.clientB2BPricePerKg is finite and > 0:
    return { pricePerKgRoasted: it, source: "CLIENT_B2B_PERSISTED", ... }
else if pricingSnapshot.clientPricePerKg is finite and > 0:
    return {
      pricePerKgRoasted: computeRoastedPrice(it, roastYield),
      source: "LEGACY_GREEN_EQUIVALENT", ...
    }
else:
    throw ClientB2BPriceError("LOT_NO_PRICING")
```

Used by:
- `contracts.service.ts` (create + switch-coffee amend)
- `demandIntent.service.ts` (preview)
- (Mappers use a parallel inline check on the snapshot's `clientB2BPricePerKg` to avoid coupling pure mappers to the Prisma-shaped lot — the priority logic is the same.)

---

## 5. Production lot verification changes

`src/services/partner/lotVerification.service.ts`:

1. After `calculateProducerPricing` produces the green producer price, the same `marketData` flows into `calculateMarketplaceB2BPricing` with the resolved roast yield, lot's green kg, currency `EUR` and the producer engine injected.
2. Persists `clientB2BPricePerKg`, `clientB2BPricingVersion`, `clientB2BPricingMode`, `clientB2BPricingBreakdown`, `clientB2BPriceComputedAt`.
3. On exception, the B2B step is **best-effort**: the producer green pricing still succeeds, `clientB2BPricePerKg` stays null, and the read path falls back to legacy green/yield.

---

## 6. Dev scenario factory changes

`src/services/dev/scenarios/devLotScenario.service.ts`:

1. After producer pricing, also runs `calculateMarketplaceB2BPricing` with `marketData: null` (deterministic) and the recipe's `estimatedRoastYield`.
2. Persists the same 5 B2B fields.
3. Jitter logic, recipe presets, allocation surfaces, and reset are all unchanged.

---

## 7. Contract changes

`src/services/clients/contracts.service.ts`:

- `createContractWithSupplyValidation`:
  - `lockedPricePerKg = resolveClientB2BPriceForLot(lot).pricePerKgRoasted` (was: `computeRoastedPrice(clientPricePerKg, yield)`).
  - `monthlyGreenKg`, supply validation, allocation, semaphore — all unchanged.

- `amendContract` (switch-coffee branch):
  - `newLockedPrice = resolveClientB2BPriceForLot(newLot).pricePerKgRoasted` (was: `computeRoastedPrice(...)`).
  - Same-coffee path is unchanged — locked price is preserved.

`Contract.lockedPricePerKg` continues to be persisted in EUR/kg roasted; only its **source** changes.

---

## 8. Demand intent changes

`src/services/clients/demandIntent.service.ts`:

- `previewPricePerKg = resolveClientB2BPriceForLot(lot).pricePerKgRoasted` (was: `computeRoastedPrice(clientPricePerKg, yield)`).
- `deltaKg` (green reservation), semaphore, expiration, `priceLocked` semantics — all unchanged.

---

## 9. Marketplace + contract catalog changes

Both DTOs gain:

- `clientB2BPricePerKg: number | null` — the persisted value (echoed for audit).
- `pricingSource: "PERSISTED_CLIENT_B2B" | "ADAPTIVE_RECOMPUTE_FALLBACK" | "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"`.

Priority for `roastedPricePerKg`:

1. **Persisted** `clientB2BPricePerKg` (when valid > 0) → `pricingSource = PERSISTED_CLIENT_B2B`. The recompute still runs to populate `producerGreenPricePerKg`, `originEquivalentRoastedPricePerKg`, `b2bReferencePricePerKg`, `adaptiveB2BPricePerKg`, `marketTarget` for audit, but the **displayed** price is the persisted one.
2. **Adaptive recompute** (existing `calculateMarketplaceB2BPricing` path) → `pricingSource = ADAPTIVE_RECOMPUTE_FALLBACK`.
3. **Legacy origin-equivalent** (no engine + no B2B reference + no persisted) → `pricingSource = LEGACY_ORIGIN_EQUIVALENT_FALLBACK`.

The adaptive recompute fallback is **never removed** — old rows with `clientB2BPricePerKg = NULL` continue to render correctly.

---

## 10. Tests added

`npm run test:allocation` → **318/318 pass** (14 new over the 304 baseline).

- `clientB2BPrice` (9): persisted wins; legacy fallback; rejects 0/negative/NaN; preserves yield; source labels; default process yield; throws on missing snapshot; throws when both prices unusable.
- `marketplaceLot.mapper` PRICING-B2B-3 (3): persisted → `PERSISTED_CLIENT_B2B`; null → fallback; zero/negative ignored.
- `lotAllocationSnapshot.mapper` (2): B2B fields propagate; null passes through safely.

---

## 11. Commands run

| Command | Result |
|---|---|
| `npx prisma generate --no-engine` | ✓ types updated (engine .dll was locked locally; `--no-engine` skips the binary write) |
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **318/318 pass** |
| `npm run build` | ✓ Compiled successfully |

To apply the migration on the dev DB:
```
npx prisma migrate deploy
```
(Non-destructive `ADD COLUMN` only.)

---

## 12. Manual validation steps

1. `npx prisma migrate deploy` to apply the new migration.
2. `/dev/scenarios/lots` → **Reset**.
3. Seed `4. Exclusive microlots` jittered with seed `pricing-geisha-1`.
4. `/api/internal/allocation/run` or Prisma Studio → confirm `PricingSnapshot.clientB2BPricePerKg` is populated for the seeded lots.
5. `/platform/marketplace` → pick a Geisha card; note the price.
6. `/api/marketplace/lots` → confirm:
   - `roastedPricePerKg === clientB2BPricePerKg`
   - `pricingSource === "PERSISTED_CLIENT_B2B"`
7. `/api/contracts/catalog` → same lot → same numbers, `pricingSource === "PERSISTED_CLIENT_B2B"`.
8. (When write flow re-enables) create a contract for that lot → `Contract.lockedPricePerKg === clientB2BPricePerKg` (no longer ~€23 for Geisha).
9. **Backwards-compat check**: a lot from before the migration has `clientB2BPricePerKg = NULL`. Marketplace falls back to `ADAPTIVE_RECOMPUTE_FALLBACK`; contract creation falls back to legacy green/yield. Both still work.

---

## 13. Known limitations

- **Existing rows need re-verification or a future backfill** to populate `clientB2BPricePerKg`. Until then they fall back to legacy green/yield (which is what the old contracts code did anyway — no regression).
- **Marketplace may still recompute** for un-migrated rows. Same numerical result as today; only `pricingSource` changes label.
- **No automatic `MarketSignalSnapshot` ingestion / refresh** yet — `marketData` is read once at lot verification and not re-applied later.
- **No price-refresh job** to recompute persisted B2B when target tables change.
- **No admin override** for `clientB2BPricePerKg`.
- **No contract UI activation** — `Request contract soon` CTA is still disabled. The price is now correct; the request flow is a future sprint.
- **`clientPricePerKg` remains misnamed legacy GREEN.** Schema-level rename is deferred to a future sprint to avoid touching every query/select in this one. The Prisma schema now carries a clear comment.
- **`resolveClientB2BPriceForLot` is duplicated by an inline check inside the marketplace + catalog mappers** to keep the pure mappers Prisma-free. The logic is identical (persisted > 0 → use it).

---

## 14. Recommended next sprint

**PRICING-WIRE-2** — `MarketSignalSnapshot` ingestion + refresh pipeline plus a pricing inspector page. With prices now persisted, you need a way to refresh them as the market moves and a UI to audit divergence between persisted and recomputed values.

Alternative: **CLIENT-NAV-1** if visual dashboard navigation (the sidebar shown in the target mock) is a higher product priority.
