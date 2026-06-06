# PRICING-ADMIN-1 — Read-only per-lot pricing inspector

Sprint scope: an audit-friendly **per-lot** detail surface that explains
exactly *why* a `GreenLot` has its current B2B price. Read-only —
no override, no apply, no writes.

PRICING-WIRE-2 already shipped:
- bulk dry-run / apply refresh
- `/dev/pricing` overview table
- a lightweight `/api/internal/pricing/lot/[id]` payload

This sprint replaces that lightweight payload with a structured
inspection and adds the matching detail UI.

---

## 1. Purpose

The bulk inspector answers *"are persisted prices drifting?"*. It does
**not** answer *"why is this Geisha priced at €400?"*. PRICING-ADMIN-1
adds the lot-level audit trail that founder/dev calibration needs:

- target table row (low / expected / high) for the lot's
  variety + altitude + SCA + country;
- commercial model layer (cost-plus vs market-anchored, soft modifiers,
  clamp behaviour);
- producer-engine green breakdown;
- active `MarketSignalSnapshot` metadata + whether it was *used*;
- allocation surface + visibility (marketplace / contract catalog);
- raw breakdowns (persisted, recomputed, producer green).

The classic "Geisha is €400 because" ladder reads off the inspector top
to bottom without opening JSON.

---

## 2. Files changed

### Created — pure helpers + tests

| Path | Role |
|---|---|
| [src/services/pricing/clientB2BPricingBreakdown.ts](../../src/services/pricing/clientB2BPricingBreakdown.ts) | Null-safe breakdown lookups (`findBreakdownItem`, `getNumberBreakdownValue`, `getBooleanBreakdownValue`, `getStringBreakdownValue`); structured views (`buildCommercialInspectionFromBreakdown`, `buildTargetInspectionFromBreakdown`); `classifyDeltaStatus`; `deriveVisibility`. |
| [src/services/pricing/__tests__/clientB2BPricingBreakdown.test.ts](../../src/services/pricing/__tests__/clientB2BPricingBreakdown.test.ts) | 24 pure tests. |

### Created — inspector service

| Path | Role |
|---|---|
| [src/services/pricing/clientB2BPricingInspector.service.ts](../../src/services/pricing/clientB2BPricingInspector.service.ts) | `getClientB2BPricingInspection(greenLotId)` orchestrator. Reads lot + persisted snapshot, runs producer + B2B engines, runs `buildAllocationSnapshots` + `decideLotAllocation`, assembles `ClientB2BPricingInspection`. No mutation. |

### Created — UI

| Path | Role |
|---|---|
| [app/dev/pricing/lot/[id]/page.tsx](../../app/dev/pricing/lot/%5Bid%5D/page.tsx) | Server shell, passes `params.id` to client component. |
| [src/components/dev/pricing/PricingLotInspector.tsx](../../src/components/dev/pricing/PricingLotInspector.tsx) | Client detail UI — header, price summary, target table panel, commercial model panel, market signal panel, allocation + visibility panel, breakdown collapsibles. |

### Modified

| Path | Change |
|---|---|
| [app/api/internal/pricing/lot/[id]/route.ts](../../app/api/internal/pricing/lot/%5Bid%5D/route.ts) | Returns the rich `ClientB2BPricingInspection` payload (replaces the previous lightweight format). 404 when lot not found. Still guarded by `requireDevRoute`. |
| [src/components/dev/pricing/PricingInspectorPanel.tsx](../../src/components/dev/pricing/PricingInspectorPanel.tsx) | Adds an `Inspect →` link per row pointing at `/dev/pricing/lot/<greenLotId>`. |

### Untouched

Prisma schema, migrations, target tables, allocation engine, marketplace UI,
client dashboard, contract creation, contract amend, demand intent service,
existing `Contract.lockedPricePerKg`, existing `DemandIntent.previewPricePerKg`,
PricingSnapshot writes (no apply / no override), CoffeeAssistant.

---

## 3. Inspector API shape

`GET /api/internal/pricing/lot/[id]` → `ClientB2BPricingInspection`:

