# DEV-CONTRACTS-1 / CLIENT-DASHBOARD-DATA-1

Sprint scope: dev-only contract scenario factory + catalog-first
client dashboard layout when the user has no contract activity.

No Prisma schema change. No real contract creation semantics change.
No emails. No Stripe. No real signature/OTP side effects. No allocation
engine / pricing / target-table changes.

---

## 1. Purpose

`/dev/scenarios/lots` already produced deterministic dev lots. The
client dashboard was hard to validate visually because:

- there was no separate way to seed Contract / DemandIntent state,
  so portfolio cells were always zero or contaminated by ad-hoc real
  contracts,
- the empty-portfolio state buried the catalog underneath dead KPI
  rows,
- there was no clean reset boundary for dev contract data.

DEV-CONTRACTS-1 fixes the data side:

1. **Seed lots** (already existed) — creates dev lots only.
2. **Seed contracts** (this sprint) — explicit operator action;
   creates dev Contract / DemandIntent rows against existing dev lots.
3. **Reset contracts** (this sprint) — removes only dev-generated rows.

CLIENT-DASHBOARD-DATA-1 fixes the layout side: when there's no client
activity, the dashboard moves the catalog strip up and renders the
portfolio panel beneath it instead of leaving it as a 2-column dead
block.

---

## 2. Files changed

### Created — service + tests

| Path | Role |
|---|---|
| [src/services/dev/scenarios/devContractScenario.types.ts](../../src/services/dev/scenarios/devContractScenario.types.ts) | Scenario kinds + per-scenario spec (`getDevContractScenarioSpec`) + `DevContractScenarioError`. Pure data; no Prisma. |
| [src/services/dev/scenarios/devContractScenario.pure.ts](../../src/services/dev/scenarios/devContractScenario.pure.ts) | `sortEligibleContractLots`, `pickEligibleLotsForContractScenario`, `buildDevContractPayload`, `resolveDevContractRoastYield`, `hasClientActivity`. |
| [src/services/dev/scenarios/devContractScenario.service.ts](../../src/services/dev/scenarios/devContractScenario.service.ts) | `seedContractScenario`, `resetContractScenarios`, `listContractScenarioStatus`. Ensures dev `User + Company`, loads eligible dev lots, applies dev pricing via persisted `clientB2BPricePerKg`, writes Contract / DemandIntent / cascades on reset. |
| [src/services/dev/scenarios/__tests__/devContractScenario.test.ts](../../src/services/dev/scenarios/__tests__/devContractScenario.test.ts) | 26 pure tests (kinds + spec, sort/pick, yield/conversion, payload builder, `hasClientActivity`). |

### Created — API

| Path | Role |
|---|---|
| [app/api/dev/scenarios/contracts/seed/route.ts](../../app/api/dev/scenarios/contracts/seed/route.ts) | `POST` — runs the scenario; resets dev contracts then writes the new ones. |
| [app/api/dev/scenarios/contracts/reset/route.ts](../../app/api/dev/scenarios/contracts/reset/route.ts) | `POST` — removes only dev contract company rows + dev-lot-bound demand intents. |
| [app/api/dev/scenarios/contracts/status/route.ts](../../app/api/dev/scenarios/contracts/status/route.ts) | `GET` — counts + last 10 contracts + last 10 intents on the dev company. |

All three guarded by `requireDevRoute({ requireUser: true })`.

### Created — UI

| Path | Role |
|---|---|
| [app/dev/scenarios/contracts/page.tsx](../../app/dev/scenarios/contracts/page.tsx) | Shell. |
| [src/components/dev/scenarios/DevContractScenarioPanel.tsx](../../src/components/dev/scenarios/DevContractScenarioPanel.tsx) | Cream/beige dev panel: scenario select, optional seed, **Seed contracts** + **Reset dev contracts** controls, last-result summary (lots used), current status table (recent contracts + demand intents). |

### Modified

| Path | Change |
|---|---|
| [src/components/platform/client/Dashboard.tsx](../../src/components/platform/client/Dashboard.tsx) | Imports `hasClientActivity` and pivots the main grid: when **false**, `SupplyDeskPanel` → `ContractCatalogStrip` → `ContractPortfolioPanel` (catalog-first); when **true**, keeps the existing 2-col `SupplyDeskPanel | ContractPortfolioPanel` followed by the strip. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace
UI, contract creation / amend service, demand intent production
service, `Contract.lockedPricePerKg`, `DemandIntent.previewPricePerKg`,
`PricingSnapshot.clientB2BPricePerKg`, FEED-1/1B/2A/2B/2C/3A/3B/3C,
partner manual route, dev lot scenario factory, CoffeeAssistant.

---

## 3. Contract scenario factory behaviour

### Scenarios (deterministic)

