# PRICING-FEED-2C — Settlement / EOD provider preview-only

Sprint scope: a second Barchart provider that prefers
settlement / close-style prices and infers settled / final status from
provider fields. Future contract-authoritative CP candidate. **Still
preview-only** — no `MarketSignalSnapshot` writes, no `clientB2BPricePerKg`
refresh, no contract / demand-intent mutation, no cron.

The intraday `barchart-preview` provider is **unchanged**. Both
providers can coexist; the operator picks which one to fetch from.

---

## 1. Purpose

PRICING-FEED-2B made `barchart-preview` a live intraday/last-price-first
provider. That's good for market awareness, but contract pricing should
only ever lock against settled / EOD numbers. PRICING-FEED-2C separates
those concerns:

| Provider | Price priority | Confidence | Role |
|---|---|---|---|
| `barchart-preview` (FEED-2B) | `lastPrice → last → close → previousClose` | `HIGH` | intraday market awareness / overlay |
| `barchart-settlement-preview` (this sprint) | `settlement → settle → close → previousClose → lastPrice / last (fallback, warned)` | `HIGH` only when settled/final detected AND non-fallback field used; `MEDIUM` otherwise | future contract-authoritative CP review |

This sprint adds the second provider behind the same env key
(`BARCHART_ONDEMAND_API_KEY`). Authority for contract pricing remains an
operator decision: applying a settlement-preview candidate goes through
the same FEED-1 manual confirm-token flow as anything else.

---

## 2. Files changed

### Modified — pure parser + tests

| Path | Change |
|---|---|
| [src/services/pricing/marketSignalBarchart.parser.ts](../../src/services/pricing/marketSignalBarchart.parser.ts) | Adds `parseBarchartSettlementResponse` (settlement price priority + settlement-status detection) and the exported `isSettlementFinal` helper. Reuses the existing internal helpers (`asObject`, `asNumber`, `asNonEmptyString`, `pickTimestamp`). The intraday `parseBarchartGetQuoteResponse` is **unchanged**. |
| [src/services/pricing/__tests__/marketSignalBarchart.parser.test.ts](../../src/services/pricing/__tests__/marketSignalBarchart.parser.test.ts) | 16 new pure tests covering settlement price priority, `isSettlementFinal` over boolean / status-string fields, settlement-status diagnostics. |

### Modified — types + registry

| Path | Change |
|---|---|
| [src/services/pricing/marketSignalProviders.types.ts](../../src/services/pricing/marketSignalProviders.types.ts) | New provider id `"barchart-settlement-preview"` in the union. Five new diagnostic codes: `MSP_BARCHART_SETTLEMENT_FINAL`, `_NOT_FINAL`, `_STATUS_UNKNOWN`, `_FALLBACK_TO_LAST`, `_PRICE_SELECTED`. |
| [src/services/pricing/marketSignalProviders.pure.ts](../../src/services/pricing/marketSignalProviders.pure.ts) | New `barchartSettlementPreviewProvider` exported and added to the registry alongside mock + intraday providers. `KNOWN_IDS` guard updated. |
| [src/services/pricing/__tests__/marketSignalProviders.test.ts](../../src/services/pricing/__tests__/marketSignalProviders.test.ts) | Settlement provider test suite (8 cases) plus a regression block proving `barchart-preview` still picks `lastPrice` and `barchart-settlement-preview` picks `settlement` from the same payload. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace
UI, client dashboard, contract creation, contract amend, demand intent
service, FEED-1 validator + provenance encoder + apply route, FEED-1B
partner adapter, FEED-2A / 2B intraday provider behaviour, partner
manual route, `clientPricePerKg` rename, `/api/internal/pricing/*`
routes (registry-driven UI picks up the new provider automatically).

---

## 3. New provider behaviour

`barchart-settlement-preview` (`kind = EXTERNAL_HTTP`):

