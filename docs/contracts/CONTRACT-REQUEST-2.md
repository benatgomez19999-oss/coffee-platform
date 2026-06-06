# CONTRACT-REQUEST-2

> Extended by [CONTRACT-REQUEST-3](./CONTRACT-REQUEST-3.md) — the same
> `evaluateContractPriceDrift` helper now runs at the
> `WAITING → OPEN` confirm boundary, returning **409
> `PRICE_DRIFT_REQUIRES_REVIEW`** when a waiting intent's preview
> price has fallen behind the current B2B price. The intent stays
> `WAITING`; the buyer creates a new request at the new price.

Price drift guard between `DemandIntent.previewPricePerKg` and the
lot's current B2B price right before contract creation / signature.
No buyer can sign at a different price than the one the dashboard
showed them when they sent the request.

Builds on [CONTRACT-REQUEST-1](./CONTRACT-REQUEST-1.md), which
captured `previewPricePerKg` on the intent. This sprint adds the
**check + clean failure mode** at the two server-side handoff
points (`createContractWithSupplyValidation` on CREATE, the AMEND
branch of `/api/contracts/verify-otp`), maps the failure to HTTP 409,
and lands two blocking UI panels showing **old vs current price**.

## 1. Summary
- New pure helper `evaluateContractPriceDrift` shared by CREATE and
  AMEND paths.
- Policy: HIGHER blocks (`PRICE_DRIFT_REQUIRES_REVIEW`); LOWER is
  allowed silently — the contract auto-locks at the new lower price
  (favourable for the buyer); MISSING preview / current both block.
- `ContractServiceError` carries an optional `details` payload so the
  route layer can echo `{ previewPricePerKg, currentPricePerKg,
  driftStatus, delta, deltaPercent }` to the wizard without a
  re-fetch.
- Tolerance: `CONTRACT_PRICE_DRIFT_TOLERANCE_EUR = 0.01` (1 ¢/kg).
- Tiny **duration handoff** ride-along: the configure-monthly-supply
  modal now forwards `&duration=N` and the wizard pre-selects it.

## 2. Files changed

| File | Purpose |
|---|---|
| `src/services/contract-request/contractPriceDrift.pure.ts` | **New** — `evaluateContractPriceDrift`, tolerance constant, drift status union |
| `src/services/contract-request/__tests__/contractPriceDrift.test.ts` | **New** — 12 pure tests |
| `src/services/clients/contracts.service.ts` | Drift guard inside the demand-intent branch of `createContractWithSupplyValidation`; `ContractServiceError.details` payload |
| `app/api/contracts/create/route.ts` | Maps `PRICE_DRIFT_REQUIRES_REVIEW` to 409 and echoes `details` |
| `app/api/contracts/verify-otp/route.ts` | AMEND branch loads the lot's current price, runs the drift helper, refuses with 409 before consuming the intent or applying the amend |
| `app/contract/create/step3Preview.tsx` | Blocking panel on 409 from `/api/contracts/create`; Sign button disabled while drift is active |
| `app/contract/verify-otp/VerifyOtpClient.tsx` | Blocking panel on 409 from `/api/contracts/verify-otp`; OTP form hidden while drift is active |
| `src/components/platform/client/ConfigureMonthlySupplyModal.tsx` | Adds `&duration=…` to the contract-create redirect |
| `app/contract/create/ContractCreateContent.tsx` | Reads `?duration=` and pre-selects the wizard's duration when the value is in `{3, 6, 12, 24}` |
| `docs/contracts/CONTRACT-REQUEST-2.md` | This document |

## 3. Price drift policy

| Result | Status code | Blocking? | Behaviour |
|---|---|---|---|
| Within `±0.01 €/kg` | `MATCH` | No | Proceed |
| Current cheaper by more than tolerance | `LOWER_CURRENT_PRICE` | **No** | Contract auto-locks at the **lower** current price (buyer-favourable); no user-facing notice from the server today |
| Current more expensive by more than tolerance | `HIGHER_CURRENT_PRICE` | **Yes** | 409 `PRICE_DRIFT_REQUIRES_REVIEW`; intent stays `OPEN`; no contract is created / amended |
| Either price is null/zero/NaN/Infinity | `MISSING_*_PRICE` | **Yes** | 409, same handling — defensive against half-built data |

`evaluateContractPriceDrift` returns `{ status, blocking, delta,
deltaPercent, message, previewPricePerKg, currentPricePerKg }`. Tests
explicitly assert the buyer-facing `message` never leaks enum names
or technical column names (`HIGHER_CURRENT_PRICE`,
`clientB2BPricePerKg`, `PricingSnapshot`, etc.).

Custom tolerances are accepted via `absoluteTolerance` (e.g. for
tests). Non-numeric / negative custom tolerances are ignored and the
helper falls back to the default.

## 4. Server guard locations

