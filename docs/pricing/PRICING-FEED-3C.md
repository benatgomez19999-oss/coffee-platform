# PRICING-FEED-3C — MarketSignalTick row inspector

Sprint scope: a read-only per-row inspector for `MarketSignalTick`.
Surfaces every column for one tick — including `rawPayload` and
`diagnostics`, which the FEED-3A list endpoint intentionally omits to
keep responses cheap — and re-runs the FEED-3A sanitisers on read as
belt-and-braces.

**Read-only.** No DB writes. No `MarketSignalSnapshot` apply. No
`PricingSnapshot.clientB2BPricePerKg` refresh. No contract / demand
intent mutation.

---

## 1. Purpose

PRICING-FEED-3B exposed an audit chart of intraday vs settlement ticks
but left no way to ask *"why is that one delta point so far off?"*.
The recent-ticks list endpoint omits `rawPayload` and `diagnostics` by
design (cheap responses), so the operator currently has to open Prisma
Studio to inspect any one row.

PRICING-FEED-3C closes that gap with a fourth, explicitly read-only
operator action:

| # | Action | Writes | Owner |
|---|---|---|---|
| 1 | Fetch provider preview (FEED-2A/B/C) | none | provider-preview route |
| 2 | Record tick (FEED-3A) | append-only `MarketSignalTick` | ticks `POST` route |
| 3 | **Inspect tick** (this sprint) | **none — read-only** | new `ticks/[id]` `GET` route |
| 4 | Apply / B2B refresh (FEED-1 + WIRE-2) | `MarketSignalSnapshot` / `PricingSnapshot.clientB2BPricePerKg` | manual confirm-token flows |

#3 never advances the operator past #4. There is no Apply button
anywhere in the inspector.

---

## 2. Files changed

### Created — pure inspector helper + tests

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalTickInspection.pure.ts](../../src/services/pricing/marketSignalTickInspection.pure.ts) | `validateMarketSignalTickInspectionId`, `detectKnownSecretKeys`, `serialiseMarketSignalTickInspection`, `buildMarketSignalTickInspectionFromRow`. No Prisma. Re-runs FEED-3A sanitisers on read. |
| [src/services/pricing/__tests__/marketSignalTickInspection.test.ts](../../src/services/pricing/__tests__/marketSignalTickInspection.test.ts) | 19 pure tests covering id validation, secret-key detection, ISO serialisation, sanitisation on read, no-mutation, no update/delete exports. |

### Created — API route

| Path | Role |
|---|---|
| [app/api/internal/pricing/market-signal/ticks/[id]/route.ts](../../app/api/internal/pricing/market-signal/ticks/%5Bid%5D/route.ts) | `GET` only. `requireDevRoute`. Maps service errors to `400 / 404 / 500`. |

### Modified

| Path | Change |
|---|---|
| [src/services/pricing/marketSignalTick.service.ts](../../src/services/pricing/marketSignalTick.service.ts) | New async `getMarketSignalTickInspection(id)`. Re-exports the inspector pure helpers + types so consumers don't need to learn the split. |
| [src/components/dev/pricing/MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) | `RecentTicksTable` gets an **Inspect** button per row. New `TickInspectorModal` overlay (close button, click-outside, no keyboard handling), renders identity grid + safety banner + diagnostics + raw payload `<details>`. No edit / delete / apply controls. |

### Created — docs

| Path | Role |
|---|---|
| [docs/pricing/PRICING-FEED-3C.md](../../docs/pricing/PRICING-FEED-3C.md) | This sprint report. |
| §27 anexado a [docs/pricing/PRICING-ENGINE-CANONICAL.md](../../docs/pricing/PRICING-ENGINE-CANONICAL.md) | Canonical sprint summary. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace
UI, client dashboard, contract creation / amend, demand intent service,
`Contract.lockedPricePerKg`, `DemandIntent.previewPricePerKg`,
`PricingSnapshot.clientB2BPricePerKg`, FEED-1 validator / encoder /
apply route, FEED-1B partner adapter, FEED-2A/B/C providers, FEED-3A
write path, FEED-3B audit chart, partner manual route,
`clientPricePerKg` rename, CoffeeAssistant.

