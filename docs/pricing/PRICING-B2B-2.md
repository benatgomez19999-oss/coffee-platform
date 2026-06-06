# PRICING-B2B-2 — Marketplace uses full adaptive pricing engine

Sprint scope: replace the static founder reference table as the marketplace's
primary price source with an adaptive pipeline that re-runs the producer
engine + a commercial layer (loss / roasting / packaging / logistics / margin
× quality multiplier), clamped to the founder reference's `[0.7×, 1.3×]`
sanity band. The founder reference table becomes a **calibration band**, not
the answer. Read-only — contracts / persistence are untouched.

---

## 1. Files changed

### Created

| Path | Role |
|---|---|
| [src/engine/pricing/client/calculateMarketplaceB2BPricing.ts](../../src/engine/pricing/client/calculateMarketplaceB2BPricing.ts) | Pure adaptive pricing module. Takes `(sca, altitude, variety, process, country, roastYield, marketData)`, returns `{ pricePerKgRoasted, pricingMode, producerGreenPricePerKg, originEquivalentRoastedPricePerKg, b2bReferencePricePerKg, adaptiveB2BPricePerKg, breakdown, fallbackReason? }`. Producer engine is **dependency-injected** so the module is testable under `node --test`. |
| [src/engine/pricing/client/__tests__/calculateMarketplaceB2BPricing.test.ts](../../src/engine/pricing/client/__tests__/calculateMarketplaceB2BPricing.test.ts) | 17 new pure tests — band membership for the four founder examples, marketData propagation, fallback hierarchy, breakdown shape, clamp behaviour. |
| [src/services/pricing/marketSignal.service.ts](../../src/services/pricing/marketSignal.service.ts) | `getLatestMarketSignalForPricing()` — reads the latest active `MarketSignalSnapshot`, range-validates `cPrice ∈ [50, 600]` and `demandIndex ∈ [0.8, 1.2]` (mirrors `lotVerification.service`). Returns `null` when no usable snapshot exists. |

### Modified

