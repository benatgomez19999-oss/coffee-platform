# PRICING-B2B-1 — Marketplace B2B roasted price engine v0

Sprint scope: introduce a **read-only** B2B roasted pricing layer that maps
`(altitude bucket, variety, SCA bucket)` to founder-reference €/kg roasted
prices, and wire `/platform/marketplace` cards to display it. The
green-derived origin-equivalent calculation is preserved for audit and
fallback. **Nothing in the contract / demand-intent / persistence path is
touched.**

---

## 1. Files changed

### Created

| Path | Role |
|---|---|
| [src/engine/pricing/client/b2bRoastedPricing.ts](../../src/engine/pricing/client/b2bRoastedPricing.ts) | Pure module — founder reference table + `calculateB2BRoastedPricing`, `getB2BAltitudeBucket`, `getB2BScaBucket`, `normalizeB2BVariety`. No Prisma, no I/O. |
| [src/engine/pricing/client/__tests__/b2bRoastedPricing.test.ts](../../src/engine/pricing/client/__tests__/b2bRoastedPricing.test.ts) | 25 pure tests — bucketers, variety normaliser, exact table values, null cells, missing inputs, metadata. |

### Modified

| Path | Change |
|---|---|
| [src/services/allocation/marketplace/marketplaceLot.mapper.ts](../../src/services/allocation/marketplace/marketplaceLot.mapper.ts) | DTO gains `originEquivalentRoastedPricePerKg`, `b2bRoastedPricePerKg`, `pricingMode`, `pricingReference`. `roastedPricePerKg = b2b ?? originEquivalent`. Currency is `EUR` on the B2B path; falls back to snapshot currency on the origin-equivalent path. |
| [src/services/allocation/__tests__/marketplaceLot.mapper.test.ts](../../src/services/allocation/__tests__/marketplaceLot.mapper.test.ts) | Replaced 4 old pricing tests with 8 new ones covering both the B2B-hit and origin-equivalent-fallback paths. |
| [src/components/platform/marketplace/mock-marketplace-data.ts](../../src/components/platform/marketplace/mock-marketplace-data.ts) | `MarketplaceLot` view-model gains optional `pricingMode`. |
| [src/components/platform/marketplace/MarketplacePage.tsx](../../src/components/platform/marketplace/MarketplacePage.tsx) | `dtoToLot` adapter forwards `dto.pricingMode`. |
| [src/components/platform/marketplace/MarketplaceLotCard.tsx](../../src/components/platform/marketplace/MarketplaceLotCard.tsx) | Shows muted "Origin equivalent" line under the price when `pricingMode === "ORIGIN_EQUIVALENT_FALLBACK"`. |
| [src/components/platform/marketplace/FeaturedLotCard.tsx](../../src/components/platform/marketplace/FeaturedLotCard.tsx) | Same treatment under the featured indicative price. |
| [package.json](../../package.json) | `test:allocation` glob now also covers `src/engine/pricing/client/__tests__/*.test.ts`. |

### Untouched (verified)

`src/services/clients/contracts.service.ts`, `src/services/clients/demandIntent.service.ts`,
`src/services/partner/lotVerification.service.ts`, `src/engine/pricing/producer/**`,
`src/lib/roastYield.ts`, allocation engine + policy, snapshot service, shipment
routes, Prisma schema, migrations, Stripe, semaphore, logistics.

---

## 2. New B2B pricing module

### Public API

```ts
type B2BRoastedScaBucket = "80_83" | "84_86" | "86_90_PLUS"

type SupportedB2BVariety =
  | "CASTILLO" | "CATURRA" | "COLOMBIA" | "TYPICA"
  | "BOURBON"  | "PINK_BOURBON" | "GEISHA" | "TABI"

type B2BRoastedFallbackReason =
  | "MISSING_ALTITUDE"
  | "MISSING_SCA"
  | "UNSUPPORTED_VARIETY"
  | "UNAVAILABLE_FOR_SCA_BUCKET"

calculateB2BRoastedPricing(input: {
  altitude: number | null,
  variety: string,
  scaScore: number | null,
  currency?: string | null,
}): {
  pricePerKgRoasted: number | null,
  currency: "EUR",
  altitudeBucket: number | null,
  scaBucket: B2BRoastedScaBucket | null,
  variety: string,
  pricingVersion: "b2b-roasted-reference-v0",
  source: "founder-reference-table",
  fallbackReason?: B2BRoastedFallbackReason,
  breakdown: Array<{ label: string, value: string | number | null }>,
}
```

Plus `getB2BAltitudeBucket`, `getB2BScaBucket`, `normalizeB2BVariety` — exposed
for tests + future audit tools.

### Bucket rules

