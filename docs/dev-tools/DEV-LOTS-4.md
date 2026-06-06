# DEV-LOTS-4 — Seeded jitter mode for dev lot scenarios

Sprint scope: opt-in seeded variation for the dev lot scenario factory so we
can exercise marketplace pricing and allocation logic against varied but
reproducible datasets, without breaking the deterministic regression preset.

No schema changes. No production behaviour changes. No new dependencies.
Dev tooling only — every route stays behind
`requireDevRoute({ requireUser: true })`.

---

## 1. Files changed

### Modified

| Path | Change |
|---|---|
| [src/services/dev/scenarios/devLotScenario.types.ts](../../src/services/dev/scenarios/devLotScenario.types.ts) | Added xfnv1a + mulberry32 PRNG, `applyRecipeJitter`, `applyJitterToRecipes`, `resolveSeedConfig`, `isScenarioJitterable`, `DevLotVariationMode`, jitter constants. |
| [src/services/dev/scenarios/devLotScenario.service.ts](../../src/services/dev/scenarios/devLotScenario.service.ts) | `SeedDevScenarioInput` accepts `variationMode` + `seed`. `seedDevScenario` resolves the config, jitters recipes when applicable, and returns `variationMode` + `appliedSeed`. |
| [app/api/dev/scenarios/lots/seed/route.ts](../../app/api/dev/scenarios/lots/seed/route.ts) | `parseSeedBody` validates `variationMode` ∈ {deterministic, jittered} and `seed` (non-empty string ≤ 120 chars). |
| [src/components/dev/scenarios/DevLotScenarioPanel.tsx](../../src/components/dev/scenarios/DevLotScenarioPanel.tsx) | Adds the jitter toggle, optional seed input, and post-seed display of the applied variation mode + seed. Auto-disables for `allocation_engine_decides`. |
| [src/services/dev/scenarios/__tests__/devLotScenario.test.ts](../../src/services/dev/scenarios/__tests__/devLotScenario.test.ts) | New tests for PRNG, `isScenarioJitterable`, `applyRecipeJitter`, `applyJitterToRecipes`, and `resolveSeedConfig`. |

### Untouched (verified)

Prisma schema, migrations, marketplace UI, marketplace pricing engine,
allocation engine, contract creation, demand intent service, supply service,
shipment production routes, EU partner / origin partner dashboards,
CoffeeAssistant, Stripe, dev logistics simulator.

---

## 2. Deterministic vs jittered behaviour

| Aspect | Deterministic (default) | Jittered |
|---|---|---|
| Recipe list | Fixed literal arrays | Same array transformed by a seeded PRNG |
| Reproducibility | Always identical (modulo `Date.now()` in `lotNumber`) | Identical *if and only if* same seed + scenario + count |
| `allocation_engine_decides` | Identical | **Forced deterministic** — the regression boundary set is never jittered |
| Pricing engine | Sees fixed inputs | Sees jittered SCA + farm altitude → naturally adapts |

The deterministic path is byte-for-byte unchanged. Existing clients that omit
`variationMode` and `seed` behave exactly as before.

---

## 3. Jitter rules

Helpers live in `devLotScenario.types.ts` (pure, no DB).

| Field | Rule |
|---|---|
| **scaScore** | integer offset `∈ {-1, 0, +1}`, clamp `[80, 92]`, additionally `≥ 84` for `Geisha` and `Pink Bourbon` |
| **greenKg** | random multiplier `∈ [0.80, 1.20]`, rounded to whole kg, clamped `≥ 50` |
| **parchmentKg** | recomputed from jittered `greenKg / conversionRate` (preserves the parchment-vs-green invariant) |
| **conversionRate** | preserved |
| **estimatedRoastYield** | preserved |
| **harvestYear** | preserved |
| **variety** | **never jittered** — preserves pricing-engine compatibility |
| **process** | **never jittered** in this sprint |
| **farmKey** | sampled from a per-scenario allowed group (existing `[DEV]` farms only — no farm creation) |

### Per-scenario farm groups

