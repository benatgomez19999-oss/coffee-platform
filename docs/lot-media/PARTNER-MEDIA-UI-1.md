# PARTNER-MEDIA-UI-1

Partner-side media upload page for export-ready lots.

Makes the **Add private proof** CTA from [PRODUCER-PROOF-POLISH](./PRODUCER-PROOF-POLISH.md)
usable for pure `PARTNER` / `ADMIN` operators by introducing a
lot-scoped media surface at `/platform/partner/media`, reusing the
existing partner media APIs (PARTNER-MEDIA-2A + STORAGE-MEDIA-1) and
adding a tiny read-only context endpoint to drive the page in one
round trip.

## 1. Summary

- New page [`/platform/partner/media`](../../app/platform/partner/media/page.tsx)
  — query-param-driven (`?lotId=&farmId=&focus=`), Suspense-wrapped,
  partner/admin-only at the API tier.
- New read-only endpoint
  [`GET /api/partner/lots/[id]/media-context`](../../app/api/partner/lots/[id]/media-context/route.ts)
  returning lot identity + existing media + the same
  `proofReady`/`proofMissing` pair the shipment guard uses. Private
  bytes are never exposed — `supabase://` rows surface as
  `{ isPrivateReference: true, publicUrl: null }`.
- `buildProofCtaHref` in
  [`proofReadinessLabels.pure.ts`](../../src/services/lot-media/proofReadinessLabels.pure.ts)
  now defaults to `/platform/partner/media`. An optional `basePath`
  override is exported alongside `PARTNER_MEDIA_BASE_PATH` and
  `PRODUCER_MEDIA_BASE_PATH` so a future surface can opt in to the
  producer route without re-rolling the URL.
- Upload flow reuses **only** the partner API endpoints
  (`POST /api/partner/lots/[id]/media/upload-url` →
  Supabase signed PUT → `POST /api/partner/lots/[id]/media`).
- 2 new pure tests + 2 updated existing tests in
  `proofReadinessLabels.test.ts`. Existing 854 lot-media / allocation
  tests still pass — 876 / 876 green.
- **No schema changes.** No new buckets. No guard changes. No
  storage changes. No producer media page changes (the producer
  flow at `/platform/producer/media` is untouched and continues to
  work for producer-owned uploads).

## 2. Files changed

| File | Change |
|---|---|
| `app/platform/partner/media/page.tsx` | NEW — partner media workspace. Suspense-wrapped page, lot identity card, proof status card, upload card with `focus=private-proof` defaults, existing-media list with private lock tiles. |
| `app/api/partner/lots/[id]/media-context/route.ts` | NEW — read-only context endpoint, PARTNER/ADMIN-gated. Returns `{ lot, media, proofReady, proofMissing }`. Strips `supabase://` URLs from the `publicUrl` field. |
| `src/services/lot-media/proofReadinessLabels.pure.ts` | `buildProofCtaHref` now defaults to `/platform/partner/media`; new `basePath` opt-in; constants `PARTNER_MEDIA_BASE_PATH` / `PRODUCER_MEDIA_BASE_PATH` exported. |
| `src/services/lot-media/__tests__/proofReadinessLabels.test.ts` | Existing `buildProofCtaHref` tests rewritten against the partner default; 2 new tests cover the `basePath` override + whitespace fallback. |
| `docs/lot-media/PARTNER-MEDIA-UI-1.md` | NEW — this file. |
| `docs/lot-media/PRODUCER-PROOF-POLISH.md` | Cross-reference banner pointing here. |
| `docs/lot-media/BUYER-PROOF-2B.md` | Cross-reference banner pointing here. |

`ExportReadyPanel.tsx` is intentionally untouched: it already calls
`buildProofCtaHref(...)` without a `basePath`, so the CTA route flip
is automatic via the helper default.

## 3. Partner media page behaviour

`/platform/partner/media?lotId=<greenLotId>&farmId=<farmId>&focus=private-proof`

States:

| Condition | UI |
|---|---|
| No `lotId` in URL | Empty state: _"Select a lot from Ready for Export to add proof media."_ + button back to `/platform/partner/lots`. |
| `lotId` present, loading | "Loading lot…" |
| `lotId` invalid / not found | Error state ("Lot not found.") |
| 401 / 403 from API | Error state ("You do not have access to this page.") |
| Loaded | Lot identity card · Proof status card (green or amber based on `proofReady`) · Upload card · Existing media list. |

When the URL hint `?farmId=` doesn't match the lot's actual farm, the
identity card shows a one-line warning — the lot's real farm is used,
the hint is ignored.

