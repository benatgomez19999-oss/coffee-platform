# PRICING-FEED-1B — Consolidate legacy partner market-signal route

Sprint scope: route refactor that replaces the duplicated validation +
write logic in `/api/partner/market-signal` with calls into the shared
`marketSignalIngestion` service. After this sprint there is **one**
validator, **one** transactional deactivate-then-create write path and
**one** provenance encoder for every `MarketSignalSnapshot` writer in
the codebase.

No Prisma schema change. No migrations. No B2B refresh. No allocation /
contract / demand-intent changes.

---

## 1. Purpose

Pre-sprint state — two MarketSignalSnapshot writers:

| Writer | Validator | Provenance | Active uniqueness |
|---|---|---|---|
| `/api/partner/market-signal` (legacy) | inline | plain `note` string | inline transaction |
| `/api/internal/pricing/market-signal` (FEED-1) | shared `validateMarketSignalCandidate` | `buildMarketSignalProvenanceNote` | shared `applyMarketSignalIngestion` |

Risk: drift. The two routes could disagree on what counts as valid (cPrice
floor, demandIndex range, expiresAt rules) and on how `note` is structured.

Post-sprint state: both routes share the FEED-1 service. The partner
route only carries auth + body adapter + response shape adapter.

---

## 2. Files changed

### Created

| Path | Role |
|---|---|
| [src/services/pricing/partnerMarketSignalAdapter.ts](../../src/services/pricing/partnerMarketSignalAdapter.ts) | Pure mapping layer: `parsePartnerMarketSignalBody`, `buildPartnerMarketSignalResponse`, `buildPartnerMarketSignalErrorResponse`. No Prisma. |
| [src/services/pricing/__tests__/partnerMarketSignalAdapter.test.ts](../../src/services/pricing/__tests__/partnerMarketSignalAdapter.test.ts) | 17 pure tests covering mapping, end-to-end-through-validator, response shapes. |

### Modified

| Path | Change |
|---|---|
| [app/api/partner/market-signal/route.ts](../../app/api/partner/market-signal/route.ts) | `POST` now delegates validation + write to `applyMarketSignalIngestion`. Auth (`PARTNER` role via `getUserFromRequest`) preserved. `GET` semantics preserved (raw active snapshot row). All inline validation / `prisma.$transaction` write logic removed. |

### Untouched (verified)

Prisma schema, migrations, target tables, allocation engine, marketplace UI,
client dashboard, contract creation, contract amend, demand intent service,
`Contract.lockedPricePerKg`, `DemandIntent.previewPricePerKg`,
PricingSnapshot writes, `clientPricePerKg` rename, FEED-1 service +
validator + provenance encoder, FEED-1 internal route, FEED-2A providers
+ provider-preview route + dev UI, CoffeeAssistant.

---

## 3. Partner route behaviour — before / after

### Before

```
POST /api/partner/market-signal
  ├─ getUserFromRequest + role === PARTNER
  ├─ validate cPrice (typeof number, finite, 50..600)
  ├─ validate demandIndex (typeof number, finite, 0.8..1.2)
  ├─ validate source against VALID_SOURCES
  ├─ validate expiresAt (string → Date, future check)
  ├─ prisma.$transaction:
  │     updateMany({ isActive: true }, { isActive: false })
  │     create({ cPrice, demandIndex, source, isActive: true, note, expiresAt })
  └─ return raw Prisma snapshot
```

### After

```
POST /api/partner/market-signal
  ├─ getUserFromRequest + role === PARTNER          (unchanged)
  ├─ parsePartnerMarketSignalBody(body)              (adapter)
  │     stamps provenance.provider="partner-route"
  │     confidence="OPERATOR_VERIFIED"
  │     rawValue=cPrice, rawUnit=US_CENTS_PER_LB
  ├─ applyMarketSignalIngestion(candidate)           (FEED-1 service)
  │     • validateMarketSignalCandidate (shared)
  │     • buildMarketSignalProvenanceNote (shared)
  │     • prisma.$transaction:
  │         updateMany({ isActive: true }, { isActive: false })
  │         create({ ... }) returning the new active row
  ├─ buildPartnerMarketSignalResponse(result)        (adapter)
  └─ return legacy snapshot fields at top level
                + diagnostics[] + ingestion {ok, applied}
```

