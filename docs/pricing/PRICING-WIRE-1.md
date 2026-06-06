# PRICING-WIRE-1 — Wire dev scenario lots + marketplace cards to the real pricing engine

Sprint scope: remove every invented price formula from the dev scenario
factory and the marketplace mapper. All prices now flow through the canonical
pipeline: `calculateProducerPricing` → `PricingSnapshot.clientPricePerKg` →
`computeRoastedPrice` (mirrored locally to keep the mapper Prisma-free).

---

## 1. Files changed

### Modified

| Path | Change |
|---|---|
| [src/services/dev/scenarios/devLotScenario.types.ts](../../src/services/dev/scenarios/devLotScenario.types.ts) | **Removed** `pricePerKg` from `DevLotRecipe`. **Removed** `RARE_BONUS_EUR_PER_KG` + `deriveBasePrice`. **Added** `PRICING_ENGINE_VARIETIES` + `toPricingEngineVariety`. **Swapped** Wush Wush / Sudan Rume → Typica / Bourbon (engine doesn't price the former two). |
| [src/services/dev/scenarios/devLotScenario.service.ts](../../src/services/dev/scenarios/devLotScenario.service.ts) | Imports `calculateProducerPricing`. `seedSingleLot` now calls the real pricing engine and persists `pricing.finalPrice` + `pricing.breakdown`. `producerPricePerKg = clientPricePerKg = pricing.finalPrice`, `marginPerKg = 0` (mirrors `lotVerification.service`). Throws if farm altitude is missing. |
| [src/services/allocation/marketplace/marketplaceLot.mapper.ts](../../src/services/allocation/marketplace/marketplaceLot.mapper.ts) | DTO replaces `pricePerKg` + `availableDisplayKg` with explicit `greenPricePerKg`, `roastedPricePerKg`, `roastYield`, `availableGreenKg`, `availableRoastedKg`, `marketplaceGreenKg`, `marketplaceRoastedKg`. Inlined two-line roast-yield math (mirrors `src/lib/roastYield.ts`). |
| [src/components/platform/marketplace/mock-marketplace-data.ts](../../src/components/platform/marketplace/mock-marketplace-data.ts) | `pricePerKgUsd` → `pricePerKgRoasted`. Added optional `availableUnit` + `currency` on `MarketplaceLot`. |
| [src/components/platform/marketplace/MarketplacePage.tsx](../../src/components/platform/marketplace/MarketplacePage.tsx) | `dtoToLot` adapter now reads `dto.marketplaceRoastedKg`, `dto.roastedPricePerKg`, `dto.currency`. Insights average uses `roastedPricePerKg`; trend label says "Avg roasted price across N lots". |
| [src/components/platform/marketplace/FeaturedLotCard.tsx](../../src/components/platform/marketplace/FeaturedLotCard.tsx) | Uses `lot.pricePerKgRoasted` + currency-aware `formatPrice`. Available stat now appends "kg roasted" / "kg green". |
| [src/components/platform/marketplace/MarketplaceLotCard.tsx](../../src/components/platform/marketplace/MarketplaceLotCard.tsx) | Same pattern — currency-aware price, unit-aware available kg, "/kg roasted" label. |

### Tests

| Path | Change |
|---|---|
| [src/services/dev/scenarios/__tests__/devLotScenario.test.ts](../../src/services/dev/scenarios/__tests__/devLotScenario.test.ts) | Removed `r.pricePerKg > 0` assertion. **Added** "recipes do NOT carry an invented pricePerKg field" guard. **Added** "pricing engine compatibility" suite: `toPricingEngineVariety` normalisation + rejection of unsupported varieties + every recipe variety + SCA combination has a base price in `BASE_PRODUCER_PRICING`. |
| [src/services/allocation/__tests__/marketplaceLot.mapper.test.ts](../../src/services/allocation/__tests__/marketplaceLot.mapper.test.ts) | `availableDisplayKg` references replaced with `marketplaceRoastedKg`. **Added** "pricing" suite: `roastedPricePerKg = greenPricePerKg / roastYield`, 0.5 yield floor, currency propagation, null green price → null roasted price. |

### Untouched (verified)

`prisma/schema.prisma`, migrations, `src/engine/pricing/**`, `src/lib/roastYield.ts`,
`src/services/clients/contracts.service.ts`, `src/services/clients/demandIntent.service.ts`,
`src/services/system/supply.service.ts`, allocation engine + policy, snapshot
service, shipment routes, EU/Origin partner dashboards, contract creation,
demand intent, CoffeeAssistant.

---

## 2. Pricing paths read

| File | What it tells us |
|---|---|
| [src/engine/pricing/producer/calculatePricing.ts](../../src/engine/pricing/producer/calculatePricing.ts) | `calculateProducerPricing({scaScore, altitude, variety, process, country?, marketData?})` returns `{basePrice, altitudeModifier, finalPrice, breakdown}`. SCA is partitioned into `80–83 / 84–86 / 87–90`; throws on SCA < 80 or unknown variety/range pair. |
| [src/engine/pricing/producer/pricingTable.ts](../../src/engine/pricing/producer/pricingTable.ts) | Supports 8 varieties: `CASTILLO, CATURRA, COLOMBIA, TYPICA, BOURBON, PINK_BOURBON, GEISHA, TABI`. **No `WUSH_WUSH` or `SUDAN_RUME`.** Pink Bourbon and Geisha exist only in 84–86 and 87–90 ranges. |
| [src/engine/pricing/modifiers/producer/{altitude,variety,country,commodity,demand}Modifier.ts](../../src/engine/pricing/modifiers/producer/) | Pipeline applies additive (altitude) → multiplicative (variety premium, country) → market (cPrice band, demandIndex). All deterministic without `marketData`. |
| [src/lib/roastYield.ts](../../src/lib/roastYield.ts) | `resolveRoastYield(lot)`, `computeRoastedPrice(green, yield) = green / max(0.5, yield)`, `greenToRoasted(kg, yield) = kg × yield`. |
| [src/services/partner/lotVerification.service.ts](../../src/services/partner/lotVerification.service.ts) | Documented production stance: `producerPricePerKg = clientPricePerKg = pricing.finalPrice`, `marginPerKg = 0`. The dev factory now mirrors this exactly (so dev rows are indistinguishable from real verified lots from the pricing perspective). |

---

## 3. Fake pricing removed

| Symbol | Where | Replaced with |
|---|---|---|
| `RARE_BONUS_EUR_PER_KG` map (Geisha +5, Pink Bourbon +2.5, Wush Wush +3, Sudan Rume +2.5) | `devLotScenario.types.ts` | **deleted** |
| `deriveBasePrice(sca, variety) = 5 + (sca − 80)·0.6 + rare` | `devLotScenario.types.ts` | **deleted** |
| `pricePerKg` field on `DevLotRecipe` | `devLotScenario.types.ts` | **deleted** — recipes only describe physical/quality data now |
| `recipe.pricePerKg * 0.6` producer price math | `devLotScenario.service.ts` | replaced with `calculateProducerPricing(...).finalPrice` |
| `pricePerKgUsd` field on `MarketplaceLot` | `mock-marketplace-data.ts` | renamed to `pricePerKgRoasted` |
| `${lot.pricePerKgUsd.toFixed(2)}` with hard-coded `$` | both card components | `formatPrice(value, currency)` with €/$/£ glyph + currency-aware fallback |
| `MarketplaceLotDto.pricePerKg` (green, mislabelled to UI) | `marketplaceLot.mapper.ts` | replaced with explicit `greenPricePerKg` + `roastedPricePerKg` pair |
| `MarketplaceLotDto.availableDisplayKg` (green kg, mislabelled to UI as "kg") | `marketplaceLot.mapper.ts` | replaced with `marketplaceGreenKg` + `marketplaceRoastedKg` |
| `dto.pricePerKg` average for trend display | `MarketplacePage.tsx` | `dto.roastedPricePerKg` average; label "Avg roasted price across N marketplace lots" |

The hardcoded "412 lots" / "$10.42" placeholders from the original mock had
already been removed in ALLOC-3; this sprint just verified the remaining UI
labels were consistent.

---

## 4. Dev scenario pricing — how it's now generated

```ts
// src/services/dev/scenarios/devLotScenario.service.ts ─ seedSingleLot

if (farm.altitude == null) throw new Error("…cannot price lot…")

const engineVariety = toPricingEngineVariety(recipe.variety)
// ↑ normalises "Pink Bourbon" → "PINK_BOURBON"; throws on Wush Wush etc.

const pricing = calculateProducerPricing({
  scaScore: recipe.scaScore,
  altitude: farm.altitude,
  variety: engineVariety,
  process: recipe.process,
  country: "COLOMBIA",
})

await tx.greenLot.create({
  data: {
    /* … */
    pricePerKg: pricing.finalPrice,
    currency: "EUR",
    pricingSnapshot: {
      create: {
        producerPricePerKg: pricing.finalPrice,
        clientPricePerKg:   pricing.finalPrice,
        marginPerKg:        0,
        pricingVersion:     "dev-scenario-v1",
        breakdown:          pricing.breakdown,        // every modifier step
        context: {
          source: "DEV_SCENARIO_FACTORY",
          scenario,
          pricingEngine: "calculateProducerPricing",
          farmKey, scaScore, altitude, variety: engineVariety,
          process, country: "COLOMBIA",
          estimatedRoastYield, harvestYear,
        },
      },
    },
  },
})
```

Result: dev lots and real verified lots are byte-for-byte identical from the
pricing perspective. The only field that distinguishes them is
`pricingVersion` (`"dev-scenario-v1"` vs `"v1"`) and the `context.source`
marker.

### Recipe corrections

| Scenario | Recipe | Before | After | Reason |
|---|---|---|---|---|
| `exclusive_microlots` | row 3 | Wush Wush WASHED 300 kg SCA 89 | **Typica** WASHED 300 kg SCA 89 | Wush Wush not in pricing table |
| `exclusive_microlots` | row 4 | Sudan Rume WASHED 350 kg SCA 90 | **Bourbon** WASHED 350 kg SCA 90 | Sudan Rume not in pricing table |
| `exclusive_microlots` | row 7 | Wush Wush ANAEROBIC 320 kg SCA 90 | **Typica** ANAEROBIC 320 kg SCA 90 | same |
| `exclusive_microlots` | row 8 | Sudan Rume WASHED 380 kg SCA 91 | **Bourbon** WASHED 380 kg SCA 91 | same |
| `stress_25_lots` | row 13 | Wush Wush ANAEROBIC 280 kg SCA 90 | **Typica** ANAEROBIC 280 kg SCA 90 | same |
| `stress_25_lots` | row 14 | Sudan Rume NATURAL 320 kg SCA 90 | **Bourbon** NATURAL 320 kg SCA 90 | same |

The exclusive route is still well covered by Geisha + Pink Bourbon entries
(rare-variety branch in the allocation engine). Typica/Bourbon at SCA 89–91
on small volume still triggers `HIGH_SCA_EXCLUSIVE` via the
`isHighSca && microlot-sized` branch. Engine behaviour is unchanged on the
boundary set.

---

## 5. Marketplace price — how it's now calculated

```ts
// src/services/allocation/marketplace/marketplaceLot.mapper.ts

// Roast yield is already resolved by the snapshot builder
// (lotAllocationSnapshot.service.ts → resolveRoastYield).
const roastYield = snapshot.estimatedRoastYield

const greenPricePerKg = snapshot.greenPricePerKg ?? null
const roastedPricePerKg =
  greenPricePerKg != null
    ? round2(computeRoastedPriceFromGreen(greenPricePerKg, roastYield))
    : null

// Inlined to keep this mapper free of @prisma/client transitive imports.
// Keeps the math identical to src/lib/roastYield.ts:
const ROAST_YIELD_FLOOR = 0.5
function computeRoastedPriceFromGreen(green, yield) {
  return green / Math.max(ROAST_YIELD_FLOOR, yield)
}
function greenKgToRoastedKg(green, yield) {
  return green × yield
}
```

The DTO ships:

| Field | Source |
|---|---|
| `availableGreenKg` | `snapshot.availableGreenKg` (full lot) |
| `availableRoastedKg` | `availableGreenKg × roastYield` |
| `marketplaceGreenKg` | `exclusive > 0 ? exclusive : marketplaceEligible` |
| `marketplaceRoastedKg` | `marketplaceGreenKg × roastYield` |
| `greenPricePerKg` | `snapshot.greenPricePerKg` (`pricingSnapshot.clientPricePerKg`, falling back to `GreenLot.pricePerKg`) |
| `roastedPricePerKg` | `greenPricePerKg / max(0.5, roastYield)` |
| `currency` | `snapshot.currency ?? "EUR"` |
| `roastYield` | `snapshot.estimatedRoastYield` (already resolved) |

The cards display `roastedPricePerKg` as the visible price, with a
currency-aware glyph (€ default, $ for USD, £ for GBP). The stats row shows
`marketplaceRoastedKg` as the customer-visible quantity. SPLIT lots only
expose their residual marketplace pool — `contractAssignableGreenKg` is
explicitly absent from the DTO (test enforces this).

---

## 6. Commands run and results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:allocation` | ✅ **101 / 101 pass** in ~0.7 s — 12 golden + 4 invariants + 18 partition + 19 snapshot mapper + **24 marketplace mapper** (was 19 + 5 new pricing) + **24 dev-scenario** (was 21 + 3 new) |
| `npm run build` | ✅ Next.js build green; no route signatures changed |

New pricing-specific tests:

```
▶ mapDecisionToMarketplaceLot — pricing
  ✔ roastedPricePerKg = greenPricePerKg / roastYield
  ✔ respects the 0.5 yield floor (never divides by tiny yield)
  ✔ propagates currency from snapshot, defaults to EUR when missing
  ✔ returns null roasted price when green price is missing

▶ pricing engine compatibility (dev scenario)
  ✔ toPricingEngineVariety normalises common variety strings
  ✔ toPricingEngineVariety throws for unsupported varieties
  ✔ every recipe variety + SCA combination has a base price

▶ recipe presets
  ✔ recipes do NOT carry an invented pricePerKg field
```

---

## 7. Manual verification steps

1. **Reset.** Open `/dev/scenarios/lots`, click **Reset dev scenarios**.
2. **Seed the boundary set.** Scenario `allocation_engine_decides`, target stage `published`, count 10. Click **Seed scenario**.
3. **Inspect the engine output.** Open `/api/internal/allocation/run` (in another tab — same dev cookie). Confirm:
   - Each entry has `decision.recommendedSurface ∈ {CONTRACT_CATALOG, SPLIT, EXCLUSIVE_MICROLOT, OPEN_MARKETPLACE, HOLD}`.
   - Snapshots carry `greenPricePerKg` derived by `calculateProducerPricing` (e.g. Castillo SCA 83 at altitude 1850 should be ≈ €5.78/kg green: `3.5 + 2 (altitude additive) = 5.5`, then × 1 (variety) × 1.05 (Colombia country) = ≈ 5.78).
4. **Open marketplace.** Navigate to `/platform/marketplace`. Pick any lot card and confirm:
   - Visible price is **€XX.XX** (NOT `$XX.XX`).
   - Sub-label says `/kg roasted` (NOT `/kg`).
   - Available stat says `XXX kg roasted`.
   - The roasted price matches `greenPrice / 0.85` (or the lot's actual yield).
5. **Verify the quantity is the marketplace portion.** For a SPLIT lot, the `availableKg` shown must equal the residual marketplace pool, not the full lot — cross-check against `decision.marketplaceEligibleGreenKg × roastYield` in the dry-run JSON.
6. **Seed exclusive_microlots.** Reset again, seed `exclusive_microlots` with `published`. Confirm marketplace shows them tagged "Exclusive microlot" (gold badge), price still EUR/kg roasted, computed from real engine numbers.
7. **Logistics-bound holds.** Reset. Seed `logistics_ready` with target stage `destination_received`. Confirm those lots **do not appear** in marketplace (allocation engine emits `HOLD + SHIPMENT_ALREADY_RESERVED`).

---

## 8. Known limitations

1. **`marginPerKg = 0` and `producerPricePerKg = clientPricePerKg`.** This mirrors the documented production stance in `lotVerification.service.ts` line 192–194. The full client-pricing economics fix (margin, logistics, roasting cost) is out of scope for this sprint.

2. **Roast-yield math is inlined in the marketplace mapper.** A two-line copy of `computeRoastedPrice` + `greenToRoasted` lives in the mapper to keep node `--test` runs free of the `@prisma/client` transitive import. Marked with a "KEEP IN SYNC" comment. If `src/lib/roastYield.ts` ever changes the floor or the formula, the mapper must be updated too. The dev-scenario test that calls `BASE_PRODUCER_PRICING` directly is a separate file and uses the canonical table.

3. **No `MarketSignalSnapshot` read in the dev factory.** `lotVerification.service` reads the active market snapshot and feeds `cPrice` + `demandIndex` into the engine. The dev factory does NOT — it always calls the engine with no `marketData`, the deterministic fallback. Acceptable for v0; means dev lots ignore the market modifiers (commodity + demand). Add later if needed for testing the market-signal pipeline.

4. **Currency is whatever the lot stored.** Cards format `€` for EUR, `$` for USD, `£` for GBP, fallback to `${amount} ${code}`. Today every dev lot is EUR, but the components don't assume it.

5. **`availableUnit` defaults to `"roasted"` when missing.** The DTO adapter always sets `"roasted"`. Legacy mock fixture rows (no longer rendered in production) don't set it, hence the optional field — the components fall back to "roasted" gracefully.

6. **Recipe SCA values now constrain to engine-supported ranges.** `getScaRange` throws below 80; recipes are all SCA 81+. Recipes with rare varieties (PINK_BOURBON, GEISHA) only sit in 84+ ranges (the only ranges where they have a base price). The "every recipe variety + SCA combination has a base price" test enforces this at CI time.

7. **Visual tone palette unchanged.** Country-keyed (Colombia → sunrise, etc.). Pricing changes don't affect tone selection.

8. **Spanish strings absent.** All UI labels remain English (matches the rest of the dev tooling).

---

## 9. Next recommended sprint

**ALLOC-4 — `/api/contracts/catalog` for the trading desk.** Re-uses
`buildAllocationSnapshots` and the same allocation pipeline, but filters to
`recommendedSurface ∈ { CONTRACT_CATALOG, SPLIT } && contractAssignableGreenKg ≥ minMarketplaceKg`,
exposing `contractAssignableGreenKg` and `committedContractGreenKg` while
keeping the marketplace residual cleanly separate. Migrate
[Dashboard.tsx](../../src/components/platform/client/Dashboard.tsx) from
`/api/market` to the new route. With pricing now wired correctly, the
contract catalog gets honest green + roasted prices for free.