### CREATE path
Inside `createContractWithSupplyValidation` ([contracts.service.ts](src/services/clients/contracts.service.ts)),
in the existing `if (input.demandIntentId)` branch. The check runs
**before** the intent is flipped to `CONSUMED` and **before** the
`Contract` row is created. The branch:

1. Loads the intent (now also selecting `previewPricePerKg` and
   `greenLotId`).
2. Validates `status === "OPEN"` and not expired (existing logic).
3. **NEW**: calls `evaluateContractPriceDrift` with
   `intent.previewPricePerKg` and `lockedPricePerKg` (the value the
   contract would lock at — already resolved a few lines above via
   `resolveClientB2BPriceForLot`).
4. If `drift.blocking`, throws
   `ContractServiceError("…", "PRICE_DRIFT_REQUIRES_REVIEW",
   { previewPricePerKg, currentPricePerKg, driftStatus, delta,
   deltaPercent })`. The transaction rolls back, so no row is
   touched.
5. Otherwise (MATCH or LOWER), the intent is consumed and the
   contract is created with the freshly-resolved `lockedPricePerKg`
   — for LOWER drift this is the new, cheaper price.

The route `/api/contracts/create` maps the code to **HTTP 409** and
echoes `error.details` into the response body.

### AMEND path
Inside `/api/contracts/verify-otp` ([verify-otp/route.ts](app/api/contracts/verify-otp/route.ts)),
right after the existing intent-validity checks and **before**
`amendContractWithSupplyValidation` is called:

1. Re-reads the lot + its `pricingSnapshot` (the amend flow doesn't
   already have it loaded).
2. Resolves the current price via `resolveClientB2BPriceForLot`.
3. Runs `evaluateContractPriceDrift`.
4. If blocking, returns **HTTP 409** with the same payload shape
   used by `/api/contracts/create`. No mutation happens: the intent
   is **not** consumed, the contract is **not** flipped to `SIGNED`,
   the signature token is **not** marked verified.

If `evaluateContractPriceDrift` itself fails (lot or pricing snapshot
absent), `currentPricePerKg` arrives as `null`, the helper returns
`MISSING_CURRENT_PRICE` and the same 409 path triggers.

## 5. UI handling

### Step 3 (CREATE) — `app/contract/create/step3Preview.tsx`
- New local state `priceDrift: { previewPricePerKg, currentPricePerKg, message } | null`.
- `signContract()` intercepts `code === "PRICE_DRIFT_REQUIRES_REVIEW"`
  from `/api/contracts/create` and populates `priceDrift` instead of
  alerting.
- When set, a warning-toned panel renders above the Sign button with
  two cards — **Your request** (`previewPricePerKg`) and **Current
  price** (`currentPricePerKg`) — plus **Return to dashboard** (routes
  to `/platform/client`) and **Dismiss** (clears the panel so the
  buyer can retry after a refresh).
- The Sign button is disabled and labelled "Sign Contract" while
  `priceDrift` is set, preventing accidental retries.

### Verify OTP (AMEND) — `app/contract/verify-otp/VerifyOtpClient.tsx`
- New local state mirrors step 3.
- `verify()` checks `res.status === 409 && data.code === "PRICE_DRIFT_REQUIRES_REVIEW"`
  before the generic error path, populates `priceDrift`, clears the
  OTP digits.
- When `priceDrift` is set, the entire OTP UI is replaced by a
  blocking panel that mirrors the step-3 layout (same copy, same
  pair of price cards, same "Return to dashboard" / "Dismiss"
  buttons).

Neither panel exposes `pricingSource`, `driftStatus`, the helper's
enum values or any internal column names.

## 6. Duration handoff decision
**Trivial path taken — no schema change.**

- The configure-monthly-supply modal builds the post-submit URL as
  `/contract/create?intentId=<id>&duration=<3|6|12|24>`.
- `ContractCreateContent.tsx` reads `searchParams.get("duration")`,
  parses it, accepts the value only if it is in the modal's allowed
  set, and seeds `draft.supply.duration` accordingly. Anything else
  (missing, junk, out-of-range) falls back to the legacy default of
  9 months so existing entry points (no `?duration=`) keep their
  behaviour.
- Nothing is persisted on `DemandIntent`. Persisting
  `requestedDurationMonths` remains an additive migration for a
  future sprint if product wants analytics.

## 7. Tests added

**12 new pure tests** in `src/services/contract-request/__tests__/contractPriceDrift.test.ts`:

- Match / tolerance (4): exact, within default tolerance, custom
  tolerance, invalid custom tolerance falls back.
- Higher (2): clearly higher → blocking; delta rounds to 4 decimals
  and percent to 2.
- Lower (2): clearly lower → not blocking; headline mentions "lower
  than your original request".
- Missing (3): missing preview → blocking; missing current →
  blocking; non-positive prices (0, -1, NaN, Infinity) → blocking on
  both sides.
