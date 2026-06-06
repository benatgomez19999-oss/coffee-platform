# PRICING-FEED-2A — External market provider preview-only

Sprint scope: provider abstraction + preview-only fetch workflow for
`MarketSignalSnapshot` candidates. Two providers (deterministic mock,
env-gated barchart skeleton). Provider results never write to the
database — the operator must still apply through the existing
PRICING-FEED-1 confirm-token workflow.

No Prisma schema change. No cron / background jobs. No live HTTP
network requests in this sprint. No B2B refresh.

---

## 1. Purpose

PRICING-FEED-1 already supports manual ingestion with provenance and
preview/apply. PRICING-FEED-2A adds the provider seam:

- Architecture for plugging in real external sources later (PRICING-FEED-2B).
- A deterministic mock provider for offline dev / tests.
- A barchart skeleton that gates on `BARCHART_ONDEMAND_API_KEY` and emits
  structured diagnostics rather than calling the network.
- A preview orchestrator that runs the candidate through the existing
  `validateMarketSignalCandidate` so the same in-band rules apply.
- A "Use this candidate in manual form" UX hop so the apply path stays
  one and the same — the existing FEED-1 confirm token + the operator's
  hand stay on the wheel.

---

## 2. Files changed

### Created — pure provider modules

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalProviders.types.ts](../../src/services/pricing/marketSignalProviders.types.ts) | `MarketSignalProvider`, `MarketSignalProviderResult`, `MarketSignalProviderPreview`, `MarketSignalProviderSummary`, `MSP_DIAGNOSTIC_CODES`. |
| [src/services/pricing/marketSignalProviders.pure.ts](../../src/services/pricing/marketSignalProviders.pure.ts) | `mockDelayedIceProvider`, `barchartPreviewProvider`, registry helpers (`listMarketSignalProviders`, `getMarketSignalProvider`, `summarizeProvider`, `isMarketSignalProviderId`). |
| [src/services/pricing/marketSignalProviders.service.ts](../../src/services/pricing/marketSignalProviders.service.ts) | `previewMarketSignalFromProvider` orchestrator — composes provider fetch + FEED-1 validator into `MarketSignalProviderPreview`. |
| [src/services/pricing/__tests__/marketSignalProviders.test.ts](../../src/services/pricing/__tests__/marketSignalProviders.test.ts) | 17 pure tests. |

### Created — internal API

| Path | Role |
|---|---|
| [app/api/internal/pricing/market-signal/providers/route.ts](../../app/api/internal/pricing/market-signal/providers/route.ts) | `GET` — list registered providers + `configured` flags. |
| [app/api/internal/pricing/market-signal/provider-preview/route.ts](../../app/api/internal/pricing/market-signal/provider-preview/route.ts) | `POST` — preview-only orchestration. No DB writes. |

### Modified

| Path | Change |
|---|---|
| [src/components/dev/pricing/MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) | New "External provider preview" section above the manual form. Provider dropdown (with `(not configured)` markers), mock-scenario dropdown, fetch button, results block (candidate cells, diagnostics, raw payload `<details>`), and "Use this candidate in manual form" button that copies values into the existing form state. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace UI,
client dashboard, contract creation, contract amend, demand intent service,
FEED-1 validator (`validateMarketSignalCandidate`), FEED-1 apply route
(`/api/internal/pricing/market-signal` POST), partner manual route,
CoffeeAssistant.

---

## 3. Provider interface / registry

```ts
type MarketSignalProvider = {
  id: MarketSignalProviderId
  label: string
  kind: "MOCK" | "MANUAL" | "EXTERNAL_HTTP"
  description: string
  requiresApiKey: boolean
  isConfigured: () => boolean
  fetchLatest(options?: {
    apiKey?: string | null
    now?: Date
    scenario?: "low" | "neutral" | "high"
  }): Promise<MarketSignalProviderResult>
}
```

`MarketSignalProviderResult` is a discriminated union:

```ts
| { ok: true,  providerId, providerKind, fetchedAt, candidate, raw, diagnostics }
| { ok: false, providerId, providerKind, fetchedAt,            raw, diagnostics }
```