| Scenario | Allowed farm keys |
|---|---|
| `allocation_engine_decides` | _(jitter disabled)_ |
| `marketplace_mix`, `contract_catalog_mix`, `large_split_lots`, `logistics_ready`, `stress_25_lots` | `huila`, `narino`, `antioquia`, `tolima`, `cauca` |
| `exclusive_microlots` | `narino`, `cauca`, `huila`, `antioquia` (no `tolima` — it's the volume farm, not the microlot one) |

### PRNG

`createSeededRng(seed)` = xfnv1a hash → mulberry32 generator. Zero dependencies,
no `Math.random`, no globals. Same seed string ⇒ same sequence forever. RNG
call order inside `applyRecipeJitter` is fixed (`SCA → greenKg → farm`) so the
output is stable across runs.

---

## 4. API contract

### Request — `POST /api/dev/scenarios/lots/seed`

```json
{
  "scenario": "stress_25_lots",
  "targetStage": "published",
  "count": 25,
  "destinationCountry": null,
  "variationMode": "jittered",
  "seed": "pricing-geisha-1"
}
```

Defaults:
- `variationMode = "deterministic"` when omitted.
- `seed` may be omitted under `jittered`; the server fills `Date.now().toString()`
  and echoes it back so the dataset is reproducible later.
- `seed` is ignored under `deterministic` (the response sets `appliedSeed: null`).

Validation errors → `400`:
- `variationMode` must be `"deterministic"` or `"jittered"`.
- `seed`, if provided, must be a non-empty string `≤ 120 chars`.

### Response

```json
{
  "scenario": "stress_25_lots",
  "targetStage": "published",
  "variationMode": "jittered",
  "appliedSeed": "pricing-geisha-1",
  "created": { ... },
  "greenLots": [ ... ],
  "shipment": null
}
```

### `allocation_engine_decides` — special case

The regression preset is **never** jittered. If a client sends
`variationMode: "jittered"` for it, the server resolves to:

```json
{ "variationMode": "deterministic", "appliedSeed": null }
```

This is the sole signal — the response is the source of truth on what
actually happened, no extra warning field. The UI also auto-disables the
jitter toggle when this scenario is selected.

---

## 5. Manual validation flow

1. Reset dev scenarios — `Reset dev scenarios` button on `/dev/scenarios/lots`.
2. Tick **Jittered variant**, scenario `4. Exclusive microlots`, seed
   `pricing-geisha-1`, click **Seed scenario**.
3. Open `/platform/marketplace`. Confirm Geisha / Pink Bourbon prices land in
   their expected target band.
4. Reset and re-seed with the same seed → values must match.
5. Re-seed with a different seed (e.g. `pricing-geisha-2`) → at least SCA,
   greenKg, parchmentKg, or farmKey must differ for one or more lots.
6. Switch scenario to `1. Allocation engine decides` → the jitter toggle is
   disabled and the panel shows the regression-coverage note.

---

## 6. Tests

`npm run test:allocation` adds new tests in
`src/services/dev/scenarios/__tests__/devLotScenario.test.ts`:

- `hashSeedToUint32` — same input → same output, different inputs → different outputs, always uint32.
- `createSeededRng` — reproducibility, divergence on different seeds, range `[0, 1)`.
- `isScenarioJitterable` — excludes `allocation_engine_decides`, includes the rest.
- `applyJitterToRecipes`:
  - `allocation_engine_decides` is never jittered (defensive).
  - Same seed → deeply equal lists.
  - Different seeds → at least one differing recipe.
  - Variety, process, harvestYear, conversionRate, yield preserved.
  - SCA invariants (integer, clamp, rare-variety floor).
  - greenKg invariants (≥ 50, parchment recomputed).
  - Farm-key invariants (always in `KNOWN_FARM_KEYS`, microlot group restricted).
- `applyRecipeJitter` (controlled RNGs):
  - SCA offset uses `{-1, 0, +1}` integer steps.
  - Geisha + Pink Bourbon clamp to ≥ 84.
  - greenKg clamp to ≥ 50.
  - parchmentKg always recomputed from jittered greenKg.
  - Variety / process / harvestYear preserved.
  - Empty `allowedFarmKeys` → original farm preserved.
- `resolveSeedConfig`:
  - Default → deterministic + null seed.
  - Explicit deterministic ignores any seed.
  - `allocation_engine_decides` forces deterministic.
  - Provided seed is trimmed and used verbatim.
  - Missing seed under jittered auto-fills via `now()`.
  - Whitespace-only seed treated as missing.

Existing tests are unaffected — base recipes, `pickRecipes`, and
`clampCount` semantics are untouched.

---

## 7. Known limitations

- **Variety + process are never jittered.** Variety stays fixed because the
  producer pricing engine only supports a curated list, and process stays
  fixed because we don't yet have per-recipe `processAlternatives` metadata.
  Both can be added in a later sprint.
- **Farm jitter is bounded to existing `[DEV]` farms.** No new farms are
  created; the altitude variation comes from the five existing farm rows
  (1650 → 2050 m).
- **Pricing flows naturally through `calculateProducerPricing`.** We never
  override `pricePerKg` after jitter — the engine sees the new SCA + altitude
  and outputs whatever it would for those inputs.
- **The `allocation_engine_decides` preset is intentionally never jittered.**
  It is the canonical boundary fixture for regression coverage.

---

## 8. Recommended next sprint

Pause and **manually** validate 3–4 jittered marketplace datasets — confirm
Geisha, Pink Bourbon, and large contract candidates land in plausible price
bands across multiple seeds. If pricing looks right, proceed to
**PRICING-B2B-3 — persist `clientB2BPricePerKg` and rewire contracts +
demand intents** so the marketplace card price and the contracted price
stop diverging by ~6×.
