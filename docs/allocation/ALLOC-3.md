# ALLOC-3 — Real Marketplace Lots API + Marketplace UI Wiring

Sprint scope: turn `/platform/marketplace` from a mock-data display into an
allocation-engine-driven view of real GreenLots. Read-only. No schema
migration. No write paths. No filter / search / pagination logic.

---

## 1. Files changed

### Created

| Path | Role |
|---|---|
| [src/services/allocation/marketplace/marketplaceLot.mapper.ts](../../src/services/allocation/marketplace/marketplaceLot.mapper.ts) | Pure mapper (snapshot + decision → DTO), metrics, insights, sort |
| [src/services/allocation/marketplace/marketplaceView.service.ts](../../src/services/allocation/marketplace/marketplaceView.service.ts) | Orchestrator used by both the API route and the page |
| [app/api/marketplace/lots/route.ts](../../app/api/marketplace/lots/route.ts) | Customer-facing GET, `requireAuth` |
| [src/services/allocation/__tests__/marketplaceLot.mapper.test.ts](../../src/services/allocation/__tests__/marketplaceLot.mapper.test.ts) | 19 unit tests (mapper / sort / metrics / insights) |
| [docs/allocation/ALLOC-3.md](../../docs/allocation/ALLOC-3.md) | This report |

### Modified

| Path | Change |
|---|---|
| [src/services/allocation/domain/types.ts](../../src/services/allocation/domain/types.ts) | Added 5 optional display-metadata fields on `LotAllocationSnapshot`: `name`, `producerName`, `farmName`, `createdAt`, `currency` |
| [src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts](../../src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts) | Carries the new metadata through; pulls farm name + producer name |
| [src/services/allocation/snapshot/lotAllocationSnapshot.service.ts](../../src/services/allocation/snapshot/lotAllocationSnapshot.service.ts) | `select` now includes `name`, `currency`, `createdAt`, `farm.name`, `farm.producer.name` |
| [src/components/platform/marketplace/MarketplacePage.tsx](../../src/components/platform/marketplace/MarketplacePage.tsx) | Reads real `view: MarketplaceLotsResponse \| null`, picks featured, builds metrics + insights, renders empty / error states |
| [app/platform/marketplace/page.tsx](../../app/platform/marketplace/page.tsx) | Server-side calls `getMarketplaceLotsView()`, passes view + `loadError` props |
| [src/components/platform/marketplace/mock-marketplace-data.ts](../../src/components/platform/marketplace/mock-marketplace-data.ts) | `MarketplaceLot` fields `scaScore`, `harvestYear`, `pricePerKgUsd` are now nullable. `MarketplaceBadge` extended with `exclusive-microlot`, `high-sca`, `marketplace-lot`. `BadgeTone` adds `gold`. Mock arrays kept (unused by production page) |
| [src/components/platform/marketplace/FeaturedLotCard.tsx](../../src/components/platform/marketplace/FeaturedLotCard.tsx) | Null-safe rendering for `harvestYear`, `scaScore`, `pricePerKgUsd` |
| [src/components/platform/marketplace/MarketplaceLotCard.tsx](../../src/components/platform/marketplace/MarketplaceLotCard.tsx) | Same null-safe patches |

### Untouched (verified)