```ts
{
  generatedAt: string

  lot: {
    id, lotNumber, name, status,
    variety, process, harvestYear, scaScore,
    altitude, country, region, producerName, farmName,
    availableGreenKg, availableRoastedKg, roastYield, currency
  }

  persisted: {
    producerGreenPricePerKg, legacyClientGreenPricePerKg,
    clientB2BPricePerKg, clientB2BPricingVersion,
    clientB2BPricingMode, clientB2BPriceComputedAt,
    pricingSource:
      "PERSISTED_CLIENT_B2B" | "LEGACY_GREEN_EQUIVALENT" | "NO_PRICE"
  }

  recomputed: {
    clientB2BPricePerKg, pricingVersion, pricingMode,
    commercialModel,
    pricingSource: "RECOMPUTED_CLIENT_B2B" | "NO_PRICE",
    warnings: string[]
  }

  delta: {
    absolute, percent,
    status:
      "MATCH" | "DRIFT_LOW" | "DRIFT_HIGH" |
      "NO_PERSISTED" | "NO_RECOMPUTE"
  }

  producer: {
    greenPricePerKg, originEquivalentRoastedPricePerKg,
    breakdown: unknown[]
  }

  target: {
    ok, sourceVersion, pricingClass,
    low, expected, high,
    scaBucket, altitudeBucket, countryGroup,
    reasons: string[]
  }

  commercial: {
    costPlusFinal, marketAnchoredPrice,
    finalBeforeClamp, clampMin, clampMax, clampApplied,
    softScarcityModifier,
    softMarketSignalModifier,
    softPrestigeModifier
  }

  marketSignal: {
    id, cPrice, demandIndex, source,
    validFrom, expiresAt, used: boolean
  }

  allocation: {
    recommendedSurface, contractAssignableGreenKg,
    contractAssignableRoastedKg, marketplaceGreenKg,
    marketplaceRoastedKg, exclusiveMicrolotGreenKg,
    blockedGreenKg, reasons: Array<{ code, severity, message }>
  }

  visibility: {
    appearsInMarketplace, appearsInContractCatalog,
    pricingSourceMarketplace, pricingSourceContractCatalog
  }

  breakdown: {
    persistedClientB2B,        // PricingSnapshot.clientB2BPricingBreakdown JSON
    recomputedClientB2B,       // calculateMarketplaceB2BPricing breakdown[]
    producerGreen,             // calculateProducerPricing breakdown[]
    raw                        // PricingSnapshot.breakdown JSON (legacy)
  }
}
```

`MATCH` threshold is 0.5% of persisted by default. `MATCH | DRIFT_LOW |
DRIFT_HIGH | NO_PERSISTED | NO_RECOMPUTE` is the canonical status union.

---

## 4. UI sections

`/dev/pricing/lot/[id]` shows, top to bottom:

1. **Header** — eyebrow with status, H1 = lot name (or lot number), then a one-line subtitle: `<lotNumber> · <variety> · <process> · SCA · altitude · region, country`. Back link to `/dev/pricing`.
2. **Price summary** — six cards: Persisted B2B, Recomputed B2B, Delta (with status tone), Legacy green-equivalent, Producer green, Available volume.
3. **Target table** — pricing class, source version, country group, SCA / altitude buckets, expected / low / high in lot currency. When `target.ok = false`, an inline warning lists the diagnostic reasons surfaced by the engine.
4. **Commercial model** — commercial model label, cost-plus final, market-anchored price, final before clamp, clamp min/max, clamp-applied, soft scarcity / market-signal / prestige modifiers (rendered as `×N.NNN`).
5. **Market signal** — cPrice (¢/lb), demand index, source, valid-from, expires, plus a clear "Used by engine? Yes/No" cell. Empty-state when no active signal.
6. **Allocation & visibility** — recommended surface, marketplace / contract catalog flags, contract assignable green/roasted kg, marketplace green/roasted kg, exclusive microlot kg, blocked kg, surface-level pricing source labels, yield. Engine reasons are listed below the grid with code, severity badge and message.
7. **Recompute warnings** — only renders when the recompute step surfaced one (skip codes, B2B engine fallback reason, etc.).
8. **Breakdowns** — four `<details>` cards (recomputed B2B, producer green, persisted client B2B, persisted raw breakdown). Pretty-printed JSON, collapsed by default.

No edit / apply / override controls anywhere on the page. Visual style
matches `/dev/pricing` (cream / amber).

---

## 5. Breakdown extraction approach

`calculateMarketplaceB2BPricing` already emits a flat
`Array<{ label, value }>` breakdown. The pure helper module
`clientB2BPricingBreakdown.ts` parses it by **label**, not index, with
type-safe getters that return `null` instead of throwing when:

- the label is missing,
- the runtime value is the wrong type (`Number.isFinite` for numbers,
  `typeof === "boolean"` for booleans, non-empty `string` for strings),
- `breakdown` itself is `null` / `undefined`.

The engine's relevant labels (used as parsing keys here):

| Label | Type | Section |
|---|---|---|
| `costPlusFinal`, `costPlusPostClamp` | number | commercial |
| `marketAnchoredPrice` | number | commercial |
| `finalBeforeClamp` | number | commercial |
| `clampMin`, `clampMax`, `clampApplied` | number / number / boolean | commercial |
| `softScarcityModifier`, `softMarketSignalModifier`, `softPrestigeModifier` | number | commercial |
| `marketTargetSourceVersion`, `marketTargetPricingClass` | string | target |
| `marketTargetExpected`, `marketTargetLow`, `marketTargetHigh` | number | target |
| `targetScaBucket`, `targetAltitudeBucket`, `targetCountryGroup` | string | target |
| `marketTargetMissing`, `marketTargetFallbackReason`, `marketTargetSkipReason` | string (diagnostic) | target.reasons |