---

## 3. API route

`GET /api/internal/pricing/market-signal/ticks/[id]`

- Auth: `requireDevRoute({ requireUser: true })`.
- Runtime: `nodejs`, `dynamic: force-dynamic`.
- Calls `getMarketSignalTickInspection(params.id)`.

| Outcome | Status |
|---|---|
| `id` is non-string / empty | `400` with `error.code = "MST_TICK_INVALID_ID"` |
| No row matches | `404` with `error.code = "MST_TICK_NOT_FOUND"` |
| OK | `200` with `MarketSignalTickInspectionResult` |
| Unexpected exception | `500` |

No `POST`, no `PATCH`, no `DELETE` are implemented. The pure-helper
test suite enforces that the inspector module exports no symbol whose
name contains `update / delete / remove / patch / mutate / apply`.

---

## 4. Service / helper behaviour

### `validateMarketSignalTickInspectionId(raw)`

```ts
{ ok: false, id: null, reason }            // non-string / empty / whitespace-only
{ ok: true,  id: trimmed }                 // trimmed non-empty string
```

### `detectKnownSecretKeys(payload)`

Walks `payload` recursively. Returns `true` if any **object key**
matches a secret-looking token (`apikey`, `api_key`, `api-key`,
`token`, `secret`, `authorization`, `auth`, `password`, `bearer`)
case-insensitively. Pure read — never mutates.

### `serialiseMarketSignalTickInspection(row)`

Pure serialiser. Converts `Date` fields (`capturedAt`, `validFrom`,
`expiresAt`, `createdAt`) to ISO strings. Accepts pre-stringified dates
too (round-tripped via `Date.parse`).

### `buildMarketSignalTickInspectionFromRow(row, { now? })`

The full pipeline:

```
row is null/undefined
  → { ok: false, error: MST_TICK_NOT_FOUND }
otherwise
  containsKnownSecretKeys = detectKnownSecretKeys(row.rawPayload)
  payloadOut              = sanitizeMarketSignalTickRawPayload(row.rawPayload)
  urlOut                  = sanitizeMarketSignalTickSourceUrl(row.sourceUrl)
  diagnosticsOut          = sanitizeMarketSignalTickRawPayload(row.diagnostics)
  tick = serialiseMarketSignalTickInspection(row) with sanitised payload + url + diagnostics overlaid
  safety = {
    rawPayloadSanitised:    payloadOut.changed || diagnosticsOut.changed
    sourceUrlSanitised:     urlOut.changed
    containsKnownSecretKeys
  }
  → { ok: true, generatedAt, tick, safety }
```

The pure helper **never mutates** the input row — separate test asserts
this on `rawPayload`, `sourceUrl` and `diagnostics` strings.

### `getMarketSignalTickInspection(id)` (Prisma)

1. Validate `id` → `MST_TICK_INVALID_ID` if bad.
2. `prisma.marketSignalTick.findUnique({ where: { id } })`.
3. Hand the row to `buildMarketSignalTickInspectionFromRow`.

Throws are caught and mapped to `MST_TICK_NOT_FOUND` so the route never
500s on transient DB hiccups.

---

## 5. UI changes

`/dev/market-signal` ([panel](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx)):

### `RecentTicksTable`

- New trailing column with an **Inspect** button per row.
- Button calls `onInspect(tick.id)` (lifted into the panel).
- Existing columns, mock/intraday/settlement badge and empty state
  are unchanged.

### `TickInspectorModal`

A modal-style overlay rendered conditionally when `inspectingTickId`
is set:

- Position: `fixed inset-0`, dim background, click-outside closes.
- Header: eyebrow `Dev Tools · Tick inspector` + H2
  `MarketSignalTick · read-only` + **Close** button (only mutating
  control on the page).
