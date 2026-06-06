# PRICING-FEED-3B — Market signal audit chart: intraday vs settlement

Sprint scope: an audit-only view that turns the `MarketSignalTick`
history (FEED-3A) into a side-by-side intraday vs settlement
comparison — summary cells + lightweight inline SVG sparkline. **Read-only.**
No DB writes. No active `MarketSignalSnapshot` apply. No B2B refresh.

---

## 1. Purpose

`PRICING-FEED-3A` introduced the append-only `MarketSignalTick` table
and the recent-ticks list. That gives us the data, but no obvious way
to see whether intraday Barchart values are diverging from
settlement-style values. PRICING-FEED-3B closes that loop:

- Pure helper to bucket ticks by provider class
  (`INTRADAY | SETTLEMENT | MOCK | OTHER`) and compute the
  intraday-vs-settlement delta from the latest of each.
- Compact "Market signal audit" section on `/dev/market-signal` with
  four summary cells + a 700×180 SVG sparkline (no chart library).
- Mock-provider points are visible but muted, so they don't distort the
  intraday-vs-settlement comparison.

The three product actions remain orthogonal:

| Action | Writes | Path |
|---|---|---|
| Provider preview (FEED-2A/B/C) | none | provider-preview route |
| Record tick (FEED-3A) | append-only `MarketSignalTick` | tick `POST` route |
| Apply active snapshot (FEED-1) | `MarketSignalSnapshot` | manual confirm-token flow |

This sprint reads from #2 and visualises it. It never advances the
operator past the manual apply step.

---

## 2. Files changed

### Created — pure helper + tests

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalTickSeries.pure.ts](../../src/services/pricing/marketSignalTickSeries.pure.ts) | `buildMarketSignalTickSeries`, `classifyMarketSignalTickProvider`, `computeMarketSignalTickDelta`. No Prisma, no fetch, no env. |
| [src/services/pricing/__tests__/marketSignalTickSeries.test.ts](../../src/services/pricing/__tests__/marketSignalTickSeries.test.ts) | 20 pure tests covering classification, sorting, bucketing, latest selection, delta math, defensive filtering, no-mutation, edge cases. |

### Created — docs

| Path | Role |
|---|---|
| [docs/pricing/PRICING-FEED-3B.md](../../docs/pricing/PRICING-FEED-3B.md) | This sprint report. |
| §26 anexado a [docs/pricing/PRICING-ENGINE-CANONICAL.md](../../docs/pricing/PRICING-ENGINE-CANONICAL.md) | Canonical sprint summary. |

### Modified

| Path | Change |
|---|---|
| [src/components/dev/pricing/MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) | New "Market signal audit" section (above "Recent provider ticks") with `AuditCell` summaries and an inline `TickSparkline` SVG. Series is computed from existing `ticks` state via `useMemo(buildMarketSignalTickSeries)`. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace
UI, client dashboard, contract creation/amend, demand intent service,
`Contract.lockedPricePerKg`, `DemandIntent.previewPricePerKg`,
`PricingSnapshot.clientB2BPricePerKg`, FEED-1 validator + apply route,
FEED-1B partner adapter, FEED-2A/B/C providers, FEED-3A tick service +
route, internal API routes (audit reads from the existing
`/api/internal/pricing/market-signal/ticks` GET), `clientPricePerKg`
rename, CoffeeAssistant.

---

## 3. Series / helper behaviour

`buildMarketSignalTickSeries(ticks)` returns:

```ts
{
  points:                Array<{
    id, providerId,
    providerClass: "INTRADAY" | "SETTLEMENT" | "MOCK" | "OTHER",
    capturedAt: ISO, cPrice, demandIndex | null, confidence | null,
  }>
  intradayPoints, settlementPoints, mockPoints
  latestIntraday, latestSettlement, latestAny
  cPriceMin, cPriceMax
  deltaIntradayVsSettlement: { absolute, percent, intradayCapturedAt, settlementCapturedAt } | null
}
```

Defensive rules (assertions in tests):

