# PARTNER-MEDIA-2A — Producer/partner media slots + public/private upload foundation

> Extended by [DASHBOARD-IMAGES-1](./DASHBOARD-IMAGES-1.md) — the
> public media managed here is now rendered in a carousel on
> marketplace + client dashboard cards.
>
> Further extended by [STORAGE-MEDIA-1](./STORAGE-MEDIA-1.md) — real
> Supabase Storage signed uploads replace the URL-paste flow as the
> default. URL paste remains as a fallback.
>
> Further extended by [BUYER-PROOF-1](./BUYER-PROOF-1.md) — private
> uploads now persist a `supabase://<bucket>/<path>` reference instead
> of a public URL, and the producer media list renders a lock
> affordance (not `<img>`) for those rows.

Operational management layer on top of [LOT-MEDIA-1](./LOT-MEDIA-1.md),
[FARM-MEDIA-1](./FARM-MEDIA-1.md), and [LOT-MEDIA-2](./LOT-MEDIA-2.md).
Producers and partners can now list, add, edit, delete, and re-prime
farm + lot media through proper API endpoints with auth + ownership
checks. Storage upload is **deliberately deferred** — this sprint is
URL-only.

## Summary of what shipped

- **Pure helpers** for URL validation, create/update normalisation,
  single-primary management, and a UI-shaped readiness panel.
- **Service layer** in `src/services/lot-media/lotMedia.service.ts`
  with auth + ownership checks. Producers can only manage media on
  their own farms / lots. Partners + admins bypass the ownership check.
- **API endpoints** for both audiences:
  - `GET/POST /api/{producer,partner}/farms/[farmId]/media`
  - `PATCH/DELETE /api/{producer,partner}/farms/[farmId]/media/[mediaId]`
  - `GET/POST /api/{producer,partner}/lots/[id]/media`
  - `PATCH/DELETE /api/{producer,partner}/lots/[id]/media/[mediaId]`
  - `GET /api/producer/farms` — producer's farms (for the UI)
  - `GET /api/producer/farms/[farmId]/media-readiness` — readiness panel
- **Producer UI** at `/platform/producer/media` — standalone page
  rendering the readiness panel, existing FarmMedia rows, and a URL-based
  add form.

## Files changed

| File | Purpose |
|---|---|
| `src/services/lot-media/lotMedia.types.ts` | `LotMediaCreateInput`, `LotMediaUpdateInput`, `LotMediaReadinessPanel*` types |
| `src/services/lot-media/lotMedia.pure.ts` | `validateLotMediaUrl`, `normalizeLotMediaCreateInput`, `normalizeLotMediaUpdateInput`, `pickSiblingPrimariesToUnset`, `buildLotMediaReadinessPanel` |
| `src/services/lot-media/lotMedia.service.ts` | New — auth-aware CRUD on FarmMedia + GreenLotMedia |
| `src/services/lot-media/lotMedia.routeHelpers.ts` | New — shared handler factories so producer/partner routes stay thin |
| `app/api/producer/farms/route.ts` | New — list producer's farms |
| `app/api/producer/farms/[farmId]/media/route.ts` + `[mediaId]/route.ts` | New |
| `app/api/producer/farms/[farmId]/media-readiness/route.ts` | New — UI readiness panel |
| `app/api/producer/lots/[id]/media/route.ts` + `[mediaId]/route.ts` | New |
| `app/api/partner/farms/[farmId]/media/route.ts` + `[mediaId]/route.ts` | New |
| `app/api/partner/lots/[id]/media/route.ts` + `[mediaId]/route.ts` | New |
| `app/platform/producer/media/page.tsx` | New — producer media management UI |
| `src/services/lot-media/__tests__/lotMedia.test.ts` | +32 tests |
| `docs/lot-media/PARTNER-MEDIA-2A.md` | This document |

## API endpoints

All routes return JSON. Errors carry `{ code, error, details? }` for
validation failures, mirroring the existing partner-route convention.

### Auth

- **Producer audience** (`/api/producer/...`):
  - 401 if no auth
  - 403 unless `user.role === "PRODUCER"`
  - **Ownership enforced**: the service walks `farm.producer.userId` /
    `lot.farm.producer.userId` and returns 403 if it does not match
    the authenticated user.
- **Partner audience** (`/api/partner/...`):
  - 401 if no auth
  - 403 unless `user.role === "PARTNER" || user.role === "ADMIN"`
  - **Ownership bypassed** — partners/admins can manage any farm/lot.

### Request bodies

`POST` body (subset of LOT-MEDIA-1 / LOT-MEDIA-2 fields):

```json
{
  "url": "https://example.com/farm.jpg",   // required
  "role": "FARM",                          // required, LotMediaRole
  "source": "PARTNER_UPLOAD",              // optional, defaults PARTNER_UPLOAD
  "visibility": "PUBLIC_MARKET",           // optional, defaults via role
  "position": 0,                           // optional, server appends if absent
  "isPrimary": false,                      // optional
  "altText": "...",                        // optional, server auto-builds if blank
  "caption": "...",                        // optional
  "credit": "..."                          // optional
}
```

