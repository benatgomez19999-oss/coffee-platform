# PRICING-FEED-2B — Live Barchart fetch path, preview-only

Sprint scope: upgrades the `barchart-preview` provider from a deferred
skeleton to a live HTTP fetch path behind `BARCHART_ONDEMAND_API_KEY`.
Adds a pure response parser for `getQuote.json`, `AbortController`-based
timeouts, structured error mapping, and a sanitised `sourceUrl` that
**never** carries the API key.

The provider remains preview-only. Operator workflow is unchanged: copy
candidate into the manual form → run Preview signal → run Apply signal.
Nothing in this sprint writes `MarketSignalSnapshot`, mutates
`PricingSnapshot.clientB2BPricePerKg`, or refreshes B2B prices.

---

## 1. Purpose

PRICING-FEED-2A shipped the provider seam + a "configured-but-deferred"
barchart provider. That meant: when an operator selected
`barchart-preview` with the env key set, the provider returned
`MSP_PROVIDER_DEFERRED_LIVE_FETCH` instead of an actual quote.

This sprint completes the live path:

- Real HTTP fetch to Barchart OnDemand `getQuote.json`.
- Timeout via `AbortController` (default 8 s).
- Structured error mapping for transport / status / parsing failures.
- Pure parser separating wire format from candidate construction.
- API key never leaves the server, never appears in `sourceUrl`,
  diagnostics, raw payload, or UI.

---

## 2. Files changed

### Created — pure parser + tests

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalBarchart.parser.ts](../../src/services/pricing/marketSignalBarchart.parser.ts) | Pure parser for `getQuote.json` payload. Defensive about field names; never throws; returns structured `BarchartQuoteParseResult`. |
| [src/services/pricing/__tests__/marketSignalBarchart.parser.test.ts](../../src/services/pricing/__tests__/marketSignalBarchart.parser.test.ts) | 16 pure tests for the parser. |

### Modified

| Path | Change |
|---|---|
| [src/services/pricing/marketSignalProviders.types.ts](../../src/services/pricing/marketSignalProviders.types.ts) | Adds `ProviderFetchImpl` / `ProviderFetchResponse` minimal interfaces; `MarketSignalProviderFetchOptions` now accepts optional `fetchImpl` and `timeoutMs`. New diagnostic codes: `MSP_BARCHART_STATUS_ERROR`, `MSP_BARCHART_EMPTY_RESULTS`, `MSP_BARCHART_PRICE_MISSING`, `MSP_BARCHART_PRICE_INVALID`, `MSP_BARCHART_TIMESTAMP_INVALID`, `MSP_BARCHART_SYMBOL_MISSING`, `MSP_BARCHART_PARSED`, `MSP_DEMAND_INDEX_DEFAULTED`. |
| [src/services/pricing/marketSignalProviders.pure.ts](../../src/services/pricing/marketSignalProviders.pure.ts) | `barchartPreviewProvider` now performs the live fetch. `MSP_PROVIDER_DEFERRED_LIVE_FETCH` no longer emitted. URL builder splits **request URL** (with apikey) from **sanitised URL** (public-safe). `defaultFetchImpl()` resolves to `globalThis.fetch` so production paths don't need to inject. |
| [src/services/pricing/__tests__/marketSignalProviders.test.ts](../../src/services/pricing/__tests__/marketSignalProviders.test.ts) | The previous "deferred" test is replaced with the full live-fetch test surface (success, HTTP error, network throw, malformed JSON, Barchart status error, key never leaks). All tests inject `fetchImpl` so no real network is hit. |
| [src/components/dev/pricing/MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) | One-line copy update: "Barchart preview fetch is read-only. Applying still requires the manual form confirmation." |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace
UI, client dashboard, contract creation, contract amend, demand intent
service, FEED-1 validator + provenance encoder + apply route, FEED-1B
partner adapter, FEED-2A registry / mock / preview orchestrator,
`/dev/market-signal` form layout, `/api/partner/market-signal`,
CoffeeAssistant.

---

## 3. Barchart fetch behaviour

