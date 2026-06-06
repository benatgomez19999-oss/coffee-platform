# PRICING-FEED-3A — MarketSignalTick append-only history

Sprint scope: a new `MarketSignalTick` table that captures provider
preview observations as audit-only history. Recording a tick is a
**third** operator action — separate from running a provider preview
(no DB write) and from applying an active `MarketSignalSnapshot`
(FEED-1 confirm-token flow). Recording a tick **never** writes to
`MarketSignalSnapshot`, **never** refreshes
`PricingSnapshot.clientB2BPricePerKg`, **never** mutates contracts or
demand intents.

---

## 1. Purpose

After PRICING-FEED-2A/2B/2C an operator can fetch live intraday
quotes from `barchart-preview` and settlement-style quotes from
`barchart-settlement-preview`. Each fetch is ephemeral. If you don't
apply it as the active `MarketSignalSnapshot`, the observation
disappears. That makes drift charts and provider comparisons
impossible without surgery.

PRICING-FEED-3A adds an **append-only** history layer:

- New `MarketSignalTick` Prisma model + migration.
- Pure validator + sanitiser (URL allow-list + recursive secret-key
  redaction in `rawPayload` / `diagnostics`).
- Service layer that records a tick from any
  `MarketSignalProviderPreview`.
- Internal API route (`requireDevRoute`) for record + list.
- "Record tick" button + recent-ticks table on `/dev/market-signal`.

The two pre-existing actions (provider preview, manual apply) are
unchanged.

---

## 2. Migration / schema fields

`prisma/schema.prisma` — new model:

```prisma
model MarketSignalTick {
  id             String             @id @default(uuid())

  providerId     String
  providerKind   String
  source         MarketSignalSource

  cPrice         Float
  demandIndex    Float?
  confidence     String?
  rawUnit        String?
  rawValue       Float?

  symbol         String?
  contractMonth  String?

  capturedAt     DateTime           @default(now())
  validFrom      DateTime?
  expiresAt      DateTime?

  sourceName     String?
  sourceUrl      String?
  note           String?

  diagnostics    Json?
  rawPayload     Json?

  createdAt      DateTime           @default(now())

  @@index([capturedAt])
  @@index([providerId, capturedAt])
  @@index([source, capturedAt])
}
```

Migration: `prisma/migrations/20260509200000_add_market_signal_tick_history/migration.sql`. New table only — no `ALTER` to existing tables, fully non-destructive. Indexes drop the cost of common queries (newest first; per-provider; per-source).

`providerId` and `providerKind` are plain `String` so adding a new
provider in the future does **not** require a migration.

---

## 3. Files changed

### Created — schema + pure helpers + tests

| Path | Role |
|---|---|
| [prisma/schema.prisma](../../prisma/schema.prisma) | Adds `MarketSignalTick` model. |
| [prisma/migrations/20260509200000_add_market_signal_tick_history/migration.sql](../../prisma/migrations/20260509200000_add_market_signal_tick_history/migration.sql) | `CREATE TABLE` + 3 indexes. |
| [src/services/pricing/marketSignalTick.types.ts](../../src/services/pricing/marketSignalTick.types.ts) | Pure types + ranges + redaction tokens + URL allow-list. |
| [src/services/pricing/marketSignalTick.pure.ts](../../src/services/pricing/marketSignalTick.pure.ts) | `validateMarketSignalTickInput`, `buildMarketSignalTickFromProviderPreview`, `sanitizeMarketSignalTickSourceUrl`, `sanitizeMarketSignalTickRawPayload`. No Prisma. |
| [src/services/pricing/__tests__/marketSignalTick.test.ts](../../src/services/pricing/__tests__/marketSignalTick.test.ts) | 27 pure tests. |

### Created — service + API

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalTick.service.ts](../../src/services/pricing/marketSignalTick.service.ts) | `recordMarketSignalTick`, `recordMarketSignalTickFromProviderPreview`, `listMarketSignalTicks`. Wraps Prisma create + findMany. Re-exports public types so callers don't need to learn the split. |
| [app/api/internal/pricing/market-signal/ticks/route.ts](../../app/api/internal/pricing/market-signal/ticks/route.ts) | `GET` (list) + `POST` (record from preview). `requireDevRoute`. Append-only — never writes `MarketSignalSnapshot`. |

### Modified — UI

