# CONTRACT-REQUEST-1

> Extended by [CONTRACT-REQUEST-3](./CONTRACT-REQUEST-3.md) — duration
> selected in the modal is now persisted on `DemandIntent`
> (`requestedDurationMonths`) and the contract wizard hydrates from
> the intent ahead of the URL param. A `requestedStartDate` column
> is also persisted (UI capture deferred).

Activates the previously-disabled "Configure monthly supply" CTAs in
the client dashboard. Clicking on a lot opens a modal that creates a
**DemandIntent** for that specific lot. No Contract, signature or
payment is created in this sprint — those remain in the existing
`/contract/create?intentId=…` wizard, which the modal hands off to
once supply is confirmed.

The audit in `CONTRACT-REQUEST-0` documented two gaps:

- G1 — `/api/demand-intent` did not enforce a role check.
- G2 — no duplicate-intent guard for `(companyId, greenLotId)`.

Both are closed here.

## User flow

1. Buyer (`role === "CLIENT"`) lands on `/platform/client` and sees the
   recommended supply row + the catalog grid.
2. Buyer clicks **Configure monthly supply** on a recommended card, or
   the **+** button on a catalog card.
3. Modal opens with: lot photo / name / origin, price/kg roasted,
   monthly volume input, duration buttons (3 / 6 / 12 / 24 months),
   estimated monthly total.
4. Buyer submits → `POST /api/demand-intent` with
   `{ greenLotId, requestedKg, type: "CREATE" }`.
5. Response is mapped via `formatDemandIntentOutcome`:
   - **approved** (semaphore green / status OPEN): modal shows a
     success card with **Continue to contract →**, routes to
     `/contract/create?intentId=<id>`.
   - **counter** (yellow / COUNTERED): modal shows
     "We can offer X kg/month" + **Accept X kg/month** (POSTs to
     `/api/demand-intent/[id]/accept`, then routes to the wizard) +
     **Cancel** (POSTs to `/api/demand-intent/[id]/cancel`).
   - **rejected** (red / REJECTED): modal shows
     "Not enough supply for that monthly volume" + **Notify me when
     supply opens** (POSTs to `/api/demand-intent/[id]/wait` with
     `autoExecute: false`).
6. After any successful submit, the dashboard refetches
   `/api/demand-intent`; the relevant card swaps its CTA for a
   **Pending request** chip, and the **Pending Requests** KPI in the
   hero strip increments.

## Why DemandIntent, not Contract

Per CONTRACT-REQUEST-0's audit and the platform's product direction,
a contract represents a commitment that has been *accepted by both
sides*. The dashboard CTA must:

- reserve supply (so the lot's `contractAssignableRoastedKg`
  shrinks immediately for everyone — handled by `getContractableSupply`
  reading `deltaKg` of open intents),
- not bypass the existing OTP signature flow,
- not auto-create a Stripe subscription or shipment,
- be cancellable.

`DemandIntent` already does all of that. `createContractWithSupplyValidation`
runs only when the buyer reaches step 3 of the existing
`/contract/create` wizard and OTP-signs.

## Server hardenings

### Role guard (G1)
All five demand-intent routes now require `user.role === "CLIENT"`:

- `POST /api/demand-intent`
- `GET /api/demand-intent`
- `POST /api/demand-intent/[id]/accept`
- `POST /api/demand-intent/[id]/wait`
- `POST /api/demand-intent/[id]/cancel`
- `POST /api/demand-intent/[id]/confirm`

Non-CLIENT requests get a `403 { code: "FORBIDDEN" }`. The canonical
role string matches the dev factory's seed
(`devContractScenario.service.ts:156` writes `role: "CLIENT"`) and the
marketplace's default branch (`app/platform/page.tsx:47`).

### Payload validation
The route delegates to `validateContractRequestInput`. The same helper
is used client-side by the modal so the front and back agree on the
caps and on the producer-friendly error copy. Body fields:

- `greenLotId` — required, non-empty string, trimmed.
- `requestedKg` — required, finite > 0, ≤ `MAX_MONTHLY_ROASTED_KG`
  (50 000), rounded to integer. Accepts numeric strings too because the
  modal's `<input type="number">` sometimes hands them off as strings.
- `durationMonths` — optional, must be one of `[3, 6, 12, 24]` when
  supplied; ignored by the service (not persisted).
- `type` — optional, defaults to `"CREATE"`. `"AMEND"` still works
  for the legacy contract-amend path.