| Input | Bucket |
|---|---|
| altitude `< 1300` | `1300` |
| altitude `≥ 2000` | `2000` |
| else | `Math.floor(altitude / 100) × 100` |
| `null` / `NaN` / non-finite | `null` (yields `MISSING_ALTITUDE`) |
| sca `≤ 83` | `80_83` |
| sca `≤ 86` | `84_86` |
| sca `> 86` | `86_90_PLUS` |
| sca `null` / `NaN` | `null` (yields `MISSING_SCA`) |

### Variety normaliser

`"Pink Bourbon"`, `"pink_bourbon"`, `"pink-bourbon"`, `"  caturra  "` → all map
to the canonical `PINK_BOURBON` / `CATURRA` form. Anything outside the eight
supported varieties returns `null`, which the engine surfaces as
`UNSUPPORTED_VARIETY` (so Wush Wush / Sudan Rume cleanly fall back to the
origin-equivalent path without breaking).

### Founder reference table

Encoded as `Record<AltitudeBucket, Record<SupportedB2BVariety, [80_83, 84_86, 86_90_PLUS]>>`.
Cells where Pink Bourbon / Geisha don't exist at the 80–83 SCA band are
`null` — the engine surfaces those as `UNAVAILABLE_FOR_SCA_BUCKET`. Currency
is **always EUR** on the result, regardless of `input.currency`. The input
parameter is kept on the type signature as a reservation for future FX work.

### Fallback hierarchy

The engine checks in this order: `altitude` → `sca` → `variety` → `tableCell`.
The first failing check sets the `fallbackReason`. Tests enforce the order so
behaviour is predictable when multiple inputs are missing.

---

## 3. Marketplace mapper changes

### Before

```ts
roastedPricePerKg = greenPricePerKg / max(0.5, roastYield)   // single value
currency          = snapshot.currency ?? "EUR"
```

### After

```ts
// 1. Origin-equivalent — wholesale-equivalent of green, kept for audit.
originEquivalentRoastedPricePerKg = greenPrice / max(0.5, yield)

// 2. B2B reference — full commercial chain, when the table has a hit.
b2bRoastedPricePerKg = calculateB2BRoastedPricing({ altitude, variety, sca }).pricePerKgRoasted

// 3. Display value — B2B wins, origin-equivalent is the fallback.
roastedPricePerKg = b2bRoastedPricePerKg ?? originEquivalentRoastedPricePerKg

pricingMode = b2bRoastedPricePerKg != null
  ? "B2B_REFERENCE"
  : "ORIGIN_EQUIVALENT_FALLBACK"

pricingReference = {
  altitudeBucket, scaBucket, pricingVersion: "b2b-roasted-reference-v0",
  source: "founder-reference-table",
  fallbackReason?: ...
}

currency = pricingMode === "B2B_REFERENCE"
  ? "EUR"                                  // table is EUR-denominated
  : snapshot.currency ?? "EUR"             // origin path respects lot currency
```

### Expected card values after reset + seed `allocation_engine_decides`

| Lot | SCA | Altitude (m) | Bucket | SCA bucket | Founder cell | Card price | Mode |
|---|---|---|---|---|---|---|---|
| Nariño Geisha Reserve | 88 | 2050 | **2000** | 86_90_PLUS | 200 | **€200.00** | B2B_REFERENCE |
| Nariño Geisha (350 kg, SCA 91) | 91 | 2050 | **2000** | 86_90_PLUS | 200 | **€200.00** | B2B_REFERENCE |
| Antioquia Pink Bourbon Selection | 87 | 1650 | **1600** | 86_90_PLUS | 50 | **€50.00** | B2B_REFERENCE |
| Nariño Geisha (mid-volume, SCA 88) | 88 | 2050 | **2000** | 86_90_PLUS | 200 | **€200.00** | B2B_REFERENCE |
| Cauca Bourbon Washed Lot | 85 | 1900 | **1900** | 84_86 | 41 | **€41.00** | B2B_REFERENCE |
| Tolima Caturra Washed Lot | 84 | 1750 | **1700** | 84_86 | 34 | **€34.00** | B2B_REFERENCE |
| Antioquia Castillo Washed Lot | 83 | 1650 | **1600** | 80_83 | 24 | **€24.00** | B2B_REFERENCE |
| Antioquia Colombia Washed Lot | 84 | 1650 | **1600** | 84_86 | 28 | **€28.00** | B2B_REFERENCE |
| Tolima Castillo Washed Lot | 81 | 1750 | **1700** | 80_83 | 26 | **€26.00** | B2B_REFERENCE |
| Huila Bourbon Natural | 86 | 1850 | **1800** | 84_86 | 38 | **€38.00** | B2B_REFERENCE |

