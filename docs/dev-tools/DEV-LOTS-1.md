# DEV-LOTS-1 — Real DB Lot Scenario Factory

Sprint scope: a dev-only tool that creates real `ProducerLotDraft` +
`GreenLot` + `PricingSnapshot` rows in two stages (PUBLISHED, optionally
shipped to `RECEIVED_BY_CLIENT`). No schema changes. No production behaviour
changes. No semaphore / risk simulator.

---

## 1. Files created / changed

### Created

| Path | Role |
|---|---|
| [src/services/dev/scenarios/devLotScenario.types.ts](../../src/services/dev/scenarios/devLotScenario.types.ts) | Types, validators, recipe presets, `pickRecipes`, `clampCount` |
| [src/services/dev/scenarios/devScenarioActors.service.ts](../../src/services/dev/scenarios/devScenarioActors.service.ts) | `ensureDevScenarioActors` — idempotent User + Producer + 5 farms |
| [src/services/dev/scenarios/devLotScenario.service.ts](../../src/services/dev/scenarios/devLotScenario.service.ts) | `seedDevScenario`, `listDevScenarioData`, `resetDevScenarios` |
| [app/api/dev/scenarios/lots/route.ts](../../app/api/dev/scenarios/lots/route.ts) | `GET` summary |
| [app/api/dev/scenarios/lots/seed/route.ts](../../app/api/dev/scenarios/lots/seed/route.ts) | `POST` seed |
| [app/api/dev/scenarios/lots/reset/route.ts](../../app/api/dev/scenarios/lots/reset/route.ts) | `POST` reset |
| [app/dev/scenarios/lots/page.tsx](../../app/dev/scenarios/lots/page.tsx) | UI shell |
| [src/components/dev/scenarios/DevLotScenarioPanel.tsx](../../src/components/dev/scenarios/DevLotScenarioPanel.tsx) | Client controls + table |
| [src/services/dev/scenarios/__tests__/devLotScenario.test.ts](../../src/services/dev/scenarios/__tests__/devLotScenario.test.ts) | 21 pure tests for validators + presets |

### Modified

| Path | Change |
|---|---|
| [package.json](../../package.json) | `test:allocation` glob now also runs `src/services/dev/scenarios/__tests__/*.test.ts` |

### Untouched (verified)

Prisma schema, migrations, marketplace UI logic, contract creation, demand
intent service, supply service, pricing formulas, shipment production routes,
EU partner / origin partner dashboards, dev logistics tooling, engine/core,
CoffeeAssistant.

---

## 2. Scenario presets implemented

| Order | Scenario | Default | Max | Recipes |
|---|---|---|---|---|
| 1 | `allocation_engine_decides` | **10** | 10 | Boundary set: 1450/1550/2500/1800/1200/350/7000/28000/4000/900 kg lots, varieties from Castillo/Caturra/Bourbon/Pink Bourbon/Geisha, SCA 81–91 |
| 2 | `marketplace_mix` | 8 | 8 | 250–900 kg lots — small premiums and short-volume residuals |
| 3 | `contract_catalog_mix` | 8 | 8 | 5 000–20 000 kg lots — recurring-contract candidates |
| 4 | `exclusive_microlots` | 8 | 8 | 200–400 kg lots, all rare varieties (Geisha, Pink Bourbon, Wush Wush, Sudan Rume) |
| 5 | `large_split_lots` | 8 | 8 | 22 000–35 000 kg lots — surfaces SPLIT decisions |
| 6 | `logistics_ready` | 8 | 8 | 800–1 800 kg lots, mid-volume — ideal for shipment + tracking |
| 7 | `stress_25_lots` | 25 | 25 | Mixed dataset of all categories for UI density / engine throughput |

**Recipes describe lot SHAPES, not allocation outcomes.** No surface is
pre-decided — the engine reads the seeded lots from the DB and classifies
them through `/api/internal/allocation/run`.

### Recipe shape (per lot)

| Field | Source |
|---|---|
| `farmKey` | one of 5 dev farms |
| `variety` | string (matches `ProducerLotDraft.variety`) |
| `process` | `WASHED` / `NATURAL` / `HONEY` / `ANAEROBIC` |
| `harvestYear` | 2026 (override per-recipe) |
| `greenKg` | total green kg (used for `totalKg = availableKg = estimatedGreenKg`) |
| `parchmentKg` | `greenKg / conversionRate`, rounded |
| `conversionRate` | 0.8 |
| `scaScore` | 81–92 |
| `estimatedRoastYield` | matches `src/lib/roastYield.ts` defaults per process |
| `pricePerKg` | EUR/green kg, deterministic from `5 + (sca − 80)·0.6 + rare bonus` |

### Pricing snapshot

| `producerPricePerKg` | `clientPricePerKg × 0.6` |
| `clientPricePerKg` | `recipe.pricePerKg` |
| `marginPerKg` | `clientPricePerKg − producerPricePerKg` |
| `pricingVersion` | `"dev-scenario-v1"` |
| `breakdown` | `{ source: "DEV_SCENARIO_FACTORY", scenario }` |
| `context` | farmKey, scaScore, harvestYear, variety, process, estimatedRoastYield |

