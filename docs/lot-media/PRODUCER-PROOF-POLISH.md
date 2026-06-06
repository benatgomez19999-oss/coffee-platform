# PRODUCER-PROOF-POLISH

> Extended by [PARTNER-MEDIA-UI-1](./PARTNER-MEDIA-UI-1.md) — the
> **Add private proof** CTA now lands operators on the new
> partner-side media surface at `/platform/partner/media` instead of
> the producer-only page. `buildProofCtaHref` default flipped from
> `/platform/producer/media` to `/platform/partner/media`; tests and
> behaviour updated accordingly. The producer page continues to work
> for producer-account uploads.

Surface the BUYER-PROOF-2B guard before partners attempt shipment creation.

[BUYER-PROOF-2B](./BUYER-PROOF-2B.md) made `createShipment` reject any
`GreenLot` that lacks verified buyer-private traceability proof; the
partner only discovered the gap when the POST returned 409. This sprint
adds a small UI polish layer: per-row **proof badges**, a friendly
**"Add private proof" CTA** deep-linking to `/platform/producer/media`,
and matching query-param defaults on the producer media form.

## 1. Summary

- New pure helper
  [`src/services/lot-media/proofReadinessLabels.pure.ts`](../../src/services/lot-media/proofReadinessLabels.pure.ts)
  with 4 functions and 20 unit tests:
  - `formatProofMissingLabel(code)` — machine code → friendly label.
  - `formatProofBadge({ proofReady, proofMissing })` →
    `{ tone, label }`.
  - `formatProofMissingDetail(codes)` — Oxford-comma sentence.
  - `buildProofCtaHref({ lotId, farmId, focus })` — deep-link builder.
- [`/api/partner/export-ready`](../../app/api/partner/export-ready/route.ts)
  now:
  - returns **machine codes** in `proofMissing` (`"TRACEABILITY_PROOF"`)
    instead of English strings. Stable contract, i18n-friendly.
  - requires `user.role === "PARTNER" | "ADMIN"` (was unauthenticated).
- [`ExportReadyPanel`](../../src/components/platform/originPartner/ExportReadyPanel.tsx)
  now shows a `Proof ready` / `Proof missing` badge per row, a detail
  line listing what is missing, and an **Add private proof** CTA that
  deep-links to `/platform/producer/media` with `lotId`, `farmId` and
  `focus=private-proof`.
- [`/platform/producer/media`](../../app/platform/producer/media/page.tsx)
  reads `?lotId`, `?farmId`, `?focus=private-proof|public-listing` from
  the URL and:
  - preselects the matching farm when `?farmId=` matches an owned farm,
  - opens `AddMediaForm` with role `TRACEABILITY_BAG` and visibility
    `BUYER_PRIVATE` when `focus=private-proof`,
  - shows a top-of-section helper banner explaining what to upload and
    (when present) which lot it's for.
- **No schema changes.** No migration. No new dependencies. No guard
  logic touched.

## 2. Files changed

| File | Change |
|---|---|
| `src/services/lot-media/proofReadinessLabels.pure.ts` | NEW — 4 pure helpers, no React / Prisma / fetch. |
| `src/services/lot-media/__tests__/proofReadinessLabels.test.ts` | NEW — 20 tests covering label mapping, badge fallback, Oxford comma, CTA href, and the "no enum leakage" guard. |
| `app/api/partner/export-ready/route.ts` | Returns machine codes in `proofMissing`. Adds PARTNER / ADMIN auth + `runtime/dynamic` exports. |
| `src/components/platform/originPartner/ExportReadyPanel.tsx` | Type extended with `farmId`, `proofReady`, `proofMissing`. New `ExportReadyRow` + `ProofBadge` subcomponents. CTA renders only when missing. Fetch now sends credentials. |
| `app/platform/producer/media/page.tsx` | Reads query params via `useSearchParams`, honours `?farmId=` for preselect, threads `focus` + `lotIdHint` to `AddMediaForm`. `AddMediaForm` initialises role/visibility from `focus` and shows a helper banner. |
| `docs/lot-media/PRODUCER-PROOF-POLISH.md` | NEW — this file. |
| `docs/lot-media/BUYER-PROOF-2B.md` | Cross-reference banner pointing here + note that `proofMissing` shape switched from English string to stable code. |

## 3. Export-ready UI changes

For each row in `/platform/partner/lots` → `Ready for Export`:

- Lot number gets a chip-style badge next to it:
  - **Proof ready** (green) — `proofReady === true`.
  - **Proof missing** (amber) — anything else (including missing field).
- When missing, a sub-line renders:
  > _Missing: Private traceability proof._
- When missing, an **Add private proof** button appears in the action
  group (next to the existing **Print** button), styled as a soft amber
  pill so it reads as a hint, not a primary action.

Friendly labels live in the pure helper and are unit-tested for
no-enum-leakage (no `_`, no `supabase`, no `bucket`).

## 4. Media upload CTA behaviour

```
/platform/producer/media?lotId=<greenLotId>&farmId=<farmId>&focus=private-proof
```

Built by `buildProofCtaHref` so the panel never hand-rolls query
strings. Params are optional and ignored safely if absent or malformed.

The page reads them via `useSearchParams` and:

1. If `?farmId=` matches a farm the authenticated producer owns →
   that farm is preselected (otherwise the existing "first farm"
   default applies).
2. If `?focus=private-proof` → `AddMediaForm` opens in the upload tab
   with role = `TRACEABILITY_BAG`, visibility = `BUYER_PRIVATE`, and a
   helper banner is shown:

   > Upload a private traceability or final-bag proof
   > _(for lot `<lotId>`)_.
   > Private proof is visible only to the contracted buyer and
   > operations — never to the public marketplace.
3. If `?focus=public-listing` → defaults stay at `FARM` /
   `PUBLIC_MARKET` (no banner). Hook is in place for a future
   public-listing CTA.
4. Unknown or missing values are silently ignored.

## 5. Producer media query-param support

| Param | Honoured by | Effect |
|---|---|---|
| `lotId` | `AddMediaForm` (helper text only) | Echoed in the banner so the operator confirms they're uploading the right lot's proof. The upload endpoint itself is still farm-scoped today (`POST /api/producer/farms/[id]/media`) — so the page does not POST to a lot-scoped route. |
| `farmId` | `ProducerMediaPage` | Preselects the farm tab if owned; falls back to the first farm otherwise. |
| `focus=private-proof` | `AddMediaForm` | Defaults `role = TRACEABILITY_BAG`, `visibility = BUYER_PRIVATE`, renders the helper banner. |
| `focus=public-listing` | `AddMediaForm` | Defaults `role = FARM`, `visibility = PUBLIC_MARKET` (existing defaults — present for symmetry / future use). |
| any other / malformed | — | Silently ignored. No crash, no auth leak. |

**Documented limitation:** lot-scoped upload endpoints don't exist yet
for this flow, so `lotId` informs *defaults and copy* but not the POST
target. A future sprint can add a lot-scoped upload route plus a
dropdown in `AddMediaForm`.

## 6. Auth decision

**Added** `user.role === "PARTNER" | "ADMIN"` to
`/api/partner/export-ready`. The only consumer
(`ExportReadyPanel`) already runs inside the partner-protected
`/platform/partner/lots` page; same-origin `fetch` sends the
session cookie. No other consumers grep'd. The audit
(BUYER-PROOF-2A §7) flagged this as a pre-existing exposure of
PUBLISHED-lot listings (now also exposing the new `proofReady`
signal). Gating was a tiny change that matches the rest of the
`/api/partner/*` namespace, so we shipped it in-scope rather than
defer to `EXPORT-READY-AUTH-1`.

## 7. Tests

20 new pure tests in
[`__tests__/proofReadinessLabels.test.ts`](../../src/services/lot-media/__tests__/proofReadinessLabels.test.ts):

- `formatProofMissingLabel`: maps `TRACEABILITY_PROOF`, `CERTIFICATE`,
  `FINAL_BAG_PHOTO`; falls back to `"Required proof"` for unknown;
  rejects non-string; never leaks enum-style names.
- `formatProofBadge`: ok / warning tone branches; defaults to warning
  when `proofReady` is missing/null/undefined; no enum leakage.
- `formatProofMissingDetail`: empty / single / two-item-with-`and` /
  three-item-Oxford-comma; unknown code falls back to `"Required proof"`
  without leaking the raw code.
- `buildProofCtaHref`: bare route when no params; single `lotId`;
  combined `farmId` + `lotId` + `focus`; whitespace ids ignored;
  public-listing focus passes through.

Existing `lotMedia.test.ts` (854 cases) continues to pass. Full
`npm run test:allocation` reports **874 / 874** after this sprint.