```
fetchLatest({ apiKey?, now?, fetchImpl?, timeoutMs? })
  ├─ resolve apiKey: options.apiKey ?? env BARCHART_ONDEMAND_API_KEY
  ├─ no key            → ok:false MSP_PROVIDER_NOT_CONFIGURED  (NO fetch)
  ├─ baseUrl           → env BARCHART_ONDEMAND_BASE_URL ?? default
  ├─ symbol            → env BARCHART_COFFEE_SYMBOL ?? "KC*1"
  ├─ same fetch helper as barchart-preview (AbortController, 8 s timeout)
  ├─ same sanitised sourceUrl (NEVER includes apikey)
  ├─ JSON.parse → parseBarchartSettlementResponse(payload, now)
  └─ on success build candidate:
        cPrice          = parsed.cPrice
        demandIndex     = 1.0    (+ MSP_DEMAND_INDEX_DEFAULTED warning)
        source          = "API_FEED"
        validFrom       = parsed.timestamp ?? now
        expiresAt       = now + 24h
        provenance      = {
          provider:    "barchart-settlement-preview",
          sourceName:  "Barchart OnDemand settlement/close <symbol>",
          sourceUrl:   sanitised,
          rawValue:    parsed.rawPrice,
          rawUnit:     "US_CENTS_PER_LB",
          confidence:  HIGH | MEDIUM   (see §5)
        }
```

Failure modes are identical to `barchart-preview`:
`MSP_PROVIDER_NOT_CONFIGURED` (no key), `MSP_PROVIDER_FETCH_FAILED`
(network / non-2xx), `MSP_PROVIDER_RESPONSE_MALFORMED` (invalid JSON),
plus the parser's settlement-aware diagnostic stream.

---

## 4. Parser / settlement logic

### Price priority

`SETTLEMENT_PRICE_PRIORITY = settlement → settle → close → previousClose → lastPrice → last`

- The first field present *and* numerically valid wins.
- Numeric strings are accepted (`"290.25"` → `290.25`).
- `lastPrice` and `last` are **fallback only** — if either wins, the parser emits `MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST` (warning).

### Settled / final detection — `isSettlementFinal(result)`

Returns `true | false | null`. Boolean fields take precedence over
status strings (so `{ isSettled: true, status: "Open" }` resolves to
`true`, not `false`).

| Source | True when | False when |
|---|---|---|
| `isSettled`, `settled`, `isFinal`, `final` | exact `=== true` | exact `=== false` |
| `status`, `tradeStatus`, `session`, `quoteType`, `mode` | string includes `"settled"`, `"final"`, `"closed"` (case-insensitive) | string includes `"open"`, `"trading"`, `"delayed"`, `"live"`, `"intraday"`, `"real-time"`, `"realtime"` |
| anything else | — | — |

`null` when no recognised field provides a verdict.

### Per-quote diagnostics emitted

| Code | Severity | When |
|---|---|---|
| `MSP_BARCHART_SETTLEMENT_FINAL` | info | `settlementStatus === true` |
| `MSP_BARCHART_SETTLEMENT_NOT_FINAL` | warning | `settlementStatus === false` |
| `MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN` | warning | `settlementStatus === null` |
| `MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST` | warning | `priceFieldUsed ∈ { lastPrice, last }` |
| `MSP_BARCHART_SETTLEMENT_PRICE_SELECTED` | info | always — names the field that won |
| `MSP_BARCHART_TIMESTAMP_INVALID` | warning | all timestamp fields unparseable |
| `MSP_BARCHART_SYMBOL_MISSING` | warning | no symbol → defaults `"UNKNOWN"` |

The full diagnostic stream is concatenated onto the provider result so
the dev UI shows the audit trail without separate API calls.

---

## 5. Confidence rules

```
confidence = HIGH iff
  parsed.settlementStatus === true
  AND
  parsed.priceFieldUsed ∈ { settlement, settle, close, previousClose }

confidence = MEDIUM otherwise
```

Concretely:

| `settlementStatus` | `priceFieldUsed` | confidence |
|---|---|---|
| `true` | `settlement` | `HIGH` |
| `true` | `settle` | `HIGH` |
| `true` | `close` | `HIGH` |
| `true` | `previousClose` | `HIGH` |
| `true` | `lastPrice` / `last` | `MEDIUM` (fallback) |
| `false` / `null` | _any_ | `MEDIUM` |