| Path | Change |
|---|---|
| [src/components/dev/pricing/MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) | New "Record tick" button under the provider preview block (enabled only when `canApply === true && previewCandidate !== null`); new "Recent provider ticks" section showing up to 20 rows newest-first with intraday / settlement badges. |

### Created — docs

| Path | Role |
|---|---|
| [docs/pricing/PRICING-FEED-3A.md](../../docs/pricing/PRICING-FEED-3A.md) | This document. |
| §25 anexado a [docs/pricing/PRICING-ENGINE-CANONICAL.md](../../docs/pricing/PRICING-ENGINE-CANONICAL.md) | Canonical sprint summary. |

### Untouched (verified)

Allocation engine, target tables, marketplace UI, client dashboard,
contract creation, contract amend, demand intent service,
`Contract.lockedPricePerKg`, `DemandIntent.previewPricePerKg`,
`PricingSnapshot.clientB2BPricePerKg`, FEED-1 validator + apply route,
FEED-1B partner adapter, FEED-2A registry / mock, FEED-2B intraday
provider, FEED-2C settlement provider, partner manual route,
`clientPricePerKg` rename, CoffeeAssistant.

---

## 4. Tick recording flow

```
operator                                 service                      DB
   │                                        │                          │
   │ /dev/market-signal                     │                          │
   │   ├─ Fetch provider preview            │                          │  ← provider/route already exists; ZERO writes
   │   ├─ Click "Record tick"               │                          │
   │   │   POST /api/internal/pricing/market-signal/ticks               │
   │   │     { preview: MarketSignalProviderPreview }                   │
   │   │ ─────────────────────────────────► │                          │
   │   │      buildMarketSignalTickFromProviderPreview(preview)         │
   │   │      validateMarketSignalTickInput(input)                      │
   │   │      sanitizeMarketSignalTickSourceUrl(...)                    │
   │   │      sanitizeMarketSignalTickRawPayload(...)                   │
   │   │      prisma.marketSignalTick.create({ data: ... }) ──────────► CREATE row
   │   │ ◄──────────────  RecordMarketSignalTickResult                  │
   │   ├─ Recent provider ticks table refreshes                         │
   │   ├─ (optional) Click "Use this candidate in manual form"          │
   │   ├─ (optional) Click Preview signal (FEED-1)                      │
   │   └─ (optional) Click Apply signal with confirm token (FEED-1)     │
                                                                        ↓
                                                MarketSignalSnapshot row written  ← only if operator applies
                                                (B2B prices still untouched)
```

The three actions remain orthogonal in code and UI:

| Action | Writes | Helper |
|---|---|---|
| Provider preview (FEED-2A/2B/2C) | none | `previewMarketSignalFromProvider` |
| **Record tick** (this sprint) | append-only `MarketSignalTick` | `recordMarketSignalTickFromProviderPreview` |
| Apply active snapshot (FEED-1) | `MarketSignalSnapshot` (deactivate-then-create) | `applyMarketSignalIngestion` |

There is no automatic chain.

---

## 5. API routes

`/api/internal/pricing/market-signal/ticks` — `requireDevRoute({ requireUser: true })`,
`runtime: nodejs`, `dynamic: force-dynamic`.

### `GET`

Query params:

- `providerId` (optional) — filter to one provider id (e.g. `barchart-settlement-preview`).
- `limit` (optional) — clamped to `[1, 500]`, default `50`.
- `since` (optional) — ISO date; only ticks with `capturedAt >= since`.

Response (`MarketSignalTickListResult`):

```ts
{
  generatedAt: string,
  count: number,
  ticks: Array<{
    id, providerId, providerKind, source,
    cPrice, demandIndex, confidence, symbol, contractMonth,
    capturedAt, validFrom, expiresAt,
    sourceName, sourceUrl, note
  }>
}
```

Newest first. `rawPayload` and `diagnostics` are intentionally **not**
exposed by the list endpoint to keep it cheap; per-row inspection is
future work.

### `POST`

Body: `{ preview: MarketSignalProviderPreview }` (also accepts the
preview at the top level for convenience). Builds a tick from the
preview, validates + sanitises it, and writes one row.

- `200` `{ ok: true, applied: true, tick: { … }, diagnostics }` on success.
- `400` `{ ok: false, applied: false, tick: null, diagnostics }` on
  validation failure (out-of-range cPrice, unknown provider preview
  shape, etc.).

