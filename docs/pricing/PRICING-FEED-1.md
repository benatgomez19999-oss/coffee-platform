# PRICING-FEED-1 — Controlled C-price / MarketSignal ingestion

Sprint scope: a safe, validated, auditable ingestion path for
`MarketSignalSnapshot`. Two-step preview/apply workflow, structured
diagnostics, provenance encoded into the existing `note` column. **Does
not** auto-refresh persisted B2B prices — that stays an explicit step on
`/dev/pricing`.

No external commodity feed wired. No cron. No Prisma schema change.

---

## 1. Purpose

Pre-sprint state:
- `MarketSignalSnapshot` exists, but the only writer was the partner POST
  route, which performed validation inline.
- Operators / dev tooling had no preview-before-write surface.
- No structured provenance — only a free-form `note` string.
- Risk: a typo in a manual signal could silently distort marketplace and
  contract pricing the moment the next refresh ran.

Post-sprint state:
- Pure validator emits typed diagnostics (`error | warning | info`).
- Service layer enforces transactional active-uniqueness.
- Internal API route gates writes behind a confirm token.
- Dev UI runs preview → apply with explicit confirmation.
- Provenance metadata is folded into `note` deterministically.
- Existing partner route is **untouched** — backwards compatible.

The sprint also ships a tiny provider seam (`MarketSignalProvider`) so
PRICING-FEED-2 can plug in an external C-price adapter without
re-architecting.

---

## 2. Files changed

### Created — pure validator + tests

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalIngestion.types.ts](../../src/services/pricing/marketSignalIngestion.types.ts) | Pure types (input candidate, normalised candidate, diagnostics, source/confidence/unit unions, in-band constants). |
| [src/services/pricing/marketSignalIngestion.pure.ts](../../src/services/pricing/marketSignalIngestion.pure.ts) | `validateMarketSignalCandidate` + `buildMarketSignalProvenanceNote`. No Prisma. Importable under node --test. |
| [src/services/pricing/__tests__/marketSignalIngestion.test.ts](../../src/services/pricing/__tests__/marketSignalIngestion.test.ts) | 20 pure tests. |

### Created — service + provider seam

| Path | Role |
|---|---|
| [src/services/pricing/marketSignalIngestion.service.ts](../../src/services/pricing/marketSignalIngestion.service.ts) | `previewMarketSignalIngestion`, `applyMarketSignalIngestion`, `listRecentMarketSignalSnapshots`, `manualProvider` + `MarketSignalProvider` interface. |

### Created — API + UI

| Path | Role |
|---|---|
| [app/api/internal/pricing/market-signal/route.ts](../../app/api/internal/pricing/market-signal/route.ts) | `GET` (active + recent) + `POST` (preview / apply with `confirm: "APPLY_MARKET_SIGNAL"`). Guarded by `requireDevRoute`. |
| [app/dev/market-signal/page.tsx](../../app/dev/market-signal/page.tsx) | Shell. |
| [src/components/dev/pricing/MarketSignalIngestionPanel.tsx](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx) | Active signal card · recent snapshots table · new-signal form · diagnostics block · next-step hint. |

### Modified

| Path | Change |
|---|---|
| [src/components/dev/pricing/PricingInspectorPanel.tsx](../../src/components/dev/pricing/PricingInspectorPanel.tsx) | "Manage market signal →" link below the active signal card, pointing at `/dev/market-signal`. Existing preview/apply controls untouched. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace UI,
client dashboard, contract creation, contract amend, demand intent service,
existing partner `/api/partner/market-signal` route, `clientPricePerKg`
naming, PricingSnapshot writes (no auto-refresh of B2B), CoffeeAssistant.

---

## 3. Validation rules

`validateMarketSignalCandidate(candidate, { now? })` →
`{ ok: true, candidate } | { ok: false, diagnostics }`.

| Field | Rule | Diagnostic on violation |
|---|---|---|
| `cPrice` | finite number, **50–600** US ¢/lb | `MSI_INVALID_CPRICE`, `MSI_CPRICE_OUT_OF_RANGE` |
| `demandIndex` | finite number, **0.8–1.2** | `MSI_INVALID_DEMAND_INDEX`, `MSI_DEMAND_INDEX_OUT_OF_RANGE` |
| `source` | one of `MANUAL \| API_FEED \| INTERNAL_COMPUTE \| AI_SYSTEM` | `MSI_INVALID_SOURCE` |
| `validFrom` | optional date; defaults to `now` | `MSI_INVALID_VALID_FROM` |
| `expiresAt` | optional date; if present must be **strictly after** `validFrom` and **strictly after now** | `MSI_INVALID_EXPIRES_AT`, `MSI_EXPIRES_BEFORE_VALID_FROM`, `MSI_EXPIRES_IN_PAST` |
| `provenance` | optional; missing emits `warning` | `MSI_PROVENANCE_MISSING`, `MSI_PROVENANCE_PARTIAL` |
| `confidence` | optional; defaults to `MEDIUM`; unknown values warn | `MSI_PROVENANCE_PARTIAL` |
| `rawUnit` | only `US_CENTS_PER_LB` accepted; other values warn + coerce | `MSI_PROVENANCE_PARTIAL` |
| valid candidate | always emits `MSI_CANDIDATE_VALID` (info) | — |

