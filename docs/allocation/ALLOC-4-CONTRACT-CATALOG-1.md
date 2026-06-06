# ALLOC-4 / CONTRACT-CATALOG-1 — Client dashboard monthly contract catalog

Sprint scope: read-only contract catalog surface inside the client dashboard.
The marketplace already shows one-off lots; this sprint exposes the other half
of the allocation flow — lots reserved for **recurring monthly contracts**.

No Prisma changes. No allocation/pricing/contract behaviour changes. No
write paths. No persistence of B2B price.

---

## 1. Purpose

`/api/marketplace/lots` already exists and shows `marketplaceEligibleGreenKg` /
`exclusiveMicrolotGreenKg`. The contract side of the allocation engine
(`contractAssignableGreenKg`) had **no client-facing surface** — buyers could
not see lots flagged for monthly contract supply.

This sprint creates that surface as a **read-only** catalog.

---

## 2. Files changed

### Created

| Path | Role |
|---|---|
| [src/services/allocation/contracts/contractCatalog.mapper.ts](../../src/services/allocation/contracts/contractCatalog.mapper.ts) | Pure mapper: snapshot+decision → `ContractCatalogLotDto`, sort, metrics. |
| [src/services/allocation/contracts/contractCatalogView.service.ts](../../src/services/allocation/contracts/contractCatalogView.service.ts) | Orchestrator: snapshots → engine → mapper → sorted view. Mirrors `marketplaceView.service.ts`. |
| [app/api/contracts/catalog/route.ts](../../app/api/contracts/catalog/route.ts) | `GET /api/contracts/catalog` (auth: `requireAuth`). |
| [src/services/allocation/contracts/__tests__/contractCatalog.mapper.test.ts](../../src/services/allocation/contracts/__tests__/contractCatalog.mapper.test.ts) | 26 pure tests for mapper, sort, metrics. |
| [src/components/platform/client/ClientContractCatalogPanel.tsx](../../src/components/platform/client/ClientContractCatalogPanel.tsx) | Dark-themed dashboard panel with lot grid + indicative price + disabled CTA. |

### Modified

| Path | Change |
|---|---|
| [src/components/platform/client/Dashboard.tsx](../../src/components/platform/client/Dashboard.tsx) | Renders `<ClientContractCatalogPanel />` in the left column under `ClientTradingPanel`. |
| [package.json](../../package.json) | `test:allocation` glob now also runs `src/services/allocation/contracts/__tests__/*.test.ts`. |
| [tsconfig.json](../../tsconfig.json) | Tooling hotfix — `ignoreDeprecations` set to `"5.0"` (TS 5.9.3 only accepts that value to silence the upcoming `baseUrl` deprecation). |

### Untouched (verified)

Prisma schema, migrations, marketplace UI, marketplace pricing engine,
allocation engine, contract creation, demand intent service, supply service,
shipment / logistics tooling, EU partner / origin partner dashboards,
CoffeeAssistant, Stripe, dev logistics simulator, `/api/market`,
`ClientTradingPanel`.

---

## 3. API

### Route

`GET /api/contracts/catalog` — `runtime: nodejs`, `dynamic: force-dynamic`,
auth: `requireAuth`.

### Response

```ts
{
  generatedAt: string                  // ISO-8601
  policyVersion: string                // allocation policy version
  count: number
  lots: ContractCatalogLotDto[]
  metrics: ContractCatalogMetrics
}
```

### `ContractCatalogLotDto`