- Messages (1): no enum / technical names leak in any of the five
  status branches.

**Project totals**: 789 / 789 pass. tsc clean. Build EXIT=0.

Route / service integration tests for the 409 flow are documented
under "Manual validation" — repo still has no Prisma HTTP test
harness.

## 8. Commands run

- `npx tsc --noEmit` ✅ clean
- `npm run test:allocation` ✅ 789 / 789
- `npm run build` ✅ EXIT=0

No migration. No prisma generate.

## 9. Manual validation

1. Seed lots via `/dev/scenarios/lots` (`marketplace_mix` or
   `contract_catalog_mix`).
2. Log in as a CLIENT, hit `/platform/client`.
3. Click **Configure monthly supply** on a lot. Note the price shown
   in the modal — that's the `previewPricePerKg` the intent will
   capture.
4. Submit a reasonable volume. Confirm `DemandIntent.previewPricePerKg`
   in Prisma Studio matches the modal's price.
5. **Higher path** — in Prisma Studio, edit the lot's
   `PricingSnapshot.clientB2BPricePerKg` upward by more than €0.01.
   - Click **Continue to contract →** in the dashboard's pending
     row.
   - In step 3 of the wizard, click **Sign Contract**.
   - Expect: HTTP 409 from `/api/contracts/create`; the warning panel
     appears with the original request price and the new higher
     price. Sign button is disabled.
   - Check the DB: no new `Contract` row, intent is still `OPEN`.
6. **Lower path** — edit `clientB2BPricePerKg` downward by more than
   €0.01. Retry the sign flow.
   - Expect: contract is created at the new lower price,
     `Contract.lockedPricePerKg` matches the new value, OTP is sent,
     wizard advances normally.
7. **Match path** — restore the original price. Retry. Contract
   flows through cleanly.
8. **AMEND path** — start from a CLIENT who has an `ACTIVE`
   contract and click "amend" / re-request volume on the same lot
   (the `ClientTradingPanel` legacy flow or a synthetic test). Before
   verifying the OTP, bump `PricingSnapshot.clientB2BPricePerKg`
   upward. Enter the OTP.
   - Expect: HTTP 409 from `/api/contracts/verify-otp`; the OTP UI
     is replaced by the blocking panel; intent is **not** consumed
     and contract is **not** signed.
9. **Missing price** — null out `PricingSnapshot.clientB2BPricePerKg`
   *and* `clientPricePerKg`. The drift helper returns
   `MISSING_CURRENT_PRICE`, both routes return 409 with the same
   panel.
10. **Tolerance edge** — bump price by exactly €0.01. Expect
    `MATCH` and the flow continues.
11. **Duration handoff** — submit a 12-month request from the
    modal. Confirm the wizard step 3 shows "Sign Contract" with
    `duration = 12` (visible in the contract details summary at
    `monthly + duration months`). Open the URL bar — it shows
    `&duration=12`.

## 10. Known limitations

- **No automatic buyer notification** when a lot's price changes
  while a DemandIntent is open. The drift surfaces only when the
  buyer tries to sign; periodic re-checks are out of scope.
- **No auto-refresh of `intent.previewPricePerKg`**. The buyer must
  cancel the open intent (Dashboard CTA) and create a new request
  to capture the new price.
- **`durationMonths` still not persisted on `DemandIntent`.** Handoff
  is URL-only.
- **`startMonth` / `notes` still not captured** anywhere.
- **No HTTP integration tests** for the 409 surface — manual
  validation steps cover both CREATE and AMEND paths.
- **AMEND path issues a second `prisma.greenLot.findUnique`** inside
  verify-otp (the amend service later loads it again). Acceptable
  performance cost for this guard; a tiny refactor could pass the
  result through `amendContractWithSupplyValidation`.
- **Wait/confirm flow** (`/api/demand-intent/[id]/confirm`) is **not**
  drift-guarded. WAITING → OPEN keeps the original
  `previewPricePerKg`; if a buyer waits for supply and the price
  shifts in the meantime, the next signature attempt triggers the
  drift guard. Documented intentionally — fixing it cleanly belongs
  alongside server-side notifications.
- **`LOWER_CURRENT_PRICE` is silent on the server**. The buyer sees
  the cheaper price in the contract preview / PDF, but there is no
  in-modal "Good news" notice today.

## 11. Recommended next sprint

- **STORAGE-MEDIA-1 / PARTNER-MEDIA-2B** if media-upload UX is the
  more pressing operational gap. Replaces the URL-paste upload from
  PARTNER-MEDIA-2A with Supabase Storage signed uploads.
- **CONTRACT-REQUEST-3** if duration / start-month persistence
  becomes necessary. Adds optional
  `DemandIntent.requestedDurationMonths` and `requestedStartMonth`
  columns, and a soft notice on the modal when the wait flow
  resolves at a different price.