**No silent clamping.** A `cPrice = 49` is rejected, not clamped to 50.
The test suite explicitly asserts this so future changes can't quietly
introduce clamping.

---

## 4. API route

`/api/internal/pricing/market-signal` — `requireDevRoute({ requireUser: true })`,
`runtime: nodejs`, `dynamic: force-dynamic`.

### `GET`

```json
{
  "active":  { "id", "cPrice", "demandIndex", "source", "validFrom", "expiresAt", "createdAt", "note", "isActive" } | null,
  "recent": [ … last 10 rows ordered by createdAt desc ]
}
```

### `POST`

Body:

```json
{
  "apply":   false,
  "confirm": "APPLY_MARKET_SIGNAL",
  "cPrice":   290,
  "demandIndex": 1.10,
  "source":   "MANUAL",
  "note":     "manual test",
  "validFrom":   "2026-05-09T12:00:00.000Z",
  "expiresAt":   "2026-05-30T00:00:00.000Z",
  "provenance": {
    "provider":  "manual",
    "sourceName": "Operator dashboard",
    "sourceUrl":  null,
    "retrievedAt": "2026-05-09T12:00:00.000Z",
    "rawValue":   290,
    "rawUnit":    "US_CENTS_PER_LB",
    "confidence": "OPERATOR_VERIFIED"
  }
}
```

Rules:
- `apply` defaults to **false**.
- `apply: true` requires exactly `confirm: "APPLY_MARKET_SIGNAL"`, else **400**.
- Invalid candidate → **400** with `diagnostics`.
- Valid preview → **200**, `applied: false`, no DB writes.
- Valid apply → **200**, `applied: true`, transactional deactivate-then-create.

### Apply transaction

```ts
prisma.$transaction(async tx => {
  await tx.marketSignalSnapshot.updateMany({
    where: { isActive: true },
    data:  { isActive: false },
  })
  return tx.marketSignalSnapshot.create({
    data: {
      cPrice, demandIndex, source, isActive: true,
      note: buildMarketSignalProvenanceNote(candidate),
      validFrom, expiresAt,
    },
  })
})
```

The previous active row stays in the table (just flipped `isActive=false`)
so the recent-snapshots view still shows the history.

---

## 5. Dev UI

`/dev/market-signal` ([page](../../app/dev/market-signal/page.tsx) + [panel](../../src/components/dev/pricing/MarketSignalIngestionPanel.tsx)):

1. **Active market signal** — cPrice, demand, source, validFrom, expires, createdAt, plus a collapsible note with full provenance string.
2. **Recent snapshots** — table of the last 10 rows, active badge first.
3. **New signal form** — cPrice, demandIndex, source, confidence, provider, sourceName, sourceUrl, user note, validFrom, expiresAt. Two buttons:
   - **Preview signal** → `POST` with `apply: false`. No DB writes.
   - **Apply signal** → browser-confirm dialog, then `POST` with `apply: true` + `confirm: "APPLY_MARKET_SIGNAL"`.
4. **Diagnostics panel** — color-coded error / warning / info entries, with the engine-level diagnostic codes left visible for traceability.
5. **Next step hint** — explicit reminder + link to `/dev/pricing` because this route never refreshes B2B prices on its own.

`/dev/pricing` overview now also has a small "Manage market signal →" link
under the active-signal block so operators don't have to memorise the URL.

---

## 6. Provenance handling

The `MarketSignalSnapshot` schema has no dedicated provenance fields, so
provenance metadata is encoded into the existing `note` string by
`buildMarketSignalProvenanceNote(candidate)`:

```
PRICING-FEED-1 | cPrice=290 | demandIndex=1.1 | provider=manual |
sourceName=Operator dashboard | rawValue=290 | rawUnit=US_CENTS_PER_LB |
confidence=OPERATOR_VERIFIED | retrievedAt=2026-05-09T12:00:00.000Z |
userNote="manual test"
```

Format choices:
- `key=value` separated by ` | ` so it's grep-friendly.
- The user-supplied free-form note is wrapped in quotes and double-quotes
  inside it are escaped with `\"` — the value can be parsed back if a
  future sprint wants structured access without changing the schema.
- Always starts with `PRICING-FEED-1` so future tooling can detect
  ingestion-built notes vs hand-typed ones.

When the operator wants pure structured JSON we can swap this to a
`JSON.stringify` block in one place; tests assert format invariants
(`includes provider/sourceName/confidence/rawUnit`), not exact spacing.

**Why no schema change?** Adding columns would require a migration which
the sprint explicitly blocks. The note column is a `String?` so it's free
to use. If a future sprint promotes provenance to a typed JSON column,
the encoder is the single point of update.

---

## 7. What ingestion updates / does not update