| Field | Source / meaning |
|---|---|
| `id`, `lotNumber`, `name` | snapshot identity / display |
| `producerName`, `farmName`, `region`, `country` | snapshot |
| `process`, `variety`, `harvestYear`, `scaScore`, `altitude` | snapshot |
| `roastYield`, `currency` | snapshot (currency defaults to EUR) |
| `totalGreenKg`, `availableGreenKg` | snapshot |
| `contractAssignableGreenKg` | **decision.contractAssignableGreenKg** — never marketplace residual |
| `contractAssignableRoastedKg` | `contractAssignableGreenKg × roastYield` |
| `committedContractGreenKg`, `committedContractMonthlyGreenKg`, `committedContractHorizonGreenKg`, `reservedIntentGreenKg` | snapshot, audit only |
| `recommendedSurface` | `"CONTRACT_CATALOG"` or `"SPLIT"` |
| `viableProfiles` | engine.viableProfiles (profileId, monthsCovered, coversTypicalConsumption) |
| `bestProfileId`, `maxMonthsCovered` | derived: highest `monthsCovered` among profiles that cover typical consumption (else fallback to highest overall) |
| `indicativeMonthlyRoastedKg`, `indicativeCoverageMonths` | derived from best profile, in roasted kg |
| `pricePerKgRoasted` | adaptive target-anchored marketplace pricing (indicative — not persisted) |
| `pricingMode`, `commercialModel`, `marketTarget` | metadata from the same pricing helper |
| `badges` | derived: `contract-ready`, `split-lot`, `high-sca`, `high-altitude`, `limited-contract-pool` |
| `reasons` | engine reasons (code, severity, message) |

### `ContractCatalogMetrics`

```ts
{
  totalLots: number
  totalAssignableGreenKg: number
  totalAssignableRoastedKg: number
  avgScaScore: number | null
  origins: Array<{ country, roastedKg, percentage }>
  topProfiles: Array<{ profileId, lots }>
}
```

---

## 4. Filtering rules

A snapshot+decision pair maps to a DTO **only if** all of the following hold:

1. `decision.recommendedSurface ∈ {"CONTRACT_CATALOG", "SPLIT"}`.
2. `decision.contractAssignableGreenKg > 0`.
3. `snapshot.greenPricePerKg != null` (a row without a base price is not
   actionable; the engine emits `MISSING_PRICING` reason for these).

Anything else is excluded (returns `null`):

- `HOLD`
- `OPEN_MARKETPLACE` only
- `EXCLUSIVE_MICROLOT` only
- Lots with zero contract assignable kg
- Lots without pricing

---

## 5. Distinction vs marketplace

| Surface | Pool field | Volume field on DTO | Lives in |
|---|---|---|---|
| Marketplace one-off | `marketplaceEligibleGreenKg` or `exclusiveMicrolotGreenKg` | `marketplaceGreenKg` / `marketplaceRoastedKg` | `marketplaceLot.mapper.ts` |
| Contract catalog | `contractAssignableGreenKg` | `contractAssignableGreenKg` / `contractAssignableRoastedKg` | `contractCatalog.mapper.ts` |

A `SPLIT` lot can appear in **both** surfaces — the marketplace mapper exposes
its residual marketplace pool, this catalog exposes its contract assignable
pool. They are intentionally separate fields and the test suite asserts that
the contract DTO never echoes `marketplaceEligibleGreenKg` /
`exclusiveMicrolotGreenKg`.

`EXCLUSIVE_MICROLOT` lots are excluded from the contract catalog — the engine
does not normally assign `contractAssignableGreenKg > 0` to them, but the
filter is defensive in case it ever does.

---

## 6. Sorting

Deterministic order designed to surface volume-reliable lots first:

1. `recommendedSurface = CONTRACT_CATALOG` before `SPLIT`.
2. Higher `contractAssignableRoastedKg` first.
3. Higher `scaScore` first.
4. `lotNumber` ascending (stable tie-break).

Rare microlots are intentionally NOT sorted to the top here — they belong
to the marketplace/exclusive surface.

---

## 7. Pricing caveat (read-only boundary)

`pricePerKgRoasted` reuses the **same** target-anchored adaptive pipeline the
marketplace uses (`calculateMarketplaceB2BPricing`). The displayed price will
not diverge between surfaces for the same lot.

But:

- This price is **not persisted** anywhere — it is computed at read time only.
- Contracts are still signed on the legacy green-price + yield path (this is
  a known divergence; see `PRICING-B2B-3`).
- The UI labels the value as **"Indicative B2B price"** and the CTA
  ("Request contract soon") is **disabled with `cursor: not-allowed`** and
  a `title` tooltip stating the request flow is not enabled yet.
- No `/api/contracts` write path is invoked.
- No `DemandIntent` is created.
- No Stripe.

---

## 8. UI

- New `ClientContractCatalogPanel` rendered in the **left column** of the
  client dashboard, **below** `ClientTradingPanel` and above
  `SourcingRelationshipCard`.