### Dev actors (always ensured before seeding)

```
User      email = "producer.dev@alturacollective.test", role = "PRODUCER", onboardingCompleted = true
Producer  name  = "Dev Producer", country = "COLOMBIA"
Farms (5) [DEV] Huila High Altitude Farm  · Huila     · 1850 m
          [DEV] Nariño Micro Farm          · Nariño    · 2050 m
          [DEV] Antioquia Volume Farm      · Antioquia · 1650 m
          [DEV] Tolima Washed Farm         · Tolima    · 1750 m
          [DEV] Cauca Experimental Farm    · Cauca     · 1900 m
```

`ensureDevScenarioActors` is idempotent. Existing rows are reused; manually
edited farm fields (region, altitude) are NEVER overwritten.

---

## 3. Routes implemented

All three routes use `requireDevRoute({ requireUser: true })` — hard-killed
on Vercel Production via the existing guard.

### `GET /api/dev/scenarios/lots`

```jsonc
{
  "lots": [
    {
      "id": "...",
      "lotNumber": "DEV-SCENARIO-allocation_engine_decides-1714000000000-3",
      "name": "[allocation_engine_decides] Bourbon WASHED",
      "status": "PUBLISHED",
      "greenLotStatus": "PUBLISHED",
      "availableKg": 2500,
      "scaScore": 85,
      "variety": "Bourbon",
      "process": "WASHED",
      "farmName": "[DEV] Cauca Experimental Farm",
      "shipmentReference": null
    }
  ],
  "counts": { "drafts": 10, "greenLots": 10, "shipments": 0 }
}
```

### `POST /api/dev/scenarios/lots/seed`

Body — every field optional:

```jsonc
{
  "scenario": "allocation_engine_decides",
  "targetStage": "published",
  "count": 10,
  "destinationCountry": "Norway"
}
```

Response (201):

```jsonc
{
  "scenario": "allocation_engine_decides",
  "targetStage": "published",
  "created": {
    "producerLotDrafts": 10,
    "greenLots": 10,
    "pricingSnapshots": 10,
    "shipments": 0
  },
  "greenLots": [ /* SeededGreenLot[] */ ],
  "shipment": null
}
```

Validation:

- `scenario === "allocation_engine_decides" && targetStage === "destination_received"` ⇒ **400** with `{ "error": "allocation_engine_decides must use targetStage=published" }`. The point of that preset is to test the engine — funnelling every lot through Shipment would force them all to `HOLD + SHIPMENT_ALREADY_RESERVED`.
- Invalid `scenario` or `targetStage` ⇒ 400.
- Empty / malformed body ⇒ all defaults applied (`allocation_engine_decides` / `published` / `count = scenario.default`).

### `POST /api/dev/scenarios/lots/reset`

```jsonc
{
  "deleted": {
    "demandIntents": 0,
    "contracts": 0,
    "producerFulfilments": 0,
    "pricingSnapshots": 10,
    "shipments": 1,
    "greenLots": 10,
    "producerLotDrafts": 10
  },
  "warnings": []
}
```

Reset deletes only rows whose `lotNumber` / `reference` starts with
`DEV-SCENARIO-`. Producer / User / `[DEV]` farms are never deleted. Order
inside a single `$transaction`:

1. `DemandIntent.deleteMany` for dev `greenLotId`s
2. `ProducerFulfilment.deleteMany` for dev `greenLotId`s
3. `Contract.deleteMany` for dev `greenLotId`s (also emits a warning if any contracts existed — orphan orders are acceptable for dev cleanup)
4. `PricingSnapshot.deleteMany` for dev `lotId`s
5. `producerLotDraft.updateMany` set `greenLotId = null`
6. `greenLot.updateMany` set `shipmentId = null`
7. `Shipment.deleteMany` for dev `reference`s
8. `GreenLot.deleteMany` for dev `lotNumber`s
9. `ProducerLotDraft.deleteMany` for dev `lotNumber`s

---

## 4. UI behaviour

URL: [/dev/scenarios/lots](../../app/dev/scenarios/lots/page.tsx)

Style matches `app/dev/logistics/page.tsx`: cream/beige palette, no charts.

Sections:

1. **Header + quick links** — open marketplace, open allocation dry-run JSON, open dev logistics, refresh button.
2. **Controls** — scenario select (defaults to `allocation_engine_decides`, listed first per spec), target stage select (with `destination_received` disabled when scenario is `allocation_engine_decides`), count select (3/5/8/10/15/20/25), optional destination country input. Two action buttons: **Seed scenario** (primary) and **Reset dev scenarios** (red secondary). Inline success / error banners.
3. **Preset explanations** — bullet list with one-line description of each scenario, plus a note pointing developers at `/api/internal/allocation/run` to see what the engine concludes.
4. **Current dev scenario data** — counts pills (drafts / green lots / shipments) and a table of all `DEV-SCENARIO-` rows. Columns: lot #, name, farm, variety, process, SCA, available kg, status badge, shipment ref. Empty state when the table has zero rows.