The route never accepts an `apply` flag and never reaches the FEED-1
write path. Only `MarketSignalTick` is created.

---

## 6. UI changes

`/dev/market-signal` ([panel](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx)):

- **External provider preview** section:
  - Existing `Use this candidate in manual form` button is unchanged.
  - **New `Record tick` button** below the candidate cells.
    - Enabled only when the preview is valid (`canApply === true && previewCandidate !== null`).
    - Title hover explains: *"Append-only audit row. Does NOT change the active MarketSignalSnapshot or refresh B2B prices."*
    - On success a green inline banner says
      `Recorded tick: <providerId> cPrice <value>.`
- **New section "Recent provider ticks"** — table of the last 20 rows
  with: captured-at, provider id (with `intraday` / `settlement` /
  kind badge), source, cPrice (2 dp), demand (3 dp or `—`),
  confidence, symbol, note. Empty state copy points the operator at
  the Record tick button.

The manual signal form, `Preview signal` and `Apply signal` controls
are completely untouched.

---

## 7. Security / redaction handling

Two surfaces could leak secrets — both are scrubbed before writing.

### `sourceUrl` allow-list

`sanitizeMarketSignalTickSourceUrl(url)` parses the URL, drops every
query parameter outside the allow-list (`symbols`, `symbol`,
`fields`), strips embedded `username:password@`, and removes any
fragment. Unparseable input returns `null`. When anything was changed,
the tick carries an `MST_SOURCE_URL_SANITIZED` warning diagnostic.

### `rawPayload` / `diagnostics` recursive redaction

`sanitizeMarketSignalTickRawPayload(value)` walks objects + arrays
recursively. For any object key whose name (lower-cased) contains one
of:

```
apikey, api_key, api-key, token, secret, authorization, auth,
password, bearer
```

…the value is replaced with the string literal `"[REDACTED]"`. The
top-level diagnostic blob is treated the same way. When anything was
changed, the tick carries an `MST_RAW_PAYLOAD_REDACTED` warning.

### Tests

- `apikey=very-secret&symbols=KC*1` → URL output contains
  `symbols=KC…` but not `apikey` and not `very-secret`.
- `https://user:pass@example.com/...` → username/password stripped.
- `{ apiKey: "very-secret", nested: { token: "abc", items: [{ Authorization: "Bearer xyz" }] } }`
  → all three values become `[REDACTED]`; non-secret keys (`okField`)
  preserved.

Best-effort: a secret embedded inside a free-form string (e.g. inside
`note`) will not be detected. Operator-supplied `note` is treated as
plain text and stored as-is.

---

## 8. What tick recording updates / does not update

| Updated | Untouched |
|---|---|
| `MarketSignalTick` (one new row, never updated) | `MarketSignalSnapshot` (FEED-1 territory) |
|  | `PricingSnapshot.clientB2BPricePerKg` |
|  | `PricingSnapshot.producerPricePerKg` / `clientPricePerKg` |
|  | `GreenLot.pricePerKg` |
|  | Existing `Contract.lockedPricePerKg` |
|  | Existing `DemandIntent.previewPricePerKg` |
|  | Allocation engine output |
|  | Target pricing tables |

If the operator wants the active snapshot or persisted B2B prices to
follow a recorded tick, they run the existing FEED-1 manual apply +
the existing PRICING-WIRE-2 / `/dev/pricing` apply respectively. Two
separate explicit clicks.

---

## 9. Tests added

`npm run test:allocation` — **491/491 pass** (27 new over 464 baseline).

All new tests live in
[marketSignalTick.test.ts](../../src/services/pricing/__tests__/marketSignalTick.test.ts):

- **Validator happy path** (4): full tick accepts; defaults capturedAt
  to `now`; `null` `demandIndex` accepted; expired `expiresAt` accepted
  (ticks are historical).
- **Validator errors** (7): `cPrice` below 50, above 600, NaN /
  Infinity; `demandIndex` below 0.8, above 1.2; unknown source string;
  invalid `capturedAt` string. Plus a no-clamp invariant.
- **Sanitisation** (5): `apikey` stripped from `sourceUrl`;
  `user:pass@` stripped; recursive `apiKey` / `token` /
  `Authorization` redaction in `rawPayload`; non-secret payload
  preserved; `MST_SOURCE_URL_SANITIZED` / `MST_RAW_PAYLOAD_REDACTED`
  warnings emitted.