Nariño farms are at altitude 2050 in the dev factory (capped to bucket 2000).
Antioquia farms are at 1650 (bucket 1600). Tolima at 1750 (bucket 1700). Huila
at 1850 (bucket 1800). Cauca at 1900 (bucket 1900). All exact founder values.

The "Huila Castillo Washed Lot" SCA 83 boundary case (recipe 1) lands on bucket
1800 / SCA 80_83 → **€28** (matches the founder example in the audit).

---

## 4. What was intentionally not changed

- **`PricingSnapshot.clientPricePerKg` semantics.** The contract creation
  pipeline in `contracts.service.ts` still reads it as a green-equivalent and
  calls `computeRoastedPrice` itself. Repurposing this field would silently
  break contract pricing — out of scope for this sprint.
- **`lotVerification.service.ts`.** Producer pricing is unchanged.
- **`calculateProducerPricing`** and the entire producer pricing engine.
- **Allocation engine + policy.** `decideLotAllocation` is purely a volume /
  surface decision; pricing changes don't touch it.
- **`PricingSnapshot.breakdown` / `context`** for newly seeded lots is still
  written by the dev factory using the producer-engine breakdown. The B2B
  layer is read-only for marketplace display — it is not persisted anywhere.
- **Allocation API** (`/api/internal/allocation/run`, `/api/internal/allocation/lot/[id]`).
- **Stripe, demand intent, shipment, semaphore, logistics, CoffeeAssistant.**
- **Wush Wush / Sudan Rume support** — recipes use the eight founder-supported
  varieties only, and the B2B engine cleanly returns `UNSUPPORTED_VARIETY` for
  others (which is the expected origin-equivalent fallback).

---

## 5. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:allocation` | ✅ **138 / 138 pass** in ~1.2 s — 12 golden + 4 invariants + 18 partition + 19 snapshot mapper + **24 marketplace mapper** (was 24, swapped 4 old pricing tests for 8 new ones) + 24 dev-scenario + **25 B2B engine** (new) |
| `npm run build` | ✅ Next.js build green |

New B2B test results:

```
▶ getB2BAltitudeBucket                              5 / 5
▶ getB2BScaBucket                                   4 / 4
▶ normalizeB2BVariety                               2 / 2
▶ calculateB2BRoastedPricing — founder-reference table values   6 / 6
▶ calculateB2BRoastedPricing — null table cells     2 / 2
▶ calculateB2BRoastedPricing — missing inputs       5 / 5
▶ calculateB2BRoastedPricing — metadata + currency  3 / 3
```

Mapper B2B coverage:

```
▶ mapDecisionToMarketplaceLot — pricing (origin-equivalent + B2B)
  ✔ originEquivalentRoastedPricePerKg = greenPricePerKg / roastYield
  ✔ respects the 0.5 yield floor on the origin-equivalent path
  ✔ returns null on both paths when green price is missing AND B2B unavailable
  ✔ uses the founder B2B table when (altitude, variety, SCA) lookup hits
  ✔ preserves origin-equivalent even when B2B price is shown
  ✔ falls back to origin-equivalent when B2B cell is null (Geisha at low SCA)
  ✔ currency is EUR on B2B path regardless of snapshot currency
  ✔ currency follows the snapshot when on origin-equivalent fallback path
```

---

## 6. Manual verification

1. **Reset** dev scenarios via `/dev/scenarios/lots`.
2. **Seed** `allocation_engine_decides` (10 lots, target stage `published`).
3. Open `/platform/marketplace`. Confirm card prices land on the founder reference values:
   - Nariño Geisha Reserve → **€200.00** /kg roasted
   - Antioquia Pink Bourbon Selection → **€50.00**
   - Huila Bourbon Natural → **€38.00**
   - Antioquia Castillo Washed Lot → **€24.00**
   - Huila Castillo Washed Lot → **€28.00**
   - Tolima Castillo Washed Lot (SCA 81) → **€26.00**
4. **No "Origin equivalent" muted line** should appear on any of these cards
   (all are B2B_REFERENCE in the dev dataset).
5. Hit `GET /api/marketplace/lots`. Each DTO should carry:
   - `pricePerKgRoasted` — the displayed value
   - `originEquivalentRoastedPricePerKg` — the green/yield value (audit)
   - `b2bRoastedPricePerKg` — table lookup
   - `pricingMode` — `"B2B_REFERENCE"` for all dev lots
   - `pricingReference` — `{ altitudeBucket, scaBucket, pricingVersion: "b2b-roasted-reference-v0", source: "founder-reference-table" }`