The proof status card mirrors the language and tone of
[`ExportReadyPanel`](../../src/components/platform/originPartner/ExportReadyPanel.tsx):
**Proof ready** (green) or **Proof missing** (amber) with a friendly
list rendered through `formatProofMissingLabel` /
`formatProofMissingDetail` — no enum names ever leak.

## 4. CTA route change

`buildProofCtaHref({ lotId, farmId, focus: "private-proof" })`
returns:

- **Before:** `/platform/producer/media?lotId=…&farmId=…&focus=private-proof`
- **After:** `/platform/partner/media?lotId=…&farmId=…&focus=private-proof`

Callers don't need to change. The single existing consumer
(`ExportReadyPanel`) already used the helper. A future surface that
explicitly wants the producer route can pass
`basePath: PRODUCER_MEDIA_BASE_PATH`.

## 5. Upload flow

```
PartnerLotMediaUploadCard
  └─ POST /api/partner/lots/[id]/media/upload-url   (PARTNER/ADMIN)
       returns { uploadUrl, bucketKind, storagePath, storageReference, publicUrl, mediaDefaults }
  └─ PUT  <signed Supabase URL>                      (direct to bucket)
  └─ POST /api/partner/lots/[id]/media               (PARTNER/ADMIN)
       body: { url: storageReference | publicUrl, role, source, visibility, altText }
       creates GreenLotMedia row
  └─ onCreated → refetch /api/partner/lots/[id]/media-context
       proofReady flips to true once a verified BUYER_PRIVATE
       TRACEABILITY_BAG row is persisted; the shipment guard
       (BUYER-PROOF-2B) recomputes the same way.
```

Defaults driven by `?focus=`:

| focus | role | visibility |
|---|---|---|
| `private-proof` | `TRACEABILITY_BAG` | `BUYER_PRIVATE` |
| `public-listing` | `FARM` | `PUBLIC_MARKET` |
| absent / unknown | `FARM` | `PUBLIC_MARKET` |

Client-side validation: JPEG / PNG / WebP, ≤ 8 MB (mirrors the
server-side rules baked into the signing route). SVG / GIF / PDF /
HEIC are rejected before the network round-trip; the server-side
rules re-check.

`STORAGE_NOT_CONFIGURED` from the signing route is mapped to a
friendly message asking the operator to fall back to the producer
dashboard (no URL-paste mode here — the partner page is intentionally
focused on real uploads).

## 6. API endpoints reused / added

Reused (no change):

- `POST /api/partner/lots/[id]/media/upload-url` — STORAGE-MEDIA-1.
- `POST /api/partner/lots/[id]/media` — PARTNER-MEDIA-2A.
- `POST /api/partner/farms/[farmId]/media/upload-url` — not used in
  this sprint but available if a future surface needs farm-level
  uploads here.

Added:

- `GET /api/partner/lots/[id]/media-context` — PARTNER-MEDIA-UI-1.
  Read-only. PARTNER/ADMIN-gated. Returns lot identity, sanitised
  media list, and `proofReady`/`proofMissing` codes.

  Sanitisation: `publicUrl` is `null` for any row whose stored `url`
  parses as a `supabase://` reference. The page renders those rows
  with a lock card, never with `<img src={…}>`.

## 7. Auth behaviour

- All three endpoints used by the page (`media-context`, the
  signed-upload endpoint, the media-create endpoint) reject anyone
  without `user.role ∈ {PARTNER, ADMIN}`.
- The page itself does no client-side auth gating — if the user
  isn't authorised, the context fetch returns 401/403 and the page
  shows _"You do not have access to this page."_
- The producer media route at `/platform/producer/media` is
  untouched and remains PRODUCER-only via `/api/producer/farms`.

## 8. Tests

22 → 24 pure tests in
[`__tests__/proofReadinessLabels.test.ts`](../../src/services/lot-media/__tests__/proofReadinessLabels.test.ts):

- Updated: `buildProofCtaHref` default route is now
  `/platform/partner/media`; queryless and queried variants both
  verified.
- New: `basePath` override drops the caller onto the producer
  surface intact.
- New: whitespace `basePath` falls back to the partner default
  (so a caller passing `""` doesn't accidentally produce
  `?lotId=lot-1` with no base path).

Existing badge / label / detail tests unchanged.

No new browser/E2E tests — out of scope for this sprint.

## 9. Manual validation

Run as a `PARTNER` user.

1. **Empty state.** Visit `/platform/partner/media` with no query
   params. Empty state + button back to Ready for Export.