- Loading state, error state (`MST_TICK_INVALID_ID` / `MST_TICK_NOT_FOUND`
  surfaced verbatim), and the body once data lands.

### `TickInspectorBody`

- **Safety banner** at the top:
  - Amber tone with `Payload was sanitised before display` when any of
    `rawPayloadSanitised | sourceUrlSanitised | containsKnownSecretKeys`
    is true (plus an inline qualifier for *which* one fired).
  - Emerald tone with `No known secret keys detected. Payload preserved as stored.`
    when everything is clean.
- **Identity grid** (3 columns at lg): tick id, provider + kind,
  source, cPrice, demand index, confidence, symbol, contract month,
  raw value, raw unit, captured-at, created-at, valid-from, expires-at,
  source name.
- **Source URL** block (sanitised) and **Note** block, only rendered
  when present.
- **`DiagnosticsView`** — if the stored `diagnostics` is an array of
  `{ code, severity, message }` items it renders as a coloured list
  (error / warning / info tones). Otherwise it falls back to a pretty
  JSON `<details>` block.
- **Raw provider payload** `<details>` (collapsed by default), pretty
  JSON, scrollable.
- Footer reminder:
  > Read-only inspector. Does not change the active MarketSignalSnapshot, persisted B2B prices, contracts or demand intents.

No Edit / Apply / Delete controls anywhere. The only button is **Close**.

---

## 6. Security / read-time sanitisation

FEED-3A already sanitises on write. PRICING-FEED-3C adds a second pass
on **read**:

- `sanitizeMarketSignalTickSourceUrl` is re-applied to the stored URL.
  If it changes (allow-list miss, embedded `user:pass@`, fragment),
  the inspector reports `safety.sourceUrlSanitised = true` and the
  banner switches to the amber "sanitised before display" copy.
- `sanitizeMarketSignalTickRawPayload` is re-applied to `rawPayload`
  **and** `diagnostics`. Either's `changed` flag flips
  `safety.rawPayloadSanitised`.
- `detectKnownSecretKeys` runs against the **original** stored payload
  so the boolean reports "the DB row had a suspect key, even though we
  redacted it before returning."

