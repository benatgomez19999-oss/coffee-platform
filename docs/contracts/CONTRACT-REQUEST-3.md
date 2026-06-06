# CONTRACT-REQUEST-3

Persist the buyer's request parameters on `DemandIntent` so the
contract wizard hydrates identically whether the buyer continues
immediately or returns later, and add a price-drift guard to the
`WAITING → OPEN` confirm flow.

## 1. Summary

- **Schema** — `DemandIntent` gains two nullable columns:
  - `requestedDurationMonths Int?` (3, 6, 12, or 24)
  - `requestedStartDate DateTime?` (first-of-month UTC when set)
- **Pure helpers** in
  [`contractRequest.pure.ts`](../../src/services/contract-request/contractRequest.pure.ts):
  - `validateContractRequestDuration` — extracted from the main
    validator, falls back to the existing default.
  - `validateContractRequestStartDate` — accepts `YYYY-MM`,
    `YYYY-MM-DD`, ISO strings or `Date`; normalises to the first
    of that month UTC; rejects past months and months > 24 ahead.
  - `sanitiseContractRequestCreateInput` — thin alias for the
    service-layer / internal callers.
  - Existing `validateContractRequestInput` now also returns
    `requestedStartDate`.
- **Service** —
  [`demandIntent.service.ts`](../../src/services/clients/demandIntent.service.ts)
  `createDemandIntent` persists the two new fields. `confirmWaiting`
  re-runs `evaluateContractPriceDrift` against the lot's current B2B
  price before flipping to `OPEN`; if the price is higher, throws
  `PRICE_DRIFT_REQUIRES_REVIEW` with details and leaves the intent
  in `WAITING`. **`previewPricePerKg` is never mutated.**
- **Routes** —
  [`POST /api/demand-intent`](../../app/api/demand-intent/route.ts)
  forwards `requestedDurationMonths` + `requestedStartDate` to the
  service; accepts both `durationMonths` (modal) and
  `requestedDurationMonths` (canonical) names for backwards compat.
  [`POST /api/demand-intent/[id]/confirm`](../../app/api/demand-intent/[id]/confirm/route.ts)
  maps `PRICE_DRIFT_REQUIRES_REVIEW` to **HTTP 409** and spreads the
  drift detail bag (`previewPricePerKg`, `currentPricePerKg`,
  `delta`, `deltaPercent`, `driftStatus`) into the response.
- **Modal** —
  [`ConfigureMonthlySupplyModal`](../../src/components/platform/client/ConfigureMonthlySupplyModal.tsx)
  now sends `requestedDurationMonths` in the POST body. The
  `?duration=` URL hop is kept as a backwards-compat hint.
- **Contract wizard** —
  [`ContractCreateContent.tsx`](../../app/contract/create/ContractCreateContent.tsx)
  hydrates `supply.duration` from
  `intent.requestedDurationMonths` when present; falls back to the
  URL param (CONTRACT-REQUEST-2) and then to the legacy default.
- **27 new pure tests** added to
  [`contractRequest.test.ts`](../../src/services/contract-request/__tests__/contractRequest.test.ts);
  full project suite passes.

## 2. Migration

[`prisma/migrations/20260514000000_add_demand_intent_request_persistence`](../../prisma/migrations/20260514000000_add_demand_intent_request_persistence/migration.sql):

```sql
ALTER TABLE "DemandIntent"
  ADD COLUMN "requestedDurationMonths" INTEGER,
  ADD COLUMN "requestedStartDate"      TIMESTAMP(3);
```

Both columns nullable. No backfill. Existing intents continue
working — the wizard falls back to its legacy duration default for
them.

## 3. Files changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Two new optional columns on `DemandIntent`. |
| `prisma/migrations/20260514000000_add_demand_intent_request_persistence/migration.sql` | NEW migration. |
| `src/services/contract-request/contractRequest.pure.ts` | New `validateContractRequestDuration` / `validateContractRequestStartDate` / `sanitiseContractRequestCreateInput` helpers; main validator now returns `requestedStartDate`; new error codes `START_DATE_INVALID`, `START_DATE_TOO_OLD`, `START_DATE_TOO_FAR`; `CONTRACT_REQUEST_MAX_FUTURE_MONTHS` constant. |
| `src/services/contract-request/__tests__/contractRequest.test.ts` | 27 new tests covering duration / start-date helpers and the extended `validateContractRequestInput`. |
| `src/services/clients/demandIntent.service.ts` | `IntentServiceError` accepts a `details` bag; `createDemandIntent` persists the two new fields; `confirmWaiting` calls `evaluateContractPriceDrift` and throws `PRICE_DRIFT_REQUIRES_REVIEW` on a HIGHER current price (or missing prices). |
| `app/api/demand-intent/route.ts` | Forwards the new fields; accepts both `durationMonths` and `requestedDurationMonths`. |
| `app/api/demand-intent/[id]/confirm/route.ts` | Maps `PRICE_DRIFT_REQUIRES_REVIEW` to 409 and spreads `err.details`. |
| `src/components/platform/client/ConfigureMonthlySupplyModal.tsx` | Sends `requestedDurationMonths` in the POST body. |
| `app/contract/create/ContractCreateContent.tsx` | Wizard hydrates `supply.duration` from `intent.requestedDurationMonths` ahead of the URL param. |
| `docs/contracts/CONTRACT-REQUEST-3.md` | NEW — this file. |
| `docs/contracts/CONTRACT-REQUEST-1.md` / `CONTRACT-REQUEST-2.md` | Cross-link banners. |