Defaults applied by the service:
- `source = "PARTNER_UPLOAD"` for both producer-created and partner-created rows
- `visibility = getDefaultVisibilityForMediaRole(role)`:
  - `FARM` / `PROCESS` / `PRODUCER` / `PRODUCT_DETAIL` / `EDITORIAL_FALLBACK` → `PUBLIC_MARKET`
  - `TRACEABILITY_BAG` / `CERTIFICATE` → `BUYER_PRIVATE`
- `position = max(siblings.position) + 1`
- `altText = buildDefaultLotMediaAltText(...)` using lot/farm context

`PATCH` accepts the same fields, all optional. Only supplied fields
are updated.

### Single-primary invariant

When a create or update sets `isPrimary: true`, the service runs a
Prisma transaction that first `updateMany`'s sibling rows
(`farmId | greenLotId == owner.id`) to `isPrimary: false`, then
writes the new row's `isPrimary: true`. This guarantees a single
primary per owner even under concurrent uploads. Tests cover the
pure tiebreak logic in `pickSiblingPrimariesToUnset`.

### Error shape

```json
{
  "code": "INVALID_INPUT",
  "error": "Media URL must be https:// or a local /images/ /uploads/ path.",
  "details": { "code": "URL_SCHEME_NOT_ALLOWED", "message": "..." }
}
```

Status codes:
- `200` — success on GET / PATCH / DELETE
- `201` — success on POST
- `400` — INVALID_INPUT / MEDIA_NOT_OWNED_BY_PARENT
- `401` — UNAUTHORIZED
- `403` — FORBIDDEN (ownership / role)
- `404` — FARM_NOT_FOUND / LOT_NOT_FOUND / MEDIA_NOT_FOUND
- `500` — Internal

## Storage decision

**URL-only this sprint.** The repo does not have Supabase Storage
helpers (`@supabase/supabase-js` is present but used only for auth /
backend integration). The spec is explicit about the choice:

> "If no storage utilities exist: do NOT build full storage this
> sprint. Implement URL-based media row management only. Document
> storage as PARTNER-MEDIA-2B or STORAGE-MEDIA-1."

What that means in practice:

- Producers + partners paste a URL when they add media.
- `validateLotMediaUrl` accepts `https://...` plus `/images/...` and
  `/uploads/...` local paths (so the existing public asset folder
  works as a dev bridge).
- Dangerous schemes (`javascript:`, `data:`, `file:`, `vbscript:`,
  `blob:`) are rejected.
- `http://` is rejected because it would mix content on production.
- Caption / credit / altText are length-capped (240 / 600 / 240 chars).
- The UI has the same constraints baked in via the API surface.

The next sprint (PARTNER-MEDIA-2B or STORAGE-MEDIA-1) will add
Supabase Storage with signed upload URLs and per-MIME validation.

## UI

`/platform/producer/media` — standalone page with three sections:

1. **Farm selector** — shown when the producer has more than one
   farm.
2. **Readiness panel** — two columns (public listing vs buyer-private),
   each row showing satisfied/missing state with stable codes
   (`PUBLIC_FARM_PHOTO`, `PUBLIC_PROCESS_OR_PRODUCT_PHOTO`,
   `PUBLIC_PRODUCER_PHOTO`, `BUYER_TRACEABILITY_PROOF`,
   `BUYER_CERTIFICATE`, `BUYER_FINAL_EXPORT_BAG`). Public-listing
   readiness state matches what the backend guard will say at
   verify/publish.
3. **Existing media list + Add form** — list with thumbnails, primary
   chip, set-primary + delete actions; the add form lets the producer
   pick role + visibility (mirrored defaults via
   `ROLE_DEFAULT_VISIBILITY`) and paste a URL.

The page lives next to (not inside) the lot wizard
(`/platform/producer/lots/new`) because the wizard has assistant
orchestration and embedding the media UI there carries breakage risk.
PARTNER-MEDIA-2B can graft the readiness summary into the wizard with
a deep-link to this page.

Lot-specific GreenLotMedia management endpoints exist
(`/api/producer/lots/[id]/media/...`) and the partner verification
flow can call them — no dedicated UI surface for lot-level media this
sprint.

## Visibility safety

Marketplace + contract catalog still call
`filterLotMediaForPublicMarket(snapshot.media)` from LOT-MEDIA-2, so
new BUYER_PRIVATE rows added via this sprint **never** leak into:

- `/api/marketplace/lots`
- `/api/contracts/catalog`
- `/platform/client` catalog
- `primaryMedia.url` / `visual.imageUrl`

