# BUYER-PROOF-2B

> Further extended by [PARTNER-MEDIA-UI-1](./PARTNER-MEDIA-UI-1.md) —
> adds a partner-side media upload page at `/platform/partner/media`
> driven by a new `GET /api/partner/lots/[id]/media-context` endpoint,
> so the **Add private proof** CTA works for pure PARTNER / ADMIN
> operators without bouncing through the producer page.
>
> Extended by [PRODUCER-PROOF-POLISH](./PRODUCER-PROOF-POLISH.md) —
> surfaces the guard in the partner export-ready UI with a badge + CTA,
> deep-links to `/platform/producer/media` with role/visibility
> pre-selected, and switches the `proofMissing` payload to stable
> machine codes (`["TRACEABILITY_PROOF"]`) instead of English strings.
> Auth was added to `/api/partner/export-ready` in that sprint.

Shipment-ready guard for buyer-private traceability proof.

Wires the existing `evaluateBuyerProofMediaReadiness({ mode: "SHIPMENT_READY" })`
helper into [`createShipment`](../../src/services/logistics/shipment.service.ts)
so no production shipment can be created for a `GreenLot` that lacks a
verified `BUYER_PRIVATE` `TRACEABILITY_BAG` row.

Follows the [BUYER-PROOF-2A audit](../../#) recommendation: enforcement at
`createShipment` (the only authenticated production write that physically
commits a lot to leaving origin), not at `/api/partner/export-ready`
(read-only listing) and not at the dev logistics routes.

## 1. Summary

- New `ShipmentServiceError` code `LOT_BUYER_PROOF_NOT_READY` → HTTP 409.
- Guard inside the `createShipment` transaction, after the
  `LOT_NOT_PUBLISHED` / `LOT_ALREADY_SHIPPED` checks and **before** the
  `Shipment` row is created or any lot is reserved.
- Per failing lot the error carries
  `{ greenLotId, lotNumber, missing: ["TRACEABILITY_PROOF"] }`.
- `/api/partner/shipments` spreads the details so callers can render
  per-lot remediation without parsing a string.
- `/api/partner/export-ready` now carries advisory
  `{ proofReady, proofMissing: string[] }` per lot (no private bytes
  exposed — just a coarse English string).
- 6 new pure regression tests pinning the rule for editorial source,
  placeholder source, INTERNAL_ONLY visibility, certificate-as-warning,
  and the documented lot-level-only call-site policy.
- **No schema changes.** No migration. No new pure helpers.

## 2. Guard point — why `createShipment`

| Candidate | Verdict |
|---|---|
| `POST /api/partner/lots/[id]/verify` | No — runs at lot creation, well before bag photo exists. |
| `POST /api/partner/lots/[id]/publish` | No — same reason; published lots may not be contracted yet. |
| **`createShipment` (this sprint)** | **Yes — only authenticated production write that physically commits a lot to leaving origin. Already transactional. Already loops the lots.** |
| `POST /api/partner/orders/[id]/prepare` | No — Order → GreenLot is a two-join indirection; not all shipped lots go through an Order. |
| `POST /api/eu-partner/shipments/[id]/receive` | No — runs after arrival. |
| `POST /api/contracts/verify-otp` / Stripe webhook (`Contract.status → ACTIVE`) | No — pre-physical-goods; lot may not even have a bag yet. |
| `POST /api/partner/export-ready` | No — it's a read-only list with no auth and no writes. Carries advisory only. |
| `POST /api/dev/logistics/*` | No — dev-only. Will inherit the guard via `createShipment` when dev seed runs. |

`createShipment` already throws typed `ShipmentServiceError`s for
`DUPLICATE_REFERENCE`, `LOT_NOT_FOUND`, `LOT_NOT_PUBLISHED`, and
`LOT_ALREADY_SHIPPED`. We slot `LOT_BUYER_PROOF_NOT_READY` into the
same machinery.

## 3. Readiness rule

For every `GreenLot` being shipped, at least one row must satisfy
**all** of:

| Field | Value |
|---|---|
| `role` | `TRACEABILITY_BAG` |
| `visibility` | `BUYER_PRIVATE` (not `PUBLIC_MARKET`, not `INTERNAL_ONLY`) |
| `source` | `PARTNER_UPLOAD` or `PLATFORM_CURATED` (not `GENERATED_EDITORIAL`, not `TONAL_PLACEHOLDER`) |
| ownership | **lot-level (`GreenLotMedia`) only** — see §4 |

`CERTIFICATE` rows are encouraged but **not required** — a missing
certificate produces a warning, never a block.

The rule is implemented by passing the lot's media (only) to
`evaluateBuyerProofMediaReadiness({ mode: "SHIPMENT_READY" })`. The
helper already encodes:

- `isBuyerPrivateMedia` filter (LOT-MEDIA-2 visibility).
- `isVerifiedLotMediaSource` filter (LOT-MEDIA-1 trust rule).
- A `BUYER_TRACEABILITY_PROOF_REQUIRED` blocking reason when the
  filtered set has no `TRACEABILITY_BAG`.
- A `BUYER_CERTIFICATE_RECOMMENDED` warning when no certificate.

## 4. Why lot-level only (call-site policy)

The pure helper `evaluateBuyerProofMediaReadiness` historically
**concatenated lot media + farm media** before applying the readiness
rules. That is the right behaviour for the lot lifecycle
(`CONTRACTED` warnings) where a farm-wide bag photo can plausibly
satisfy buyer expectation.

For `SHIPMENT_READY` we deliberately restrict to lot-level rows by
passing `farmMedia: []` at the call site in `createShipment`. Rationale:

- The bag/label photo is **per-shipment by definition** — a farm-wide
  photo cannot prove that *this* lot's bags were marked correctly.
- The helper change would have rippled through every other caller
  that already relies on the lot+farm combination. Restricting at the
  call site is the safest minimal change.

There are two regression tests pinning this contract:

- `"farm-level traceability alone does NOT satisfy when called with farmMedia=[]"` —
  verifies the service guard's call shape.
- `"helper internals: farm-level traceability would satisfy if BOTH were passed"` —
  pins the helper's current behaviour, so if anyone changes the helper
  to drop farm media, the service tests fail loudly.

Certificate coverage remains lot-level-only in this sprint as a
side-effect. Acceptable because certificate is warning-only.

## 5. Error shape

Service layer:

```ts
throw new ShipmentServiceError(
  "Private traceability proof is required before shipment.",
  "LOT_BUYER_PROOF_NOT_READY",
  {
    failingLots: [
      { greenLotId: "uuid", lotNumber: "AAA-001", missing: ["TRACEABILITY_PROOF"] },
      ...
    ],
  },
)
```

Route layer response (`POST /api/partner/shipments`):

```json
{
  "code": "LOT_BUYER_PROOF_NOT_READY",
  "error": "Private traceability proof is required before shipment.",
  "failingLots": [
    { "greenLotId": "uuid", "lotNumber": "AAA-001", "missing": ["TRACEABILITY_PROOF"] }
  ]
}
```

HTTP status: **409 Conflict** (the lot exists but is not in a state to
ship — mirrors `LOT_ALREADY_SHIPPED`).

## 6. Export-ready advisory

`/api/partner/export-ready` was previously a raw `prisma.greenLot.findMany`
returning the rows verbatim. Per-row we now add:

```ts
{
  ...lot,
  proofReady: boolean,
  proofMissing: string[]   // e.g. ["Private traceability proof"]
}
```

We **do not** add per-row media payloads — exposing private bytes
would defeat BUYER-PROOF-1. The string is coarse: it tells the partner
*what* is missing without leaking *which* private rows exist.

Auth on this route remains as it was (unchanged this sprint — see
"Known limitations"). The advisory is informational; enforcement
lives inside the transaction in `createShipment`.

## 7. Product copy

Partner/producer error toast (parse `failingLots` from the 409):

> "Add a private traceability or final-bag proof for lot **AAA-001**
> before adding it to a shipment."

Generic upload-form caption (already present in BUYER-PROOF-1):

> "Private proof is visible only to the contracted buyer and operations
> — never to the public marketplace."

We intentionally avoid mentioning `BUYER_PRIVATE` / `TRACEABILITY_BAG`
/ Supabase / bucket names in user-facing copy.

## 8. Files changed

| File | Change |
|---|---|
| `src/services/logistics/shipment.service.ts` | Imports `evaluateBuyerProofMediaReadiness` + normalisers; extends `ShipmentServiceError` with optional `details`; inserts the proof guard in `createShipment` between the alreadyShipped check and `tx.shipment.create`. |
| `app/api/partner/shipments/route.ts` | Maps `LOT_BUYER_PROOF_NOT_READY` to 409; spreads `err.details` into the response body so `failingLots` is visible to callers. |
| `app/api/partner/export-ready/route.ts` | Joins each lot's media, computes `proofReady` + `proofMissing` per row using the same helper, strips the media payload before returning. |
| `src/services/lot-media/__tests__/lotMedia.test.ts` | +6 regression tests for the SHIPMENT_READY rule and the lot-level-only call-site policy. |
| `docs/lot-media/BUYER-PROOF-2B.md` | NEW — this file. |
| `docs/lot-media/BUYER-PROOF-1.md` | Cross-reference banner pointing here. |

## 9. Manual validation

Run as a `PARTNER` user.

1. **Block path.** PUBLISHED lot with no proof.
   `POST /api/partner/shipments` with that lot →
   **409 `LOT_BUYER_PROOF_NOT_READY`**. No `Shipment` row. Lot stays
   `PUBLISHED`, `shipmentId` stays `null`.
2. **Public traceability does not satisfy.** Upload `TRACEABILITY_BAG`
   with `visibility = PUBLIC_MARKET`. Retry. Still **409**.
3. **Internal-only does not satisfy.** Upload with `INTERNAL_ONLY`.
   Retry. Still **409**.
4. **Editorial source does not satisfy.** If you have a way to create
   a row with `source = GENERATED_EDITORIAL` (dev seed only — the
   producer UI defaults to `PARTNER_UPLOAD`). Retry. Still **409**.
5. **Happy path.** Upload `TRACEABILITY_BAG`,
   `visibility = BUYER_PRIVATE`, `source = PARTNER_UPLOAD`. Retry.
   **200**. `Shipment` row created. Lot → `RESERVED`,
   `shipmentId` set.
6. **Mixed batch.** Two lots in one POST, one with proof and one
   without. **409**. Neither lot reserved (transaction rolled back).
7. **Buyer dashboard regression.** Open the active contract for the
   lot in the buyer dashboard, expand "View proof". Confirm the same
   `TRACEABILITY_BAG` row that satisfied the guard renders in the
   panel.
8. **Export-ready advisory.** `GET /api/partner/export-ready`. Each
   row should now include `proofReady` and `proofMissing`. The
   `proofReady=false` lots match the ones the shipment-create guard
   would block.
9. **Dev seed.** `POST /api/dev/logistics/shipments/seed` against a
   lot with no proof → **409**. Document as expected; dev seeders
   must upload proof first or use a different lot.

## 10. Known limitations

- **No `FINAL_EXPORT_BAG` role yet.** `TRACEABILITY_BAG` doubles as
  both the sample/parchment tag and the final-bag photo. Splitting
  into a separate role is a future sprint (would require a schema
  enum addition + default-visibility map + UI dropdown change).
- **No admin override.** A partner/admin who absolutely must ship
  without proof has no escape hatch in this sprint. If product wants
  one, scope it to `user.role === "ADMIN"` with an audit-log entry.
- **No `proofReady` denormalized field on `Contract` / `Shipment` /
  `GreenLot`.** Readiness is recomputed per request. Acceptable for
  current traffic.
- **No audit log of proof checks.** When/how a lot satisfied the
  guard is not persisted. Defer until a compliance reviewer asks.
- **Dev shipment seed may now fail** if the candidate lot has no
  proof. Expected; the dev seed already calls the production
  `createShipment`. Seed authors must upload proof or pass a
  pre-seeded `greenLotIds` arg pointing at a lot that already has
  proof.
- **Old public-URL "private" rows still count** as proof. Any
  `GreenLotMedia` row with `visibility = BUYER_PRIVATE` AND
  `source ∈ {PARTNER_UPLOAD, PLATFORM_CURATED}` satisfies the rule
  regardless of whether its `url` is a public URL or a
  `supabase://` reference. Correct — those ARE buyer-private rows;
  they just predate the BUYER-PROOF-1 bucket split. A future
  migration can rebucket the bytes without changing the rule.
- **`/api/partner/export-ready` remains unauthenticated.**
  Pre-existing concern, untouched here. Should become
  `user.role === "PARTNER"` at minimum in a follow-up; the advisory
  payload added in this sprint is coarse (English string, no IDs,
  no URLs) so the marginal exposure from adding it is near-zero.
- **Certificate slot is lot-only in this sprint.** Because we pass
  `farmMedia: []`, a farm-wide certificate won't suppress the
  warning. Acceptable — certificate is warning-only.

## 11. Related sprints

- [BUYER-PROOF-1](./BUYER-PROOF-1.md) — created the two-bucket model,
  the `supabase://` reference scheme, the `/api/contracts/[id]/proof-media`
  endpoint and the buyer-side panel. This sprint is the production
  enforcement that makes the boundary load-bearing on the producer side.
- [LOT-MEDIA-2](./LOT-MEDIA-2.md) — introduced
  `LotMediaVisibility` and the original
  `evaluateBuyerProofMediaReadiness` pure helper. This sprint wires
  the `SHIPMENT_READY` branch of that helper into a real production
  route for the first time.
- [STORAGE-MEDIA-1](./STORAGE-MEDIA-1.md) — signed uploads. Unchanged.

## 12. Tests

```
npx tsc --noEmit              # clean
npm run test:allocation       # 854 / 854 pass (+ 6 new)
npm run build                 # clean
```

No service-level integration harness exists for `createShipment`
(prisma transactions, no mocking pattern in the repo). Per the sprint
brief this falls back to pure helper tests + manual validation, both
listed above.