The route file is now ~80 lines instead of ~150 and contains zero
duplicated rules.

---

## 4. Shared validation / write path

After this sprint, every `MarketSignalSnapshot` write in the codebase
goes through the same chain:

```
candidate
   ↓
validateMarketSignalCandidate (FEED-1 pure)
   ↓ ok
applyMarketSignalIngestion (FEED-1 service, transactional)
   ↓
{ deactivate previous active rows, create new active row }
   ↓
{ ok, applied: true, diagnostics, createdSnapshot }
```

Validation rules now enforced uniformly:

- `cPrice` — finite number in `[50, 600]` US ¢/lb. **No silent clamping.**
  Tests prove `49 → reject`, not `49 → 50`.
- `demandIndex` — finite number in `[0.8, 1.2]`.
- `source` — `MANUAL | API_FEED | INTERNAL_COMPUTE | AI_SYSTEM`.
- `validFrom` — optional date, defaults to `now`.
- `expiresAt` — optional date; if present must be **strictly after**
  both `validFrom` and `now`.
- `provenance` — optional but warned when missing; partner route always
  stamps it via the adapter.

---

## 5. Auth compatibility

Preserved exactly:

```
const user = await getUserFromRequest(req)
if (!user)               → 401 { error: "Unauthorized" }
if (user.role !== "PARTNER") → 403 { error: "Forbidden" }
```

The route was **not** switched to `requireDevRoute`. Access remains
PARTNER-only. CLIENT and PRODUCER cannot reach this route — same as
before.

---

## 6. Provenance handling

The adapter stamps every partner POST candidate with a fixed
`PARTNER_PROVENANCE`:

```ts
provider:    "partner-route"
sourceName:  "Partner submitted market signal"
sourceUrl:   null
retrievedAt: now (server-side)
rawValue:    cPrice (when finite)
rawUnit:     "US_CENTS_PER_LB"
confidence:  "OPERATOR_VERIFIED"
```

The shared `buildMarketSignalProvenanceNote` then encodes this — plus
the user-provided `note` as `userNote="..."` — into the snapshot's
`note` column. Both routes now produce notes that begin with
`PRICING-FEED-1 |` and follow the same `key=value | key=value` shape,
so future tooling can parse provenance without case-by-case adapters.

---

## 7. Response shape

### Success (200)

Legacy top-level snapshot fields are preserved verbatim, with
`diagnostics` + `ingestion` added alongside:

```json
{
  "id":          "snap-1",
  "cPrice":      290,
  "demandIndex": 1.10,
  "source":      "MANUAL",
  "isActive":    true,
  "note":        "PRICING-FEED-1 | provider=partner-route | …",
  "validFrom":   "2026-05-09T12:00:00.000Z",
  "expiresAt":   null,
  "createdAt":   "2026-05-09T12:00:00.000Z",
  "diagnostics": [
    { "code": "MSI_CANDIDATE_VALID", "severity": "info", "message": "…" }
  ],
  "ingestion":   { "ok": true, "applied": true }
}
```

### Validation error (400)

```json
{
  "error":       "cPrice 49 is outside the in-band range [50, 600] cents/lb. Sprint policy: no silent clamp — reject.",
  "diagnostics": [ { "code": "MSI_CPRICE_OUT_OF_RANGE", "severity": "error", "message": "…" } ]
}
```

`error` is set to the first error-severity diagnostic message so
existing clients that read `body.error` keep working without a
breaking change.

---

## 8. Tests added

`npm run test:allocation` — **414/414 pass** (17 new over the 397
baseline).

All new tests live in
[partnerMarketSignalAdapter.test.ts](../../src/services/pricing/__tests__/partnerMarketSignalAdapter.test.ts):

- **Mapping** (6): valid body → candidate; provenance stamps
  `provider="partner-route"` + `confidence="OPERATOR_VERIFIED"` +
  `rawUnit="US_CENTS_PER_LB"`; legacy `note` → user note; missing
  source → 400 + `MSI_INVALID_SOURCE`; unknown source → 400; non-finite
  cPrice → `provenance.rawValue = null`.