| Updated by `apply: true` | Untouched |
|---|---|
| New `MarketSignalSnapshot` row created with `isActive=true` | `PricingSnapshot.clientB2BPricePerKg` |
| Previous `isActive=true` rows flipped to `isActive=false` | `PricingSnapshot.clientPricePerKg` (legacy GREEN) |
|  | `GreenLot.pricePerKg` |
|  | `Contract.lockedPricePerKg` (every existing row) |
|  | `DemandIntent.previewPricePerKg` (every existing row) |
|  | Allocation engine output |
|  | Target pricing tables |

The new snapshot only affects future computations performed by:
- `lotVerification.service` at lot verification time,
- the marketplace adaptive recompute fallback for un-migrated rows,
- `/dev/pricing` dry-run / apply (PRICING-WIRE-2),
- `/dev/pricing/lot/[id]` inspector recompute (PRICING-ADMIN-1).

If the operator wants persisted B2B prices to follow the new signal, they
**explicitly** run apply on `/dev/pricing` after this. Two-step intent.

---

## 8. Tests added

`npm run test:allocation` — **380/380 pass** (20 new over the 360 baseline).

All new tests live in
[marketSignalIngestion.test.ts](../../src/services/pricing/__tests__/marketSignalIngestion.test.ts):

- **Happy path** (4): full candidate validates, validFrom defaults to `now`, expiresAt nullable with warning, missing provenance still ok with warning.
- **cPrice rejection** (5): below 50, above 600, NaN/Infinity, non-number, no-silent-clamp invariant.
- **demandIndex rejection** (3): below 0.8, above 1.2, NaN.
- **source / dates rejection** (5): unknown source, expiresAt before validFrom, expiresAt in past, invalid validFrom string, invalid expiresAt string.
- **Provenance note builder** (3): includes provider/sourceName/confidence/rawUnit; user-note quote escaping; retrievedAtFallback honoured when `provenance.retrievedAt` is null.

`package.json` already runs the `src/services/pricing/__tests__/*.test.ts`
glob so no script change was needed.

---

## 9. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **380/380 pass** |
| `npm run build` | ✓ Compiled successfully — `/api/internal/pricing/market-signal` and `/dev/market-signal` in the manifest |

No migrations, no `prisma generate` re-run needed.

---

## 10. Manual validation steps

1. Open `/dev/market-signal`.
2. Form values:
   - `cPrice = 290`
   - `demandIndex = 1.10`
   - `source = MANUAL`
   - `confidence = OPERATOR_VERIFIED`
   - User note: `"Manual test PRICING-FEED-1"`
3. Click **Preview signal**. Diagnostics panel shows:
   - `MSI_CANDIDATE_VALID` (info)
   - `MSI_PROVENANCE_PARTIAL` warnings only when fields are missing.
   - "Would deactivate active: yes/no".
   - **No** DB writes.
4. Click **Apply signal**, confirm browser dialog.
   - Banner: `Applied. New active cPrice=290 / demand=1.10. Open /dev/pricing to preview B2B drift before applying any price refresh.`
5. `GET /api/internal/pricing/market-signal` → previous snapshot now has `isActive=false`, the new one is active.
6. `/dev/pricing` → market signal block shows cPrice 290 / demand 1.10. Per-lot table may show non-zero deltas for lots persisted under a different signal.
7. **Do not** apply B2B refresh automatically — that stays a separate explicit decision (`/dev/pricing` → Apply refresh).
8. Optional: apply another signal `cPrice=330, demand=1.15`. Confirm only one active row remains; both previous rows are visible in the recent table.

---

## 11. Known limitations

- **No external API feed yet.** This sprint ships the architectural seam (`MarketSignalProvider` + `manualProvider`) but every value is operator-typed.
- **No scheduled ingestion.** No cron, no background job. Apply is always explicit.
- **No automatic B2B price refresh.** By design — see PRICING-WIRE-2.
- **Provenance lives in `note`** (a structured string) because the schema has no dedicated provenance columns. Promoting to a typed JSON column is a future migration sprint.
- **Historical contracts untouched.** `Contract.lockedPricePerKg` keeps its historical value forever.
- **Historical demand intents untouched.** `DemandIntent.previewPricePerKg` keeps its historical value forever.
- **Active uniqueness is enforced in the application transaction** (deactivate-then-create), not via a Postgres unique constraint. A future sprint could add a partial-unique-index on `(isActive=true)` if we want belt-and-braces guarantees.
- ~~**The existing partner route is left untouched.**~~ Consolidated in PRICING-FEED-1B — `/api/partner/market-signal` POST now delegates to `applyMarketSignalIngestion`. See [PRICING-FEED-1B.md](./PRICING-FEED-1B.md).
- **No admin override / rollback UI.** To revert to a previous snapshot you currently re-apply it as a new row.

---

## 12. Recommended next sprint

1. **PRICING-FEED-2** — external provider adapter (NYC C / ICE) with safe **preview-only** fetch path. Same `MarketSignalProvider` interface; the existing apply route accepts whatever the adapter returns.
2. **CLIENT-NAV-1** — vertical sidebar dashboard polish for `/platform/client` to match the original target mock.
3. **PRICING-FEED-1B** *(small follow-up)* — consolidate the partner manual route to call this service so the two writers share a single validator + provenance encoder. Optional once the dev workflow has settled.