Every button is `type="button"`. No filters, no pagination, no charts. Reset
asks `confirm()` before firing.

---

## 5. Commands run and results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (no output) |
| `npm run test:allocation` | ✅ **93 / 93** tests pass — 12 golden + 4 invariants + 18 partition + 19 snapshot mapper + 19 marketplace mapper + **21 dev-scenario** |
| `npm run build` | ✅ Next.js build green; new routes registered: `/api/dev/scenarios/lots`, `/api/dev/scenarios/lots/seed`, `/api/dev/scenarios/lots/reset`, `/dev/scenarios/lots` |

Test highlights for this sprint:

```
▶ constants                                       (5 farms, prefixes, email)
▶ isDevScenarioKind / isDevTargetStage            (accept + reject)
▶ clampCount                                       (defaults, max, NaN/-∞, fractional floor)
▶ recipe presets
  ✔ every scenario provides at least its default count of recipes
  ✔ stress_25_lots has exactly 25 recipes
  ✔ allocation_engine_decides has exactly 10 boundary recipes
  ✔ every recipe has positive volume + valid SCA + parchment ≥ greenKg
  ✔ allocation_engine_decides preset includes the documented boundary cases
▶ pickRecipes                                      (slice + cap + min 1)
▶ lotNumber convention                             (DEV-SCENARIO- prefix)
```

---

## 6. Known limitations

1. **Stage B reuses `createShipment` then mutates the row directly.** The production `receiveShipment` doesn't set `arrivedAt` or `currentStage`, so the dev factory updates the shipment to `RECEIVED + currentStage = RECEIVED_BY_CLIENT + arrivedAt = receivedAt = now` after the create transaction. This bypasses any state-machine guards the production receive path enforces — acceptable because the goal is data, not flow correctness.

2. **Reset deletes orphan contracts.** If a developer has manually attached contracts to dev lots (e.g. testing the contract flow against a `DEV-SCENARIO-` lot), reset deletes them. A warning string is returned in the response, but the deletion is not blocked. Deliberate — otherwise reset would refuse to clean up after a partial test.

3. **`Order` rows are not touched.** The schema has `Order.contractId` optional with no cascade, so deleting a dev contract leaves the order with `contractId = null`. For a dev cleanup tool this is acceptable; production order data should never reference dev-prefixed lots in the first place.

4. **Idempotency only at the actor level.** Repeated seeds create new lots with new lot numbers (the timestamp suffix differs). Reset is the way to clean up, not seed-twice-overwrites.

5. **Lot number conflicts are not retried.** `lotNumber` uniqueness is enforced via `DEV-SCENARIO-${scenario}-${Date.now()}-${index}`. Seeds happening in the same millisecond would collide; in practice this would only happen from automated tests firing concurrent seeds, which isn't a use case here.

6. **The dev producer is not the same user as `dev/login-as` defaults.** This factory creates a stable `producer.dev@alturacollective.test` user. The existing dev-login-as route uses whatever email is in `DEV_PRODUCER_EMAIL` env var — typically a different email. Lots seeded by this factory belong to the factory's user, not the env user. Marketplace and allocation engine see them regardless of who's logged in (no owner filter); the producer dashboard only sees them if you log in as the factory's user.

7. **No image / Ideogram integration.** `GreenLot.imageUrl` is left `null`. The marketplace mapper falls back to deterministic gradient-key tones.

8. **`page.tsx` does not gate auth itself.** The UI shell is openly routable; the API routes behind it are the security boundary (matches the existing `/dev/logistics` pattern). If a developer hits the URL on production, the `requireDevRoute` guard returns 403 on every API call.

9. **Spanish strings absent.** All UI text is English (matches the dev-logistics page).

10. **`MarketSignalSnapshot` not seeded.** Recipes don't create market-signal rows. The allocation engine's optional `marketDemandIndex` stays `null` for dev lots — fine for v0.

---

## 7. Next recommended sprint

**ALLOC-3 visual validation with real scenario data.**

Concrete steps for the next session:

1. Seed `allocation_engine_decides` (10 lots, `published`).
2. Open `/api/internal/allocation/run` — verify the engine emits a healthy mix of `CONTRACT_CATALOG`, `OPEN_MARKETPLACE`, `EXCLUSIVE_MICROLOT`, `SPLIT`, and at most one `HOLD` (the one with low SCA / borderline volume).
3. Open `/platform/marketplace` — verify only marketplace + exclusive lots appear, sorted with exclusives first; metrics show real numbers (not the deleted 412 placeholder); featured-lot pick is deterministic.
4. Seed `large_split_lots` and confirm the marketplace residual chunks of those split lots show up in the grid while their main contract pool stays hidden.
5. Seed `logistics_ready` with `targetStage = destination_received` and confirm those lots disappear from marketplace (engine emits `HOLD + SHIPMENT_ALREADY_RESERVED`) and appear in `/dev/logistics`.
6. Reset between scenarios to keep the dataset clean.

After visual validation passes, **ALLOC-4** wires `/api/contracts/catalog`
for the trading desk using `contractAssignableGreenKg`, in parallel with the
already-shipping `/api/marketplace/lots`.