Prisma schema, migrations, contract creation, demand intent service, supply
service, `/api/market`, `/api/contracts/catalog` (doesn't exist yet), shipment
service, EU partner / origin partner dashboards, dev logistics tooling,
pricing formulas, engine/core, CoffeeAssistant.

---

## 2. API route behaviour

### `GET /api/marketplace/lots`

**Auth** — `requireAuth()` (same pattern as [/api/market](../../app/api/market/route.ts)). All authenticated platform users; no role restriction. 401 on missing/invalid token.

**Pipeline** — `buildAllocationSnapshots()` → `decideLotAllocation` per snapshot → `mapDecisionToMarketplaceLot` (filters non-marketplace surfaces) → sort → metrics + insights.

**Filter rule** — a snapshot/decision pair becomes a DTO only if:

```ts
decision.recommendedSurface ∈ { OPEN_MARKETPLACE, EXCLUSIVE_MICROLOT, SPLIT }
&& (decision.marketplaceEligibleGreenKg > 0 || decision.exclusiveMicrolotGreenKg > 0)
```

This explicitly excludes `CONTRACT_CATALOG`, `HOLD`, shipment-bound (engine emits `HOLD + SHIPMENT_ALREADY_RESERVED`), `SOLD`/`DRAFT` (engine emits `HOLD + LOT_ALREADY_SOLD` / `LOT_NOT_PUBLISHED`), and lots without pricing (`HOLD + MISSING_PRICING`).

**Display kg rule**:

```ts
availableDisplayKg = exclusiveMicrolotGreenKg > 0
  ? exclusiveMicrolotGreenKg
  : marketplaceEligibleGreenKg
```

A `SPLIT` lot exposes ONLY its marketplace residual — `contractAssignableGreenKg` is never serialised on the DTO. The mapper test enforces this.

**Sort** — exclusive microlots first, then SCA desc (null SCA last), then `lotNumber.localeCompare`.

**Response shape**:

```jsonc
{
  "lots": [ { /* MarketplaceLotDto */ } ],
  "metrics": {
    "availableLots": 12,
    "avgScaScore": 87.4,
    "origins": 4,
    "freshArrivals": 3
  },
  "insights": {
    "topOriginsByVolume": [ { "label": "Colombia", "volumeKg": 2400, "percentage": 38 } ],
    "freshArrivalsByOrigin": [ { "label": "Ethiopia", "count": 2 } ]
  },
  "generatedAt": "2026-05-08T12:34:56.789Z",
  "policyVersion": "allocation-policy-v0"
}
```

**No pagination, no search, no server-side filters** — non-goals for this sprint.

---

## 3. DTO mapping rules

The DTO carries every field the spec listed plus a few that keep the existing UI shape stable.

| DTO field | Source / rule |
|---|---|
| `id`, `greenLotId`, `lotNumber` | snapshot |
| `name` | `snapshot.name` if present, else `${farmName} ${variety} ${process}`, else `lotNumber` |
| `producerName` | `snapshot.producerName`, fallback `"Producer pending"` |
| `farmName` | `snapshot.farmName`, fallback `"Farm pending"` |
| `originLabel` | `${region}, ${country}` if both, else country, else region, else `"Origin pending"` |
| `country`, `region` | `snapshot.producerCountry`, `snapshot.farmRegion` |
| `process` | TitleCase of Prisma's UPPERCASE string |
| `variety`, `harvestYear`, `scaScore` | snapshot (nullable) |
| `availableGreenKg` | `snapshot.availableGreenKg` (raw lot total available) |
| `availableDisplayKg` | exclusive pool if `> 0`, else marketplace pool |
| `pricePerKg` | `snapshot.greenPricePerKg` (defensive null — engine should have HOLD'd it) |
| `currency` | `snapshot.currency`, fallback `"EUR"` |
| `recommendedSurface` | engine output, narrowed to `OPEN_MARKETPLACE \| EXCLUSIVE_MICROLOT \| SPLIT` |
| `badges[]` | derived: `exclusive-microlot` (if exclusive) → `high-sca` (≥ 86) → `fresh-arrival` (createdAt within 14 days) → `high-traceability` (farm + producer + country present) → `marketplace-lot` (fallback). Always at least one |
| `badgeLabel`, `badgeTone` | first badge's label + tone |
| `traceabilityLabel` | `"Farm traceability"` if all three (farm + producer + country), else `"Traceability pending"` |
| `isExclusive` | `exclusiveMicrolotGreenKg > 0` |
| `isFreshArrival` | `createdAt` within last 14 days |
| `allocation.reasons` | `decision.reasons.map({ code, severity })` — the human-readable `message` is intentionally stripped from the DTO |
| `allocation.confidence` | engine output |
| `visual.gradientKey` / `visualTone` | `TONE_BY_COUNTRY[country]` if known, else hash of `lotNumber` mod 6 (deterministic) |
| `visual.imageUrl` | `null` (no real images yet) |

**Producer phone/email, internal user ids, pricingSnapshot breakdown, demand intent ids and contract ids are explicitly never serialised.** Only `code` + `severity` of allocation reasons are exposed (no message text leak).

---

## 4. UI behaviour

### Page rendering ([app/platform/marketplace/page.tsx](../../app/platform/marketplace/page.tsx))

The server component:

1. Auth + onboarding guard (unchanged).
2. Calls `getMarketplaceLotsView()` directly (no HTTP roundtrip from same-server render).
3. On exception, sets `loadError = true` and continues — the page still renders, the error state replaces the lot grid only.
4. Passes `view` and `loadError` to the client `MarketplacePage`.

### `MarketplacePage` ([src/components/platform/marketplace/MarketplacePage.tsx](../../src/components/platform/marketplace/MarketplacePage.tsx))

1. **DTO → view-model adapter** (`dtoToLot`) converts each `MarketplaceLotDto` to the existing `MarketplaceLot` shape so the visual cards do not need a redesign. Process is TitleCased, badges flow through, gradient is derived from tone, `imageUrl` is null.
2. **Featured pick** — the first exclusive microlot (since the server already sorts them first); if none, the highest-SCA lot (also already at the top).
3. **Grid** — every other lot in sort order.
4. **Empty state** — when `view.lots.length === 0`, shows "No marketplace lots available yet" inside the centre column. Hero/toolbar/sidebar/insights still render.
5. **Error state** — when `loadError`, shows "Unable to load marketplace lots". Same layout preserved.
6. **Hero metrics** — built from real `metrics`. When metrics are absent or `view` is null, an `EMPTY_METRICS` array shows zeros / em-dash. **No "412 lots" hardcoded fallback.**
7. **Insights** — top origins + fresh arrivals come from real data with real flag emojis. The 30-day price sparkline is intentionally **empty** (we do not yet have a time series and the spec forbids mock values). The price-trend badge above the empty sparkline shows the average `pricePerKg` across marketplace lots, which is a real number — the label adjusts to "Avg across N marketplace lots".
8. **Toolbar / sidebar** — visual-only this sprint, untouched. Their counts still come from the (now isolated) mock filter arrays. ALLOC-4+ wires real filters.

### Visual design

The card / hero / panel / sidebar visuals are unchanged — the only edits are null-safe display fallbacks (`scaScore`, `harvestYear`, `pricePerKgUsd` show `—` when null) and the new `gold` badge tone for exclusive microlots.

### Mock data

[mock-marketplace-data.ts](../../src/components/platform/marketplace/mock-marketplace-data.ts) is **not deleted** — it still exports types, the new badge labels/tones, and the filter arrays the sidebar references. The fixture arrays (`MARKETPLACE_LOTS`, `FEATURED_LOT`, `MARKETPLACE_METRICS`, `MARKETPLACE_INSIGHTS`) are no longer imported by the production page.

---

## 5. Tests added / commands run

### Tests

19 new tests in [marketplaceLot.mapper.test.ts](../../src/services/allocation/__tests__/marketplaceLot.mapper.test.ts):

```
▶ mapDecisionToMarketplaceLot — OPEN_MARKETPLACE
  ✔ maps marketplaceEligibleGreenKg as availableDisplayKg
  ✔ uses lot.name when present, builds composite otherwise
▶ mapDecisionToMarketplaceLot — EXCLUSIVE_MICROLOT
  ✔ uses exclusiveMicrolotGreenKg as availableDisplayKg, isExclusive true
▶ mapDecisionToMarketplaceLot — SPLIT
  ✔ exposes marketplace residual only, never contract assignable
▶ mapDecisionToMarketplaceLot — filter
  ✔ returns null for CONTRACT_CATALOG
  ✔ returns null for HOLD even if marketplace kg is non-zero
  ✔ returns null for surface CONTRACT_CATALOG
  ✔ returns null for surface HOLD
  ✔ returns null when both pools are zero
▶ mapDecisionToMarketplaceLot — visual
  ✔ imageUrl is null in v0 (no real images yet)
  ✔ known producer countries map to a stable visual tone
  ✔ unknown countries fall back to a stable hash on lotNumber
▶ computeMarketplaceMetrics
  ✔ counts lots, computes avg SCA, counts origins, counts fresh arrivals
  ✔ avgScaScore is null when no lot has a score
  ✔ does not count Unknown country toward origins
▶ computeMarketplaceInsights
  ✔ groups marketplace volume by country and computes percentages
  ✔ freshArrivalsByOrigin counts only fresh lots
▶ sortMarketplaceLots
  ✔ places exclusive microlots first, then sorts by SCA desc, then by lotNumber
▶ mapDecisionToMarketplaceLot — allocation reasons
  ✔ forwards reason codes and severities only (no message text leaks)
```

### Commands

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:allocation` | ✅ **72 / 72 pass** in ~0.8 s — 12 golden + 4 invariants + 18 partition + 19 mapper (snapshot) + 19 mapper (marketplace) |
| `npm run build` | ✅ Next.js build green; new route `/api/marketplace/lots` registered as dynamic Node route; `/platform/marketplace` recompiled |

---

## 6. Known limitations

1. **No 30-day price trend.** The insights panel renders without the sparkline; the price badge shows the current average across marketplace lots. A `MarketSignalSnapshot` time series is needed before we can plot a trend.

2. **Toolbar and filter sidebar are still visual-only.** The pill counts come from `mock-marketplace-data.ts` constants. Wiring real counts requires real filter logic, which is a non-goal of this sprint.

3. **Pagination is not implemented.** All marketplace lots come back in one response. With a small lot table this is fine; once the platform crosses ~100 marketplace-eligible lots a `?cursor=` parameter and a slice in the service will be needed.

4. **`pricePerKg` currency is whatever the lot stored.** The DTO carries `currency` per lot, but the UI shows `$` regardless (matches existing visual). Multi-currency display is a non-goal here.

5. **Featured-lot rule is "first sorted".** The server already ranks exclusive microlots first, so the page picks the top entry. There's no manual "this is THE featured lot" override.

6. **Visual tone palette is static.** Colombia is always sunrise, Ethiopia always forest, etc. Unknown countries hash to one of six tones based on `lotNumber`. Stable, but not editorially curated. No image upload pipeline yet — `imageUrl` is hard-coded to `null`.

7. **Allocation reasons are exposed in the DTO** (codes + severities only, no message text). They are not currently rendered by any component, but downstream UI work could surface them. This was a deliberate choice in the spec ("v1 okay to include allocation.reasons in DTO if not rendered").

8. **No empty-state for insights panel.** The panel always renders; when there are no lots, top-origins and fresh-arrivals lists are empty (`<ul>` with no `<li>`), the sparkline is silently null, and the trend label flips to "Price trend not available yet". Components handle the empty arrays gracefully without changing layout.

9. **`view` is fetched on every server render.** `dynamic = "force-dynamic"` is preserved, so each navigation re-runs the three Prisma queries. With the snapshot service's batched query model this is acceptable; if marketplace traffic grows we can introduce a 30-second cache layer in `marketplaceView.service.ts`.

10. **Process strings narrowed via lookup.** Anything outside `WASHED|NATURAL|HONEY|ANAEROBIC|Washed|Natural|Honey|Anaerobic` falls back to `"Washed"` in the view-model adapter. Prisma's enum guarantees this is unreachable in practice.

---

## 7. Next recommended sprint — ALLOC-4

Wire the **client trading desk's contract catalog** to allocation decisions, in
parallel with marketplace, but using `contractAssignableGreenKg` as the
selectable green-kg ceiling and keeping marketplace residual completely
separate.

Concrete scope:

1. New route `app/api/contracts/catalog/route.ts` — `requireAuth()`, calls
   `buildAllocationSnapshots()` → `decideLotAllocation` per snapshot, filters
   to:
   ```ts
   decision.recommendedSurface ∈ { CONTRACT_CATALOG, SPLIT }
   && decision.contractAssignableGreenKg >= policy.minMarketplaceKg
   ```
2. New mapper `src/services/allocation/contract-catalog/contractCatalogLot.mapper.ts`
   producing a DTO with `contractAssignableGreenKg` and `committedContractGreenKg`
   visible — never the marketplace residual.
3. Migrate [Dashboard.tsx](../../src/components/platform/client/Dashboard.tsx) to
   read `/api/contracts/catalog` instead of `/api/market`. Confirm the
   `selectedLotId` selector only sees contract-assignable lots.
4. Keep `/api/market` running for one more sprint until parity is verified;
   then deprecate it.
5. Internal admin allocation inspector (ALLOC-5) becomes the natural follow-up
   — re-uses both routes' DTOs to render a "split view" of every lot.

**Non-goals for ALLOC-4**: no schema changes, no contract-creation logic
change, no admin UI, no persistence of decisions.