Tests assert each branch: settled-flag-only ≠ HIGH (must also have
non-fallback field), and non-fallback field alone ≠ HIGH (must also be
settled).

---

## 6. UI / API changes

The dev UI is **registry-driven**, so no UI code change was needed:
`/dev/market-signal` automatically lists `Barchart settlement / EOD
preview` in the provider dropdown. The existing flow handles it:

- Disabled with `(not configured)` when `BARCHART_ONDEMAND_API_KEY` is unset.
- `Fetch provider preview` runs the existing
  `POST /api/internal/pricing/market-signal/provider-preview` route.
- The `Use this candidate in manual form` button populates the existing
  manual form state. The manual `Preview signal → Apply signal` flow
  remains the only write path.

The provider's description carries the user-facing copy:

> Settlement preview prefers close / settlement values and is intended for contract-safe CP review.

The internal API route (`provider-preview/route.ts`) already accepts a
`providerId` string and returns the orchestrator's
`MarketSignalProviderPreview` payload. **Unchanged** — no new endpoint.

---

## 7. Tests added

`npm run test:allocation` — **464 / 464 pass** (27 new over 437 baseline).

### Parser ([marketSignalBarchart.parser.test.ts](../../src/services/pricing/__tests__/marketSignalBarchart.parser.test.ts), 16 new)

- **Price priority** (6): `settlement` wins; `settle` wins when
  `settlement` missing; `close` fallback; `previousClose` fallback;
  `lastPrice` fallback emits `MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST`;
  `MSP_BARCHART_SETTLEMENT_PRICE_SELECTED` names the field.
- **`isSettlementFinal`** (7): boolean true/false flags;
  `status='settled'`/`'final'`/`'Day Settled'`; `status='Open'`/`'Trading'`/`'Delayed'`/`session='intraday'`/`quoteType='real-time'`;
  unknown fields → `null`; boolean takes precedence over status string.
- **Settlement-status diagnostics** (3): `MSP_BARCHART_SETTLEMENT_FINAL`
  fires; `MSP_BARCHART_SETTLEMENT_NOT_FINAL` fires; `MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN`
  fires.

### Provider ([marketSignalProviders.test.ts](../../src/services/pricing/__tests__/marketSignalProviders.test.ts), 11 new)

Settlement provider:
- Registry contains `barchart-settlement-preview` with `EXTERNAL_HTTP` + `requiresApiKey: true`.
- Without API key → `MSP_PROVIDER_NOT_CONFIGURED` and **fetch never called** (asserted via call counter).
- Returns ok candidate with `provenance.provider = "barchart-settlement-preview"` + `cPrice = 290.25` + `demandIndex = 1.0` + `source = API_FEED`.
- Confidence = `HIGH` when `isSettled: true` AND `settlement` field used + emits `MSP_BARCHART_SETTLEMENT_FINAL`.
- Confidence = `MEDIUM` when settlement status `null` (UNKNOWN) + emits `MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN`.
- Confidence = `MEDIUM` when `lastPrice` fallback used even with `isSettled: true` + emits `MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST`.
- API key never appears in `sourceUrl` or `raw` (recognisable string `"very-secret-settlement-key"` searched for).
- Diagnostics include `MSP_DEMAND_INDEX_DEFAULTED` + `MSP_PROVIDER_PREVIEW_ONLY` + `MSP_PROVIDER_CANDIDATE_CREATED`.
- Settlement candidate validates through the FEED-1 validator
  (`validateMarketSignalCandidate.ok === true`).

Regression:
- `barchart-preview` keeps `lastPrice`-first on a payload that contains
  both `lastPrice` and `settlement` (intraday semantics unchanged).
- `barchart-settlement-preview` picks `settlement` on the same payload
  — the two providers diverge by design.

No real network in any test. Every fetch path injects `fetchImpl`.

---

## 8. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **464 / 464 pass** |
| `npm run build` | ✓ Compiled successfully — `provider-preview` + `providers` routes still in the manifest |