2. **Invalid lot.** Visit
   `/platform/partner/media?lotId=does-not-exist&focus=private-proof`.
   Error state ("Lot not found."), no crash.
3. **Happy CTA.** Open `/platform/partner/lots`. A row with
   `proofReady=false` shows **Proof missing** + **Add private proof**.
   Click → URL becomes
   `/platform/partner/media?lotId=<id>&farmId=<id>&focus=private-proof`.
4. **Page loads.** Lot identity card shows lot number / farm /
   region / producer. Proof status card is amber with
   _"Missing: Private traceability proof."_ Upload card opens with
   role = **Traceability / bag proof** and visibility =
   **Buyer-private**.
5. **Reject SVG.** Pick an SVG. Inline error appears before any
   network round-trip.
6. **Reject oversized.** Pick a >8 MB file. Inline error.
7. **Happy upload.** Pick a < 8 MB JPEG, hit **Upload**. Phase
   transitions Preparing → Uploading → Saving → Saved. Success
   message: _"Private proof uploaded. This lot is ready for shipment."_
8. **Proof flip.** The proof status card re-renders green with
   _"This lot already has verified buyer-private proof and can be
   added to a shipment."_
9. **Lock tile.** The new row appears in the existing-media list as
   a locked tile (no `<img>` rendered).
10. **Return to Export Ready.** `/platform/partner/lots` row badge
    is now **Proof ready**.
11. **Shipment creates.** `POST /api/partner/shipments` with that
    lot now succeeds.
12. **Buyer dashboard.** Open an active contract for the lot — the
    `ContractProofMediaPanel` shows the new traceability tile (signed
    via the proof endpoint, not via partner page).
13. **Forbidden role.** Log in as `CLIENT` and visit the partner
    page → error state. The context API responds 403; no lot data
    appears in DOM/network.
14. **Marketplace regression.** `/api/marketplace/lots` and
    `/api/contracts/catalog` still omit `BUYER_PRIVATE` rows.
15. **Producer regression.** `/platform/producer/media` continues
    to work for producer-owned uploads.

## 10. Known limitations

- **No signed preview of private media inside the partner page.**
  The page shows a lock tile + metadata. Signing read URLs for
  partners would mean a new sign-as-partner code path; deliberately
  deferred. Operators who need to verify the bag photo do so via
  the buyer-side proof endpoint (or the producer page, which signs
  via `/api/contracts/[id]/proof-media` when a contract exists).
- **No `FINAL_EXPORT_BAG` role yet.** `TRACEABILITY_BAG` continues
  to double-duty. The label helper already knows the future role
  string.
- **No admin override of the shipment guard.** Carried over from
  BUYER-PROOF-2B.
- **No storage object cleanup.** Deleting a media row leaves the
  Supabase object behind. Out of scope.
- **No `proofReady` denormalized column.** Recomputed on each
  request; fine for current scale.
- **No audit log of proof checks.** Defer to `AUDIT-LOG-1` when
  compliance asks.
- **No route integration tests.** No service-level harness in repo
  for the upload flow (Prisma transactions, no mocking pattern).
  Manual validation above covers the workflow.
- **Page is not role-aware for `PRODUCER` users.** A producer
  hitting `/platform/partner/media` gets a 403 from the context
  endpoint and sees the access-denied message. Producers continue
  to use `/platform/producer/media`. Adding a generous fallback was
  considered and deferred — the producer surface already covers
  that audience.

## 11. Related sprints

- [BUYER-PROOF-1](./BUYER-PROOF-1.md) — created the private storage
  bucket and signed-read proof endpoint. The partner page renders
  rows uploaded through this path as locked tiles.
- [BUYER-PROOF-2B](./BUYER-PROOF-2B.md) — `createShipment` proof
  guard. The partner page's proof status mirrors the same
  evaluator (`evaluateBuyerProofMediaReadiness({ mode: "SHIPMENT_READY" })`).
- [PRODUCER-PROOF-POLISH](./PRODUCER-PROOF-POLISH.md) — the
  Ready-for-Export badge + CTA. The CTA now lands operators here
  instead of the producer surface.
- [PARTNER-MEDIA-2A](./PARTNER-MEDIA-2A.md) — original partner
  media CRUD. This sprint just builds a UI on top.
- [STORAGE-MEDIA-1](./STORAGE-MEDIA-1.md) — signed upload mechanics
  reused unchanged.

## 12. Tests

```
npx tsc --noEmit              # clean
npm run test:allocation       # 876 / 876 pass
npm run build                 # clean
```