| Kind | Contracts | Intents | Effect |
|---|---|---|---|
| `empty_contracts` | 0 | 0 | Resets the dev contract company; leaves all lots / catalog / pricing untouched. |
| `one_pending_signature` | 1 (`AWAITING_SIGNATURE`) | 0 | Pending signature KPI = 1. |
| `one_active_contract` | 1 (`ACTIVE`, 12-mo, monthly = 600 kg roasted) | 0 | Hero + portfolio populate; catalog still visible. |
| `mixed_contract_portfolio` | 4 (`ACTIVE` + `AWAITING_SIGNATURE` + `PAYMENT_PENDING` + `COMPLETED`) | 0 | Portfolio cells light up; supply contracts panel shows the active row. |
| `demand_intent_pending` | 0 | 1 (`OPEN`, 250 kg roasted) | Pending Requests KPI = 1 with no signed contract yet. |

### Pricing

Each dev contract locks at `clientB2BPricePerKg` from the lot's
`PricingSnapshot` (PRICING-B2B-3). When that's missing, the dev
factory falls back to `computeRoastedPrice(clientPricePerKg, yield)`
— mirroring the production `resolveClientB2BPriceForLot` rule. No
silent zero. No silent clamp.

Volumes: `monthlyVolumeKg` is roasted, `monthlyGreenKg` is derived
from the lot's resolved `roastYield`. `pricePerBag`, `bagsPerDelivery`
and `monthlyPrice` follow the production formulas.

### Eligible lot selection

Pure helper `pickEligibleLotsForContractScenario(scenario, lots)`:

1. Sort lots: SCA desc → `clientB2BPricePerKg` desc → `lotNumber` asc.
2. Slice top `spec.contracts.length + spec.demandIntents.length`.
3. If not enough eligible lots, return a clear error pointing the
   operator at `/dev/scenarios/lots`. The route maps that to **409**.

A lot is eligible when:
- `status === "PUBLISHED"`
- `lotNumber` starts with `DEV-SCENARIO-`
- a `PricingSnapshot` row exists for the lot

### Identification

The factory uses a dedicated dev client:

- `User.email = "client.contract-scenarios@alturacollective.test"`
- `Company.name = "[DEV] Contract Scenarios Company"`
- `Company.country = "TEST"`

`ensureDevContractClient` creates them if missing and idempotently
links the user to the company. All dev contracts and intents are
written under that company, so reset can identify them with a single
`companyId` filter.

---

## 4. Reset boundaries

`resetContractScenarios()` operates inside one Prisma transaction.
Defensive: only rows tied to the dev company **AND** referencing a
`DEV-SCENARIO-` lot (or with no lot link) are removed. Off-spec rows
trigger a warning but are **left intact**.

Delete order (FK-safe):

1. `DemandIntent` linked to dev contracts.
2. `DemandIntent` owned by the dev company with no contract (standalone
   intents on dev lots).
3. `SignatureToken` for dev contracts.
4. `Order` for dev contracts (defensive — dev factory never creates
   orders, but real seeds might).
5. `Contract` rows themselves.

**Never deleted:**

- `GreenLot`, `PricingSnapshot`, `Farm`, `Producer`, `User` rows.
- `MarketSignalSnapshot`, `MarketSignalTick`.
- Any contracts / intents on companies other than the dev one.
- Marketplace lots / catalog rows.

Return shape: `{ contractsDeleted, demandIntentsDeleted, signatureTokensDeleted, ordersDeleted, warnings[] }`.

---

## 5. Client dashboard state / layout

```ts
hasActivity =
  activeContracts > 0
  || pendingSignatureContracts > 0
  || pendingPaymentContracts > 0
  || pendingRequests > 0
```

When `hasActivity === true` (default for clients with portfolio):
```
[SupplyDeskPanel | ContractPortfolioPanel]   (2-col grid)
[ContractCatalogStrip]
[Sourcing · SupplyContracts · NeedHelp]
```

When `hasActivity === false` (empty client, catalog-first):
```
[SupplyDeskPanel (full width)]
[ContractCatalogStrip]
[ContractPortfolioPanel (full width, mostly zeros)]
[Sourcing · SupplyContracts · NeedHelp]
```

The hero KPIs render in both modes — they're cheap and contextual.
The bottom row of trust cards is unchanged.

No new copy / no global label changes were necessary for this sprint:
the Portfolio panel already labels global figures
(`Available Supply`, `Published Lots`) in a way that reads as catalog
context. Catalog-first reorder makes the empty state visually correct
without renaming anything.

---

## 6. Tests added

`npm run test:allocation` — **556/556 pass** (26 new over the 530
baseline).

All new tests live in
[devContractScenario.test.ts](../../src/services/dev/scenarios/__tests__/devContractScenario.test.ts):