```
fetchLatest({ apiKey?, now?, fetchImpl?, timeoutMs? })
  ├─ resolve apiKey:    options.apiKey ?? env BARCHART_ONDEMAND_API_KEY
  ├─ if no key          → ok:false MSP_PROVIDER_NOT_CONFIGURED   (NO fetch)
  ├─ resolve baseUrl:   env BARCHART_ONDEMAND_BASE_URL ?? "https://ondemand.websol.barchart.com"
  ├─ resolve symbol:    env BARCHART_COFFEE_SYMBOL       ?? "KC*1"
  ├─ resolve fetch:     options.fetchImpl ?? globalThis.fetch
  ├─ if no fetch impl   → ok:false MSP_PROVIDER_FETCH_FAILED
  ├─ AbortController, default timeoutMs = 8000
  ├─ requestUrl =       baseUrl/getQuote.json?apikey=<key>&symbols=<symbol>&fields=…
  ├─ sanitizedUrl =     baseUrl/getQuote.json?symbols=<symbol>            ← public-safe
  ├─ fetchImpl(requestUrl, { signal })
  ├─ network throw      → ok:false MSP_PROVIDER_FETCH_FAILED  (error message preserved)
  ├─ non-2xx            → ok:false MSP_PROVIDER_FETCH_FAILED  (status preserved in raw)
  ├─ JSON.parse(body)   → on error: ok:false MSP_PROVIDER_RESPONSE_MALFORMED
  ├─ parseBarchartGetQuoteResponse(payload, now)
  │     ├─ status.code != 200       → MSP_BARCHART_STATUS_ERROR
  │     ├─ empty results            → MSP_BARCHART_EMPTY_RESULTS
  │     ├─ no usable price field    → MSP_BARCHART_PRICE_MISSING
  │     ├─ non-finite / non-positive→ MSP_BARCHART_PRICE_INVALID
  │     ├─ all timestamps unparseable → MSP_BARCHART_TIMESTAMP_INVALID (warning, still ok)
  │     ├─ no symbol                → MSP_BARCHART_SYMBOL_MISSING (warning, still ok)
  │     └─ ok                       → MSP_BARCHART_PARSED (info)
  └─ on success build candidate:
        cPrice          = parsed.cPrice
        demandIndex     = 1.0    (+ MSP_DEMAND_INDEX_DEFAULTED warning)
        source          = "API_FEED"
        validFrom       = parsed.timestamp ?? now
        expiresAt       = now + 24h
        provenance      = { provider: "barchart-preview",
                            sourceName: "Barchart OnDemand getQuote <symbol>",
                            sourceUrl: sanitizedUrl,         ← no apikey
                            retrievedAt: now,
                            rawValue: parsed.rawPrice,
                            rawUnit: "US_CENTS_PER_LB",
                            confidence: "HIGH" }
```

`raw` on the result includes `sourceUrl` (sanitised), `symbol`, the
HTTP status, and the parsed payload — never the api key.

No retries. No caching. No persistence. No background scheduling.

---

## 4. Parser behaviour

`parseBarchartGetQuoteResponse(payload, now?)` is **pure** (no fetch, no
env, no Prisma):

- Defensive about wire format: `payload` may be anything; non-objects
  return `MSP_PROVIDER_RESPONSE_MALFORMED`.
- `status.code` checked when present; `!== 200` → `MSP_BARCHART_STATUS_ERROR`.
- `results` must be a non-empty array; otherwise `MSP_BARCHART_EMPTY_RESULTS`.
- `results[0]` must be an object.
- Price extraction priority: `lastPrice → last → close → previousClose`.
  Numeric strings accepted (e.g. `"290.25"`).
- Non-positive / non-finite price → `MSP_BARCHART_PRICE_INVALID`.
- KC*1 (Coffee C) is treated as **US cents/lb**. The parser **never**
  guesses a unit conversion; if a future contract advertises a different
  unit this is the single point of update.
- Timestamp priority: `tradeTimestamp → serverTimestamp → timestamp`.
  Falls back to `null` and emits `MSP_BARCHART_TIMESTAMP_INVALID` only
  when *all* present timestamps fail to parse.
- Symbol priority: `result.symbol → result.raw.symbol`. Falls back to
  `"UNKNOWN"` with `MSP_BARCHART_SYMBOL_MISSING` warning.
- `contractMonth`: `result.contractMonth → result.contract → null`.

The provider feeds the parser's diagnostics straight into its own
diagnostics array, so the operator sees them in the dev UI.

---

## 5. Provider preview flow (unchanged at the boundary)

```
operator                                         service                                   network
   │                                                │                                         │
   │  POST /api/internal/pricing/market-signal/provider-preview                               │
   │      { providerId: "barchart-preview" }        │                                         │
   │ ─────────────────────────────────────────────► │                                         │
   │                                                │   provider.fetchLatest({apiKey:env})    │
   │                                                │ ─────────────────────────────────────► │
   │                                                │                                         │
   │                                                │  ◄────────────────────────────  HTTP/JSON
   │                                                │   parseBarchartGetQuoteResponse()       │
   │                                                │   validateMarketSignalCandidate()       │
   │  ◄──────────────  MarketSignalProviderPreview                                            │
   │                                                                                          │
   │  click "Use this candidate in manual form"  → form populates                             │
   │  click Preview signal      → POST /api/internal/pricing/market-signal {apply:false}      │
   │  click Apply signal        → POST  ... {apply:true, confirm:"APPLY_MARKET_SIGNAL"}       │
   │                                                ↓
   │                                       MarketSignalSnapshot row written
```

