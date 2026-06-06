# Coffee Platform Pricing Engine — Canonical Documentation

> **Source-of-truth document, derived from code. No invented behaviour.**
> Every formula and value below is cited to the file + line that produces it.
> If something is uncertain or unimplemented, this doc says so explicitly.
>
> Last refreshed: **PRICING-ARCH-2B** is live. The MARKET_ANCHORED_MODEL is
> now anchored on `getMarketTargetPricing().band.expected` (research-backed
> May 2026 benchmark). The old SCA × altitude × country multiplier stack
> from PRICING-ARCH-1 is gone — those dimensions are encoded in the target
> table itself, so multiplying again would double-count.
> PRICING-ARCH-2A (target table layer), PRICING-ARCH-1 (dual models),
> PRICING-B2B-2, DEV-LOTS-3 are all live. PRICING-B2B-3 (persisted client
> B2B price) is **not** yet implemented.
>
> **Integer SCA assumption (founder direction):** Throughout this engine, SCA
> scores are treated as integers. Non-integer SCA support is a separate
> future sprint and is NOT a goal of any current pricing layer.

---

## 1. Executive summary

The platform currently has **seven** pricing surfaces, layered:

| # | Layer | Status | Where |
|---|---|---|---|
| 1 | Producer green/origin engine | ✅ Live | [src/engine/pricing/producer/calculatePricing.ts](../../src/engine/pricing/producer/calculatePricing.ts) |
| 2 | Roast yield conversion | ✅ Live | [src/lib/roastYield.ts](../../src/lib/roastYield.ts) |
| 3 | Marketplace adaptive B2B (read-only, recomputed at request time) | ✅ Live | [src/engine/pricing/client/calculateMarketplaceB2BPricing.ts](../../src/engine/pricing/client/calculateMarketplaceB2BPricing.ts) |
| 4 | Founder reference B2B table (now used as a clamp band) | ✅ Live | [src/engine/pricing/client/b2bRoastedPricing.ts](../../src/engine/pricing/client/b2bRoastedPricing.ts) |
| 5 | `MarketSignalSnapshot` (cPrice + demandIndex) | ✅ Schema + read in lot verification + marketplace, no automatic ingestion | [prisma/schema.prisma](../../prisma/schema.prisma) line 712-741, [src/services/pricing/marketSignal.service.ts](../../src/services/pricing/marketSignal.service.ts) |
| 6 | Contracts pricing path | ✅ Live, **but reads green-equivalent only — does not see marketplace adaptive layer** | [src/services/clients/contracts.service.ts](../../src/services/clients/contracts.service.ts) line 95-97 |
| 7 | Dev scenario pricing path | ✅ Live, calls real producer engine, **does NOT pass `marketData`** | [src/services/dev/scenarios/devLotScenario.service.ts](../../src/services/dev/scenarios/devLotScenario.service.ts) line 220-227 |

⚠️ **Marketplace ≠ contracts.** A card showing **€140/kg roasted** for a Geisha
(adaptive engine, clamped) and a contract signed against the **same lot** locks
at **~€23.11/kg roasted** (origin-equivalent of green). The card price is
read-only, recomputed each render; the contract price is persisted at
sign-time from `PricingSnapshot.clientPricePerKg / roastYield`. **Closing this
gap is the next planned sprint (PRICING-B2B-3).**

---

## 2. Pricing vocabulary