This is belt-and-braces: legacy rows from before the FEED-3A
on-write sanitisers (or any external writer we don't own) can't leak
secrets through the inspector. The pure-test suite asserts that the
returned `tick.rawPayload` never contains the original secret string
when secret-looking keys are present, and that the `sourceUrl` never
contains a leaked apikey query param even when the stored row did.

The route is also guarded by `requireDevRoute` so it's inaccessible
to ordinary users.

---

## 7. Tests added

`npm run test:allocation` — **530/530 pass** (19 new over the 511
baseline; all in
[marketSignalTickInspection.test.ts](../../src/services/pricing/__tests__/marketSignalTickInspection.test.ts)).

- **ID validation** (3): non-string / null / undefined rejected; empty
  / whitespace-only rejected; trimmed non-empty accepted.
- **Secret-key detector** (4): nullish / primitives → false; clean
  payloads → false; nested `apiKey` / `token` / `Authorization` at any
  depth → true; case-insensitive + substring matches.
- **Serialiser** (2): ISO conversion for every date field;
  pre-stringified ISO dates round-trip.
- **Main builder** (10):
  - null row → `MST_TICK_NOT_FOUND`;
  - clean row → `safety.*` all false;
  - `rawPayload` with secret-looking keys → sanitised + safety reports both
    `rawPayloadSanitised` and `containsKnownSecretKeys`;
  - `sourceUrl?apikey=…` → scrubbed, `sourceUrlSanitised=true`;
  - `diagnostics` blob with secret-looking keys → scrubbed
    + `rawPayloadSanitised=true`;
  - **does not mutate the input row** (separate test on
    `rawPayload`/`sourceUrl`/`diagnostics`);
  - clean diagnostics array preserved verbatim;
  - null `sourceUrl` / `rawPayload` / `diagnostics` pass through;
  - dates → ISO consistently;
  - module surface enforces no `update` / `delete` / `apply` / `patch`
    / `mutate` exports.

Existing 511 tests untouched.

---

## 8. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **530 / 530 pass** |
| `npm run build` | ✓ Compiled successfully — `/api/internal/pricing/market-signal/ticks/[id]` in the manifest |

No migrations. No `prisma generate`. No new dependencies.

---

## 9. Manual validation steps

1. Ensure the FEED-3A migration is applied:
   ```
   npx prisma migrate deploy
   ```
2. Open `/dev/market-signal`.
3. **Mock provider path**:
   - Fetch `mock-delayed-ice` preview → **Record tick**.
   - In Recent provider ticks, click **Inspect** on the new row.
4. Confirm the modal shows:
   - **Safety banner**: emerald, `No known secret keys detected.`
   - **Identity grid**: `cPrice = 290.00`, `provider = mock-delayed-ice (MOCK)`, `source = API_FEED`, etc.
   - **Diagnostics**: rendered as a coloured list if the provider preview emitted structured diagnostics (info / warning / error).
   - **Raw provider payload**: collapsed by default; expanding it shows the JSON payload (with `[REDACTED]` placeholders only if the original row had secrets).
   - **No** Edit / Delete / Apply buttons. Only **Close**.
5. **Barchart path** (when `BARCHART_ONDEMAND_API_KEY` is set):
   - Record one `barchart-preview` tick.
   - Inspect it. Confirm the API key string **never** appears in
     `sourceUrl` or `rawPayload`.
   - If the banner is amber (`Payload was sanitised before display`),
     it's because FEED-3A already redacted on write — confirmed by
     `[REDACTED]` in the JSON view.
6. **Cross-route checks**:
   - `GET /api/internal/pricing/market-signal` → active snapshot unchanged.
   - `/dev/pricing` → persisted `clientB2BPricePerKg` unchanged.
   - Existing contracts / demand intents unchanged.
   - The inspector route doesn't accept anything other than `GET`:
     `curl -X DELETE /api/internal/pricing/market-signal/ticks/<id>`
     → `405` (Next.js default for missing handler).

---

## 10. Known limitations

- **No tick delete / retention cleanup.** `MarketSignalTick` stays
  append-only.
- **No diff view between two selected ticks.** A single-row inspector
  only — comparison is still done via the FEED-3B chart and recent
  ticks table.
- **No chart-point click → inspect.** The Recent provider ticks table
  is the entry point. A future small sprint could wire chart-point
  clicks to `openInspector(tick.id)`.
- **`rawPayload` is JSON-only.** No syntax highlighting, no provider-
  specific rendering. The `DiagnosticsView` falls back to JSON when
  the shape isn't the canonical `{code, severity, message}` array.
- **Read-time secret detection is best-effort.** Same scope as FEED-3A
  sanitisation: secret-looking *keys* are detected; secrets embedded
  inside free-form string values are not.
- **No DB-level guarantee** that historical rows are sanitised. The
  read-time sanitiser scrubs anything that slipped through.
- **Modal keyboard handling is minimal.** `Esc` is not wired (only
  click-outside + Close button). Acceptable for a dev tool — a future
  small sprint can add `Esc`.

---

## 11. Recommended next sprint

1. **PRICING-FEED-4A** — scheduled / manual EOD recording workflow:
   either a small admin tool to fire a settlement provider fetch on a
   schedule, or a "fire-and-record" button that combines fetch + record
   for the operator. Still preview-only at the apply layer.
2. **CLIENT-NAV-1** — vertical sidebar dashboard polish for
   `/platform/client` if product polish is the priority now.
3. **PRICING-FEED-3D** *(small follow-up)* — click-to-inspect from
   `TickSparkline` chart points, plus an `Esc`-to-close hook for the
   inspector modal.