The provider preview route never accepts `apply` and never holds a
confirm token. The two-step intent enforced by FEED-1 / FEED-2A is
preserved: a provider fetch + a successful validation produce a
**candidate**, not a snapshot.

---

## 6. Security / API key handling

**Never exposed:**

- Not in `provenance.sourceUrl` (which is `baseUrl/getQuote.json?symbols=<symbol>` only).
- Not in `provenance.rawValue` / `rawUnit` / `confidence`.
- Not in `result.raw` (raw forwards `sourceUrl, symbol, status, payload`).
- Not in any UI surface — the `/dev/market-signal` page renders only
  `provenance.*` fields and the `result.raw` JSON.
- Not in any diagnostic message.

**How it leaves the server:**

- Embedded only in `requestUrl` (the URL passed to `fetchImpl`).
- Read from `process.env.BARCHART_ONDEMAND_API_KEY` server-side.
- Optionally overridable via `options.apiKey` in tests / direct provider
  calls (the preview route ignores client-supplied `apiKey` — it only
  honors env).

A test asserts that a recognisable API key string never appears in
`provenance.sourceUrl` nor in `result.raw` after a successful fetch.

---

## 7. Dev UI changes

[MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) — single
copy update under the "External provider preview" section:

> Barchart preview fetch is read-only. Applying still requires the manual form confirmation.

No structural / layout changes. The existing flow already:

- disables the dropdown entry when the provider is not configured,
- runs `POST /api/internal/pricing/market-signal/provider-preview`,
- shows candidate cells, diagnostics list, and raw payload `<details>`,
- exposes a `Use this candidate in manual form` button that populates
  the existing manual form state.

When the provider is not configured, the dropdown shows
`(not configured)`, and clicking Fetch emits the
`MSP_PROVIDER_NOT_CONFIGURED` diagnostic without a network call.

---

## 8. Tests added

`npm run test:allocation` → **437/437 pass** (23 new over the 414
baseline; no test removed, the previous "DEFERRED_LIVE_FETCH" assertion
is replaced by the live-fetch test set).

### Parser ([marketSignalBarchart.parser.test.ts](../../src/services/pricing/__tests__/marketSignalBarchart.parser.test.ts), 16 tests)

- **Happy paths** (8): valid payload with numeric `lastPrice`; numeric
  string price; fallback to `close` / `previousClose` when earlier
  fields missing; preserves `contractMonth` / falls through to
  `result.contract`; parses `tradeTimestamp` when valid; emits
  `MSP_BARCHART_TIMESTAMP_INVALID` warning when all timestamps fail to
  parse.
- **Error paths** (8): non-object payload → `MSP_PROVIDER_RESPONSE_MALFORMED`;
  `status.code != 200` → `MSP_BARCHART_STATUS_ERROR`; empty results →
  `MSP_BARCHART_EMPTY_RESULTS`; no usable price field →
  `MSP_BARCHART_PRICE_MISSING`; non-finite / zero / negative price →
  rejected; `results[0]` not an object → malformed; missing symbol →
  `MSP_BARCHART_SYMBOL_MISSING` warning + `symbol = "UNKNOWN"`.

### Provider ([marketSignalProviders.test.ts](../../src/services/pricing/__tests__/marketSignalProviders.test.ts), updated)

- Without API key → `MSP_PROVIDER_NOT_CONFIGURED` and `fetchImpl` is
  **never called** (asserted via call counter).
- With API key + mock fetch returning a valid Barchart body → ok candidate
  with `cPrice = 290.25`, `demandIndex = 1.0`, `source = API_FEED`,
  `provenance.provider = "barchart-preview"`, `confidence = "HIGH"`,
  `rawUnit = "US_CENTS_PER_LB"`.
- Diagnostics on success include `MSP_DEMAND_INDEX_DEFAULTED`,
  `MSP_PROVIDER_CANDIDATE_CREATED`, `MSP_PROVIDER_PREVIEW_ONLY`.
- API key **never** leaks: `sourceUrl` excludes the key string and
  `result.raw` excludes it too.