| Path | Change |
|---|---|
| [src/services/allocation/marketplace/marketplaceLot.mapper.ts](../../src/services/allocation/marketplace/marketplaceLot.mapper.ts) | DTO gains `producerGreenPricePerKg`, `b2bReferencePricePerKg`, `adaptiveB2BPricePerKg`, `pricingBreakdown`. `pricingMode` union expanded to `ADAPTIVE_B2B_ENGINE \| B2B_REFERENCE_FALLBACK \| ORIGIN_EQUIVALENT_FALLBACK`. Old `b2bRoastedPricePerKg` replaced by `b2bReferencePricePerKg`. New optional third arg `pricingContext: { marketData?, producerPricingFn? }`. |
| [src/services/allocation/marketplace/marketplaceView.service.ts](../../src/services/allocation/marketplace/marketplaceView.service.ts) | Reads `MarketSignalSnapshot` once via `getLatestMarketSignalForPricing()`. Builds a `pricingContext` with `producerPricingFn` adapter (boundary cast for the engine's strict literal-union types). Passes the context to every `mapDecisionToMarketplaceLot` call. Snapshots + market signal load in parallel. |
| [src/services/allocation/__tests__/marketplaceLot.mapper.test.ts](../../src/services/allocation/__tests__/marketplaceLot.mapper.test.ts) | Renamed `B2B_REFERENCE` → `B2B_REFERENCE_FALLBACK`, `b2bRoastedPricePerKg` → `b2bReferencePricePerKg`. Added 6 new tests under "adaptive pricing path" covering engine-injected mode + marketData propagation + producer-engine-throws fallback. |
| [src/components/platform/marketplace/mock-marketplace-data.ts](../../src/components/platform/marketplace/mock-marketplace-data.ts) | `pricingMode` union expanded. |
| [src/components/platform/marketplace/MarketplaceLotCard.tsx](../../src/components/platform/marketplace/MarketplaceLotCard.tsx) | Muted line shows "Fallback price" when `pricingMode !== "ADAPTIVE_B2B_ENGINE"`. |
| [src/components/platform/marketplace/FeaturedLotCard.tsx](../../src/components/platform/marketplace/FeaturedLotCard.tsx) | Same treatment under the featured indicative price. |

### Untouched (verified)

`prisma/schema.prisma`, migrations, `src/services/clients/contracts.service.ts`,
`src/services/clients/demandIntent.service.ts`,
`src/services/partner/lotVerification.service.ts`, `src/engine/pricing/producer/**`,
allocation engine + policy + snapshot service, shipment, Stripe, semaphore,
logistics, CoffeeAssistant.

---

## 2. Current pricing path after this sprint

```
GreenLot row in DB
  ├── pricingSnapshot.clientPricePerKg   ← STILL green; CONTRACTS still read this
  └── farm.altitude / lot.scaScore / lot.variety / lot.process

marketplaceView.service.getMarketplaceLotsView()
  │
  ├── 1. await Promise.all([
  │       buildAllocationSnapshots(),
  │       getLatestMarketSignalForPricing(),
  │     ])                                ← MarketSignalSnapshot read ONCE per render
  │
  ├── 2. for each snapshot:
  │       decideLotAllocation(snap)        ← unchanged
  │       mapDecisionToMarketplaceLot(snap, decision, {
  │         marketData,
  │         producerPricingFn: calculateProducerPricing,
  │       })
  │
  └── 3. mapper calls calculateMarketplaceB2BPricing with the snapshot's
         (sca, altitude, variety, process, country, roastYield) + marketData

calculateMarketplaceB2BPricing
  │
  ├── Step 1: producer engine
  │     calculateProducerPricing({ sca, altitude, variety, process, country, marketData })
  │     → producerGreenPricePerKg
  │     → originEquivalentRoastedPricePerKg = producerGreen / max(0.5, yield)
  │
  ├── Step 2: commercial layer
  │     baseCost = origin-equivalent + roasting + packaging + logistics
  │     margined = baseCost × (1 + commercialMarginRate)
  │     adaptiveB2B = margined × qualityMultiplier(sca, variety)
  │
  ├── Step 3: founder reference clamp
  │     reference = calculateB2BRoastedPricing(sca, altitude, variety)
  │     final = clamp(adaptiveB2B, reference × 0.7, reference × 1.3)
  │
  └── pricingMode = "ADAPTIVE_B2B_ENGINE"  (for all dev-seeded valid lots)

Card displays roastedPricePerKg with EUR glyph and "/kg roasted" label.
```

---

## 3. Adaptive marketplace B2B price — formula v0

```
producerGreen   = calculateProducerPricing(sca, altitude, variety, process,
                                           country, marketData).finalPrice
originEquivKg   = producerGreen / max(0.5, roastYield)

baseCost        = originEquivKg
                + ROASTING_COST_PER_KG       (5.5)
                + PACKAGING_COST_PER_KG      (1.0)
                + LOGISTICS_COST_PER_KG      (1.5)

margined        = baseCost × (1 + COMMERCIAL_MARGIN_RATE)        (margin 0.35)

qualityMultiplier:
  start 1.0
  + 0.10 if sca ≥ 87
  + 0.20 if sca ≥ 89                                              (additional)
  + 1.25 if variety = GEISHA
  + 0.35 if variety = PINK_BOURBON
  + 0.10 if variety ∈ {BOURBON, TYPICA, TABI}
  capped at 3.0

adaptiveB2B     = margined × qualityMultiplier

reference       = founder table[bucket(altitude)][variety][bucket(sca)]
floor           = reference × 0.7
ceiling         = reference × 1.3
final           = clamp(adaptiveB2B, floor, ceiling)
```

Worked example (no marketData):

| Lot | producerGreen | originEquiv | baseCost | margined | qualityMult | adaptive (pre-clamp) | reference | band | final |
|---|---|---|---|---|---|---|---|---|---|
| Geisha 88 @ 2050 (WASHED) | 19.64 | 23.11 | 31.11 | 42.00 | 2.35 | 98.70 | 200 | [140, 260] | **140** (clamped) |
| Pink Bourbon 87 @ 1650 | 12.40 | 14.59 | 22.59 | 30.50 | 1.45 | 44.23 | 50 | [35, 65] | **44.23** |
| Bourbon 86 @ 1850 (NATURAL) | 7.88 | 9.61 | 17.61 | 23.77 | 1.10 | 26.15 | 38 | [26.6, 49.4] | **26.60** (clamped) |
| Castillo 83 @ 1850 | 5.78 | 6.80 | 14.80 | 19.98 | 1.00 | 19.98 | 28 | [19.6, 36.4] | **19.98** |
| Castillo 81 @ 1750 | 5.25 | 6.18 | 14.18 | 19.14 | 1.00 | 19.14 | 26 | [18.2, 33.8] | **19.14** |

All values land **within** the founder reference band — none escape the
sanity guard. Geisha and Bourbon clamp up to the floor (the v0 commercial
constants under-shoot the founder's high-end tiers); calibration of
`ROASTING_COST_PER_KG`, `COMMERCIAL_MARGIN_RATE`, or the quality multiplier
curve is the natural founder follow-up.

All constants are at the top of `calculateMarketplaceB2BPricing.ts` with
`TODO: founder calibration` comments — no magic numbers buried in code.

---

## 4. CP / demand integration

`getLatestMarketSignalForPricing()` reads the latest `MarketSignalSnapshot`
where `isActive = true`, ordered by `createdAt desc`, validates:

- not expired (`expiresAt == null || expiresAt > now`)
- `cPrice ∈ [50, 600]` (cents/lb)
- `demandIndex ∈ [0.8, 1.2]`

Returns `{ cPrice, demandIndex }` or `null`. Same validation rules as
`lotVerification.service.ts` — both code paths accept / reject the same
snapshots, so a verified lot and the marketplace card derived from it agree
on whether the market signal applied.

When `marketData` is `null`:

- The producer engine's `commodityModifier` returns `1` (no `cPrice` factor).
- The producer engine's `demandModifier` returns `1` (no demand factor).
- Final price falls purely on `(sca, altitude, variety, process, country)`.
- The breakdown still records `cPrice: null, demandIndex: null` for audit.

When `marketData` exists:

- `cPrice = 240` raises producer green by `min(240/180, 1.25) = 1.25×`
  (clamped by the engine's commodity band).
- `demandIndex = 1.2` raises by another 1.2×.
- The clamp band against the founder reference still applies — the
  marketplace can never overshoot the reference's 130 % ceiling regardless
  of how hot the market is.

The marketplace renders deterministically across an entire request (one
snapshot read per `getMarketplaceLotsView` call) so cards within a single
page render are internally consistent.

---

## 5. Founder reference table — new role

Before: the static table value WAS the displayed price.

After: the table is a **commercial sanity band** only:

- `floor = reference × 0.7` (prevents engine from undershooting too far)
- `ceiling = reference × 1.3` (prevents engine from runaway)
- adaptive price is clamped into `[floor, ceiling]` whenever the table has
  a cell for `(altitude bucket, variety, SCA bucket)`
- when the table cell is null (e.g. Geisha at SCA ≤ 83), no clamp applies —
  the adaptive price is used as-is

If the producer engine fails (unsupported variety / missing inputs), the
fallback hierarchy:

1. Adaptive engine succeeded → `pricingMode = "ADAPTIVE_B2B_ENGINE"`
2. Adaptive failed but reference table has a value → `"B2B_REFERENCE_FALLBACK"`
3. Reference null but origin-equivalent computable → `"ORIGIN_EQUIVALENT_FALLBACK"`
4. All paths failed → `pricePerKgRoasted = null`

Cards show "Fallback price" muted text whenever `pricingMode !== "ADAPTIVE_B2B_ENGINE"`.

---

## 6. What was intentionally not changed

- **`PricingSnapshot.clientPricePerKg`** — still the green price; contracts read it as before.
- **`contracts.service.ts`** — `lockedPricePerKg = computeRoastedPrice(green, yield)` unchanged.
- **`demandIntent.service.ts`** — uses the same green + yield path.
- **`lotVerification.service.ts`** — producer pricing pipeline at lot verification time.
- **`src/engine/pricing/producer/**`** — the producer engine itself; we only consume it.
- **`src/lib/roastYield.ts`** — pure roast-yield helpers.
- **Allocation engine + policy + snapshot service** — pure surface decisions, unchanged.
- **Prisma schema** — no field added; `MarketSignalSnapshot` already existed.
- **Stripe / shipment / semaphore / CoffeeAssistant**.
- **Wush Wush / Sudan Rume support** — recipes use the eight founder-supported varieties only; unsupported varieties cleanly fall back via `B2B_REFERENCE_FALLBACK` (when the table has a value) or `ORIGIN_EQUIVALENT_FALLBACK`.

---

## 7. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:allocation` | ✅ **161 / 161 pass** in ~1.6 s — 12 golden + 4 invariants + 18 partition + 19 snapshot mapper + **30 marketplace mapper** (was 24, +6 adaptive) + 24 dev-scenario + 25 B2B reference + **17 adaptive B2B engine** (new) + 12 misc |
| `npm run build` | ✅ Next.js build green |

New adaptive-engine test highlights:

```
▶ calculateMarketplaceB2BPricing — adaptive within founder band
  ✔ Geisha 88 @ 2050 → within 70–130% of €200 reference
  ✔ Pink Bourbon 87 @ 1650 → within 70–130% of €50 reference
  ✔ Bourbon 86 @ 1850 (NATURAL 0.82) → within 70–130% of €38 reference
  ✔ Castillo 83 @ 1850 → within 70–130% of €28 reference
▶ calculateMarketplaceB2BPricing — marketData propagates
  ✔ higher cPrice raises producerGreenPrice (within clamp band)
  ✔ higher demandIndex raises producerGreenPrice
  ✔ missing marketData still produces a valid adaptive price
  ✔ breakdown records cPrice / demandIndex even when null
▶ calculateMarketplaceB2BPricing — fallbacks
  ✔ producer engine throws → falls back to founder reference if available
  ✔ unsupported variety + reference miss → ORIGIN_EQUIVALENT_FALLBACK
  ✔ missing altitude → null price
  ✔ missing SCA → null price
▶ calculateMarketplaceB2BPricing — clamp
  ✔ clamps adaptive price to ≥ 70% of reference when too low (Geisha → €140 floor)
  ✔ clamps adaptive price to ≤ 130% of reference when too high (Castillo → €36.40 ceiling)
▶ mapDecisionToMarketplaceLot — adaptive pricing path
  ✔ flips pricingMode to ADAPTIVE_B2B_ENGINE when producerPricingFn is injected
  ✔ propagates marketData — higher cPrice raises producerGreenPrice
  ✔ falls back to B2B_REFERENCE_FALLBACK when producer engine throws
```

---

## 8. Manual verification

1. **Reset.** `/dev/scenarios/lots` → click **Reset dev scenarios**.
2. **Seed.** `allocation_engine_decides`, target stage `published`, count 10.
3. Open `/platform/marketplace`. Card prices should land **inside** but **not** at exactly the founder values. Expected (no `MarketSignalSnapshot`):
   - Nariño Geisha Reserve (SCA 88) → **€140.00** /kg roasted (clamped at floor)
   - Antioquia Pink Bourbon Selection (SCA 87) → **€44.23**
   - Huila Bourbon Natural (SCA 86) → **€26.60** (clamped at floor)
   - Antioquia Castillo Washed Lot (SCA 83) → **€19.98**
   - Huila Castillo Washed Lot (SCA 83) → **€19.98**
   - Tolima Castillo Washed Lot (SCA 81) → **€19.14**
4. **No "Fallback price" muted line** appears (every dev lot is `ADAPTIVE_B2B_ENGINE`).
5. Hit `GET /api/marketplace/lots`. Each DTO carries:
   - `pricePerKgRoasted` — the displayed value
   - `producerGreenPricePerKg` — green from the engine (not from PricingSnapshot)
   - `originEquivalentRoastedPricePerKg` — green/yield audit
   - `b2bReferencePricePerKg` — founder table reference
   - `adaptiveB2BPricePerKg` — pre-clamp engine output
   - `pricingMode` — `"ADAPTIVE_B2B_ENGINE"`
   - `pricingBreakdown` — array with `producerGreenPricePerKg`, `originEquivalentRoastedPricePerKg`, `roastingCostPerKg`, `packagingCostPerKg`, `logisticsCostPerKg`, `commercialMarginRate`, `qualityMultiplier`, `adaptivePreClampPerKg`, `b2bReferencePricePerKg`, `referenceFloor`, `referenceCeiling`, `adaptivePostClampPerKg`
6. **CP/demand effect (manual).** Insert an active row in `MarketSignalSnapshot` with `cPrice = 240, demandIndex = 1.15` (`isActive = true`, no `expiresAt`). Refresh marketplace. Cards should rise within the clamp band. Reset to a normal cPrice (180) — cards return to the deterministic values.
7. **Allocation surfaces unchanged.** `GET /api/internal/allocation/run` — surfaces and quantities are untouched (allocation never sees pricing).
8. **Contracts untouched.** Open `/platform/client` and pick any lot for a contract. `lockedPricePerKg` is still derived via `computeRoastedPrice(pricingSnapshot.clientPricePerKg, roastYield)` — no influence from the marketplace adaptive layer.

---

## 9. Known limitations

1. **`MarketSignalSnapshot` is per-request.** A snapshot inserted between request 1 and request 2 will only affect request 2. Acceptable v0 — the snapshot table is operator-curated, not high-frequency.
2. **`commercialMarginRate = 0.35` and the quality multiplier are placeholders.** Real cost components (logistics by route, packaging variants, brand margin tiers) are TODOs marked in the source. When the founder confirms numbers, update those constants.
3. **High-end Geisha clamps to floor, not target.** Adaptive output for Geisha 88 @ 2050 is €98.70 pre-clamp; reference is €200; clamp to €140. Re-tuning the quality multiplier (Geisha 1.25 → maybe 2.5) and/or the margin would close this gap. Marked as a calibration item, not a bug.
4. **Persistence still unchanged.** `PricingSnapshot.clientPricePerKg` is still the producer green; contracts still derive their roasted price from green/yield. The marketplace card's adaptive price has **no** effect on a signed contract. Closing this gap is PRICING-B2B-3.
5. **No FX.** Adaptive pipeline assumes EUR throughout. A snapshot row with `currency = "USD"` would still be priced via the EUR commercial layer — fine for Colombian-origin dev data, brittle for non-EUR future data.
6. **Boundary cast in marketplaceView.service.ts.** The producer engine's local `Variety` / `ProcessType` literal unions aren't exported, so `marketplaceView.service` casts via `Parameters<typeof calculateProducerPricing>[0]["variety"]`. Runtime-safe because `calculateMarketplaceB2BPricing` validates against `PRODUCER_VARIETY_SET` before calling.
7. **`MarketplaceInsightsPanel` averages across pricingModes.** When some lots resolve to ADAPTIVE_B2B_ENGINE and others to fallback, the avg is conceptually mixed. Today every dev lot is adaptive, so academic.
8. **No audit trail persisted.** The `pricingBreakdown` is recomputed each request. Snapshotting the breakdown for "what did this card show on date X?" belongs in a future sprint.
9. **Dev scenario factory still calls `calculateProducerPricing` without `marketData`.** That's the *seed* path — it produces the `pricingSnapshot.clientPricePerKg` (green) at lot creation. The marketplace re-runs the engine with `marketData` at read time. Lot verification (`lotVerification.service.ts`) does pass `marketData` already; the dev factory parity gap is tracked for PRICING-WIRE-2 (out of scope here).

---

## 10. Next recommended sprint

**PRICING-B2B-3 — Persist marketplace B2B prices and rewire contracts.**

Concretely:

1. Schema change — `PricingSnapshot.clientB2BPricePerKg Float?` (Phase 1: nullable
   for backwards-compat).
2. `lotVerification.service` writes both `clientPricePerKg` (green, unchanged)
   AND `clientB2BPricePerKg` (computed via `calculateMarketplaceB2BPricing`
   with the same `marketData` the engine consumed).
3. `contracts.service.ts.createContractWithSupplyValidation`:
   `lockedPricePerKg = pricingSnapshot.clientB2BPricePerKg ?? computeRoastedPrice(...)`.
4. Marketplace mapper drops its inline `calculateMarketplaceB2BPricing` call
   in favour of the persisted value when present — single source of truth
   per-lot, with adaptive recompute as a fallback for unmigrated lots.
5. After backfill: `marketplace card price === contract locked price` — the
   commercial gap closes end-to-end.

That sprint touches the schema, contracts, and lotVerification — explicitly
out of scope here.

**Optional smaller follow-ups before B2B-3:**

- **PRICING-WIRE-2** — wire `getLatestMarketSignalForPricing` into the dev scenario
  factory so seeded lots also reflect the active market signal at seed time.
- **PRICING-B2B-2a** — founder calibration of `ROASTING_COST_PER_KG`,
  `COMMERCIAL_MARGIN_RATE`, and the quality multiplier curve so Geisha doesn't
  clamp to floor.
- **PRICING-INSIGHTS-1** — currency-aware insights average that filters by
  `pricingMode` so mixed datasets don't produce nonsense averages.