- **Kind guards + spec** (6): all five scenario kinds round-trip,
  unknowns rejected, `empty_contracts` has no work, `one_active_contract`
  / `one_pending_signature` have exactly one contract with the right
  status, `mixed_contract_portfolio` carries `ACTIVE + AWAITING_SIGNATURE + PAYMENT_PENDING + COMPLETED`,
  `demand_intent_pending` carries one `OPEN` intent.
- **Sort + pick** (6): SCA desc → price desc → lotNumber asc; null
  SCA/price lowest priority; input array untouched; `empty_contracts`
  picks 0; `one_active_contract` picks top; `mixed_contract_portfolio`
  picks 4; insufficient lots returns a clear "seed lots first" message.
- **Yield + conversion** (5): `resolveDevContractRoastYield` uses
  estimated, falls back to process default, clamps to `[0.5, 1.0]`;
  `roastedToGreenLocal` uses yield floor.
- **Payload builder** (3): `monthlyVolumeKg` roasted →
  `monthlyGreenKg` via yield; ACTIVE recipe sets `nextExecution`;
  AWAITING_SIGNATURE leaves it null; backdated `startDate` honoured.
- **`hasClientActivity`** (4): false when all zero; true when any
  bucket is non-zero (active, pending sig, pending payment,
  pending requests); tolerates partial objects.

Test file is picked up by the existing `test:allocation` glob
(`src/services/dev/scenarios/__tests__/*.test.ts`).

---

## 7. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **556 / 556 pass** |
| `npm run build` | ✓ Compiled successfully — `/api/dev/scenarios/contracts/{seed,reset,status}` and `/dev/scenarios/contracts` in the manifest |

No migrations. No `prisma generate`. No new dependencies.

---

## 8. Manual validation steps

1. `/dev/scenarios/lots` → **Reset** → seed `marketplace_mix` (or any
   catalog-eligible preset). Confirms `/api/contracts/catalog` returns
   rows.
2. `/platform/client` (no client activity yet):
   - Layout pivots to **catalog-first**: SupplyDesk full-width →
     ContractCatalogStrip → ContractPortfolioPanel (mostly zeros).
3. `/dev/scenarios/contracts`:
   - Pick **5. Demand intent pending** → **Seed contracts**.
4. `/platform/client`:
   - `Pending Requests` KPI in the hero increments to 1.
   - Layout flips to **portfolio-side**: 2-col grid with SupplyDesk +
     ContractPortfolio at top; catalog strip below.
5. `/dev/scenarios/contracts` → **Reset dev contracts** → seed
   **3. One active contract**.
6. `/platform/client`:
   - `Active Contracts` KPI = 1; Monthly Volume populated.
   - SupplyContracts panel shows the active contract.
   - Catalog still visible below.
7. Reset → seed **4. Mixed contract portfolio**. Portfolio cells
   light up across `Active / Pending Signature / Pending Payment`.
8. Final reset → confirms `/api/contracts/catalog` is unaffected and
   `/platform/marketplace` keeps working.
9. Inspect Prisma Studio:
   - Only the `[DEV] Contract Scenarios Company` carries the
     dev-generated contracts and intents.
   - Reset removed `Contract`, `DemandIntent`, `SignatureToken` and
     any `Order` rows for the dev company — nothing else.

---

## 9. Known limitations

- **No real Request Contract CTA yet.** Catalog cards still carry the
  disabled `Request contract soon` button.
- **No signature / OTP flow** triggered by dev seeding.
- **No Stripe / payment side effects.** `PAYMENT_PENDING` is a static
  status string.
- **No shipment / fulfilment timeline** beyond
  `Contract.nextExecution`. Dev contracts don't create `Shipment` or
  `ProducerFulfilment` rows.
- **Dev contracts are clearly synthetic** — tied to a dedicated dev
  company, never to a real user's company.
- **Dashboard still uses placeholder thumbnails** for catalog cards;
  unaffected by this sprint.
- **Reset is "delete all rows owned by the dev company".** If a real
  user is ever assigned to that company by mistake, their contracts
  would be at risk — the company name and email are documented
  precisely to prevent that.
- **No CSV export** of dev contract data (Prisma Studio is enough).

---

## 10. Recommended next sprint

1. **CONTRACT-REQUEST-1** — activate the `Request contract` CTA on
   `ContractCatalogStrip` / `ContractCatalogPanel`, wiring it into
   the existing demand intent / contract request flow. With DEV-CONTRACTS-1
   in place, the new end-to-end can be reproduced deterministically
   from a fresh state.
2. **CLIENT-DASHBOARD-POLISH-2** — catalog-first visual polish now
   that data states are clean (heading "Coffee for monthly contracts"
   could surface higher; KPI strip could collapse on the empty path).
3. **CLIENT-NAV-1** — vertical sidebar dashboard navigation if the
   original mock target is still on the roadmap.