### Duplicate guard (G2)
Inside the same Prisma `$transaction` that creates the row,
`createDemandIntent` now refuses to insert if the same
`(companyId, greenLotId)` already has a non-expired intent in
`OPEN | COUNTERED | WAITING`:

```ts
const existing = await tx.demandIntent.findFirst({
  where: {
    companyId,
    greenLotId,
    status: { in: ["OPEN", "COUNTERED", "WAITING"] },
    expiresAt: { gt: new Date() },
  },
})
if (existing) throw new IntentServiceError(..., "DUPLICATE_REQUEST")
```

The route surfaces this as `409 { code: "DUPLICATE_REQUEST",
existingIntentId, existingStatus }`. The modal shows
*"You already have a request open for this lot."* and the catalog
card swaps its CTA for the pending chip.

## Volume + pricing behaviour

- **Volume unit**: client-facing values are always ROASTED kg.
  `requestedKg` in the request is roasted; `Contract.monthlyVolumeKg`
  later locks in roasted; only the service-internal `deltaKg` and
  `monthlyGreenKg` are green.
- **Pricing source**: `DemandIntent.previewPricePerKg` is set by
  `resolveClientB2BPriceForLot`, the same resolver `createContractWithSupplyValidation`
  uses for `Contract.lockedPricePerKg`. The number the modal shows the
  buyer is the same number they will sign at, **unless the partner
  re-prices the lot between the intent and the contract** — a known
  edge case carried forward from the audit.

## Files changed

| File | Purpose |
|---|---|
| `src/services/contract-request/contractRequest.pure.ts` | **New** — validate input, format outcome, pending-intent helper |
| `src/services/contract-request/__tests__/contractRequest.test.ts` | **New** — 27 pure tests |
| `app/api/demand-intent/route.ts` | Role guard (CLIENT) + payload validation + 409 mapping for DUPLICATE_REQUEST |
| `app/api/demand-intent/[id]/accept/route.ts` | Role guard |
| `app/api/demand-intent/[id]/wait/route.ts` | Role guard + autoExecute is now strictly opt-in |
| `app/api/demand-intent/[id]/cancel/route.ts` | Role guard |
| `app/api/demand-intent/[id]/confirm/route.ts` | Role guard |
| `src/services/clients/demandIntent.service.ts` | Duplicate-intent guard inside the transaction |
| `src/components/platform/client/ConfigureMonthlySupplyModal.tsx` | **New** — modal UI with the three outcome states |
| `src/components/platform/client/SupplyDeskPanel.tsx` | Activated CTA + pending chip on recommended cards |
| `src/components/platform/client/ClientContractCatalogPanel.tsx` | Activated `+` CTA + pending chip on catalog grid |
| `src/components/platform/client/Dashboard.tsx` | Holds modal state, builds the pending-intent id set, refreshes intents after submit |
| `package.json` | Test glob now picks up `contract-request` |
| `docs/contracts/CONTRACT-REQUEST-1.md` | This document |

## Tests added

**27 new pure tests** in `src/services/contract-request/__tests__/`:

- `validateContractRequestInput` (13): canonical input, trim
  `greenLotId`, reject missing/empty `greenLotId`, reject non-string
  `greenLotId`, reject missing `requestedKg`, reject `requestedKg <= 0`,
  reject `NaN/Infinity/non-numeric strings`, accept numeric strings,
  round fractional kg, reject above cap, accept each duration option,
  reject duration outside `{3,6,12,24}`, default duration when omitted,
  **no technical terms leaked in error messages**.
- `hasPendingRequestForLot` (8): detects `OPEN`, `COUNTERED`, `WAITING`,
  ignores `CANCELLED / CONSUMED / EXPIRED / REJECTED`, ignores other
  lots, case-insensitive status, null inputs.
- `formatDemandIntentOutcome` (5): green → approved, yellow → counter
  with rounded `offeredKg`, red → rejected, never leaks semaphore enum
  names in headlines, malformed payload returns `null`.

**Full project**: 777 / 777 pass, tsc clean.

**Not covered by automated tests** (no Prisma HTTP harness in the
repo):
- Role guard returning 403 for PRODUCER / PARTNER.
- Duplicate guard returning 409.
- Green / yellow / red paths writing the right row.

These are validated manually below.

## Commands run