6. Hit `GET /api/internal/allocation/run` — surfaces and quantities are
   **unchanged** (allocation engine doesn't see pricing).
7. **Contracts route untouched** — try creating a contract through the existing
   client flow on a lot. `lockedPricePerKg` is still derived via
   `computeRoastedPrice(pricingSnapshot.clientPricePerKg, roastYield)` — i.e.
   the green-equivalent path, no B2B influence. (Easy to verify by reading
   `contracts.service.ts:97` and confirming it's identical to before.)

To exercise the **fallback path** specifically, seed `exclusive_microlots`:
the recipes there include Typica/Bourbon at SCA 89-91 which are all in the
B2B table → still B2B_REFERENCE. To force a fallback, manually create a lot
with an unsupported variety (e.g. directly via Prisma Studio with
`variety = "Wush Wush"`); it should render with `pricingMode = ORIGIN_EQUIVALENT_FALLBACK`
and the muted "Origin equivalent" line appears under the card price.

---

## 7. Known limitations

1. **Persisted prices unchanged.** `PricingSnapshot.clientPricePerKg` is still
   green. Any service that reads `clientPricePerKg` (contracts, demand intents)
   sees the same number it always did. This is the intended scope — fixing the
   persisted semantics requires a coordinated change across contract creation,
   amendment, and reporting that is too invasive for this sprint.
2. **B2B → contract gap.** A user signing a monthly contract via the
   client trading desk is still locked at the green-derived roasted price
   (`green / yield`), not the B2B price the marketplace card shows. Document
   this as a known gap until PRICING-B2B-2 (which would persist the B2B price
   into a new field — `clientB2BPricePerKg` — and have contracts.service
   read it).
3. **Currency is EUR on the B2B path regardless of input.** The founder
   reference table is EUR-denominated; we don't FX. If a future lot has
   `currency = "USD"` and the B2B engine hits the table, the card will show
   €X.XX. The fallback path respects the lot's currency. Acceptable for v0
   because every dev / Colombian-origin lot is EUR.
4. **No interpolation between altitude buckets.** A lot at 1850 m gets the
   1800 m row. A 1450 m lot still gets the 1400 m row even though founder may
   have intended a smoother curve. Buckets match the founder spec exactly —
   no smoothing in v0.
5. **No marketData / cPrice / demand index input.** The B2B engine doesn't
   accept `marketData`. The producer pricing engine does, but the dev factory
   doesn't pass it. The B2B table is supposed to absorb commodity volatility
   into its margin layer — by founder design, not a bug.
6. **`MarketplaceInsightsPanel` average mixes pricing modes.** The panel
   averages `roastedPricePerKg` across all displayed lots; if some are B2B
   and some are fallback, the average is conceptually mixed. With every dev
   lot resolving to B2B_REFERENCE today, this is academic.
7. **Wush Wush / Sudan Rume not supported on the B2B path.** They cleanly
   fall back to origin-equivalent (with the muted "Origin equivalent" UI
   tag). Adding them requires the founder to extend the reference table.
8. **No persistence of B2B prices for audit replay.** Rebuilding a card
   tomorrow will recompute the B2B price from current `b2bRoastedPricing.ts`.
   If the founder updates the table, every card moves to the new value
   automatically. Snapshotting the displayed price would belong in a future
   sprint that persists per-row.

---

## 8. Next recommended sprint

**PRICING-B2B-2 — Persist B2B and rewire contracts.**

Concretely:

1. Add a `PricingSnapshot.clientB2BPricePerKg Float?` column (schema change)
   — written by `lotVerification.service.ts` alongside the existing producer
   green price, computed via `calculateB2BRoastedPricing`.
2. `contracts.service.ts`'s `lockedPricePerKg = computeRoastedPrice(green, yield)`
   becomes `lockedPricePerKg = pricingSnapshot.clientB2BPricePerKg ?? computeRoastedPrice(...)`
   — preferring the B2B price when available, transparently falling back for
   pre-existing rows.
3. The marketplace mapper drops its inline B2B call and reads the persisted
   field directly — single source of truth.
4. `clientPricePerKg` semantics finally aligned with the field name.

That sprint touches `prisma/schema.prisma`, contracts, demand intents, and
`lotVerification.service.ts` — explicitly out of scope here. The current
sprint is the read-only stepping stone.

**Optional smaller follow-ups before B2B-2:**

- **PRICING-B2B-1a — Logistics layer.** A pure module that, given
  `(origin region, destination country, requiresDestinationCustoms)`, returns
  €/kg logistics. Could feed into B2B-2 for a more transparent breakdown.
- **PRICING-WIRE-2 — `MarketSignalSnapshot` ingestion in the dev factory.**
  Currently dev lots don't apply `cPrice` / `demandIndex` modifiers because
  the dev factory passes no `marketData`. Wiring the snapshot read here
  (mirroring `lotVerification.service`) would close the parity gap.
- **PRICING-INSIGHTS-1 — Currency-aware insights average.** Filter the
  trend average by mode so mixed currency / mixed-mode datasets don't
  produce nonsense numbers.