Registry exposes:

- `listMarketSignalProviders(): MarketSignalProviderSummary[]` — safe-to-expose metadata, never carries secrets.
- `getMarketSignalProvider(id: string): MarketSignalProvider | null`
- `summarizeProvider(p)` — single-provider summary helper.
- `isMarketSignalProviderId(value): value is MarketSignalProviderId` — guard.

### Diagnostic codes

| Code | Used when |
|---|---|
| `MSP_PROVIDER_NOT_FOUND` | unknown providerId |
| `MSP_PROVIDER_FETCH_FAILED` | provider's `fetchLatest` threw |
| `MSP_PROVIDER_NOT_CONFIGURED` | env / api key missing |
| `MSP_PROVIDER_RESPONSE_MALFORMED` | reserved (FEED-2B) |
| `MSP_PROVIDER_UNSUPPORTED_UNIT` | reserved (FEED-2B) |
| `MSP_PROVIDER_CANDIDATE_CREATED` | provider produced a candidate |
| `MSP_PROVIDER_MOCK_USED` | mock provider fired |
| `MSP_PROVIDER_VALIDATED` | FEED-1 validator accepted the candidate |
| `MSP_PROVIDER_PREVIEW_ONLY` | always emitted — never writes |
| `MSP_PROVIDER_DEFERRED_LIVE_FETCH` | barchart key present but live fetch deferred to FEED-2B |

---

## 4. Providers implemented

### `mock-delayed-ice` (kind `MOCK`)

- Fully deterministic. No `Math.random`. No env. No network.
- Three scenarios:
  - `low`     — `cPrice = 240`, `demandIndex = 0.95`
  - `neutral` — `cPrice = 290`, `demandIndex = 1.10` (default)
  - `high`    — `cPrice = 340`, `demandIndex = 1.18`
- Always emits `source = API_FEED` so it exercises the same path real
  feeds will use.
- Provenance: `provider="mock-delayed-ice"`, `sourceName="Mock delayed ICE Arabica C"`, `rawUnit="US_CENTS_PER_LB"`, `confidence="MEDIUM"`, `retrievedAt=now`.
- Diagnostics: `MSP_PROVIDER_MOCK_USED` + `MSP_PROVIDER_CANDIDATE_CREATED` + `MSP_PROVIDER_PREVIEW_ONLY`.
- `isConfigured()` → always `true`. Safe for tests, builds, CI without secrets.

### `barchart-preview` (kind `EXTERNAL_HTTP`)

Skeleton — **never** issues a live HTTP request in this sprint:

- No env key   → `ok: false` + `MSP_PROVIDER_NOT_CONFIGURED` (error severity).
- Env key set  → `ok: false` + `MSP_PROVIDER_DEFERRED_LIVE_FETCH` (warning) +
  `MSP_PROVIDER_PREVIEW_ONLY` (info). Description text points the operator
  at PRICING-FEED-2B as the home for the real fetch path.
- `isConfigured()` → reflects `BARCHART_ONDEMAND_API_KEY` presence.

Tests therefore never need a network and CI without secrets builds clean.

### Optional `manual-echo`

Skipped — the existing FEED-1 manual form already covers this UX.
The `manual-echo` id is reserved in the type so a future sprint can drop
in a passthrough without touching the union type.

---

## 5. API routes added

Both guarded by `requireDevRoute({ requireUser: true })`,
`runtime: nodejs`, `dynamic: force-dynamic`.

### `GET /api/internal/pricing/market-signal/providers`

```json
{
  "providers": [
    { "id": "mock-delayed-ice",  "label": "...", "kind": "MOCK",          "requiresApiKey": false, "configured": true,  "description": "..." },
    { "id": "barchart-preview",  "label": "...", "kind": "EXTERNAL_HTTP", "requiresApiKey": true,  "configured": false, "description": "..." }
  ]
}
```

### `POST /api/internal/pricing/market-signal/provider-preview`

Body:

```json
{
  "providerId": "mock-delayed-ice",
  "scenario": "neutral"   // optional, mock-only
}
```

Response (`MarketSignalProviderPreview`):