- `npx tsc --noEmit` ✅ clean
- `npm run test:allocation` ✅ 777/777
- `npm run build` ✅ EXIT=0 on retry. The first attempt failed
  intermittently on `/api/assistant/story` static collection (an
  unrelated dynamic-server-usage warning emitted by every route that
  reads cookies). Pre-existing environment artefact, not introduced
  by this sprint.

## Manual validation

1. `npx prisma migrate deploy` (no new migration this sprint, just
   ensures the DB is current).
2. Seed lots via `/dev/scenarios/lots` → `marketplace_mix` or
   `contract_catalog_mix`.
3. Log in as a CLIENT (`devContractScenario.service.ts` writes
   `role: "CLIENT"` on the dev client user).
4. `/platform/client` → recommended row or catalog grid → click a
   lot's **Configure monthly supply** / **+**.
5. Modal shows: image / origin / price / available kg, monthly volume
   input, 3/6/12/24 buttons, estimated monthly total updates live.
6. Submit a reasonable volume (e.g. 200 kg/month, 6 months) →
   approved/green path:
   - Outcome card "Supply is available — your request is approved.".
   - **Continue to contract →** routes to
     `/contract/create?intentId=<id>` (existing wizard).
   - Dashboard hero KPI "Pending Requests" increments by 1.
   - The card now shows a "Pending request" chip.
7. Try the same lot again → modal returns
   *"You already have a request open for this lot."* (409
   DUPLICATE_REQUEST).
8. Submit an unreasonably large volume (e.g. 30 000 kg/month) on a
   lot with limited supply → yellow path:
   - Outcome card *"We can offer X kg/month on this lot."*
   - **Accept X kg/month →** POSTs to `/accept`, routes to wizard.
   - **Cancel** clears the intent.
9. Submit a volume far above the lot's supply → red path:
   - Outcome card *"This lot doesn't have enough supply for that
     monthly volume."*
   - **Notify me when supply opens** POSTs to `/wait` with
     `autoExecute: false`, modal shows confirmation toast.
10. Log in as a PRODUCER / PARTNER. Manually
    `POST /api/demand-intent` (Postman or browser console) →
    `403 { code: "FORBIDDEN" }`.
11. Confirm **no `Contract` row is created** until the buyer
    completes `/contract/create` + OTP. The contracts table count is
    unchanged after step 6.
12. Confirm the modal's price equals the catalog DTO's
    `pricePerKgRoasted` (same `resolveClientB2BPriceForLot` source as
    the eventual contract lock).
13. Confirm marketplace + client dashboard cards still render the
    public media carousel (LOT-MEDIA-2 path) — buyer-private media
    is never touched here.
14. Mobile viewport: modal slides up from the bottom, footer stays
    pinned, Escape / overlay click close it.

## Known limitations

- **`durationMonths` is captured in the modal but not persisted on
  `DemandIntent`.** The contract wizard reads `intent.requestedKg`
  only; duration is re-confirmed at signature time. Adding
  `DemandIntent.requestedDurationMonths Int?` is a tiny additive
  schema change for a future sprint if product wants analytics.
- **No `notes` field** at request time. `DemandIntent` has no `notes`
  column; the audit flagged this as optional.
- **No `startMonth` field** at request time. The contract still
  defaults to `startDate: new Date()` at signature.
- **No signature / payment** in this sprint. That's the existing
  `/contract/create` wizard's responsibility.
- **No notification sending** when a `WAITING` intent's lot regains
  supply. `autoExecute = false` always; a future sprint can poll
  these or push notifications.
- **No HTTP-route integration tests** because the repo has no Prisma
  test harness for routes. Pure-helper coverage is comprehensive (27
  tests).
- **Counter / wait wording** is functional but may benefit from
  Founder copy polish — none of it leaks semaphore names.
- **Pricing drift** between intent and contract is still possible if
  the partner repricies the lot. The audit flagged this as a Medium
  risk to revisit when the wizard handoff is hardened.

## Recommended next sprint

- **CONTRACT-REQUEST-2** — tighten the contract-creation handoff.
  Concretely: re-read the lot's `clientB2BPricePerKg` immediately
  before the OTP step and refuse to sign if it drifted more than ε
  from the intent's `previewPricePerKg`. Optionally persist
  `requestedDurationMonths` on `DemandIntent`.
- Or **STORAGE-MEDIA-1 / PARTNER-MEDIA-2B** if media upload moving
  off URL-paste becomes the more pressing operational gap.