| Term | Unit | Green / Roasted | Persisted? | Where |
|---|---|---|---|---|
| `producerPricePerKg` (engine output) | EUR | green | no — function return value | [calculatePricing.ts:117-121](../../src/engine/pricing/producer/calculatePricing.ts#L117-L121) |
| `clientPricePerKg` (engine output) | n/a | n/a | n/a | **Does not exist as engine output** — see below |
| `GreenLot.pricePerKg` | EUR | green | yes (Prisma) | [prisma/schema.prisma:160](../../prisma/schema.prisma#L160). Set to `pricing.finalPrice` by [lotVerification.service.ts:185](../../src/services/partner/lotVerification.service.ts#L185) |
| `PricingSnapshot.producerPricePerKg` | EUR | green | yes | [prisma/schema.prisma:272](../../prisma/schema.prisma#L272). Set to `pricing.finalPrice` |
| `PricingSnapshot.clientPricePerKg` | EUR | **green** (despite name — see §13) | yes | [prisma/schema.prisma:275](../../prisma/schema.prisma#L275). Set to `pricing.finalPrice` (= producer price). Read by contracts as green |
| `PricingSnapshot.marginPerKg` | EUR | n/a | yes | Currently always `0` |
| green price | EUR/kg | green | varies | Authoritative source for downstream conversions |
| roasted price | EUR/kg | roasted | varies | Either origin-equivalent (green/yield) or full B2B |
| roasted-equivalent price | EUR/kg | roasted | computed | `green / max(0.5, yield)` — see [roastYield.ts:38-44](../../src/lib/roastYield.ts#L38-L44) |
| B2B roasted price | EUR/kg | roasted | computed (request-time) | Adaptive output of the full pipeline |
| `roastYield` | dimensionless | n/a | yes (`GreenLot.estimatedRoastYield`) or default | Range 0.50–1.00 — see §12 |
| `cPrice` | cents/lb | n/a | yes (`MarketSignalSnapshot.cPrice`) | ICE C-market reference, used by commodityModifier |
| `demandIndex` | dimensionless | n/a | yes (`MarketSignalSnapshot.demandIndex`) | Range 0.8–1.2 — used by demandModifier |
| SCA bucket | "80-83" \| "84-86" \| "87-90" | n/a | computed | See §5 |
| altitude modifier | EUR (additive) | n/a | computed | See §6 |
| variety modifier | factor (multiplicative) | n/a | computed | See §7 |
| country modifier | factor (multiplicative) | n/a | computed | See §8 |
| commodity modifier | factor (multiplicative, via `market` slot) | n/a | computed | See §9 |
| demand modifier | factor (multiplicative, via `market` slot) | n/a | computed | See §10 |

---

## 3. Producer green/origin pricing engine

**File:** [src/engine/pricing/producer/calculatePricing.ts](../../src/engine/pricing/producer/calculatePricing.ts)

### Input type

```ts
type PricingInput = {
  scaScore: number          // required
  altitude: number          // required
  variety: Variety          // strict literal union, see §4
  process: ProcessType      // "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC"
  country?: string          // optional, see §8
  marketData?: {
    cPrice?: number         // optional, see §9
    demandIndex?: number    // optional, see §10
  }
}
```

### Output type

```ts
type PricingOutput = {
  basePrice: number          // value from BASE_PRODUCER_PRICING table
  altitudeModifier: number   // value from PRODUCER_ALTITUDE_MODIFIER table
  finalPrice: number         // EUR/kg green, after all modifiers
  breakdown: PricingStep[]   // one row per modifier applied
}
```

`PricingStep`:
```ts
{ id: string; type: string; value: number; priceAfter: number }
```

`priceAfter` is the running price after each modifier, rounded with
`Number(price.toFixed(2))`. **Final price is also rounded to 2 decimals.**

### Computation order

The engine sorts the modifier list by `type` before applying. Documented order
in [engine.ts:32-53](../../src/engine/pricing/modifiers/engine.ts#L32-L53):

```
basePrice
  ↓
+ altitude (additive)
  ↓
× variety (multiplicative)
  ↓
× country (multiplicative)
  ↓
× cPrice (market)
  ↓
× demand (market)
  ↓
finalPrice
```

Same order is used by both `applyModifiers` (line 22-54) and
`applyModifiersWithBreakdown` (line 60-121). The breakdown variant is the one
called by `calculateProducerPricing`.

### Error path

`getScaRange(sca)` throws `"SCA score out of supported range"` for
`sca < 80`. Variety lookup throws `"No producer base price for variety X in
range Y"` for unsupported variety/range combinations. **Caller must catch
both.**

---

## 4. Base producer pricing table

**File:** [src/engine/pricing/producer/pricingTable.ts](../../src/engine/pricing/producer/pricingTable.ts)

`BASE_PRODUCER_PRICING` (EUR/kg green):

| Variety | 80-83 | 84-86 | 87-90 |
|---|---|---|---|
| **CASTILLO** | 3.5 | 4.5 | 6.0 |
| **CATURRA** | 3.75 | 5.0 | 6.5 |
| **COLOMBIA** | 3.5 | 4.5 | 6.0 |
| **TYPICA** | 3.75 | 5.25 | 7.25 |
| **BOURBON** | 4.0 | 5.5 | 7.5 |
| **PINK_BOURBON** | *(not in table)* | 5.75 | 7.75 |
| **GEISHA** | *(not in table)* | 6.0 | 8.0 |
| **TABI** | 3.75 | 5.25 | 7.0 |

### Unsupported combinations

- `PINK_BOURBON` and `GEISHA` at SCA 80–83 → `basePrice === undefined` →
  engine throws `"No producer base price for variety PINK_BOURBON in range 80-83"`.
- Any variety not in the eight literal-union members → engine throws.
- SCA `< 80` → engine throws via `getScaRange`.
- SCA `> 90` → maps to `"87-90"` (no upper cap on the bucket — see §5).

### What the marketplace mapper does about it

`calculateMarketplaceB2BPricing` short-circuits BEFORE the engine when
`canRunProducerEngine(input)` returns false (variety not in
`PRODUCER_VARIETY_SET`, SCA `< 80`, missing altitude). See [calculateMarketplaceB2BPricing.ts:148-165](../../src/engine/pricing/client/calculateMarketplaceB2BPricing.ts).

When the engine still throws (e.g. malformed input that passed precondition),
it's caught and the result falls through to `B2B_REFERENCE_FALLBACK` or
`ORIGIN_EQUIVALENT_FALLBACK`. See [calculateMarketplaceB2BPricing.ts:236-251](../../src/engine/pricing/client/calculateMarketplaceB2BPricing.ts).

---

## 5. SCA bucket logic

Two **different** bucketers exist and they disagree on non-integer SCA scores
and at the 86-87 boundary — this is a real source of subtle bugs.

### Producer engine bucket — [calculatePricing.ts:53-59](../../src/engine/pricing/producer/calculatePricing.ts#L53-L59)

```ts
function getScaRange(sca: number): "80-83" | "84-86" | "87-90" {
  if (sca >= 80 && sca <= 83) return "80-83"
  if (sca >= 84 && sca <= 86) return "84-86"
  if (sca >= 87) return "87-90"
  throw new Error("SCA score out of supported range")
}
```

| SCA | Producer bucket | Behaviour |
|---|---|---|
| 79.9 | — | **throws** |
| 80 | 80-83 | OK |
| 83 | 80-83 | OK |
| **83.5** | — | **throws** (between 83 and 84, no `<= 84` branch) |
| 84 | 84-86 | OK |
| 86 | 84-86 | OK |
| **86.5** | — | **throws** (between 86 and 87) |
| 87 | 87-90 | OK |
| 90 | 87-90 | OK |
| 91 | 87-90 | OK (no upper cap) |
| 100 | 87-90 | OK (still 87-90, no overflow check) |

**Real coffee SCA scores commonly carry decimals (e.g. 87.25).** The producer
engine throws on those — caught above the engine call sites by the cast-to-any
pattern, but emerges as runtime errors when uncaught.

### Founder reference table bucket — [b2bRoastedPricing.ts:235-242](../../src/engine/pricing/client/b2bRoastedPricing.ts#L235-L242)

```ts
function getB2BScaBucket(sca: number | null): "80_83" | "84_86" | "86_90_PLUS" | null {
  if (sca <= 83) return "80_83"
  if (sca <= 86) return "84_86"
  return "86_90_PLUS"
}
```

| SCA | Reference bucket | Notes |
|---|---|---|
| null/NaN/Infinity | `null` | yields `MISSING_SCA` |
| 50 | 80_83 | accepts any number ≤ 83 — **no minimum check** |
| 83 | 80_83 | OK |
| **83.5** | 84_86 | (engine would throw) |
| 86 | 84_86 | OK |
| **86.5** | 86_90_PLUS | (engine would throw) |
| 87 | 86_90_PLUS | OK |

**The bucket name `"86_90_PLUS"` includes 86 in the label but SCA 86 actually
belongs to `"84_86"`** — the boundary check uses `<= 86` for the middle
bucket. This is a naming-vs-logic mismatch worth flagging in any future
calibration.

---

## 6. Altitude modifier

**File:** [src/engine/pricing/modifiers/producer/altitudeModifier.ts](../../src/engine/pricing/modifiers/producer/altitudeModifier.ts)

**Type:** `additive` (added to `basePrice` before any multiplier).

Table from [pricingTable.ts:34-42](../../src/engine/pricing/producer/pricingTable.ts#L34-L42):

| Range (m) | Additive (EUR/kg green) |
|---|---|
| `[0, 1400)` | **−1.0** |
| `[1400, 1500)` | 0.0 |
| `[1500, 1600)` | +0.5 |
| `[1600, 1700)` | +1.0 |
| `[1700, 1800)` | +1.5 |
| `[1800, 1900)` | +2.0 |
| `[1900, 2000)` | +2.5 |
| `[2000, ∞)` | +3.0 |

### Boundary behaviour

- `1400` exactly → `[1400, 1500)` → **0** (the bucket is half-open, including the lower bound).
- `2000` exactly → `[2000, ∞)` → **+3**.
- `0` → `[0, 1400)` → **−1**.
- Negative altitude → no match (no `min < 0` row) → modifier returns **0** (defensive zero, [altitudeModifier.ts:13-19](../../src/engine/pricing/modifiers/producer/altitudeModifier.ts#L13-L19)).

### Null altitude

The `PricingInput.altitude` type is `number` (not optional). A null altitude
would fail TypeScript at compile time. At runtime, `lotVerification.service.ts`
throws `"Farm altitude missing"` before the engine sees a missing value (line
74). The dev factory's `seedSingleLot` throws similarly (line 199-203 in
devLotScenario.service.ts).

The marketplace adaptive engine's `canRunProducerEngine` (line 158-161)
returns `false` when altitude is null/non-finite, so the engine isn't called
and the fallback path triggers.

### Examples (without other modifiers)

| Altitude | Castillo SCA 83 final (no other mods) |
|---|---|
| 1300 | 3.5 + (−1) = **2.5** |
| 1450 | 3.5 + 0 = 3.5 |
| 1850 | 3.5 + 2 = **5.5** |
| 2050 | 3.5 + 3 = **6.5** |

---

## 7. Variety modifier

**File:** [src/engine/pricing/modifiers/producer/varietyModifier.ts](../../src/engine/pricing/modifiers/producer/varietyModifier.ts)

**Type:** `multiplicative` (applied AFTER altitude additive).

```ts
const premiums: Record<string, number> = {
  GEISHA: 1.70,
  PINK_BOURBON: 1.35,
}
let factor = premiums[ctx.variety] || 1

if (ctx.variety === "GEISHA") {
  if (ctx.scaScore >= 90) factor += 0.5
  else if (ctx.scaScore >= 89) factor += 0.25
}

if (ctx.variety === "PINK_BOURBON") {
  if (ctx.scaScore >= 90) factor += 0.3
  else if (ctx.scaScore >= 89) factor += 0.15
}
```

### Variety × SCA matrix (final factor)

| Variety | SCA ≤ 88 | SCA 89 | SCA ≥ 90 |
|---|---|---|---|
| `GEISHA` | **1.70** | 1.95 | **2.20** |
| `PINK_BOURBON` | **1.35** | 1.50 | **1.65** |
| `CASTILLO` / `CATURRA` / `COLOMBIA` / `TYPICA` / `BOURBON` / `TABI` | 1.0 | 1.0 | 1.0 |
| anything else | 1.0 (default branch `|| 1`) | 1.0 | 1.0 |

### Worked examples

| Lot | Stage | Calculation | Result |
|---|---|---|---|
| Castillo SCA 83, alt 1850 | base + altitude | 3.5 + 2 = 5.5 | 5.5 |
|   | × variety (1.0) | 5.5 × 1.0 | **5.5** |
| Bourbon SCA 86, alt 1850 | base + altitude | 5.5 + 2 = 7.5 | 7.5 |
|   | × variety (1.0) | 7.5 × 1.0 | **7.5** |
| Pink Bourbon SCA 87, alt 1650 | base + altitude | 7.75 + 1 = 8.75 | 8.75 |
|   | × variety (1.35, no SCA bonus, 87 < 89) | 8.75 × 1.35 | **11.81** |
| Geisha SCA 88, alt 2050 | base + altitude | 8.0 + 3 = 11.0 | 11.0 |
|   | × variety (1.70, no SCA bonus, 88 < 89) | 11.0 × 1.70 | **18.70** |
| Geisha SCA 90, alt 2050 | base + altitude | 8.0 + 3 = 11.0 | 11.0 |
|   | × variety (2.20 = 1.70 + 0.5) | 11.0 × 2.20 | **24.20** |

(All before country / cPrice / demand.)

### Unsupported variety

`premiums[ctx.variety] || 1` returns 1 for any variety not in the map. So a
variety the engine accepts but isn't `GEISHA` or `PINK_BOURBON` gets factor 1.
Note: the engine throws *before* this modifier when the variety isn't in
`BASE_PRODUCER_PRICING` (see §4) — so the multiplier is only ever called for
supported varieties.

---

## 8. Country modifier

**File:** [src/engine/pricing/modifiers/producer/countryModifier.ts](../../src/engine/pricing/modifiers/producer/countryModifier.ts)

**Type:** `multiplicative`.

```ts
if (!ctx.country) return 1

const countryFactors: Record<string, number> = {
  ETHIOPIA: 1.1,
  COLOMBIA: 1.05,
  PANAMA: 1.25,
  KENYA: 1.15,
  BRAZIL: 0.95,
}

return countryFactors[ctx.country.toUpperCase()] || 1
```

| Country | Factor |
|---|---|
| `PANAMA` | **1.25** |
| `KENYA` | 1.15 |
| `ETHIOPIA` | 1.10 |
| `COLOMBIA` | **1.05** |
| `BRAZIL` | 0.95 |
| anything else / `null` / undefined | **1.0** |

`PANAMA` IS implemented (1.25 multiplier — biggest factor in the map). Only
relevant if a future producer is in Panama.

The country string is case-normalised via `.toUpperCase()`. `"colombia"`,
`"COLOMBIA"`, `"Colombia"` all map to `1.05`.

### Production usage

- [lotVerification.service.ts:137](../../src/services/partner/lotVerification.service.ts#L137) hardcodes `country: "COLOMBIA"`.
- [devLotScenario.service.ts:225](../../src/services/dev/scenarios/devLotScenario.service.ts#L225) hardcodes `country: "COLOMBIA"`.

In practice every produced lot in current code is Colombian → factor 1.05.

---

## 9. Commodity / cPrice modifier

**File:** [src/engine/pricing/modifiers/producer/commodityModifier.ts](../../src/engine/pricing/modifiers/producer/commodityModifier.ts)

**Type:** `market` (applied after `multiplicative`).

```ts
if (!ctx.marketData?.cPrice) return 1

const baseline = 180  // cents/lb baseline

const ratio = ctx.marketData.cPrice / baseline

return Math.max(0.85, Math.min(ratio, 1.25))
```

### Behaviour

| `cPrice` (cents/lb) | Ratio | Clamped factor |
|---|---|---|
| missing / `null` / `0` | n/a | **1.0** (passthrough) |
| 100 | 0.555 | 0.85 (floor) |
| 153 | 0.85 | 0.85 |
| 180 | 1.0 | 1.0 (neutral) |
| 200 | 1.111 | 1.111 |
| 225 | 1.25 | 1.25 (ceiling) |
| 300 | 1.666 | 1.25 (ceiling) |

Maximum ±25% range from baseline.

### Where `cPrice` comes from

| Path | Reads cPrice? |
|---|---|
| `lotVerification.service.ts` (partner verifies a lot) | ✅ via `prisma.marketSignalSnapshot.findFirst({ isActive: true })` — line 96-119 |
| `marketplaceView.service.ts` (per request) | ✅ via `getLatestMarketSignalForPricing()` — line 41-44 |
| `devLotScenario.service.ts` (dev factory seed) | ❌ **No** — calls engine without `marketData` (line 220-227) |
| `contracts.service.ts` (contract creation) | ❌ does not call producer engine |

**`cPrice` is currently NOT dynamic.** No background ingestion exists. A
partner must manually POST to `/api/partner/market-signal` to update it
(see §18). External feeds / API ingestion is unimplemented.

### How much can `cPrice` move price?

A clamped factor of `0.85` to `1.25` means the producer green can move
±25 % from its deterministic baseline due to commodity. That maps to a
proportional change in the marketplace adaptive output, but the **founder
reference clamp** (§17) further bounds the marketplace-displayed price to
±30 % of the founder reference — so the *visible* shift is smaller in
practice for lots whose adaptive baseline is already at the band edge.

---

## 10. Demand index modifier

**File:** [src/engine/pricing/modifiers/producer/demandModifier.ts](../../src/engine/pricing/modifiers/producer/demandModifier.ts)

**Type:** `market` (applied after `commodityModifier`).

```ts
if (!ctx.marketData?.demandIndex) return 1
return ctx.marketData.demandIndex
```

### Behaviour

| `demandIndex` | Factor |
|---|---|
| missing / `null` / `0` | **1.0** |
| 0.8 | 0.8 |
| 1.0 | 1.0 |
| 1.2 | 1.2 |
| **anything else** | **passes through unchanged** |

**No clamp inside the modifier itself** — but `getLatestMarketSignalForPricing()`
([marketSignal.service.ts:39-46](../../src/services/pricing/marketSignal.service.ts#L39-L46))
**rejects snapshots outside [0.8, 1.2]**, returning `null` instead. The
`/api/partner/market-signal` POST route validates the same range
([market-signal/route.ts:72-82](../../app/api/partner/market-signal/route.ts#L72-L82)).
So in practice the modifier always sees a value in `[0.8, 1.2]` or 1.0.

### Where `demandIndex` comes from

Same paths and same gaps as `cPrice` (§9). Currently operator-curated only.

---

## 11. Modifier engine

**File:** [src/engine/pricing/modifiers/engine.ts](../../src/engine/pricing/modifiers/engine.ts)

### Order

Modifiers are applied **by type, not by registration order**:

1. All `additive` modifiers (in registration order). Currently: `producerAltitudeModifier`.
2. All `multiplicative`. Currently: `producerVarietyModifier`, `producerCountryModifier` (in that order — see [producer/index.ts:11-17](../../src/engine/pricing/modifiers/producer/index.ts#L11-L17)).
3. All `market`. Currently: `commodityModifier`, `demandModifier` (in that order).

Two callable variants:

- `applyModifiers(basePrice, modifiers, ctx)` — returns a single number, rounded to 2 decimals at the end.
- `applyModifiersWithBreakdown(basePrice, modifiers, ctx)` — returns `{ finalPrice, steps[] }`. **`steps` is what `calculateProducerPricing` ships in `breakdown`.**

### Rounding

- `applyModifiers`: only the final result is rounded.
- `applyModifiersWithBreakdown`: the running `price` is **not** rounded between steps; `priceAfter` in each step entry is the running `price` rounded for display. `finalPrice` is rounded at the end.
- This means `priceAfter` of step N may differ from `priceAfter` of step N−1 + the actual additive value — display-only artefact, not a logic bug.

### Errors

- The modifier engine itself never throws.
- `calculateProducerPricing` throws on invalid SCA or unsupported variety/range *before* the engine runs.

---

## 12. Roast yield conversion

**File:** [src/lib/roastYield.ts](../../src/lib/roastYield.ts)

### Defaults

```ts
const DEFAULT_YIELDS: Record<ProcessType, number> = {
  WASHED:    0.85,
  NATURAL:   0.82,
  HONEY:     0.84,
  ANAEROBIC: 0.82,
}
const MIN_YIELD = 0.50
const MAX_YIELD = 1.00
```

### Functions

| Function | Behaviour |
|---|---|
| `resolveRoastYield(lot)` | `lot.estimatedRoastYield ?? DEFAULT_YIELDS[lot.process] ?? 0.83`. Then clamps to `[0.50, 1.00]`. |
| `greenToRoasted(greenKg, yield)` | `greenKg × yield` |
| `roastedToGreen(roastedKg, yield)` | `roastedKg / max(0.50, yield)` |
| `computeRoastedPrice(greenPrice, yield)` | `greenPrice / max(0.50, yield)` |

### Floor

The MIN_YIELD floor (0.5) only matters when callers pass a yield below 0.5
*directly* — `resolveRoastYield` already clamps before returning. The floor
is a defensive guard.

### Examples

- 100 kg green, WASHED (yield 0.85) → roasted = **85 kg**
- 100 kg roasted, WASHED → green needed = 100 / 0.85 = **117.65 kg**
- €10/kg green, yield 0.85 → roasted-equivalent price = 10 / 0.85 = **€11.76/kg roasted**
- Same €10/kg green, NATURAL yield 0.82 → **€12.20/kg roasted** (natural loses more mass during roast → costs more per roasted kg)

### Mirrored math in marketplace mapper

[marketplaceLot.mapper.ts](../../src/services/allocation/marketplace/marketplaceLot.mapper.ts) ships
its own copy of `computeRoastedPriceFromGreen` and `greenKgToRoastedKg` to
avoid pulling `@prisma/client` (transitively imported by `roastYield.ts`)
into `node --test` runs. Marked `KEEP IN SYNC` — if `MIN_YIELD` changes there,
update both.

The same pattern exists in `calculateMarketplaceB2BPricing.ts:127-129`:
local `ROAST_YIELD_FLOOR = 0.5` constant for the same reason.

---

## 13. Production lot verification pricing path

**File:** [src/services/partner/lotVerification.service.ts](../../src/services/partner/lotVerification.service.ts)

When a partner verifies a lot in production:

1. **Validate inputs.** `scaScore` and `conversionRate` must be finite and `> 0`. Otherwise throws.
2. **Fetch draft + farm.** Throws if either is missing or if `farm.altitude` is null.
3. **Read active `MarketSignalSnapshot`.** If valid (cPrice ∈ [50, 600], demandIndex ∈ [0.8, 1.2], not expired), `marketData = { cPrice, demandIndex }`. Wrapped in try/catch — failure logs and proceeds without market data.
4. **Convert volume.** `greenKg = draft.parchmentKg × input.conversionRate`.
5. **Compute pricing.** `calculateProducerPricing({ scaScore, altitude: farm.altitude, variety: draft.variety as any, process: draft.process as any, country: "COLOMBIA", marketData? })`.
6. **Persist `GreenLot`.** `pricePerKg = pricing.finalPrice`.
7. **Persist `PricingSnapshot`** (created via Prisma nested create):
   - `producerPricePerKg = pricing.finalPrice`
   - `clientPricePerKg = pricing.finalPrice`  ⚠️ **same value**
   - `marginPerKg = 0`
   - `pricingVersion = "v1"`
   - `breakdown = pricing.breakdown` (array of modifier steps)
   - `context = { scaScore, altitude, variety, process, marketContext? }`
8. **Update `ProducerLotDraft`.** `status = VERIFIED`, `greenLotId = greenLot.id`, `conversionRate = input.conversionRate`.
9. **Emit event.** `eventBus.emit(EVENTS.LOT_VERIFIED, { greenLotId, lotId })`.

### Critical fact: `clientPricePerKg === producerPricePerKg`

Lot verification stores the same number twice. Both fields reflect the
**green** price. There is no separate roasted / B2B / margined value persisted.
This means downstream consumers reading `clientPricePerKg` get green, despite
the field name suggesting it's a client-facing roasted price.

This is the structural ambiguity the marketplace adaptive engine
(PRICING-B2B-2) and contract creation (§19) both navigate around in different
ways — the marketplace recomputes a B2B price at read time without persisting
it; the contract treats it as green and converts via roastYield.

---

## 14. Dev scenario pricing path

**File:** [src/services/dev/scenarios/devLotScenario.service.ts](../../src/services/dev/scenarios/devLotScenario.service.ts) (`seedSingleLot`)

The dev factory mirrors `lotVerification.service` exactly with two
differences:

1. **No `MarketSignalSnapshot` read.** The engine is called without
   `marketData`. cPrice and demand modifiers return 1 (neutral).
2. **`pricingVersion = "dev-scenario-v1"`** (not `"v1"`).

Per-lot flow:

1. `toPricingEngineVariety(recipe.variety)` validates the variety against the
   8 supported values, throws otherwise.
2. Throws if `farm.altitude == null`.
3. `calculateProducerPricing({ scaScore, altitude, variety, process, country: "COLOMBIA" })` (no `marketData`).
4. Persists exactly the same shape as production:
   - `GreenLot.pricePerKg = pricing.finalPrice`
   - `PricingSnapshot.producerPricePerKg = clientPricePerKg = pricing.finalPrice`
   - `marginPerKg = 0`
   - `pricingVersion = "dev-scenario-v1"`
   - `breakdown = pricing.breakdown`
   - `context = { source: "DEV_SCENARIO_FACTORY", scenario, pricingEngine: "calculateProducerPricing", farmKey, scaScore, altitude, variety, process, country: "COLOMBIA", estimatedRoastYield, harvestYear }`

**No fake pricing path remains** — PRICING-WIRE-1 removed it entirely. Test
[devLotScenario.test.ts:159-171](../../src/services/dev/scenarios/__tests__/devLotScenario.test.ts) enforces this:

```
✔ recipes do NOT carry an invented pricePerKg field
```

### Unsupported varieties

`toPricingEngineVariety` throws for anything outside the 8 producer-engine
varieties. PRICING-WIRE-1 swapped `Wush Wush` and `Sudan Rume` (both
unsupported by the engine) for `Typica` and `Bourbon` in the recipe presets.
The test
[devLotScenario.test.ts:225-244](../../src/services/dev/scenarios/__tests__/devLotScenario.test.ts)
enforces that every recipe's `(variety, scaBucket)` pair has a base price.

---

## 15. Marketplace allocation pricing path

### Routes

- HTTP: [app/api/marketplace/lots/route.ts](../../app/api/marketplace/lots/route.ts) → `getMarketplaceLotsView()`.
- Server page: [app/platform/marketplace/page.tsx](../../app/platform/marketplace/page.tsx) → calls the same helper directly (no HTTP roundtrip).

### Pipeline

`marketplaceView.service.getMarketplaceLotsView()` (read-only):

1. `Promise.all([buildAllocationSnapshots(), getLatestMarketSignalForPricing()])`.
2. Build a `pricingContext` with:
   - `marketData` from the snapshot (or `null` if none).
   - `producerPricingFn` adapter that boundary-casts the literal-union types
     of `calculateProducerPricing`.
3. For each snapshot:
   - `decision = decideLotAllocation(snapshot)` (allocation engine — no pricing involvement).
   - `dto = mapDecisionToMarketplaceLot(snapshot, decision, pricingContext)`.
   - Skip when `dto === null` (HOLD lots, contract-only lots, etc.).
4. `sortMarketplaceLots(lots)`, `computeMarketplaceMetrics`, `computeMarketplaceInsights`.
5. Return `{ lots, metrics, insights, generatedAt, policyVersion }`.

### Mapper output (DTO fields, pricing-related)

| Field | Source / formula |
|---|---|
| `greenPricePerKg` | Persisted `PricingSnapshot.clientPricePerKg` (or `GreenLot.pricePerKg` fallback). NOT recomputed. |
| `producerGreenPricePerKg` | **Re-computed** at request time via `calculateProducerPricing(... + marketData)`. |
| `originEquivalentRoastedPricePerKg` | `producerGreenPricePerKg / max(0.5, roastYield)`. |
| `b2bReferencePricePerKg` | Founder-reference table lookup by `(altitudeBucket, variety, scaBucket)`. |
| `adaptiveB2BPricePerKg` | Commercial layer × quality multiplier — see §16. |
| `roastedPricePerKg` | The displayed price: `pricingMode = ADAPTIVE_B2B_ENGINE` → adaptive (clamped). `B2B_REFERENCE_FALLBACK` → reference. `ORIGIN_EQUIVALENT_FALLBACK` → origin-equivalent. |
| `pricingMode` | One of three enum values, see §16. |
| `pricingBreakdown` | Audit array — every modifier step + commercial-layer constants + clamp band. |
| `pricingReference` | Summary `{ altitudeBucket, scaBucket, pricingVersion, source, fallbackReason? }`. |
| `currency` | `"EUR"` on adaptive + reference paths (commercial layer is EUR). Snapshot currency on origin-equivalent fallback. |

### What the card shows

Cards display `roastedPricePerKg` with a currency-aware glyph (€ default).
Sub-label: `/kg roasted`. When `pricingMode !== "ADAPTIVE_B2B_ENGINE"`,
shows muted "Fallback price" line (added in PRICING-B2B-2).

The persisted `greenPricePerKg` is NOT used by the card directly when the
adaptive engine succeeds — `producerGreenPricePerKg` (recomputed) drives the
adaptive layer instead. Both fields exist on the DTO for audit.

---

## 16. Marketplace B2B adaptive pricing — dual-model architecture (PRICING-ARCH-1)

**File:** [src/engine/pricing/client/calculateMarketplaceB2BPricing.ts](../../src/engine/pricing/client/calculateMarketplaceB2BPricing.ts) (`pricingVersion: "marketplace-b2b-adaptive-v1"`)

The engine now picks one of two commercial models per lot. The previous
universal `[reference × 0.7, reference × 1.3]` clamp was replaced because it
forced premium coffees (Geisha, Pink Bourbon, high-SCA microlots) to clamp at
the floor — Geisha 88 @ 2050 was rendered at €140 even though the founder
reference is €200.

### Input

```ts
type MarketplaceB2BPricingInput = {
  scaScore: number | null
  altitude: number | null
  variety: string
  process: string
  country: string | null
  roastYield: number
  marketplaceGreenKg?: number | null   // PRICING-ARCH-1: residual / exclusive pool kg
  currency?: string | null
  marketData?: {
    cPrice?: number | null
    demandIndex?: number | null
  } | null
}
```

### Output (new fields highlighted)

```ts
type MarketplaceB2BPricingResult = {
  pricePerKgRoasted: number | null
  currency: string
  pricingMode: MarketplacePricingMode
  commercialModel: "COST_PLUS_MODEL" | "MARKET_ANCHORED_MODEL"   // ← NEW
  // ...producerGreenPricePerKg, originEquivalentRoastedPricePerKg,
  //    b2bReferencePricePerKg, adaptiveB2BPricePerKg, breakdown,
  //    fallbackReason?, pricingVersion
}
```

### Producer engine dependency

Injected via `deps: { producerPricingFn: ProducerPricingFn }`. Same DI pattern
as v0 — keeps the module node `--test` friendly.

### Model selection — `selectCommercialPricingModel`

```
MARKET_ANCHORED_MODEL  iff  any of:
  - variety === GEISHA
  - variety === PINK_BOURBON
  - scaScore >= 88
  - marketplaceGreenKg ≤ 500
  - b2bReferencePricePerKg ≥ 50

else  COST_PLUS_MODEL
```

Rationale: premium coffees are priced by market willingness + scarcity, NOT
by cost-plus economics. Volume coffees are priced by cost-plus.

### Commercial layer constants

```ts
const ROASTING_COST_PER_KG          = 5.5     // EUR/kg roasted
const PACKAGING_COST_PER_KG         = 1.0     // EUR/kg roasted
const LOGISTICS_COST_PER_KG         = 1.5     // EUR/kg roasted (placeholder)
const COMMERCIAL_MARGIN_RATE        = 0.35

// COST_PLUS clamp band (unchanged from v0).
const COST_PLUS_CLAMP_FLOOR         = 0.7
const COST_PLUS_CLAMP_CEILING       = 1.3
const NORMAL_QUALITY_MULTIPLIER_CAP = 1.6     // ← was 3.0 in v0

// MARKET_ANCHORED variety-specific bands (NEW).
const GEISHA_PREMIUM_FLOOR          = 0.80
const GEISHA_PREMIUM_CEILING        = 1.80
const PINK_BOURBON_PREMIUM_FLOOR    = 0.80
const PINK_BOURBON_PREMIUM_CEILING  = 1.55
const OTHER_PREMIUM_FLOOR           = 0.75
const OTHER_PREMIUM_CEILING         = 1.45
```

All `TODO: founder calibration`.

### COST_PLUS_MODEL formula

```
producerGreen          = producerPricingFn(...).finalPrice
originEquivKg          = producerGreen / max(0.5, roastYield)
costPlusBaseCost       = originEquivKg + 5.5 + 1.0 + 1.5
margined               = costPlusBaseCost × 1.35

normalQualityMultiplier:
  start 1.0
  + 0.10 if sca ≥ 87
  + 0.20 if sca ≥ 89                          (additional, on top of 87+)
  + 0.10 if variety ∈ {BOURBON, TYPICA, TABI}
  capped at 1.6                              ← was 3.0 in v0

costPlusFinal          = margined × normalQualityMultiplier
final                  = clamp(costPlusFinal, ref × 0.7, ref × 1.3)
                                                          [if reference exists]
```

For Castillo / Caturra / Bourbon / Tabi at typical SCA & volume, this matches
v0 behaviour within rounding (the v0 quality bumps for these varieties were
also +0.10).

### MARKET_ANCHORED_MODEL formula (PRICING-ARCH-2B — target-anchored)

The price is now anchored on the **research target's expected value**, not on
the founder reference table. Three SOFT residual modifiers shape the price
around it; the cost-plus value is the floor; `target.band.low / .high` is the
clamp.

```
target              = getMarketTargetPricing({ variety, country, altitude,
                                              scaScore, producerPrestigeTier })
                                                          // returns ok:true|false

// MARKET_ANCHORED branch when target.ok:
anchor              = target.band.expected                // research expected
softScarcity        = getSoftScarcityModifier(marketplaceGreenKg)
softMarketSignal    = getSoftMarketSignalModifier({ cPrice, demandIndex,
                                                  pricingClass: target.pricingClass })
softPrestige        = getSoftPrestigeModifier({ producerPrestigeTier,
                                              pricingClass, targetAltitudeBucket })

marketAnchored      = anchor × softScarcity × softMarketSignal × softPrestige

// COST FLOOR — never below cost of producing + selling.
finalBeforeClamp    = max(marketAnchored, costPlusFinal ?? 0)

// TARGET BAND CLAMP — research band, not founder reference.
final               = clamp(finalBeforeClamp, target.band.low, target.band.high)
```

If `target.ok` is false (e.g. unsupported variety), the engine falls through
to `B2B_REFERENCE_FALLBACK` if the founder reference is non-null, or
`ORIGIN_EQUIVALENT_FALLBACK` if origin-equivalent is computable.

### What changed from PRICING-ARCH-1 (v1) → PRICING-ARCH-2B (v2)

| Layer | v1 (PRICING-ARCH-1) | v2 (PRICING-ARCH-2B) |
|---|---|---|
| Anchor | `b2bReferencePricePerKg` (founder table) | `target.band.expected` (research target) |
| SCA modifier | `getExactScaMarketModifier` (5-tier × variety) | encoded in target row |
| Altitude modifier | `getPremiumAltitudeMarketModifier` (6-tier × variety) | encoded in target row |
| Country modifier | `getCountryPrestigeMarketModifier` (5 origins × variety) | encoded in target row |
| Scarcity | `getScarcityMarketModifier` (1.00 → 1.35) | `getSoftScarcityModifier` (1.00 → 1.18) — softer |
| Market signal | `sqrt(cPrice / 180)` × demand, clamped [0.92, 1.18] / [0.90, 1.15] | `getSoftMarketSignalModifier` — class-elastic, baseline 290 |
| Prestige | only via Panama row selection in target | `getSoftPrestigeModifier` (NAMED / FAMOUS_ESTATE) — collapses to 1.00 when target row already encodes the premium |
| Clamp | reference × variety-specific band [0.75, 1.80] | `target.band.low / .high` — research band |

### SOFT MODIFIERS (MARKET_ANCHORED only)

#### `getSoftScarcityModifier(marketplaceGreenKg)` — softer than v1

| `marketplaceGreenKg` | Modifier |
|---|---|
| `null` / non-finite | 1.00 |
| ≤ 50 | 1.18 |
| ≤ 100 | 1.12 |
| ≤ 250 | 1.08 |
| ≤ 500 | 1.05 |
| ≤ 1000 | 1.02 |
| > 1000 | 1.00 |

The research target already includes a microlot premium for low-volume
origins, so this layer is intentionally tighter than v1.

#### `getSoftMarketSignalModifier({ cPrice, demandIndex, pricingClass })`

Class-sensitive — premium classes are less elastic so commodity noise can't
drag a Geisha out of its target band.

```
SOFT_COMMODITY_BASELINE   = 290 c/lb              ← target-layer "elevated normal"
commodityRatio            = cPrice / 290
commodityRaw              = clamp(0.85, 1.30, commodityRatio)
elasticity by class:
  NORMAL_SPECIALTY  : 1.00
  PREMIUM_SPECIALTY : 0.45
  RARE_PINK_BOURBON : 0.25
  ULTRA_RARE_GEISHA : 0.12
commoditySoft             = 1 + (commodityRaw - 1) × elasticity

demand bands by class:
  NORMAL_SPECIALTY  : [0.85, 1.15], elasticity 1.00
  PREMIUM_SPECIALTY : [0.82, 1.20], elasticity 0.60
  RARE_PINK_BOURBON : [0.78, 1.25], elasticity 0.40
  ULTRA_RARE_GEISHA : [0.75, 1.35], elasticity 0.25
demandSoft                = 1 + (clampedDemand - 1) × elasticity

softMarketSignalModifier  = commoditySoft × demandSoft
```

Producer engine still applies its hard `cPrice / 180` and `demandIndex`
modifiers to `producerGreen` (which raises `costPlusFinal`, the cost floor).
This soft layer is a separate, smaller nudge on the market-anchored price —
two channels, two baselines, no double-count.

#### `getSoftPrestigeModifier({ producerPrestigeTier, pricingClass, targetAltitudeBucket })`

| Tier | Geisha | Pink Bourbon | Other premium |
|---|---|---|---|
| `UNKNOWN` / `STANDARD` | 1.00 | 1.00 | 1.00 |
| `NAMED` | 1.08 | 1.05 | 1.02 |
| `FAMOUS_ESTATE` | 1.25 | 1.12 | 1.05 |

**Double-count guard:** if the target row is already `PANAMA_FAMOUS` (which
the target selector picks when `producerPrestigeTier === "FAMOUS_ESTATE"` and
country = Panama), this modifier collapses to **1.00** — the famous-estate
premium is already encoded in the target row's `expected` value.

### Worked examples (PRICING-ARCH-2B, no `MarketSignalSnapshot`, scarcity > 1000kg, prestige UNKNOWN)

| Lot | target.expected | Final price | Note |
|---|---|---|---|
| Castillo SCA 83 @ 1850 (large lot) | n/a (COST_PLUS) | **€19.98** | unchanged from v1 |
| Bourbon SCA 86 @ 1850 NATURAL (large) | n/a (COST_PLUS) | **€26.60** | unchanged (clamp floor) |
| Pink Bourbon SCA 87 @ 1650 | 70 (target row COLOMBIA_1700) | **€70.00** | was €49.68 in v1 |
| Pink Bourbon SCA 90 @ 2000 | 165 | **€165.00** | new behaviour |
| Pink Bourbon SCA 91 @ 2000 | 200 | **€200.00** | new behaviour |
| Geisha SCA 88 @ 2050 Colombia | 200 | **€200.00** | was €298.08 in v1 (double-count fixed) |
| Geisha SCA 90 @ 2050 Colombia | 325 | **€325.00** | was €360 (clamp ceiling) in v1 |
| Geisha SCA 91 @ 2050 Colombia | 400 | **€400.00** | new behaviour |
| Geisha SCA 88 @ 2050 Panama (FAMOUS_ESTATE) | 580 (target row PANAMA_FAMOUS) | **€580.00** | row encodes prestige |
| Geisha SCA 90 @ Panama FAMOUS_ESTATE | 1250 (PANAMA_FAMOUS) | **€1250.00** | was clamped at €360 in v1 |
| Castillo SCA 84, 300 kg pool | 40 (NORMAL_SPECIALTY 84_86) | ~**€42.00** | low volume flips to MARKET_ANCHORED + scarcity 1.05 |

### `pricingMode` values

| Value | When |
|---|---|
| `ADAPTIVE_B2B_ENGINE` | Either model produced a price (clamped or not). |
| `B2B_REFERENCE_FALLBACK` | Producer engine failed AND founder reference is non-null. |
| `ORIGIN_EQUIVALENT_FALLBACK` | All other failure cases. |

### Currency

Always `"EUR"` on adaptive + reference paths; falls back to lot's currency on
origin-equivalent fallback.

### Worked examples (no `MarketSignalSnapshot`, all Colombia, scarcity > 1000kg)

| Lot | Model | Reference | marketAnchored / costPlusFinal | Final price |
|---|---|---|---|---|
| Castillo SCA 83 @ 1850 | COST_PLUS | 28 | costPlusFinal 19.98 | **€19.98** (in band) |
| Bourbon SCA 86 @ 1850 NATURAL | COST_PLUS | 38 | costPlusFinal 26.15 | **€26.60** (clamp floor) |
| Pink Bourbon SCA 87 @ 1650 | MARKET_ANCHORED | 50 | marketAnchored 50 × 1.00 × 0.92 × 1.08 × 1.00 × 1.00 = 49.68 | **€49.68** |
| Geisha SCA 88 @ 2050 | MARKET_ANCHORED | 200 | 200 × 1.00 × 1.38 × 1.08 × 1.00 × 1.00 = 298.08 | **€298.08** (in band) |
| Geisha SCA 90 @ 2050 | MARKET_ANCHORED | 200 | 200 × 1.40 × 1.38 × 1.08 × 1.00 × 1.00 = 417.31 | **€360.00** (Geisha ceiling 1.80 × 200) |
| Geisha SCA 88 @ 2050 Panama | MARKET_ANCHORED | 200 | 200 × 1.00 × 1.38 × 3.50 × 1.00 × 1.00 = 966.00 | **€360.00** (ceiling) |
| Geisha SCA 86 @ 1600 (low producer mock) | MARKET_ANCHORED | 55 | 55 × 0.80 × 0.80 × 1.08 × 1.00 × 1.00 = 38.02 | **€44.00** (Geisha floor 0.80 × 55) |

The same Geisha 88 @ 2050 with `cPrice = 240, demandIndex = 1.15` clamps to
the **€360 ceiling** because the soft market signal lifts adaptive past the
1.80 × reference cap — which is the intended behaviour: market signals can
move premium prices, but variety-specific premium clamps still dominate.

### Tests

[calculateMarketplaceB2BPricing.test.ts](../../src/engine/pricing/client/__tests__/calculateMarketplaceB2BPricing.test.ts) — 33 tests including:
- COST_PLUS stays within ±30 % for Castillo / Bourbon / Caturra,
- Geisha 88 @ 2050 no longer floor-clamped at 140,
- Geisha 90 > Geisha 88 (SCA sensitivity),
- Panama Geisha > Colombian Geisha (country prestige),
- Geisha @ 2050 > Geisha @ 1800 (altitude),
- Pink Bourbon SCA + altitude sensitivity,
- scarcity bumps low-volume marketplace pools,
- low-volume Castillo (≤500 kg) flips to MARKET_ANCHORED,
- breakdown contains commercialModel + every documented audit step,
- `selectCommercialPricingModel` rules covered exhaustively.

---

## 17. Founder reference B2B table

**File:** [src/engine/pricing/client/b2bRoastedPricing.ts](../../src/engine/pricing/client/b2bRoastedPricing.ts)

### Role evolution

- **PRICING-B2B-1 (previous sprint):** This table WAS the displayed
  marketplace price.
- **PRICING-B2B-2 (current state):** This table is now a **commercial sanity
  band** only. Adaptive engine output is clamped to `[reference × 0.7,
  reference × 1.3]`.

When the table cell is `null` (Geisha / Pink Bourbon at SCA 80–83), no clamp
applies — adaptive output is used as-is.

### Altitude bucket

```ts
function getB2BAltitudeBucket(altitude: number | null): number | null {
  if (altitude == null || !Number.isFinite(altitude)) return null
  if (altitude < 1300) return 1300        // floor
  if (altitude >= 2000) return 2000       // cap
  return Math.floor(altitude / 100) * 100 // 100m buckets
}
```

| Altitude | Bucket |
|---|---|
| 0–1299 | 1300 |
| 1450 | 1400 |
| 1850 | 1800 |
| 2050 | 2000 |
| ≥2000 | 2000 |
| `null` / NaN / Infinity | `null` |

### SCA bucket — see §5

### Variety normalisation

`normalizeB2BVariety("Pink Bourbon")` → `"PINK_BOURBON"`. Returns `null` for
anything outside the 8 supported strings.

### Founder reference values (EUR/kg roasted)

[b2bRoastedPricing.ts:103-184](../../src/engine/pricing/client/b2bRoastedPricing.ts#L103-L184). Sample at altitude 1800:

| Variety | 80_83 | 84_86 | 86_90_PLUS |
|---|---|---|---|
| CASTILLO | 28 | 34 | 45 |
| CATURRA | 30 | 36 | 48 |
| COLOMBIA | 28 | 34 | 44 |
| TYPICA | 32 | 38 | 52 |
| BOURBON | 32 | 38 | 55 |
| PINK_BOURBON | (null) | 48 | 63 |
| GEISHA | (null) | 70 | 140 |
| TABI | 32 | 38 | 52 |

Full table lives in the source file.

### Fallback reasons

`MISSING_ALTITUDE` → `MISSING_SCA` → `UNSUPPORTED_VARIETY` →
`UNAVAILABLE_FOR_SCA_BUCKET` (priority order checked top-down).

### Tests

[b2bRoastedPricing.test.ts](../../src/engine/pricing/client/__tests__/b2bRoastedPricing.test.ts) — 25 tests including exact values for
`Geisha 88 @ 2050 → 200`, `Castillo 83 @ 1850 → 28`, etc.

---

## 18. MarketSignalSnapshot integration

### Schema — [prisma/schema.prisma:712-741](../../prisma/schema.prisma#L712-L741)

```prisma
model MarketSignalSnapshot {
  id          String              @id @default(uuid())
  cPrice      Float                       // ICE arabica, cents/lb
  demandIndex Float                       // normalized 0.8–1.2
  source      MarketSignalSource          // MANUAL | API_FEED | INTERNAL_COMPUTE | AI_SYSTEM
  isActive    Boolean             @default(true)
  note        String?
  validFrom   DateTime            @default(now())
  expiresAt   DateTime?
  createdAt   DateTime            @default(now())
}
```

### Active-snapshot selection

`prisma.marketSignalSnapshot.findFirst({ where: { isActive: true }, orderBy: { createdAt: "desc" } })`

**There is no DB constraint on uniqueness of `isActive: true`.** The
`/api/partner/market-signal` POST route enforces it at the application layer
by deactivating previous active rows in a single transaction
([market-signal/route.ts:123-139](../../app/api/partner/market-signal/route.ts#L123-L139)).
A DB script that bypasses the route could leave multiple rows active;
`findFirst` would still return the most recent one but the others persist.

### Validation

| Where | cPrice range | demandIndex range | Expiry check |
|---|---|---|---|
| `/api/partner/market-signal` POST | `[50, 600]` | `[0.8, 1.2]` | `expiresAt > now()` (if provided, must be future) |
| `lotVerification.service.ts:102-119` | `[50, 600]` | `[0.8, 1.2]` | `!expiresAt \|\| expiresAt > now()` |
| `marketSignal.service.ts:30-46` (used by marketplace) | `[50, 600]` | `[0.8, 1.2]` | `!expiresAt \|\| expiresAt > now()` |

All three paths use the same range. ✅ Consistent.

### Read sites

| Caller | Frequency | Reads `cPrice`? | Reads `demandIndex`? | Effect |
|---|---|---|---|---|
| Lot verification (production) | per-verification | ✅ | ✅ | Modifies `pricing.finalPrice` written to DB |
| Marketplace request | once per request, shared by all lots in that render | ✅ | ✅ | Modifies adaptive marketplace price (transient — no persistence) |
| Dev scenario factory seed | — | ❌ | ❌ | Lots seeded by the dev factory ignore market data at seed time |
| Contracts | — | ❌ | ❌ | Reads only the persisted `pricingSnapshot.clientPricePerKg` (which was set at lot verification, possibly with marketData baked in) |

### Posting a snapshot

Only `PARTNER` role can POST. The partner UI for this is not documented here;
the route accepts:

```jsonc
{
  "cPrice": 240,                   // 50–600
  "demandIndex": 1.15,             // 0.8–1.2
  "source": "MANUAL",              // or API_FEED / INTERNAL_COMPUTE / AI_SYSTEM
  "note": "ICE July settlement",
  "expiresAt": "2026-06-01T00:00:00Z"   // optional, must be future
}
```

### Read-but-not-written consumers

The marketplace and the production lot-verification pricing both consume the
same active snapshot at different lifecycle moments:

- **Lot verification** bakes the snapshot into the persisted producer green
  price. A lot verified under cPrice=240 carries that uplift forever in
  `GreenLot.pricePerKg`.
- **Marketplace** re-reads the snapshot at request time and applies it on top
  of the **lot's actual snapshot at verification**. The persisted green is
  ignored — the producer engine is re-run from `(sca, altitude, variety,
  process, country, marketData)`. So the marketplace card responds to live
  market changes regardless of when the lot was verified.

This means a developer who:
1. Seeds a lot at cPrice=180 (deterministic).
2. Inserts a `MarketSignalSnapshot` cPrice=240.
3. Refreshes marketplace.

sees the marketplace card change. But a contract created against that lot
(post step 3) still uses the lot's verification-time green price — which was
180. The contract is decoupled from current market conditions.

---

## 19. Contracts pricing path

**File:** [src/services/clients/contracts.service.ts](../../src/services/clients/contracts.service.ts)

The critical block, from
[contracts.service.ts:91-104](../../src/services/clients/contracts.service.ts#L91-L104):

```ts
const lot = await fetchGreenLotWithPricing(greenLotId, tx)
const roastYield = resolveRoastYield(lot)
const greenPricePerKg = lot.pricingSnapshot!.clientPricePerKg     // ← treated as GREEN
const lockedPricePerKg = computeRoastedPrice(greenPricePerKg, roastYield)

// CONVERT ROASTED → GREEN FOR VALIDATION
const monthlyGreenKg = roastedToGreen(monthlyVolumeKg, roastYield)
```

| Question | Answer |
|---|---|
| Does contract path use `PricingSnapshot.clientPricePerKg`? | ✅ Yes |
| Does it treat it as green or roasted? | **Green** (consistent with what lot verification persists). |
| Does it call `computeRoastedPrice`? | ✅ Yes — `lockedPricePerKg = green / max(0.5, yield)` |
| Does it use marketplace B2B / adaptive pricing? | ❌ **No.** |
| Does it use `MarketSignalSnapshot`? | ❌ **No** at contract time. The snapshot is already baked into `clientPricePerKg` at lot verification. |
| Is the contract's `lockedPricePerKg` the same as the marketplace card's `roastedPricePerKg`? | ❌ **No** — different commercial layers. |

### Numerical example — Geisha SCA 88 @ 2050, no MarketSignalSnapshot

| Quantity | Where computed | Value (EUR/kg roasted) |
|---|---|---|
| Marketplace card price (adaptive, clamped at floor) | `calculateMarketplaceB2BPricing` | **140.00** |
| Marketplace `b2bReferencePricePerKg` (founder table) | `calculateB2BRoastedPricing` | 200.00 |
| Marketplace `originEquivalentRoastedPricePerKg` | `producerGreen / yield` | 23.11 |
| **Contract `lockedPricePerKg`** | `computeRoastedPrice(persistedGreen, yield)` = 19.64 / 0.85 | **23.11** |

A buyer signing a contract on the same lot pays €23.11/kg roasted while
seeing €140.00/kg roasted on the marketplace card. **Roughly 6× divergence.**
This is the central gap PRICING-B2B-3 is meant to close.

### Amend path

Same green-equivalent semantics in
[contracts.service.ts:212-355](../../src/services/clients/contracts.service.ts#L212-L355).
- **CASE C (switch coffee)**: re-fetches new lot's `pricingSnapshot.clientPricePerKg`, re-runs `computeRoastedPrice`. Same gap.
- **CASE A/B (same coffee)**: keeps `lockedPricePerKg` from the original sign — no recomputation.

---

## 20. Demand intent / semaphore / supply interaction

### Demand intents

[demandIntent.service.ts:57-156](../../src/services/clients/demandIntent.service.ts#L57-L156). Intents reserve **green kg** via `deltaKg`. The pricing fields they
record:

- `previewPricePerKg` = `computeRoastedPrice(clientPricePerKg, roastYield)` — same green-equivalent path as contracts.
- `priceLocked` = `true` only when the semaphore returned green light.

Intent does NOT consult marketplace adaptive pricing or
MarketSignalSnapshot — same gap as contracts.

### Semaphore

[src/decision/semaphoreEvaluator.ts](../../src/decision/semaphoreEvaluator.ts).
Semaphore inputs are volumes and risk scores only — **no pricing fields**.
The semaphore decision (green/yellow/red) is purely a supply gate, not a price
gate.

### supply.service

[src/services/system/supply.service.ts](../../src/services/system/supply.service.ts).
`getContractableSupply` aggregates green kg available, deducts committed +
reserved + safety buffer. **Reads no price fields.**
`getDisplayableSupply` adds a deterministic adjustment factor — also
price-agnostic.

### Allocation engine

[src/services/allocation/engine/lotAllocationEngine.ts](../../src/services/allocation/engine/lotAllocationEngine.ts).
Decides surface (CONTRACT_CATALOG / OPEN_MARKETPLACE / SPLIT / EXCLUSIVE_MICROLOT
/ HOLD) using volumes, SCA, variety, status. **Does not read or emit
pricing.** The mapper layer ([marketplaceLot.mapper.ts](../../src/services/allocation/marketplace/marketplaceLot.mapper.ts))
runs pricing AFTER the decision.

Only existence of pricing matters: the engine emits `MISSING_PRICING` HOLD
when `snapshot.greenPricePerKg == null`
([lotAllocationEngine.ts:131-133](../../src/services/allocation/engine/lotAllocationEngine.ts#L131-L133)).

---

## 21. Persisted vs computed pricing matrix

| Field / Value | Persisted? | Computed live? | Green or roasted | Source | Used by |
|---|---|---|---|---|---|
| `GreenLot.pricePerKg` | ✅ | n/a | green | `pricing.finalPrice` at verification / dev seed | Snapshot builder, dev list, marketplace fallback |
| `PricingSnapshot.producerPricePerKg` | ✅ | n/a | green | `pricing.finalPrice` | Audit only currently |
| `PricingSnapshot.clientPricePerKg` | ✅ | n/a | **green (despite name)** | `pricing.finalPrice` (= producer) | Contracts, demand intents, marketplace fallback |
| `PricingSnapshot.marginPerKg` | ✅ | n/a | n/a | always `0` | Nothing yet |
| `PricingSnapshot.breakdown` | ✅ | n/a | n/a | engine `breakdown` array | Audit only |
| `PricingSnapshot.context` | ✅ | n/a | n/a | engine inputs + market context | Audit only |
| `producerGreenPricePerKg` (DTO) | ❌ | ✅ per request | green | re-runs `calculateProducerPricing` at marketplace request time | Marketplace audit / breakdown |
| `originEquivalentRoastedPricePerKg` (DTO) | ❌ | ✅ | roasted | `producerGreen / max(0.5, yield)` | Marketplace audit / fallback |
| `b2bReferencePricePerKg` (DTO) | ❌ | ✅ | roasted | founder table | Marketplace clamp band; `B2B_REFERENCE_FALLBACK` price |
| `adaptiveB2BPricePerKg` (DTO, pre-clamp) | ❌ | ✅ | roasted | commercial layer × quality | Audit |
| `roastedPricePerKg` (DTO, displayed) | ❌ | ✅ | roasted | adaptive (clamped) ?? reference ?? origin-equivalent | **Marketplace card** |
| `Contract.lockedPricePerKg` | ✅ | n/a | **roasted** | `computeRoastedPrice(clientPricePerKg, roastYield)` at sign time | Contract billing |
| `Contract.roastYieldAtCreation` | ✅ | n/a | n/a | `resolveRoastYield(lot)` at sign time | Future amends, audit |
| `Contract.monthlyGreenKg` | ✅ | n/a | green | `roastedToGreen(monthlyVolumeKg, yield)` | Supply accounting |
| `Contract.monthlyVolumeKg` | ✅ | n/a | roasted | client commitment | Billing |
| `DemandIntent.previewPricePerKg` | ✅ | n/a | roasted | `computeRoastedPrice(clientPricePerKg, yield)` | Display in intent flow |
| `DemandIntent.deltaKg` | ✅ | n/a | green | `roastedToGreen(requestedKg, yield)` | Reservation |

---

## 22. Worked examples

Computed by walking the engine pipeline by hand. Six lots from
`allocation_engine_decides`. **No `MarketSignalSnapshot` active** (cPrice =
demand modifiers = 1).

### Common steps for all examples

```
producerGreen = (basePrice + altitudeAdditive)
              × varietyPremium(sca)
              × countryFactor("COLOMBIA" → 1.05)
              × 1.0 (cPrice neutral)
              × 1.0 (demand neutral)
              [rounded to 2 decimals]

originEquiv   = producerGreen / max(0.5, roastYield)
baseCost      = originEquiv + 5.5 + 1.0 + 1.5
margined      = baseCost × 1.35
adaptive      = margined × qualityMultiplier(sca, variety)
final         = clamp(adaptive, reference × 0.7, reference × 1.3)
                                                          [if reference is non-null]
```

### Example 1 — Castillo SCA 83, 1850m, COLOMBIA, WASHED (yield 0.85)

| Step | Calculation | Value |
|---|---|---|
| basePrice (Castillo, 80-83) | — | 3.50 |
| + altitude (1850 → +2.0) | 3.50 + 2.00 | 5.50 |
| × variety (Castillo: 1.0) | 5.50 × 1.0 | 5.50 |
| × country (Colombia: 1.05) | 5.50 × 1.05 | 5.775 → 5.78 |
| × cPrice (1.0) | 5.78 × 1.0 | 5.78 |
| × demand (1.0) | 5.78 × 1.0 | **producerGreen = 5.78** |
| originEquiv = 5.78 / 0.85 | | **6.80** |
| baseCost = 6.80 + 5.5 + 1.0 + 1.5 | | 14.80 |
| margined = 14.80 × 1.35 | | 19.98 |
| qualityMultiplier (sca 83 < 87, Castillo no bonus) | | 1.00 |
| adaptive = 19.98 × 1.00 | | **19.98** |
| reference (Castillo 80_83 @ 1800) | | 28 |
| floor 28 × 0.7 = 19.60, ceiling 28 × 1.3 = 36.40 | | clamp [19.60, 36.40] |
| **Card price** | clamp(19.98, 19.60, 36.40) | **€19.98 /kg roasted** |

### Example 2 — Bourbon SCA 86, 1850m, COLOMBIA, NATURAL (yield 0.82)

| Step | Calculation | Value |
|---|---|---|
| basePrice (Bourbon, 84-86) | — | 5.50 |
| + altitude (1850 → +2.0) | 5.50 + 2.00 | 7.50 |
| × variety (Bourbon: 1.0) | | 7.50 |
| × country (1.05) | 7.50 × 1.05 | 7.875 → 7.88 |
| **producerGreen** | | **7.88** |
| originEquiv = 7.88 / 0.82 | | **9.61** |
| baseCost = 9.61 + 8 | | 17.61 |
| margined = 17.61 × 1.35 | | 23.77 |
| qualityMultiplier (sca 86 < 87, Bourbon +0.10) | 1.0 + 0.10 | 1.10 |
| adaptive = 23.77 × 1.10 | | **26.15** |
| reference (Bourbon 84_86 @ 1800) | | 38 |
| floor 38 × 0.7 = 26.60 | | |
| **Card price** | clamp(26.15, 26.60, 49.40) → **clamped to floor** | **€26.60 /kg roasted** |

### Example 3 — Pink Bourbon SCA 87, 1650m, COLOMBIA, WASHED (yield 0.85)

| Step | Calculation | Value |
|---|---|---|
| basePrice (Pink Bourbon, 87-90) | — | 7.75 |
| + altitude (1650 → +1.0) | 7.75 + 1.00 | 8.75 |
| × variety (PINK_BOURBON 1.35, sca 87 < 89, no bonus) | 8.75 × 1.35 | 11.8125 |
| × country (1.05) | 11.8125 × 1.05 | 12.403 → 12.40 |
| **producerGreen** | | **12.40** |
| originEquiv = 12.40 / 0.85 | | **14.59** |
| baseCost = 14.59 + 8 | | 22.59 |
| margined = 22.59 × 1.35 | | 30.50 |
| qualityMultiplier (sca 87, +0.10; PINK_BOURBON +0.35) | 1.0 + 0.10 + 0.35 | 1.45 |
| adaptive = 30.50 × 1.45 | | **44.23** |
| reference (Pink Bourbon 86_90_PLUS @ 1600) | | 50 |
| floor 50 × 0.7 = 35, ceiling 50 × 1.3 = 65 | | clamp [35, 65] |
| **Card price** | clamp(44.23, 35, 65) | **€44.23 /kg roasted** |

### Example 4 — Geisha SCA 88, 2050m, COLOMBIA, WASHED (yield 0.85)

| Step | Calculation | Value |
|---|---|---|
| basePrice (Geisha, 87-90) | — | 8.00 |
| + altitude (2050 → +3.0) | 8.00 + 3.00 | 11.00 |
| × variety (GEISHA 1.70, sca 88 < 89, no bonus) | 11.00 × 1.70 | 18.70 |
| × country (1.05) | 18.70 × 1.05 | 19.635 → 19.64 |
| **producerGreen** | | **19.64** |
| originEquiv = 19.64 / 0.85 | | **23.11** |
| baseCost = 23.11 + 8 | | 31.11 |
| margined = 31.11 × 1.35 | | 42.00 |
| qualityMultiplier (sca 88 ≥ 87 → +0.10; GEISHA +1.25) | 1.0 + 0.10 + 1.25 | 2.35 |
| adaptive = 42.00 × 2.35 | | **98.70** |
| reference (Geisha 86_90_PLUS @ 2000) | | 200 |
| floor 200 × 0.7 = 140, ceiling 200 × 1.3 = 260 | | clamp [140, 260] |
| **Card price** | clamp(98.70, 140, 260) → **clamped to floor** | **€140.00 /kg roasted** |

### Example 5 — Geisha SCA 90, 2050m, COLOMBIA, WASHED (yield 0.85)

| Step | Calculation | Value |
|---|---|---|
| basePrice (Geisha, 87-90) | — | 8.00 |
| + altitude (2050 → +3.0) | | 11.00 |
| × variety (GEISHA 1.70, sca ≥ 90 → +0.50 → 2.20) | 11.00 × 2.20 | 24.20 |
| × country (1.05) | 24.20 × 1.05 | 25.41 |
| **producerGreen** | | **25.41** |
| originEquiv = 25.41 / 0.85 | | **29.89** |
| baseCost = 29.89 + 8 | | 37.89 |
| margined = 37.89 × 1.35 | | 51.15 |
| qualityMultiplier (sca 90 ≥ 89 → +0.20 on top of +0.10; GEISHA +1.25) | 1.0 + 0.10 + 0.20 + 1.25 | 2.55 |
| adaptive = 51.15 × 2.55 | | **130.43** |
| reference (Geisha 86_90_PLUS @ 2000) | | 200 |
| clamp [140, 260] | | |
| **Card price** | clamp(130.43, 140, 260) → **clamped to floor** | **€140.00 /kg roasted** |

(Note: SCA 90 still clamps to the same €140 floor under v0 commercial
constants. The reference drops to **140** for both SCA 88 and SCA 90, because
the table doesn't differentiate above 86 → marketplace doesn't reflect the
real SCA spread on Geisha until calibration.)

### Example 6 — Geisha SCA 88 @ 2050 with active MarketSignalSnapshot (cPrice 240, demandIndex 1.15)

| Step | Calculation | Value |
|---|---|---|
| Same as Example 4 up to country mod | | 19.64 |
| × cPrice ratio (240/180 = 1.333 → clamp 1.25) | 19.64 × 1.25 | 24.55 |
| × demand (1.15) | 24.55 × 1.15 | 28.23 |
| **producerGreen** | | **28.23** |
| originEquiv = 28.23 / 0.85 | | **33.21** |
| baseCost = 33.21 + 8 | | 41.21 |
| margined = 41.21 × 1.35 | | 55.63 |
| qualityMultiplier (sca 88, GEISHA) | | 2.35 |
| adaptive = 55.63 × 2.35 | | **130.73** |
| clamp [140, 260] | | |
| **Card price** | clamp(130.73, 140, 260) → **clamped to floor** | **€140.00 /kg roasted** |

Even with cPrice maxed and demand at 1.15, the Geisha 88 still clamps to the
€140 floor. **The clamp absorbs cPrice/demand effect at the high end of the
quality curve.** This is a real concern for "what's the point of cPrice?" —
it's documented but practically invisible until calibration moves the
adaptive base higher.

For comparison on a non-premium variety:

### Example 6b — Castillo SCA 83 @ 1850 with same market signal (cPrice 240, demandIndex 1.15)

| Step | Calculation | Value |
|---|---|---|
| Same as Example 1 up to country | | 5.78 |
| × cPrice (1.25) | 5.78 × 1.25 | 7.225 |
| × demand (1.15) | 7.225 × 1.15 | 8.3088 → 8.31 |
| **producerGreen** | | **8.31** |
| originEquiv = 8.31 / 0.85 | | **9.78** |
| baseCost = 9.78 + 8 | | 17.78 |
| margined = 17.78 × 1.35 | | 24.00 |
| qualityMultiplier | | 1.00 |
| adaptive | | **24.00** |
| clamp [19.60, 36.40] | | |
| **Card price** | clamp(24.00, 19.60, 36.40) | **€24.00 /kg roasted** |

(vs €19.98 without market data — **+20%** lift, fully visible.)

---

## 23. Known gaps / risks

### Marketplace ↔ contract divergence (highest priority)

- **Contract `lockedPricePerKg` is green / yield** (Example 4: €23.11/kg roasted).
- **Marketplace card is adaptive clamped** (Example 4: €140/kg roasted).
- They disagree by **~6×** for Geisha. The marketplace card sets buyer expectation; the contract sign reverts to the much lower number.
- No DB persistence of B2B price means contracts can't read it — currently structurally impossible to align.

### `PricingSnapshot.clientPricePerKg` is misnamed

The field is **green** despite the name suggesting client-facing roasted.
Documented (§13). Renaming requires a coordinated migration; meanwhile every
new engineer reading the code risks confusion.

### `MarketSignalSnapshot` parity gaps

- Dev factory does NOT pass `marketData` to the engine at seed time — dev rows have deterministic green prices baked in regardless of any active snapshot.
- No automated ingestion (no API feed, no scheduled job). All snapshots are operator-curated via `/api/partner/market-signal` POST.
- No history/version retention beyond `isActive=false` rows. A diff or "what changed since last week" view is unimplemented.

### SCA bucket disagreements

- Producer engine throws on non-integer SCA scores at boundaries (83.5, 86.5).
- Founder reference table has different boundaries (`<= 86` includes 86 in middle bucket; bucket name `86_90_PLUS` is misleading).
- Real SCA scores have decimals; this can cause runtime errors in lot verification when an unguarded caller passes 87.25 or similar.

### Commercial layer is uncalibrated

- `ROASTING_COST_PER_KG = 5.5`, `PACKAGING_COST_PER_KG = 1.0`, `LOGISTICS_COST_PER_KG = 1.5`, `COMMERCIAL_MARGIN_RATE = 0.35` are placeholders.
- Quality multiplier (`+1.25` for Geisha, etc.) is heuristic.
- Result: Geisha clamps to floor (€140) when founder reference is €200. Calibration needed to move adaptive into the upper band.

### High-end SCA insensitivity

- Founder table `86_90_PLUS` collapses SCA 87 = SCA 91 = SCA 100. Card price for Geisha at SCA 88 vs SCA 90 should differ; with current clamp it doesn't (both → €140 floor).
- The producer engine differentiates 88 / 89 / 90 via the variety modifier's SCA tiers, but the clamp band is the same so the difference is invisible to buyers.

### Logistics / FX / tax / Incoterms

- `LOGISTICS_COST_PER_KG = 1.5` is a single number. No origin-region table, no destination-country adjustment, no Incoterms (FOB/CIF/DDP etc.).
- No FX. Adaptive engine and founder table are both EUR. A lot stored with `currency = "USD"` would still be priced via the EUR commercial layer when the adaptive path runs — currency only respected on the origin-equivalent fallback path.
- No VAT / tax handling.
- No co-roaster cost differentiation.

### Audit trail not persisted

- `pricingBreakdown` is recomputed each marketplace request. There is no per-day snapshot of "what did this card show on date X?".
- Contract pricing has the breakdown persisted in `PricingSnapshot.breakdown` (engine steps) but only at lot-verification time — not at contract-sign time.

### Dev factory + marketplace divergence

- Dev factory persists green via deterministic engine.
- Marketplace re-runs the engine WITH `marketData` at request time.
- A dev lot seeded under no market signal will show different marketplace prices when an operator inserts a `MarketSignalSnapshot` later — without the underlying lot row changing. This is the *intended* behaviour but worth documenting because it surprises debuggers.

---

## 24. Recommendations

In priority order:

### PRICING-B2B-3 — Persist client B2B price + rewire contracts

**Why:** Closes the marketplace-vs-contract divergence (the most damaging
gap). After this, a buyer signs at the price they saw.

**Files likely touched:**
- `prisma/schema.prisma` — add `PricingSnapshot.clientB2BPricePerKg Float?`
- migration
- `lotVerification.service.ts` — write both `clientPricePerKg` (green, unchanged) AND `clientB2BPricePerKg` (computed via `calculateMarketplaceB2BPricing` with the same `marketData`)
- `contracts.service.ts` — `lockedPricePerKg = pricingSnapshot.clientB2BPricePerKg ?? computeRoastedPrice(...)` (preferring B2B, falling back for unmigrated rows)
- `marketplaceLot.mapper.ts` — drop adaptive recompute when persisted B2B is present
- `demandIntent.service.ts` — same preference

**Risk:** Medium. Touches contract creation. Needs careful backfill plan or
default to green-fallback for old lots until they're re-verified.

### PRICING-B2B-2A — Founder calibration of commercial constants

**Why:** Geisha currently clamps to floor regardless of SCA — the marketplace
shows the same €140 for SCA 88 and SCA 90. Calibrating `ROASTING_COST_PER_KG`,
`COMMERCIAL_MARGIN_RATE`, and the GEISHA quality bump moves adaptive into the
upper band so quality differences become visible.

**Files likely touched:**
- `calculateMarketplaceB2BPricing.ts` constants only
- mapper test thresholds

**Risk:** Low. Pure constant edit; tests update; no schema change.

### PRICING-WIRE-2 — `MarketSignalSnapshot` ingestion in dev factory + automatic feeds

**Why:** Dev factory currently bypasses market signals at seed time. Hard to
reproduce production behaviour locally. Plus there's no automatic ingestion
of ICE prices — every snapshot is an operator action.

**Files likely touched:**
- `devLotScenario.service.ts` — read `getLatestMarketSignalForPricing()` before calling engine
- new `cron`-style or `RemoteTrigger` worker for periodic ICE ingestion
- new `/api/internal/pricing/snapshot/refresh` route

**Risk:** Low for the dev parity bit. Medium if external API ingestion is included (rate limits, error handling).

### PRICING-LOGISTICS-1 — Destination + origin-region logistics layer

**Why:** Single `LOGISTICS_COST_PER_KG = 1.5` is a fiction. Real logistics
varies by route, container size, FOB/CIF basis. The founder maintains a
table; needs encoding.

**Files likely touched:**
- New `src/engine/pricing/client/logisticsCost.ts` pure module
- `calculateMarketplaceB2BPricing.ts` — replace constant with `getLogisticsCost({ originRegion, destinationCountry, requiresDestinationCustoms })`
- breakdown columns

**Risk:** Low — additive layer, doesn't break existing tests.

### PRICING-FX-1 — Currency handling

**Why:** Today everything is EUR by assumption. Future producers / clients in
USD/GBP need real conversion (or at least correct labelling).

**Files likely touched:**
- New FX rates table or `MarketSignalSnapshot`-style snapshot
- `calculateMarketplaceB2BPricing.ts` — accept and respect `input.currency`
- card components — already currency-aware via `formatPrice`

**Risk:** Medium. FX is famously easy to get subtly wrong.

### PRICING-ADMIN-1 — Pricing inspector page

**Why:** No internal tool to walk through a single lot's pricing from
`(scaScore, altitude, variety, process, country, marketData)` through every
modifier to the displayed card price. Each layer is documented but only in
code; an inspector would let founder calibrate visually.

**Files likely touched:**
- `app/dev/pricing/lot/[id]/page.tsx`
- `app/api/internal/pricing/lot/[id]/route.ts` — returns the full breakdown
- a small client view that renders the modifier steps + clamp visualisation

**Risk:** Very low. Pure UI + read-only API behind `requireDevRoute`.

### PRICING-ARCH-2A target table layer (✅ shipped — read-only, not runtime-wired yet)

**File:** [src/engine/pricing/client/marketTargetPricing.ts](../../src/engine/pricing/client/marketTargetPricing.ts)

A pure module that encodes the **May 2026 specialty-coffee research benchmark**
as `(variety, country, altitude, integer SCA, optional producer prestige tier)
→ { low, expected, high } EUR/kg roasted` target bands. The module is
**read-only** — it does NOT change marketplace runtime prices in this sprint.

Why this exists: PRICING-ARCH-1's `MARKET_ANCHORED_MODEL` multiplies the
founder reference by SCA × altitude × country × scarcity × market signal,
which can double-count premium effects. The target table layer is the
research-backed source of truth that PRICING-ARCH-2B will consume directly
to re-anchor the market-anchored path on `targetExpected` and only apply
soft modifiers (scarcity, CP, demand, prestige) on top.

**Public API:**

| Export | Purpose |
|---|---|
| `MARKET_TARGET_SOURCE_VERSION` | Constant `"research-2026-05"` — bumped when a new research benchmark replaces the encoded values. |
| `normalizeMarketTargetVariety(value)` | `"Pink Bourbon"`, `"pink-bourbon"`, `"Gesha"` etc. → `MarketTargetVariety \| null`. Rejects Wush Wush / Sudan Rume / Pacamara. |
| `classifyMarketPricingVariety(variety)` | Buckets into one of `NORMAL_SPECIALTY` / `PREMIUM_SPECIALTY` / `RARE_PINK_BOURBON` / `ULTRA_RARE_GEISHA`. |
| `NORMAL_SPECIALTY_TARGETS`, `PINK_BOURBON_TARGETS`, `GEISHA_TARGETS` | Readonly tables. |
| `getMarketTargetPricing(input)` | Main selector. Returns `{ ok: true, band, pricingClass, source, confidence, bucket, reasons, sourceVersion }` or `{ ok: false, reasons, sourceVersion }`. |

**Pricing classes:**

- `NORMAL_SPECIALTY` — Castillo, Caturra, Colombia. Single normal table. SCA buckets `80_83 / 84_86 / 87_88 / 89_90 / 91_PLUS`. Confidence `medium-high`.
- `PREMIUM_SPECIALTY` — Typica, Bourbon, Tabi. Same normal table layout but each variety has its own row with higher base values. Confidence `medium`.
- `RARE_PINK_BOURBON` — five origin rows: `COLOMBIA_1700`, `COLOMBIA_1900`, `COLOMBIA_2000`, `COSTA_RICA`, `PANAMA`. SCA buckets `87 / 88 / 89 / 90 / 91_PLUS`. Confidence `medium`.
- `ULTRA_RARE_GEISHA` — seven origin rows: `COLOMBIA_1800`, `COLOMBIA_2000`, `COLOMBIA_2050_PLUS`, `PANAMA_NON_FAMOUS`, `PANAMA_FAMOUS` (driven by `producerPrestigeTier === "FAMOUS_ESTATE"`), `ETHIOPIA_NAMED`, `COSTA_RICA_BOLIVIA_ECUADOR`. SCA buckets `87 / 88 / 89 / 90 / 91 / 92_PLUS / 93_PLUS`. Confidence `medium-high` for Colombia, `medium` elsewhere.

**Geisha bands:** Research ships a single `expected` per (origin, SCA) cell.
The module derives `low = round(expected × 0.80)` and `high = round(expected × 1.25)`
so the result shape stays uniform. Other classes ship triplets directly.

**SCA assumption:** **Integer SCA only** (founder direction). The selector
calls `Math.round(scaScore)` before bucketing. SCA 88.4 → 88, SCA 88.6 → 89.
Decimal-SCA support is a separate future sprint.

**SCA clamps:**

- `SCA < 80` (or `< 87` for Pink Bourbon / Geisha) → bucket clamps to the lowest table column AND `SCA_CLAMPED_LOW` is added to `reasons`.
- `SCA > 93` → `SCA_CLAMPED_HIGH` is added regardless of variety class.

**Country fallback:**

- Pink Bourbon unknown country → `COLOMBIA_1900` row + `COUNTRY_GROUPED` reason.
- Geisha unknown country → `COLOMBIA_2000` row + `COUNTRY_GROUPED` reason.
- Pink Bourbon Colombia + missing altitude → `COLOMBIA_1900` row + `MISSING_ALTITUDE` + `ALTITUDE_BUCKETED`.
- Geisha Colombia + missing altitude → `COLOMBIA_2000` row + `MISSING_ALTITUDE` + `ALTITUDE_BUCKETED`.

**What this sprint did NOT change**

- No marketplace card prices changed.
- No new tables in Prisma.
- No persistence.
- `calculateMarketplaceB2BPricing` still ships v1 dual-model output.

**Worked sample:**

```ts
getMarketTargetPricing({
  variety: "Geisha",
  country: "Colombia",
  altitude: 2050,
  scaScore: 88,
})
// → {
//   ok: true,
//   variety: "GEISHA",
//   pricingClass: "ULTRA_RARE_GEISHA",
//   band: { low: 160, expected: 200, high: 250 },
//   source: "RESEARCH_2026_05_TABLE",
//   confidence: "medium-high",
//   sourceVersion: "research-2026-05",
//   bucket: {
//     scaBucket: "88",
//     altitudeBucket: "COLOMBIA_2050_PLUS",
//     countryGroup: "COLOMBIA",
//     producerPrestigeTier: "UNKNOWN",
//   },
//   reasons: ["GEISHA_TABLE_MATCH", "SCA_BUCKETED", "ALTITUDE_BUCKETED"],
// }
```

**Tests:** [marketTargetPricing.test.ts](../../src/engine/pricing/client/__tests__/marketTargetPricing.test.ts) — 44 cases covering normalisation, classification, every documented table cell across all four classes, SCA clamps, country fallback, missing-altitude fallback, prestige selection, result invariants (`low ≤ expected ≤ high`, `sourceVersion`, never-throws-on-malformed-input).

---

### PRICING-FIX-1 — SCA bucket consistency

**Why:** Producer engine throws on SCA 83.5 / 86.5. Real lab scores have
decimals. Founder reference table accepts them but with surprising bucket
assignment. Cosmetic, but prevents runtime errors during partner verification.

**Files likely touched:**
- `calculatePricing.ts:53-59` — change to `<= 83.99` style or interpolate
- alignment with `b2bRoastedPricing.ts:235-242`

**Risk:** Low. One-file change with test coverage.

---

## Verification

```
npx tsc --noEmit                  ✅ clean
npm run test:allocation           ✅ 161 / 161 pass
npm run build                     ✅ Next.js build green
```

(Documentation-only sprint; gates run to confirm no accidental breakage.)


---

## §17 PRICING-B2B-3 — Persisted client B2B price (2026-05)

### What changed

`PricingSnapshot` now carries a roasted B2B price that contracts and demand
intents read directly. The legacy `clientPricePerKg` field is **GREEN** and
remains untouched for backwards compatibility, but it is no longer the
primary price source for new lots.

| Field | Unit | Source |
|---|---|---|
| `clientPricePerKg` *(legacy, misleading name)* | €/kg **GREEN** | Producer engine — same as `producerPricePerKg` |
| `clientB2BPricePerKg` *(new, PRICING-B2B-3)* | €/kg **ROASTED** | `calculateMarketplaceB2BPricing` (target-anchored) |
| `clientB2BPricingVersion` | — | echoed from the B2B engine (`marketplace-b2b-target-anchored-v1`) |
| `clientB2BPricingMode` | — | `ADAPTIVE_B2B_ENGINE` / `B2B_REFERENCE_FALLBACK` / `ORIGIN_EQUIVALENT_FALLBACK` |
| `clientB2BPricingBreakdown` | JSON | full audit array |
| `clientB2BPriceComputedAt` | timestamp | when the B2B price was persisted |

### Read priority (resolveClientB2BPriceForLot)

1. `clientB2BPricePerKg` if finite and > 0 → `source: "CLIENT_B2B_PERSISTED"`
2. `computeRoastedPrice(clientPricePerKg, roastYield)` → `source: "LEGACY_GREEN_EQUIVALENT"`
3. throw `ClientB2BPriceError("LOT_NO_PRICING")`

### Where the new price is consumed

- `contracts.service.ts` — `createContractWithSupplyValidation` and the
  switch-coffee branch of amend.
- `demandIntent.service.ts` — `previewPricePerKg`.
- `marketplaceLot.mapper.ts` — DTO `roastedPricePerKg` + `pricingSource`.
- `contractCatalog.mapper.ts` — DTO `pricePerKgRoasted` + `pricingSource`.

The marketplace and contract catalog DTOs now expose
`pricingSource: "PERSISTED_CLIENT_B2B" | "ADAPTIVE_RECOMPUTE_FALLBACK" |
"LEGACY_ORIGIN_EQUIVALENT_FALLBACK"` so a buyer or auditor can tell
exactly where a number came from.

### Backwards compatibility

- Pre-migration rows have `clientB2BPricePerKg = NULL`. Marketplace falls
  back to recompute, contracts/intents fall back to legacy green/yield.
  Both paths render identical numbers to today.
- The adaptive recompute fallback is **never** removed.
- `clientPricePerKg` is **not** renamed in this sprint despite the
  misleading name. A future migration may rename it.

### Sprint report

See `docs/pricing/PRICING-B2B-3.md`.



---

## §18 PRICING-WIRE-2 — B2B refresh + pricing inspector (2026-05)

### What changed

`PRICING-B2B-3` persisted `clientB2BPricePerKg` but had no path to refresh
it when `MarketSignalSnapshot` or target tables drift. PRICING-WIRE-2 adds
the operational hooks:

- `previewClientB2BRefresh(scope?)` and `applyClientB2BRefresh(scope?)`
  in `src/services/pricing/clientB2BPriceRefresh.service.ts`. Pure helpers
  live in the `.pure.ts` sibling so they are unit-testable without Prisma.
- Internal API: `GET` (dry-run) and `POST` (apply with `confirm` token) at
  `/api/internal/pricing/client-b2b-refresh`. Single-lot inspector at
  `/api/internal/pricing/lot/[id]`.
- Dev page: `/dev/pricing` with market-signal block, summary KPIs, and a
  per-lot table showing persisted vs recomputed and the signed delta.

### What apply mode UPDATES vs leaves alone

Updates only: `clientB2BPricePerKg`, `clientB2BPricingVersion`,
`clientB2BPricingMode`, `clientB2BPriceComputedAt`.

Never touches: `producerPricePerKg`, `clientPricePerKg` (legacy green),
`GreenLot.pricePerKg`, existing `Contract.lockedPricePerKg`, existing
`DemandIntent.previewPricePerKg`, or any allocation engine output.

### Source-of-truth labels exposed by the refresh result

`pricingSourceBefore` / `pricingSourceAfter` ∈
`{ PERSISTED_CLIENT_B2B, RECOMPUTED_CLIENT_B2B, LEGACY_GREEN_EQUIVALENT,
NO_PRICE }`.

### Backwards compatibility

Pre-PRICING-B2B-3 rows continue to render via the marketplace adaptive
recompute fallback and contract legacy green/yield fallback until apply is
run on them.

### Known operational gaps

No external commodity feed yet. No scheduler. No admin override. See
`docs/pricing/PRICING-WIRE-2.md` for the full list.

### Sprint report

See `docs/pricing/PRICING-WIRE-2.md`.



---

## §19 PRICING-ADMIN-1 — Per-lot pricing inspector (2026-05)

### What changed

`/api/internal/pricing/lot/[id]` now returns a structured
`ClientB2BPricingInspection` payload that explains exactly *why* a lot
has its current B2B price. New companion UI at `/dev/pricing/lot/[id]`.

### Key fields

The payload is a top-level orchestration of:

- `persisted` — what was actually stored (`clientB2BPricePerKg`,
  `clientB2BPricingMode`, `clientB2BPriceComputedAt`, `pricingSource`).
- `recomputed` — fresh result from `calculateMarketplaceB2BPricing`
  (`clientB2BPricePerKg`, `pricingMode`, `commercialModel`, warnings).
- `delta` — `{ absolute, percent, status }` where `status ∈
  { MATCH | DRIFT_LOW | DRIFT_HIGH | NO_PERSISTED | NO_RECOMPUTE }`.
- `target` — target table row (low / expected / high), pricing class,
  source version, SCA / altitude buckets, country group; with `ok` flag
  and surfaced fallback reasons.
- `commercial` — cost-plus final, market-anchored price, final before
  clamp, clamp min/max + applied, soft scarcity / market-signal /
  prestige modifiers.
- `marketSignal` — full snapshot metadata + a `used: boolean` flag
  showing whether the engine actually applied it.
- `allocation` + `visibility` — recommended surface, contract / market
  green & roasted kg, blocked kg, marketplace + catalog visibility, and
  the surface-level pricing source labels.
- `breakdown` — the raw arrays (recomputed B2B, producer green,
  persisted client B2B, persisted raw) for full audit.

### Read-only boundary

No mutation. No override. No apply. The inspector exposes the audit
trail; PRICING-ADMIN-2 (future) is where override + audit row will
land.

### Sprint report

See `docs/pricing/PRICING-ADMIN-1.md`.



---

## §20 PRICING-FEED-1 — Controlled MarketSignal ingestion (2026-05)

### What changed

Adds a safe preview/apply ingestion path for MarketSignalSnapshot:

- Pure validator: `validateMarketSignalCandidate` (no Prisma) with
  in-band ranges (cPrice 50–600 ¢/lb, demandIndex 0.8–1.2), strict
  non-clamping, and structured diagnostics
  (`MSI_INVALID_CPRICE`, `MSI_DEMAND_INDEX_OUT_OF_RANGE`, …).
- Service layer: `previewMarketSignalIngestion` /
  `applyMarketSignalIngestion`. Apply transactionally deactivates the
  current active snapshot before creating the new one.
- Internal route: `GET/POST /api/internal/pricing/market-signal`,
  guarded by `requireDevRoute`. `apply: true` requires
  `confirm: "APPLY_MARKET_SIGNAL"`.
- Dev UI: `/dev/market-signal` — form, diagnostics panel, recent table,
  next-step hint linking to `/dev/pricing`.

### Provenance

Provider / sourceName / sourceUrl / rawValue / rawUnit / confidence /
retrievedAt + the operator’s free-form note are encoded into
`MarketSignalSnapshot.note` deterministically by
`buildMarketSignalProvenanceNote`. No schema change.

### Two-step boundary (preserved)

Ingestion **does not** refresh `clientB2BPricePerKg`. It also never
touches existing contracts / demand intents. To propagate the new signal
into persisted B2B prices, the operator runs the existing PRICING-WIRE-2
refresh on `/dev/pricing`.

### Provider seam

`MarketSignalProvider` interface + `manualProvider` helper land here so
PRICING-FEED-2 can plug in an external C-price adapter without
re-architecting.

### Sprint report

See `docs/pricing/PRICING-FEED-1.md`.



---

## §21 PRICING-FEED-2A — Provider preview-only (2026-05)

### What changed

Adds a provider seam under pricing services. Every provider produces a
`MarketSignalIngestionCandidate` that flows through the FEED-1 validator
before becoming a preview. **No provider writes** to `MarketSignalSnapshot`
or `PricingSnapshot`; the operator must still apply through the existing
FEED-1 confirm-token route.

### Providers

- `mock-delayed-ice` (`MOCK`) — deterministic, no env, no network.
  Three scenarios (`low`, `neutral`, `high`).
- `barchart-preview` (`EXTERNAL_HTTP`) — env-gated skeleton. Real fetch
  path is intentionally deferred to PRICING-FEED-2B.
  - Without `BARCHART_ONDEMAND_API_KEY` → `MSP_PROVIDER_NOT_CONFIGURED`.
  - With key → `MSP_PROVIDER_DEFERRED_LIVE_FETCH` (no HTTP issued).

### Routes

- `GET  /api/internal/pricing/market-signal/providers` — list summaries.
- `POST /api/internal/pricing/market-signal/provider-preview` — orchestrate
  fetch + validate, return `MarketSignalProviderPreview`. Never writes.

### UI hop

`/dev/market-signal` adds an "External provider preview" section above
the manual form. Operator picks a provider, fetches, and clicks
**Use this candidate in manual form** — the existing manual
Preview signal → Apply signal flow remains the only write path.

### Sprint report

See `docs/pricing/PRICING-FEED-2A.md`.



---

## §22 PRICING-FEED-1B — Partner route consolidated (2026-05)

### What changed

`/api/partner/market-signal` POST no longer carries duplicated
validation or transactional write logic. It now:

  1. authenticates (PARTNER role) — unchanged.
  2. parses the legacy body via `parsePartnerMarketSignalBody`
     (new pure adapter, stamps provenance with
     `provider="partner-route"` + `confidence="OPERATOR_VERIFIED"`).
  3. calls `applyMarketSignalIngestion` — the same write path as
     `/dev/market-signal`.
  4. adapts the result back via `buildPartnerMarketSignalResponse`
     so legacy clients keep seeing snapshot fields at the top level
     (now augmented with `diagnostics[]` and `ingestion {ok,applied}`).

`GET` semantics preserved (raw active snapshot row).

### Single source of truth

After this sprint, every `MarketSignalSnapshot` writer in the codebase
flows through the same chain: `validateMarketSignalCandidate` →
`applyMarketSignalIngestion` → `prisma.$transaction(deactivate, create)`.
There is no remaining duplicated rule for cPrice / demandIndex /
expiresAt / source / active uniqueness.

### Backwards compatibility

Body fields accepted by the partner route are unchanged
(`cPrice`, `demandIndex`, `source`, `note`, `expiresAt`, plus
`validFrom` now flows through to the shared validator). Auth +
top-level success/error fields preserved; new fields added
alongside.

### Sprint report

See `docs/pricing/PRICING-FEED-1B.md`.



---

## §23 PRICING-FEED-2B — Live Barchart fetch (2026-05)

### What changed

`barchart-preview` is no longer deferred. With
`BARCHART_ONDEMAND_API_KEY` set, the provider issues a live HTTP
request to `getQuote.json` (default symbol `KC*1`), parses the
response through a pure parser, and returns a validated
`MarketSignalIngestionCandidate`. Without the env key it still
returns `MSP_PROVIDER_NOT_CONFIGURED` and never touches the network.

### Boundaries preserved

- Preview-only — never writes `MarketSignalSnapshot`.
- Never auto-refreshes `clientB2BPricePerKg`.
- API key is server-only and never appears in `provenance.sourceUrl`,
  diagnostics, raw payload or any UI.

### New shapes

Diagnostic codes added: `MSP_BARCHART_STATUS_ERROR`,
`_EMPTY_RESULTS`, `_PRICE_MISSING`, `_PRICE_INVALID`,
`_TIMESTAMP_INVALID`, `_SYMBOL_MISSING`, `_PARSED`,
`MSP_DEMAND_INDEX_DEFAULTED`.

`MarketSignalProviderFetchOptions` gains `fetchImpl?` and
`timeoutMs?` so tests inject HTTP without hitting the network and
the AbortController timeout is configurable.

### Sprint report

See `docs/pricing/PRICING-FEED-2B.md`.



---

## §24 PRICING-FEED-2C — Settlement / EOD provider (2026-05)

### What changed

Adds `barchart-settlement-preview` alongside the intraday
`barchart-preview`. Same env key, same fetch helper, **different
price priority** and a new settled / final detection step.

### Price priority (new provider)

`settlement → settle → close → previousClose → lastPrice → last`.
The last two are fallback only; falling back emits
`MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST` (warning).

### Settled / final detection — `isSettlementFinal(result)`

Returns `true | false | null`. Booleans (`isSettled`, `settled`,
`isFinal`, `final`) take precedence over status strings (`status`,
`tradeStatus`, `session`, `quoteType`, `mode`) which match keywords
like `settled` / `final` / `closed` (true) or `open` / `trading` /
`delayed` / `live` / `intraday` / `real-time` (false).

### Confidence rule

`HIGH` iff `settlementStatus === true` AND price came from
`settlement | settle | close | previousClose`. `MEDIUM` otherwise.

### Boundaries preserved

- Preview-only — never writes `MarketSignalSnapshot`.
- API key never exposed in `sourceUrl` or `raw`.
- Intraday `barchart-preview` semantics unchanged
  (regression test enforces lastPrice-first).
- Operator must still apply via the manual ingestion form.

### Sprint report

See `docs/pricing/PRICING-FEED-2C.md`.



---

## §25 PRICING-FEED-3A — MarketSignalTick history (2026-05)

### What changed

Adds `MarketSignalTick`, an append-only audit table for provider
preview observations. Recording a tick is a **third** explicit
operator action — separate from running a provider preview (no
write) and from applying an active `MarketSignalSnapshot` (FEED-1
confirm-token flow).

### Schema

New table only. Non-destructive `CREATE TABLE` + 3 indexes
(`capturedAt`, `(providerId, capturedAt)`, `(source, capturedAt)`).
`providerId` and `providerKind` are plain strings so adding
providers later does not require a migration.

### What ticks update / do not update

- ONLY `MarketSignalTick` (append-only).
- NEVER `MarketSignalSnapshot`,
  `PricingSnapshot.clientB2BPricePerKg`, `Contract.lockedPricePerKg`,
  `DemandIntent.previewPricePerKg`, allocation engine output, target
  pricing tables.

### API + UI

- `GET /api/internal/pricing/market-signal/ticks` — list (newest first;
  optional `providerId` / `since` / `limit`).
- `POST /api/internal/pricing/market-signal/ticks` — record one tick
  from a `MarketSignalProviderPreview`.
- `/dev/market-signal` adds a `Record tick` button below the provider
  preview block and a `Recent provider ticks` table (last 20 rows,
  intraday / settlement badge).

### Security

URL allow-list (`symbols`, `symbol`, `fields`) plus recursive secret-key
redaction for `rawPayload` and `diagnostics` (`apikey`, `api_key`,
`api-key`, `token`, `secret`, `authorization`, `auth`, `password`,
`bearer`). Embedded `user:pass@` in URLs is stripped.

### Sprint report

See `docs/pricing/PRICING-FEED-3A.md`.



---

## §26 PRICING-FEED-3B — Audit chart intraday vs settlement (2026-05)

### What changed

Adds a read-only audit view on `/dev/market-signal`:

  • Pure helper `buildMarketSignalTickSeries` buckets ticks by class
    (`INTRADAY | SETTLEMENT | MOCK | OTHER`), surfaces latest of each
    and computes a 2-decimal `delta` (absolute + percent) between
    latest intraday and latest settlement.
  • Helper exposes `classifyMarketSignalTickProvider` and
    `computeMarketSignalTickDelta` for direct callers.
  • UI "Market signal audit" section: four summary cells +
    inline 700×180 SVG sparkline (no chart library). Mock points
    dashed/muted; intraday amber; settlement emerald.

### Boundaries preserved

  • Read-only. No DB writes.
  • No active `MarketSignalSnapshot` apply.
  • No `clientB2BPricePerKg` refresh.
  • No mutation of contracts or demand intents.

### Defensive rules (tested)

  • Non-finite or non-positive cPrice ignored.
  • Unparseable `capturedAt` ignored.
  • Latest values picked by `capturedAt`, not array order.
  • `delta = null` whenever either side missing — never a fake zero.
  • Input array not mutated.

### Sprint report

See `docs/pricing/PRICING-FEED-3B.md`.



---

## §27 PRICING-FEED-3C — Tick row inspector (2026-05)

### What changed

Adds a read-only per-row inspector for `MarketSignalTick`:

  • Pure module `marketSignalTickInspection.pure.ts` with
    `validateMarketSignalTickInspectionId`, `detectKnownSecretKeys`,
    `serialiseMarketSignalTickInspection`,
    `buildMarketSignalTickInspectionFromRow`.
  • `getMarketSignalTickInspection(id)` in the tick service.
  • `GET /api/internal/pricing/market-signal/ticks/[id]` route
    (`requireDevRoute`).
  • UI Inspect button per row in Recent provider ticks + modal
    overlay that surfaces the identity grid, diagnostics (coloured
    list when shaped like `{code,severity,message}` else JSON),
    and the raw provider payload (collapsed by default).

### Read-time defence

FEED-3A already sanitises on write. The inspector re-runs
`sanitizeMarketSignalTickSourceUrl` + `sanitizeMarketSignalTickRawPayload`
on read and reports `safety = { rawPayloadSanitised,
sourceUrlSanitised, containsKnownSecretKeys }`. A legacy row that
slipped past the on-write sanitiser still gets scrubbed before
display.

### Boundaries preserved

Inspection never:
  • writes / updates / deletes any `MarketSignalTick` row;
  • writes `MarketSignalSnapshot`;
  • refreshes `PricingSnapshot.clientB2BPricePerKg`;
  • mutates `Contract.lockedPricePerKg` or
    `DemandIntent.previewPricePerKg`;
  • exposes Barchart API keys.

Pure-test invariant: the inspector module surface exports no
identifier matching `update / delete / remove / patch / mutate /
apply`.

### Sprint report

See `docs/pricing/PRICING-FEED-3C.md`.