No migrations. No `prisma generate`.

---

## 9. Manual validation

### Without env key

1. Open `/dev/market-signal`.
2. Provider dropdown shows
   `Barchart settlement / EOD preview (not configured)`.
3. Fetch → diagnostic `MSP_PROVIDER_NOT_CONFIGURED` (error). `canApply = false`.
4. **Use this candidate** disabled.

### With env key

1. Set `BARCHART_ONDEMAND_API_KEY` and restart `npm run dev`.
2. Select `Barchart settlement / EOD preview`.
3. Click **Fetch provider preview**.
4. Confirm candidate cells:
   - `cPrice ≈ <live settlement / close>`
   - `demand = 1.000`
   - `source = API_FEED`
   - `provider = barchart-settlement-preview`
   - `confidence = HIGH` if Barchart marked the day as settled and a
     non-fallback field was used, otherwise `MEDIUM`.
5. Diagnostics include `MSP_BARCHART_SETTLEMENT_PRICE_SELECTED` (info)
   + one of `MSP_BARCHART_SETTLEMENT_{FINAL, NOT_FINAL, STATUS_UNKNOWN}`
   + `MSP_DEMAND_INDEX_DEFAULTED` + `MSP_PROVIDER_CANDIDATE_CREATED`
   + `MSP_PROVIDER_PREVIEW_ONLY`.
6. Raw payload `<details>` shows the sanitised request URL (no apikey).
7. **Use this candidate in manual form** → form populated.
8. Manual **Preview signal → Apply signal** with confirm token if
   intentionally writing.
9. `/dev/pricing` reflects the applied signal.
10. Persisted B2B prices unchanged until the operator runs `/dev/pricing`
    apply (separate explicit step).

### Diff vs intraday

Run both providers in a row on the same trading day:

- `barchart-preview` may show a `cPrice` that disagrees with
  `barchart-settlement-preview` mid-session because the former picks
  `lastPrice` and the latter picks `settlement` / `close`.
- After the close, with `isSettled: true` in the payload, both should
  converge — the settlement provider will report `confidence = HIGH`
  while the intraday provider keeps `HIGH` on `lastPrice` regardless.

---

## 10. Known limitations

- **Settlement final detection depends on Barchart response fields.**
  If the account / endpoint doesn't surface any of the recognised flags
  (`isSettled`, `settled`, `isFinal`, `final`, `status`, `tradeStatus`,
  `session`, `quoteType`, `mode`), confidence falls back to `MEDIUM`
  with `MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN`. Real Barchart payloads
  may need calibration.
- **`demandIndex` still defaults to 1.0** (with warning). Demand
  inference is out of scope for any external provider.
- **No cron / scheduled EOD job.** Operator-triggered only.
- **No automatic apply.** Provider preview never writes
  `MarketSignalSnapshot`.
- **No B2B refresh.** `/dev/pricing` apply remains a separate explicit
  step.
- **No `MarketSignalTick` history.** Repeated provider fetches are not
  persisted.
- **No retries.** Transient failures surface a single
  `MSP_PROVIDER_FETCH_FAILED` and rely on the operator to retry.
- **Settlement provider still uses `getQuote`** (same endpoint as
  intraday) — if Barchart exposes a dedicated settlement / EOD endpoint
  later, that's a future sprint (PRICING-FEED-2D).
- **`expiresAt = now + 24h`** is fixed; operators can edit before
  applying.

---

## 11. Recommended next sprint

1. **PRICING-FEED-3A** — append-only `MarketSignalTick` history table
   so repeated provider fetches feed an audit chart on `/dev/pricing`.
   Intraday + settlement providers both contribute rows; the chart
   shows the divergence cleanly.
2. **PRICING-FEED-2D** — dedicated Barchart settlement endpoint /
   parser if the OnDemand catalogue exposes a better EOD URL than
   `getQuote.json` (e.g. `getHistory.json` or a dedicated settlements
   API).
3. **CLIENT-NAV-1** — vertical sidebar dashboard polish for
   `/platform/client`.