- `points` is sorted **ascending** by `capturedAt` so the sparkline
  draws left-to-right; ties break on `id` for deterministic output.
- `latestIntraday / latestSettlement / latestAny` are derived by max
  `capturedAt`, **not** array order.
- A tick is dropped from `points` when:
  - `cPrice` is not finite or `≤ 0`,
  - `capturedAt` is unparseable.
- `cPriceMin / cPriceMax` are computed from the surviving points only.
- `deltaIntradayVsSettlement` returns `null` whenever either bucket is
  empty — never a zero or fake value.
- `delta.absolute = intraday.cPrice - settlement.cPrice`,
  `delta.percent = (… / settlement.cPrice) × 100`, both rounded to
  2 decimals.
- The function never mutates the input array (separate test).

`classifyMarketSignalTickProvider(providerId)` is a tiny lookup:

| providerId | class |
|---|---|
| `barchart-preview` | `INTRADAY` |
| `barchart-settlement-preview` | `SETTLEMENT` |
| `mock-delayed-ice` | `MOCK` |
| anything else (or non-string) | `OTHER` |

`computeMarketSignalTickDelta({ latestIntraday, latestSettlement })` is
exposed separately so other callers can request a delta without
rebuilding the full series.

---

## 4. UI changes

`/dev/market-signal` ([panel](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx))
gains one section between "External provider preview" and "Recent
provider ticks":

### "Market signal audit"

- **Four summary cells:**
  1. **Latest intraday** — `cPrice ¢/lb` + `capturedAt` (amber accent).
  2. **Latest settlement** — `cPrice ¢/lb` + `capturedAt` (emerald accent).
  3. **Δ intraday − settlement** — absolute (signed) + percent. Accent
     amber when positive, emerald when negative, muted when null.
  4. **Latest confidence** — settlement first then intraday fallback,
     plus the total tick count.
- **Inline `TickSparkline` SVG** — 700×180 viewBox, `preserveAspectRatio="none"`
  so it scales to container width:
  - Frame + min/max y labels in the top-left and bottom-left corners.
  - Earliest / latest `capturedAt` labels along the x axis.
  - Two foreground polylines + dot markers:
    - **Intraday** — `#d6a04b` (amber).
    - **Settlement** — `#3a6b35` (emerald).
  - **Mock points** — dashed light line + small dimmed dots
    (`#bfae92` at 50–60% opacity), so they're visible for context but
    don't compete with the real comparison.
  - Real-time scaling along the x axis (linear in `Date.parse`) so
    irregular sampling intervals read correctly. With one point only,
    x falls back to viewport midpoint.
  - 5% padding on the y axis so a flat series doesn't sit on the frame.
- **Legend** below the chart: intraday / settlement / mock + axis
  hint. Plus a one-line read-only reminder:
  > Read-only audit. Recording or charting ticks does not change the active MarketSignalSnapshot, persisted B2B prices, contracts or demand intents.

Empty state: when no ticks yet, the section renders a friendly
dashed-border block pointing the operator at the **Record tick**
button above. The chart itself also has a graceful empty path when
`points.length === 0`.

No new dependencies. No chart library. The SVG is hand-rendered.

---

## 5. Tests added

`npm run test:allocation` — **511/511 pass** (20 new over the 491
baseline; all in
[marketSignalTickSeries.test.ts](../../src/services/pricing/__tests__/marketSignalTickSeries.test.ts)).

- **Classifier** (4): `barchart-preview` → `INTRADAY`;
  `barchart-settlement-preview` → `SETTLEMENT`; `mock-delayed-ice` →
  `MOCK`; unknown / empty / null / undefined → `OTHER`.
- **Builder** (12):
  - empty input → empty buckets, all `null` deltas / mins / maxes;
  - sorts ascending by `capturedAt` with `id` tie-break;
  - buckets across all four classes;
  - `cPriceMin` / `cPriceMax` across all surviving points;
  - latest intraday + latest settlement picked by `capturedAt`,
    not array order;
  - non-finite cPrice (`NaN`, `±Infinity`, `≤0`) ignored;
  - unparseable `capturedAt` ignored;
  - `confidence` and `demandIndex` preserved on each point;
  - **input array not mutated**;
  - intraday-only → `deltaIntradayVsSettlement = null`;
  - settlement-only → `deltaIntradayVsSettlement = null`;
  - both present → absolute + percent computed correctly with the
    `capturedAt` of each side; sign correct when intraday < settlement.