- **Provider preview builder** (4): valid mock provider preview →
  tick; `canApply: false` → `MST_PROVIDER_PREVIEW_NOT_APPLICABLE`;
  `null` preview → `MST_PROVIDER_PREVIEW_INVALID`; settlement provider
  preview preserves `providerId` + `providerKind`.
- **Standalone sanitisers** (7): URL helper handles null / unparseable
  / allow-listed params / suspicious params; payload helper handles
  any depth, leaves clean payloads alone, handles primitives /
  null / undefined.

No real DB or network in any test. Validator and builder are pure.

---

## 10. Commands run

| Command | Result |
|---|---|
| `npx prisma generate` | ✓ Generated Prisma Client v5.22.0 (new `MarketSignalTick` model present) |
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **491/491 pass** |
| `npm run build` | ✓ Compiled successfully — `/api/internal/pricing/market-signal/ticks` in the manifest |

To apply on the dev DB:
```
npx prisma migrate deploy
```
Non-destructive: `CREATE TABLE` + 3 `CREATE INDEX` only.

---

## 11. Manual validation steps

### Without env key (mock provider)

1. `npx prisma migrate deploy`.
2. Open `/dev/market-signal`.
3. Provider dropdown → `mock-delayed-ice`. Click **Fetch provider preview**.
4. Click **Record tick**.
5. Banner: `Recorded tick: mock-delayed-ice cPrice 290.`
6. **Recent provider ticks** section refreshes — shows the new row, badge `intraday`/`mock`.
7. Verify the active `MarketSignalSnapshot` is **not** created (e.g. `GET /api/internal/pricing/market-signal` shows the same active row as before).
8. Verify `/dev/pricing` shows no B2B drift change attributable to the tick alone.

### With Barchart env key (`BARCHART_ONDEMAND_API_KEY`)

1. Restart `npm run dev`.
2. Fetch `barchart-preview` → Record tick.
3. Fetch `barchart-settlement-preview` → Record tick.
4. **Recent provider ticks** now shows two rows for the two providers,
   possibly with different `cPrice` (intraday vs settlement). Badges
   read `intraday` and `settlement`.
5. Open Prisma Studio and inspect the new `MarketSignalTick` rows.
6. **Security check**: in `rawPayload`, search for the API key string
   value (e.g. your `BARCHART_ONDEMAND_API_KEY`). It must **not** appear.
   `sourceUrl` must contain only `?symbols=…[&fields=…]` — no `apikey`
   query param.
7. `/dev/pricing` again — the persisted B2B prices have not changed,
   the active `MarketSignalSnapshot` has not changed. Two-step intent
   intact.

---

## 12. Known limitations

- **No automatic tick recording.** Each tick is operator-triggered.
- **No cron / scheduled history.** No background job records intraday
  ticks every N minutes.
- **No realtime dashboard** — `/dev/market-signal` only refreshes
  ticks after a successful Record action.
- **No chart library**, no SVG sparkline, no audit chart yet
  (PRICING-FEED-3B candidate).
- **No retention cleanup.** Append-only with no scheduled prune.
- **No DB-level deduplication.** Two ticks with the same provider +
  cPrice + capturedAt simply produce two rows.
- **No B2B refresh.** Tick recording never touches
  `PricingSnapshot.clientB2BPricePerKg`.
- **No active `MarketSignalSnapshot` apply** unless the operator
  separately runs the FEED-1 confirm-token flow.
- **`rawPayload` redaction is best-effort** — it scrubs by *key name*,
  not by content. A secret embedded inside a free-form string blob
  (e.g. inside an arbitrary `note` field that the operator typed) is
  not auto-redacted.
- **List endpoint omits `rawPayload` / `diagnostics`** to keep responses
  cheap. Per-row inspection is a future sprint.

---

## 13. Recommended next sprint

1. **PRICING-FEED-3B** — simple intraday-vs-settlement audit chart on
   `/dev/market-signal` (or `/dev/pricing`). Pure helper
   `buildMarketSignalTickSeries` + minimal SVG sparkline (no
   dependencies).
2. **PRICING-FEED-2D** — dedicated Barchart settlement endpoint /
   parser (e.g. `getHistory.json`) if the OnDemand catalogue exposes a
   true EOD URL distinct from `getQuote.json`.
3. **CLIENT-NAV-1** — vertical sidebar dashboard polish for
   `/platform/client`.