- Dark palette consistent with the rest of `/platform/client`.
- Title: **"Coffee for monthly contracts"**.
- Subtitle: **"These lots are reserved for recurring roasted coffee supply.
  Contract requests are not enabled yet — this catalog is read-only while
  pricing is being persisted into contracts."**
- Metric strip: lots in catalog, total assignable roasted kg, avg SCA score.
- Card grid (responsive `auto-fill, minmax(280px, 1fr)`):
  variety, process, SCA, altitude, harvest year, contract pool,
  assignable green, est. coverage, indicative B2B price, badges, disabled CTA.
- Empty state: friendly copy + link to `/platform/marketplace`.
- Error state: short message + the underlying error string.

`/api/market` and `ClientTradingPanel` are intentionally untouched.

---

## 9. Tests

`npm run test:allocation` adds new tests in
`src/services/allocation/contracts/__tests__/contractCatalog.mapper.test.ts`:

- CONTRACT_CATALOG decision → DTO with correct kg fields.
- altitude propagation (number and `null`).
- `[DEV]` prefix stripped from `farmName`.
- viableProfiles preserved; `bestProfileId` / `maxMonthsCovered` /
  `indicativeMonthlyRoastedKg` derived correctly (covering vs non-covering).
- Reasons preserved (code + severity + message).
- Price/pricingMode are null when no producer engine is injected.
- Badges (`contract-ready`, `split-lot`, `high-sca`, `high-altitude`,
  `limited-contract-pool`).
- SPLIT decision uses `contractAssignableGreenKg`, never marketplace residual.
- DTO never exposes `marketplaceEligibleGreenKg` / `exclusiveMicrolotGreenKg`.
- Excluded surfaces (`OPEN_MARKETPLACE`, `EXCLUSIVE_MICROLOT`, `HOLD`) → `null`.
- Zero contract pool → `null`. Missing `greenPricePerKg` → `null`.
- Sort: CONTRACT_CATALOG before SPLIT, then roastedKg desc, then SCA desc,
  then lotNumber asc.
- Metrics: totals, country grouping with percentages, avg SCA, top profiles.

Existing 261 tests are unaffected.

---

## 10. Manual validation

1. Reset dev scenarios (`/dev/scenarios/lots` → **Reset**).
2. Seed `1. Allocation engine decides`, target `published`.
3. Open `/api/internal/allocation/run` — confirm there are decisions with
   `recommendedSurface = "CONTRACT_CATALOG"` or `"SPLIT"`.
4. Open `/api/contracts/catalog`. Confirm:
   - No `HOLD` decisions.
   - No `EXCLUSIVE_MICROLOT`-only or `OPEN_MARKETPLACE`-only lots.
   - `SPLIT` rows show `contractAssignableGreenKg`, never marketplace residual.
5. Open `/platform/client`. Confirm a new section **"Coffee for monthly
   contracts"** with cards showing altitude, SCA, assignable roasted kg,
   indicative price, and a disabled "Request contract soon" CTA.
6. Open `/platform/marketplace`. Confirm marketplace still works and shows
   the opposite surface (residuals + exclusive microlots).
7. Optional: seed `5. Large split lots`. Confirm `/api/contracts/catalog`
   shows large assignable pools and marketplace shows residuals — no
   double-counting between surfaces.

---

## 11. Known limitations

- **Contract creation still uses old pricing** — the catalog price is
  indicative; signed contracts are priced via the legacy green/yield helper
  until `PRICING-B2B-3` persists `clientB2BPricePerKg`.
- **This catalog is read-only.** No `/api/contracts` writes, no demand
  intents, no Stripe.
- **No filters / search / pagination yet.** Lots are returned in the order
  defined by `sortContractCatalogLots`.
- **`/api/market` remains untouched.** `ClientTradingPanel` is unchanged.
- **No persistence of the indicative B2B price** — it is recomputed per
  request from snapshot + producer engine + market signal.
- **No admin overrides** for catalog inclusion.

---

## 12. Recommended next sprint

**PRICING-B2B-3** — persist `clientB2BPricePerKg` and rewire contracts +
demand intents so the price displayed in marketplace/contract catalog is the
exact value a buyer signs at. This is the missing link between the read
surface created in ALLOC-4 and the existing contract-creation write path.