## 4. Request duration / start-date behaviour

| Field | Allowed | Default | Persisted | Hydration priority |
|---|---|---|---|---|
| `requestedDurationMonths` | 3, 6, 12, 24 | `getDefaultContractRequestDurationMonths()` (6) | yes | intent → URL `?duration=` → wizard default (9) |
| `requestedStartDate` | `YYYY-MM`, `YYYY-MM-DD`, ISO; current month .. +24 months | `null` (not collected by the modal in this sprint) | yes | not yet consumed by the wizard — see §10 |

Past months are rejected with `START_DATE_TOO_OLD`. Months more
than `CONTRACT_REQUEST_MAX_FUTURE_MONTHS = 24` ahead are rejected
with `START_DATE_TOO_FAR`. All start-date inputs are normalised to
the **first of the month at 00:00 UTC** before persistence — so a
`YYYY-MM` and a full ISO date in the same month produce identical
rows.

`previewPricePerKg` is **immutable** post-creation. Neither
`confirmWaiting` nor any other mutation in this sprint updates it.
The buyer's remembered price stays the buyer's remembered price.

## 5. Modal changes

`ConfigureMonthlySupplyModal` now adds `requestedDurationMonths` to
the POST body. The duration query-param hop (`/contract/create?…&duration=`)
is retained as a backwards-compat hint for old wizard sessions, but
the canonical source of truth is now the intent row.

No new UI for start month in this sprint — the field is
schema-ready but the modal does not collect it yet. See §10.

## 6. Contract wizard hydration

In `ContractCreateContent.tsx` the intent fetch handler now overrides
`supply.duration` with `intent.requestedDurationMonths` when:

1. the field is a finite number, AND
2. the field is in the allow-list `{3, 6, 12, 24}`.

Otherwise the wizard keeps `prev.supply.duration` — which is whatever
the URL param + legacy default resolved to during page mount. This
means:

- Intents created after CONTRACT-REQUEST-3 → wizard always matches
  what the buyer entered in the modal.
- Intents created before CONTRACT-REQUEST-3 (NULL column) → wizard
  falls back to the URL param if the buyer was forwarded with one,
  otherwise to the legacy default (9).
- Buyer manually editing the URL param doesn't poison a fresh
  intent's value.

`requestedStartDate` is loaded onto the intent but not pre-filled
into the wizard's `supply` object in this sprint — the wizard's
draft type doesn't carry a start-date field today and the sprint
brief was explicit about not refactoring it. Documented as a
limitation; future work can extend the draft and surface it.

## 7. Wait / confirm drift handling

[`confirmWaiting`](../../src/services/clients/demandIntent.service.ts)
now runs a drift check inside the same transaction that flips
`WAITING → OPEN`. The check:

1. Re-fetches the lot's `pricingSnapshot`.
2. Resolves the current B2B roasted price via `resolveClientB2BPriceForLot`.
3. Calls `evaluateContractPriceDrift({ intentPreviewPricePerKg, currentPricePerKg })`.

Outcomes:

| Drift status | Action |
|---|---|
| `MATCH` | Confirm proceeds. |
| `LOWER_CURRENT_PRICE` | Confirm proceeds. The contract creation guard (CONTRACT-REQUEST-2) will lock at the lower price when the wizard signs. |
| `HIGHER_CURRENT_PRICE` | **Throws `PRICE_DRIFT_REQUIRES_REVIEW`**. Intent stays `WAITING`. No `Order` / `Contract` created. |
| `MISSING_INTENT_PRICE` / `MISSING_CURRENT_PRICE` | Same — blocking. The buyer creates a new request. |

Response body on the 409:

```json
{
  "code": "PRICE_DRIFT_REQUIRES_REVIEW",
  "error": "This lot's price changed since your request. Please review the updated price before continuing.",
  "previewPricePerKg": 12.34,
  "currentPricePerKg": 13.10,
  "delta": 0.76,
  "deltaPercent": 6.16,
  "driftStatus": "HIGHER_CURRENT_PRICE"
}
```

Existing supply re-check (`INSUFFICIENT_SUPPLY`) still runs first
and produces its own 409, so a buyer doesn't see a stale price
error when the underlying supply has actually gone away.

## 8. Tests

27 new pure tests in
[`contractRequest.test.ts`](../../src/services/contract-request/__tests__/contractRequest.test.ts):

- `validateContractRequestDuration` — accepts each allowed duration
  (3 / 6 / 12 / 24), numeric strings, rejects 5, rejects non-numeric,
  defaults on null / undefined, no leakage of technical terms.