No new component / browser tests — out of scope per the sprint
brief.

## 8. Manual validation

1. **Missing-proof badge.** Start with a PUBLISHED lot that has no
   `BUYER_PRIVATE TRACEABILITY_BAG`.
   `GET /api/partner/export-ready` (as PARTNER) → row carries
   `proofReady: false`, `proofMissing: ["TRACEABILITY_PROOF"]`.
2. **UI flag.** Open `/platform/partner/lots`. The row shows a
   **Proof missing** chip + the "Missing: Private traceability
   proof." line + the **Add private proof** button.
3. **CTA navigation.** Click **Add private proof**. URL lands at
   `/platform/producer/media?lotId=<id>&farmId=<farmId>&focus=private-proof`.
4. **Form defaults.** As a producer owning that farm: the helper
   banner shows, `role = TRACEABILITY_BAG`, `visibility = BUYER_PRIVATE`,
   the upload tab is selected.
5. **Upload private proof.** Upload an image. Confirm the row appears
   in the media list as the private-storage lock card from
   BUYER-PROOF-1.
6. **Round trip.** Return to `/platform/partner/lots`. The row chip
   flips to **Proof ready** (green). `POST /api/partner/shipments`
   with that lot now succeeds.
7. **Unauthenticated callers.** `GET /api/partner/export-ready` from
   an anonymous session → **401**. From a CLIENT / PRODUCER session
   → **403**.
8. **Privacy regression.** Confirm no private URL or signed reference
   ever appears in `/api/partner/export-ready` payloads — only the
   coarse machine code in `proofMissing`. Marketplace and contract
   catalog continue to omit `BUYER_PRIVATE` rows.
9. **Mixed-batch shipment.** Two lots, one ready and one missing.
   Submit. Still **409 `LOT_BUYER_PROOF_NOT_READY`**, neither lot
   reserved.
10. **Buyer regression.** Open an active contract for the now-proof'd
    lot. `ContractProofMediaPanel` shows the same traceability tile.

## 9. Known limitations

- **CTA is deep-link only.** No multi-step guided flow. If the
  producer media page can't preselect a *lot-scoped* upload (current
  endpoints are farm-scoped), the operator must select the right
  farm/lot themselves; the helper banner echoes the `lotId` to make
  the mismatch obvious.
- **No `FINAL_EXPORT_BAG` role yet.** `TRACEABILITY_BAG` doubles for
  both the sample tag and the final-bag photo. The label helper
  already includes a `FINAL_BAG_PHOTO` case so it's ready when the
  enum exists.
- **No admin override.** Inherited from BUYER-PROOF-2B.
- **No `proofReady` denormalized field.** Recomputed per request on
  the export-ready listing; this is fine at current scale.
- **No audit log of proof checks.** Defer until a compliance reviewer
  asks.
- **Partner users following the CTA hit a producer-only page.** The
  `/platform/producer/media` page is gated to `PRODUCER`; a PARTNER
  user clicking the CTA will see the page load empty / error.
  Workflow-wise this is fine for ops/admin who can switch roles, and
  the helper banner copy ("Ask the producer…") covers the gap, but a
  proper partner-side upload UI is a future sprint.
- **`proofMissing` contract changed shape.** It now ships stable codes
  (`["TRACEABILITY_PROOF"]`) instead of human strings
  (`["Private traceability proof"]`). The only consumer is the
  partner UI we ship in this sprint, so no external breakage. The
  BUYER-PROOF-2B doc has been updated.

## 10. Out of scope / next sprint

- **CONTRACT-REQUEST-3** — persist `requestedDurationMonths` /
  `startMonth` on `DemandIntent`, improve wait-list drift handling.
- **PARTNER-MEDIA-UI-1** (formerly EXPORT-READY-AUTH-1, now folded
  in) — build a partner-side media upload page so the CTA works for
  partner accounts, not only producer-account ops who can switch
  roles.
- **FINAL_EXPORT_BAG role** — schema enum + default-visibility map
  + AddMediaForm dropdown + readiness rule update.
- **Audit log of proof checks** — append-only `ProofGateAudit` table
  with `{ shipmentId, greenLotId, decision, evaluatedAt }`.

## 11. Tests

```
npx tsc --noEmit              # clean
npm run test:allocation       # 874 / 874 pass
npm run build                 # clean
```