If the engine ever rewords or re-IDs a label, only the helper changes —
the inspector and tests follow.

---

## 6. Tests added

`npm run test:allocation` → **360 / 360 pass** (24 new over the 336
baseline; all in [clientB2BPricingBreakdown.test.ts](../../src/services/pricing/__tests__/clientB2BPricingBreakdown.test.ts)):

- **Lookup helpers** (5): label found / missing; null/empty inputs; numeric
  rejects NaN / Infinity / strings; boolean extracts `clampApplied`; string
  rejects non-string / empty.
- **Commercial inspection** (3): full extraction from a market-anchored
  result; nulls when breakdown empty; `costPlusPostClamp` fallback when
  `costPlusFinal` absent.
- **Target inspection** (2): ok=true with all bands present; ok=false +
  surfaced reasons when the target row was not applied.
- **Delta classification** (7): MATCH on identity; MATCH on sub-threshold
  drift; DRIFT_HIGH / DRIFT_LOW above threshold; NO_PERSISTED for null/0;
  NO_RECOMPUTE for null; custom threshold honoured.
- **Visibility** (6): OPEN_MARKETPLACE / EXCLUSIVE_MICROLOT / CONTRACT_CATALOG /
  SPLIT / HOLD; zero-pool surfaces flip flags off even when the surface
  label allows them.

All previous 336 tests remain green.

---

## 7. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **360 / 360 pass** |
| `npm run build` | ✓ Compiled successfully — `/dev/pricing/lot/[id]` and the route in the manifest |

No migrations, no destructive DB commands, no Prisma schema changes.

---

## 8. Manual validation steps

1. Seed dev data: `/dev/scenarios/lots` → seed `4. Exclusive microlots` jittered seed `pricing-geisha-1`.
2. `/dev/pricing` → click `Inspect →` on a Geisha row.
3. Detail page (`/dev/pricing/lot/<id>`) shows:
   - Persisted B2B and Recomputed B2B prices; Delta near zero (right after seed).
   - Target table panel: expected / low / high for `GEISHA / SCA / 2050+ m / COLOMBIA`.
   - Commercial model `MARKET_ANCHORED_MODEL` with the three soft modifiers and final-before-clamp / clamp behaviour.
   - Allocation surface (likely `EXCLUSIVE_MICROLOT` or `OPEN_MARKETPLACE` for microlot recipes); visibility flags reflect the surface.
4. Open a Castillo / Caturra row from `marketplace_mix` → `COST_PLUS_MODEL`, sub-€20/kg. Target table panel may show ok=false with a fallback reason — that is correct for normal-specialty rows when no target row exists.
5. Open a Pink Bourbon row → target row resolves under the `PINK_BOURBON` pricing class.
6. Confirm there are **no** edit / apply / override buttons on the detail page.
7. Optional drift check:
   - Create an active `MarketSignalSnapshot` (`isActive=true`, in-band cPrice + demandIndex) via the existing partner / admin route.
   - Reload the inspector → `Recomputed B2B` may diverge from `Persisted B2B`; `Delta` flips to `DRIFT_HIGH` / `DRIFT_LOW`. Persisted stays unchanged (no apply was triggered).

---

## 9. Known limitations

- **Read-only only.** No `clientB2BPricePerKg` override. No apply. No mutation routes.
- **No external commodity feed** — `MarketSignalSnapshot` ingestion is still manual.
- **No scheduled refresh** — the inspector reflects whatever bulk apply was last triggered.
- **Existing contracts unchanged.** The inspector reflects current persisted B2B; lock prices on signed contracts keep their historical values.
- **No historical price chart** — the inspector is point-in-time. A future sprint can persist daily snapshots and add a sparkline.
- **Breakdown parsing depends on stable label IDs** — if `calculateMarketplaceB2BPricing` ever renames a label, the helper module is the single point of update.
- **Producer prestige tier is not wired yet** — the engine accepts `producerPrestigeTier`, but inputs flow through as `null`. Future sprint: hydrate from a real producer field.
- **Allocation snapshot is computed per request** — for heavy datasets this could be slow; today it's fine because the inspector targets one lot at a time.
- **Persisted B2B breakdown** is rendered as raw JSON in a `<details>` block; pretty-formatting per-step is a future polish sprint.

---

## 10. Recommended next sprint

1. **PRICING-ADMIN-2** — manual `clientB2BPricePerKg` override for a single lot with an audit row (who / when / previous value / reason). The inspector already exposes everything needed; only a write path + guarded UI control remains.
2. **PRICING-FEED-1** — external C-price ingestion adapter (NYC C / ICE) writing to `MarketSignalSnapshot` with confidence + provenance.
3. **CLIENT-NAV-1** — vertical sidebar dashboard polish to match the original target mock for `/platform/client`.