A `BUYER_PRIVATE` row flagged `isPrimary=true` is filtered out
**before** primary selection — the public DTO will keep its public
primary intact. Tests in the marketplace-mapper suite continue to
cover that path.

## Tests added

32 new lot-media pure tests:

- `validateLotMediaUrl` — accepts https / `/images/` / `/uploads/`,
  rejects `javascript:` / `data:` / `file:` / `http://` / empty /
  whitespace / non-string / unsafe local paths / malformed URL.
- `normalizeLotMediaCreateInput` — defaults source to PARTNER_UPLOAD,
  defaults visibility via role (TRACEABILITY_BAG → BUYER_PRIVATE,
  FARM → PUBLIC_MARKET), respects override, rejects unknown role /
  source, requires role, clamps altText / caption / credit, passes
  URL validation through, normalises position to non-negative
  integer or null.
- `normalizeLotMediaUpdateInput` — PATCH semantics (only supplied
  fields), validates URL when present, clears altText to null via
  empty string.
- `pickSiblingPrimariesToUnset` — returns other primaries, ignores
  current primary, handles empty.
- `buildLotMediaReadinessPanel` — flags publicListing.ready false when
  no farm media; true with verified PUBLIC_MARKET FARM + PROCESS;
  PRODUCT_DETAIL counts toward process slot; BUYER_PRIVATE FARM does
  not satisfy; buyer-proof slots reflect coverage and never block; no
  mutation.

Totals: 110 lot-media tests pass (78 prior + 32 new). Full project
suite: 681/681. tsc clean.

## Manual validation

1. `npx prisma generate` + `npx prisma migrate deploy` (no new
   migration this sprint; existing LOT-MEDIA-2 columns are required).
2. Log in as a producer with a farm but no media. Visit
   `/platform/producer/media` — both required slots show as MISSING
   and publicListing.ready is "Not ready".
3. Use the Add form with `role=FARM`, `visibility=PUBLIC_MARKET`,
   `url=/images/marketplace_main_card.png`. Reload — the row appears
   in the media list and the FARM slot flips to SATISFIED.
4. Add `role=PROCESS`, `visibility=PUBLIC_MARKET`, same URL. The
   readiness panel flips to "Ready".
5. Attempt `POST /api/partner/lots/[id]/verify` (as the partner) —
   should now succeed (no `LOT_MEDIA_NOT_READY`).
6. Add a `role=TRACEABILITY_BAG` row with `visibility=BUYER_PRIVATE`
   via the UI. Check `/api/marketplace/lots` — the bag must NOT
   appear in `media`, `primaryMedia`, or `visual.imageUrl`. Check
   `/api/contracts/catalog` — same.
7. Add two public images. Click "Set primary" on one — confirm
   `primaryMedia.url` in `/api/marketplace/lots` follows the
   selection.
8. Delete a media row — confirm the readiness panel updates.
9. Attempt to access another producer's farm:
   `POST /api/producer/farms/<other-producer-farm-id>/media` — should
   return 403.
10. Log in as a PARTNER user — `POST /api/partner/farms/<any-farm-id>/media`
    works without ownership check.
11. `/dev/scenarios/lots` reset/seed still works (the media tables are
    independent of the dev factory).

## Known limitations

- **No upload UI / no storage integration** — URL paste only. The
  spec explicitly defers this to PARTNER-MEDIA-2B or
  STORAGE-MEDIA-1.
- **No carousel** anywhere; LotImageWell still renders only
  `primaryMedia.url`.
- **No buyer-private endpoint** for contracted buyers. The
  `buildBuyerLotMediaSequence` helper exists but no route exposes it.
- **No shipment / export guard.** `evaluateBuyerProofMediaReadiness`
  is wired in pure-helper form but the `SHIPMENT_READY` block is not
  attached to any production flow.
- **Producer wizard not modified.** The new page is reachable
  directly via `/platform/producer/media`; the wizard at
  `/platform/producer/lots/new` does not yet embed the readiness
  panel because the assistant orchestration there is fragile.
- **No lot-level UI surface.** GreenLotMedia endpoints exist; the
  partner verification UI will need a thin add-on to use them — out
  of scope this sprint.
- **No file-size / MIME validation.** Both depend on storage being
  available; they will land with PARTNER-MEDIA-2B.
- **Existing farms / lots need backfill** by the producer (or partner)
  to satisfy the public-listing guard. Dev seeds intentionally bypass
  the guard.

## Recommended next sprint

- **PARTNER-MEDIA-2B** — storage integration (Supabase Storage signed
  URLs), file picker UI on top of the existing endpoints, buyer-private
  media endpoint for contracted buyers, wire
  `evaluateBuyerProofMediaReadiness({ mode: "SHIPMENT_READY" })` into
  the partner shipment flow.
- **DASHBOARD-IMAGES-1** — render the public sequence as a carousel
  on marketplace / client dashboard cards with deterministic editorial
  fallbacks for empty lots.