```ts
{
  generatedAt: string,
  provider: MarketSignalProviderSummary | null,
  providerResult: MarketSignalProviderResult | null,
  validation:
    | { ok: true, candidate: NormalizedMarketSignalCandidate }
    | { ok: false, diagnostics }
    | null,
  previewCandidate: NormalizedMarketSignalCandidate | null,
  diagnostics: MarketSignalIngestionDiagnostic[],   // composed: provider + validator + PREVIEW_ONLY
  canApply: boolean
}
```

Status codes:

- 400 — `providerId` missing.
- 200 — provider not found, fetch failed, validation failed, or success.
  The body's `canApply` + `diagnostics` carry the actual outcome so the
  UI never has to translate HTTP statuses.
- 500 — only on unexpected exceptions.

---

## 6. Dev UI changes

`/dev/market-signal` ([panel](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx))
gains a top section, **"External provider preview"**, above the manual
form:

- Provider dropdown — entries marked `(not configured)` are disabled.
- Mock scenario dropdown (only when a `MOCK`-kind provider is selected):
  `low / neutral / high`.
- **Fetch provider preview** button → POSTs to the new route.
- Result block:
  - Status banner (green when `canApply`, amber when provider ok but
    validation has issues, red when provider ok=false).
  - 6-cell candidate summary (cPrice, demand, source, provider,
    sourceName, confidence).
  - Color-coded diagnostics list (`error / warning / info`) with the
    code visible.
  - Collapsible **Raw provider payload** `<details>`.
- **Use this candidate in manual form** button — populates the existing
  form's state setters (`setCPriceStr`, `setDemandStr`, `setSource`,
  `setNote`, `setProvider`, `setSourceName`, `setSourceUrl`,
  `setConfidence`). Then a banner reminds the operator to run the
  manual `Preview signal → Apply signal` flow with the existing confirm
  token.

The existing manual form's preview/apply controls are untouched.

---

## 7. Validation flow

```
provider.fetchLatest()
   ↓
   ok=false  → diagnostics passed through, canApply=false (validator skipped)
   ok=true   → validateMarketSignalCandidate(candidate)
                  ↓
                  ok=true  → previewCandidate = normalised, canApply=true,
                             + MSP_PROVIDER_VALIDATED + MSP_PROVIDER_PREVIEW_ONLY
                  ok=false → diagnostics passed through, canApply=false
```

Composition rule: provider diagnostics first, then validator
diagnostics, then `MSP_PROVIDER_PREVIEW_ONLY` last. The UI renders the
list in order so the operator reads "what the provider said" then "what
the validator said" then the preview-only reminder.

---

## 8. What remains preview-only

Apply mode for `MarketSignalSnapshot` is **only** reachable through the
existing FEED-1 path:

```
POST /api/internal/pricing/market-signal
{ apply: true, confirm: "APPLY_MARKET_SIGNAL", ... }
```

The provider preview route does **not** accept `apply` and does **not**
hold a confirm token. The two-step intent the sprint demanded is
preserved — operator chooses provider, copies into manual form, runs
the existing apply flow. There is no path from a single click on the
provider section to a `MarketSignalSnapshot` row.

The route also never:

- writes `PricingSnapshot.clientB2BPricePerKg`,
- changes `Contract.lockedPricePerKg`,
- changes `DemandIntent.previewPricePerKg`,
- triggers `/dev/pricing` apply.

---

## 9. Tests added

`npm run test:allocation` — **397/397 pass** (17 new over 380 baseline).

All new tests in
[marketSignalProviders.test.ts](../../src/services/pricing/__tests__/marketSignalProviders.test.ts):

- **Registry** (4): mock + barchart present; `configured` reflects env;
  `getMarketSignalProvider` resolves; `isMarketSignalProviderId` guard.
- **Mock provider** (5): cPrice in `[50, 600]`; demandIndex in
  `[0.8, 1.2]`; deterministic for fixed `now/scenario`; low/neutral/high
  differ and are monotonic; `source = API_FEED` + provenance keys; emits
  the right diagnostic codes.