- **Direct delta helper** (4): null on missing sides; rounding to 2
  decimals on both `absolute` and `percent`.

Existing 491 tests untouched.

---

## 6. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **511 / 511 pass** |
| `npm run build` | ✓ Compiled successfully — no new routes; existing `/api/internal/pricing/market-signal/ticks` still in the manifest |

No migrations, no `prisma generate`, no new dependencies.

---

## 7. Manual validation steps

1. Apply the FEED-3A migration if not already applied:
   ```
   npx prisma migrate deploy
   ```
2. Open `/dev/market-signal`.
3. Provider preview → `mock-delayed-ice` → **Fetch provider preview** →
   **Record tick**. The mock point should appear muted (dashed) on the
   chart once it draws.
4. With `BARCHART_ONDEMAND_API_KEY` set:
   - **Fetch** `barchart-preview` → **Record tick**.
   - **Fetch** `barchart-settlement-preview` → **Record tick**.
5. Confirm "Market signal audit":
   - **Latest intraday** cell shows the `barchart-preview` cPrice + timestamp (amber).
   - **Latest settlement** cell shows the `barchart-settlement-preview` cPrice + timestamp (emerald).
   - **Δ intraday − settlement** shows a signed `¢/lb` and a `%` value.
   - The sparkline draws two short lines (intraday + settlement) plus
     muted mock dots; legend at the bottom labels each.
6. Repeat the fetch + record on different scenarios (`mock-delayed-ice`
   `low` / `neutral` / `high`) — the chart should grow points
   left-to-right as `capturedAt` advances.
7. Confirm the active `MarketSignalSnapshot` is unchanged
   (`GET /api/internal/pricing/market-signal`). Persisted
   `clientB2BPricePerKg` is unchanged (`/dev/pricing` still shows
   yesterday's values until you explicitly run the FEED-1 apply and
   the PRICING-WIRE-2 B2B refresh).

---

## 8. Known limitations

- **No automatic tick recording.** Each tick is still operator-triggered.
- **No cron / scheduled history fill-in.**
- **No realtime UI** — the audit panel only refreshes after a manual
  `Record tick` action; refreshing the page also re-fetches.
- **Simple inline SVG only.** No tooltips on hover, no zoom, no
  brush-and-zoom, no proper d3-style axes / gridlines.
- **No retention cleanup.** Append-only with no scheduled prune;
  long windows can clutter the chart over time. Consider a
  `since=<ISO>` query filter (already supported by the FEED-3A list
  endpoint) before this becomes painful.
- **No settlement dedicated endpoint** at the provider level yet — the
  settlement provider still uses `getQuote.json`. If/when Barchart
  exposes a true EOD endpoint, the chart will reflect it transparently
  without changes here (PRICING-FEED-2D).
- **Mock points share the chart with real providers.** They are muted
  but not hidden, because operators sometimes use the mock to seed
  fixtures for the chart layout itself.
- **List endpoint omits `rawPayload` / `diagnostics`** — the chart
  doesn't need them and skipping them keeps responses cheap.

---

## 9. Recommended next sprint

1. **PRICING-FEED-2D** — dedicated Barchart EOD / `getHistory.json`
   settlement endpoint. With FEED-3A + 3B in place, FEED-2D would
   surface higher-confidence settlement points on the same chart.
2. **CLIENT-NAV-1** — vertical sidebar dashboard polish for
   `/platform/client` (the historical mock targets a left navigation
   that still doesn't exist).
3. **PRICING-FEED-3C** *(small follow-up)* — per-row tick inspector
   route exposing `rawPayload` + `diagnostics` for a single tick id;
   useful when the chart shows an unexpected delta.