- `validateContractRequestStartDate` — null / undefined / blank
  → null; `YYYY-MM` normalises to first-of-month UTC; full ISO
  normalises to first-of-month; current month accepted; past month
  → `START_DATE_TOO_OLD`; +25 months → `START_DATE_TOO_FAR`; +24
  months allowed; malformed → `START_DATE_INVALID`; valid `Date`
  accepted and normalised; invalid `Date` rejected; no mutation.
- `validateContractRequestInput` extended cases — start date echoed
  to `value.requestedStartDate`; past start date rejected; input
  not mutated.
- `sanitiseContractRequestCreateInput` — defined-as-alias contract.

No service-layer integration harness exists for `confirmWaiting`
(Prisma `$transaction`, no mocking pattern in repo). The drift
behaviour falls back to **manual validation** (§10).

Full project suite: see §9.

## 9. Commands run

```
npx prisma generate           # client regenerated
npx tsc --noEmit              # clean
npm run test:allocation       # full suite
npm run build                 # clean
```

The migration file is in place; in a real deploy run
`npx prisma migrate deploy` or `npx prisma db push` against the
target DB.

## 10. Manual validation

1. Apply migration (`prisma migrate deploy` / `db push`).
2. Log in as a `CLIENT` user.
3. `/platform/client` → open **Configure monthly supply**.
4. Select duration **12 months**, submit.
5. Inspect the new `DemandIntent` row:
   `requestedDurationMonths = 12`, `requestedStartDate IS NULL`.
6. Continue to `/contract/create?intentId=…`.
7. Wizard step 3 preselects **12 months** sourced from the intent
   (verify by also stripping the `?duration=` from the URL — the
   value should remain 12 because the intent carries it).
8. Old intent regression: pick an intent in the DB with
   `requestedDurationMonths IS NULL` and visit
   `/contract/create?intentId=<id>`. Wizard duration falls back
   to **9** (legacy default).

Wait-flow drift:

9. Force-create a `WAITING` intent (e.g. submit a volume request
   that the semaphore rejects, then `POST /wait`).
10. Bump `PricingSnapshot.clientB2BPricePerKg` on the linked lot
    upward by more than the tolerance (€0.01/kg).
11. `POST /api/demand-intent/<id>/confirm` →
    **409 `PRICE_DRIFT_REQUIRES_REVIEW`** with `previewPricePerKg`,
    `currentPricePerKg`, `delta`, `deltaPercent`, `driftStatus`
    in the body.
12. Intent row remains `status = WAITING`. No `Order` / `Contract`
    created.
13. Drop the price back below the preview. Re-`POST /confirm` →
    **200** (`LOWER_CURRENT_PRICE` is non-blocking). Intent
    becomes `OPEN`. `previewPricePerKg` unchanged.
14. Same-price scenario: confirm succeeds as before.

Regression:

15. CONTRACT-REQUEST-2 contract-creation drift guard still fires
    when the buyer reaches the create step with a stale preview.
16. No `Contract` is created directly by the modal.
17. Dashboard "Pending requests" KPI is unaffected.

## 11. Known limitations

- **`requestedStartDate` is not collected by the modal yet.** The
  schema and helpers are ready; UI surface is deferred. Until the
  modal collects it, every new intent will store `NULL`.
- **`requestedStartDate` is not yet consumed by the contract
  wizard.** The wizard draft doesn't carry a start-date field. A
  future sprint can extend the draft and surface a "Start month"
  step.
- **No notes field on `DemandIntent`.** Skipped per sprint brief.
- **No notification when wait-confirm is blocked by drift.** The
  buyer learns about it via the 409 in whatever UI calls confirm.
  The dashboard has no waiting-intent UI in this sprint.
- **Old intents (pre-migration) have NULL duration / start date.**
  Wizard falls back gracefully; no backfill.
- **No service-level integration tests** for `confirmWaiting` /
  `createDemandIntent` — repo has no Prisma `$transaction` harness.
  Manual validation above covers the workflow.
- **Drift detail leak.** The 409 response includes the current B2B
  price. That number is already visible on the marketplace /
  catalog endpoints for `PUBLISHED` lots, so the exposure here is
  equivalent. If a future sprint wants to gate price visibility
  by buyer relationship, this response will need to be revisited.
- **`durationMonths` body alias.** The route accepts both
  `durationMonths` (modal's existing field name) and
  `requestedDurationMonths` (canonical). When both are present
  the canonical one wins.

## 12. Related sprints

- [CONTRACT-REQUEST-1](./CONTRACT-REQUEST-1.md) — original modal +
  semaphore + intent lifecycle.
- [CONTRACT-REQUEST-2](./CONTRACT-REQUEST-2.md) — contract-creation
  price-drift guard. This sprint reuses the same
  `evaluateContractPriceDrift` helper at the wait-confirm boundary.
- Future: **AUDIT-LOG-1** — append-only record of price-gate +
  proof-gate decisions for compliance.