- **Barchart provider** (3): no API key → `MSP_PROVIDER_NOT_CONFIGURED`;
  key present → `MSP_PROVIDER_DEFERRED_LIVE_FETCH` (no network);
  `isConfigured()` flips with env.
- **Preview service** (4): valid mock candidate → `canApply=true` +
  `MSP_PROVIDER_VALIDATED`; unknown id → `MSP_PROVIDER_NOT_FOUND`;
  provider ok=false propagates without running validator; an injected
  fake provider with out-of-range cPrice yields validation failure
  (proves the validator path is wired).

No live network calls in tests. Env mutations always restored.

---

## 10. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **397 / 397 pass** |
| `npm run build` | ✓ Compiled successfully — both new internal routes in the manifest |

No migrations. No `prisma generate` needed.

---

## 11. Manual validation steps

### Mock provider path

1. Open `/dev/market-signal`.
2. In **External provider preview**:
   - Provider: `mock-delayed-ice`
   - Mock scenario: `neutral`
3. Click **Fetch provider preview**.
4. Confirm:
   - Banner: green ("Validated — ready to copy into the manual form.")
   - Candidate cells: `cPrice = 290.00`, `demand = 1.100`, `source = API_FEED`, `provider = mock-delayed-ice`, `confidence = MEDIUM`.
   - Diagnostics include `MSP_PROVIDER_MOCK_USED`, `MSP_CANDIDATE_VALID`, `MSP_PROVIDER_VALIDATED`, `MSP_PROVIDER_PREVIEW_ONLY`.
5. Click **Use this candidate in manual form** — manual form fields populate.
6. Manual form → **Preview signal** → diagnostics `MSI_CANDIDATE_VALID`, no DB writes.
7. Manual form → **Apply signal** → confirm dialog → snapshot active.
8. Open `/dev/pricing` — market signal block reflects `cPrice 290 / demand 1.10`.
9. Confirm **B2B prices unchanged** until you explicitly run apply on `/dev/pricing`.

### Barchart provider path (no API key)

1. Open `/dev/market-signal`.
2. Provider: `barchart-preview`. Note `(not configured)` in the dropdown if no env var.
3. Click **Fetch provider preview**.
4. Diagnostic shown: `MSP_PROVIDER_NOT_CONFIGURED` (error). `canApply = false`.
5. No crash. No writes. `Use this candidate` button is disabled (no candidate).

### Mock-low / Mock-high

1. Switch scenario to `low` → cPrice ≈ 240. To `high` → cPrice ≈ 340.
2. Confirm deltas appear when applied + opened in `/dev/pricing`.

---

## 12. Known limitations

- **`barchart-preview` is not wired to the live network.** Even with `BARCHART_ONDEMAND_API_KEY` set, this sprint returns `MSP_PROVIDER_DEFERRED_LIVE_FETCH`. Real fetch lands in PRICING-FEED-2B.
- **No cron / background ingestion.** Every fetch is operator-triggered.
- **No automatic apply.** Provider preview never writes. Apply still requires the manual confirm-token flow.
- **No B2B price refresh.** Drift only shows up on `/dev/pricing` after the operator applies a signal.
- **No realtime UI.** Provider results are point-in-time; the panel does not poll.
- **No `MarketSignalTick` history table.** Repeated fetches are not stored. The existing recent-snapshots table only shows applied rows.
- **No settlement-EOD job.** The "use settlement EOD for contract-authoritative CP" decision is documented but not enforced.
- **No external provider SLA.** When the live Barchart fetch lands, it must add timeouts, retries, structured error mapping — none of that exists yet.
- **`manual-echo` provider id is reserved but not implemented** — kept in the union for future use.

---

## 13. Recommended next sprint

1. **PRICING-FEED-2B** — real Barchart fetch path (HTTP, env-key-gated) with `AbortController`, structured error mapping, raw-payload preservation, and unit normalisation. Still preview-only.
2. **PRICING-FEED-1B** — consolidate the legacy `/api/partner/market-signal` route to call the new ingestion service so both writers share `validateMarketSignalCandidate` + `buildMarketSignalProvenanceNote`.
3. **CLIENT-NAV-1** — vertical sidebar dashboard polish for `/platform/client`.