- HTTP non-2xx → `MSP_PROVIDER_FETCH_FAILED`.
- Network throw → `MSP_PROVIDER_FETCH_FAILED` with the original error
  message preserved.
- Invalid JSON body → `MSP_PROVIDER_RESPONSE_MALFORMED`.
- HTTP 200 with `status.code != 200` Barchart payload →
  `MSP_BARCHART_STATUS_ERROR`.
- `isConfigured()` flips with `BARCHART_ONDEMAND_API_KEY`.
- A successful candidate validates through the FEED-1 validator
  (`validateMarketSignalCandidate.ok === true`).

No real network calls in tests. Every test that touches
`barchartPreviewProvider.fetchLatest` injects `fetchImpl`.

---

## 9. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **437 / 437 pass** |
| `npm run build` | ✓ Compiled successfully — provider-preview + providers routes still in the manifest |

No migrations. No `prisma generate` re-run.

---

## 10. Manual validation steps

### Without env key

1. Open `/dev/market-signal`.
2. Provider dropdown shows `Barchart OnDemand (preview) (not configured)`.
3. Click **Fetch provider preview**.
4. Diagnostic: `MSP_PROVIDER_NOT_CONFIGURED` (error). `canApply = false`.
5. **Use this candidate in manual form** is disabled.

### With env key

1. Set `BARCHART_ONDEMAND_API_KEY` in local `.env` and restart `npm run dev`.
2. `/dev/market-signal` → provider `Barchart OnDemand (preview)` is now enabled.
3. Click **Fetch provider preview**.
4. Confirm:
   - Candidate cells: `cPrice ≈ <live KC*1 quote>`, `demand = 1.000`,
     `source = API_FEED`, `provider = barchart-preview`,
     `confidence = HIGH`.
   - Raw payload visible in the `<details>` block; the request URL it
     references is the sanitised one (no `apikey` query param).
   - Diagnostics include `MSP_BARCHART_PARSED`, `MSP_DEMAND_INDEX_DEFAULTED`
     (warning), `MSP_PROVIDER_CANDIDATE_CREATED`, `MSP_PROVIDER_PREVIEW_ONLY`.
5. Click **Use this candidate in manual form** — manual form fields
   populate with the live Barchart values.
6. Run **Preview signal**, then **Apply signal** with the existing
   confirm token if you intentionally want to write a snapshot.
7. Open `/dev/pricing` — the new market signal block reflects the
   applied values; persisted B2B prices are unchanged until you
   explicitly run the `/dev/pricing` apply.

### Failure modes worth checking

- Invalid API key in env → expect `MSP_BARCHART_STATUS_ERROR` (HTTP 200
  with Barchart status 401) **or** `MSP_PROVIDER_FETCH_FAILED` (HTTP 401)
  depending on how Barchart routes the error. Either way `canApply = false`.
- Network blocked / DNS failure → `MSP_PROVIDER_FETCH_FAILED` with the
  underlying error message visible in the diagnostic.

---

## 11. Known limitations

- **No cron / scheduled fetches.** Operator-triggered only.
- **No automatic `MarketSignalSnapshot` apply.** Provider never writes;
  apply still requires the manual confirm token.
- **No automatic B2B refresh.** `/dev/pricing` apply remains a separate
  intent step.
- **`demandIndex` defaults to 1.0** with a warning. Barchart only
  supplies cPrice; demand inference is out of scope.
- **No settlement-EOD parser.** This sprint reads the latest quote
  (`lastPrice` first). A settlement-only parser is future work
  (PRICING-FEED-2C).
- **No `MarketSignalTick` history table.** Repeated fetches are not
  persisted; only an applied signal lives in DB.
- **Default symbol `KC*1`.** Calibration may want a different roll
  (e.g. specific contract month) — set `BARCHART_COFFEE_SYMBOL` to
  override.
- **Provider SLA depends on Barchart account.** Timeouts surface as
  `MSP_PROVIDER_FETCH_FAILED`.
- **No retries.** A transient network error returns once and asks the
  operator to retry.
- **`expiresAt = now + 24h`** is a fixed default. Operators can edit
  it in the manual form before applying.

---

## 12. Recommended next sprint

1. **PRICING-FEED-2C** — settlement-EOD provider (separate provider id
   that prefers `close` / `settlement` and stamps `confidence = "HIGH"`
   only when Barchart marks the day as settled).
2. **PRICING-FEED-3A** — append-only `MarketSignalTick` history table
   so repeated provider fetches feed an audit chart on `/dev/pricing`.
3. **CLIENT-NAV-1** — vertical sidebar dashboard polish for `/platform/client`.