- **End-to-end through shared validator** (5): `cPrice = 49` →
  `MSI_CPRICE_OUT_OF_RANGE`; no silent clamping (`49` stays `49`);
  `demandIndex = 1.5` → `MSI_DEMAND_INDEX_OUT_OF_RANGE`; `expiresAt` in
  past → `MSI_EXPIRES_IN_PAST`; valid candidate ends with
  `OPERATOR_VERIFIED`.
- **Success response adapter** (4): preserves legacy top-level fields;
  adds `diagnostics` + `ingestion`; never includes
  `clientB2BPricePerKg` / `lockedPricePerKg` / `previewPricePerKg`;
  defensive throw when `createdSnapshot` is missing.
- **Error response adapter** (2): picks first error message; falls back
  to a generic message when only warnings exist.

Existing 397 tests untouched.

---

## 9. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run test:allocation` | **414 / 414 pass** |
| `npm run build` | ✓ Compiled successfully — `/api/partner/market-signal` route still in the manifest |

No migrations, no `prisma generate` needed.

---

## 10. Manual validation steps

### Happy path

1. As a PARTNER user, `POST /api/partner/market-signal`:
   ```json
   {
     "cPrice": 290,
     "demandIndex": 1.1,
     "source": "MANUAL",
     "note": "Partner consolidation test"
   }
   ```
2. Confirm `200` with the snapshot at top level + `diagnostics` and
   `ingestion: { ok: true, applied: true }`.
3. `GET /api/internal/pricing/market-signal` (dev/internal route) →
   confirm the new active snapshot is the partner-route-applied one.
4. Confirm the snapshot's `note` starts with `PRICING-FEED-1 |` and
   contains `provider=partner-route` and `confidence=OPERATOR_VERIFIED`.

### Validation paths

1. POST with `cPrice = 49` → `400` with `error` =
   `cPrice 49 is outside the in-band range …` and `diagnostics`
   carrying `MSI_CPRICE_OUT_OF_RANGE`.
2. POST with `demandIndex = 1.5` → `400` with `MSI_DEMAND_INDEX_OUT_OF_RANGE`.
3. POST with past `expiresAt` → `400` with `MSI_EXPIRES_IN_PAST`.
4. POST without `source` → `400` with `MSI_INVALID_SOURCE`.

### Cross-route

1. `/dev/market-signal` page still works (manual + provider preview).
2. `/dev/pricing` reflects the new market signal applied via partner.
3. **No** `PricingSnapshot.clientB2BPricePerKg` row changed automatically.
4. **No** existing `Contract.lockedPricePerKg` /
   `DemandIntent.previewPricePerKg` row mutated.

---

## 11. Known limitations

- **Partner route still requires the caller to provide values manually.**
  No external feed wired in (PRICING-FEED-2B will land that for the
  internal route's provider seam).
- **No external provider writes yet.** Provider preview from FEED-2A
  is preview-only; no writer calls a provider directly.
- **No cron / scheduled refresh.** Every snapshot is human-triggered.
- **No automatic B2B refresh.** Two-step intent preserved: signal then
  `/dev/pricing` apply.
- **No typed provenance JSON column.** Provenance still lives inside
  the `note` string (FEED-1 design choice, kept here).
- **No DB-level unique-active constraint.** Active uniqueness is still
  enforced by the application transaction
  (`updateMany({ isActive: true }, { isActive: false })` then `create`).
  A future migration sprint could add a partial-unique index.
- **Partner route `GET` was not consolidated.** It remains a direct
  Prisma read returning the raw row, because the existing client
  contract expects that exact shape. Consolidation here would change
  the response and was therefore out of scope.

---

## 12. Recommended next sprint

1. **PRICING-FEED-2B** — live Barchart fetch path behind
   `BARCHART_ONDEMAND_API_KEY`, still preview-only, using the provider
   seam from FEED-2A. With this consolidation in place, anything the
   live provider produces now flows through the same validator + apply
   path the partner and dev routes use.
2. **PRICING-FEED-1C** *(small follow-up)* — add a Postgres partial
   unique index `(isActive=true)` so the active uniqueness is also
   guaranteed at DB level, not just inside the apply transaction.
3. **CLIENT-NAV-1** — vertical sidebar dashboard polish for
   `/platform/client`.
