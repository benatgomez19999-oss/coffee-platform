# LOT-MEDIA-2 / PARTNER-LOT-MEDIA-1

> Extended by [PARTNER-MEDIA-2A](./PARTNER-MEDIA-2A.md) — producer +
> partner CRUD endpoints, ownership checks, and a producer-facing
> media management page at `/platform/producer/media` honouring the
> visibility separation described here.
>
> Extended by [BUYER-PROOF-1](./BUYER-PROOF-1.md) — turns the
> `BUYER_PRIVATE` / `INTERNAL_ONLY` visibilities into a real storage
> boundary (separate Supabase bucket + signed read URLs) and ships
> a buyer-facing proof panel on the client dashboard.

Media visibility separation. Public marketplace media stays visible to
everyone; traceability proof, final export bag labels and certificates
become buyer-private; partner / ops imagery stays internal.

Extends:
- [LOT-MEDIA-1](./LOT-MEDIA-1.md) — semantic media model
- [FARM-MEDIA-1](./FARM-MEDIA-1.md) — farm-level reuse + producer media-readiness guard

## Three dimensions

After this sprint, every media row carries three orthogonal axes:

1. **role** — `FARM` / `PROCESS` / `PRODUCER` / `TRACEABILITY_BAG` /
   `PRODUCT_DETAIL` / `CERTIFICATE` / `EDITORIAL_FALLBACK`. *What* the
   image shows.
2. **source** — `PARTNER_UPLOAD` / `PLATFORM_CURATED` /
   `GENERATED_EDITORIAL` / `TONAL_PLACEHOLDER`. *How trustworthy* the
   image is.
3. **visibility** — `PUBLIC_MARKET` / `BUYER_PRIVATE` /
   `INTERNAL_ONLY`. *Who can see* the image.

These dimensions are independent. A `PARTNER_UPLOAD` `TRACEABILITY_BAG`
is documentary evidence but still buyer-private by default.

## Schema

```prisma
enum LotMediaVisibility {
  PUBLIC_MARKET
  BUYER_PRIVATE
  INTERNAL_ONLY
}

model GreenLotMedia {
  …
  visibility LotMediaVisibility @default(PUBLIC_MARKET)
  …
  @@index([greenLotId, visibility])
}

model FarmMedia {
  …
  visibility LotMediaVisibility @default(PUBLIC_MARKET)
  …
  @@index([farmId, visibility])
}
```

Additive migration: `prisma/migrations/20260511130000_add_lot_media_visibility/migration.sql`.
Default `PUBLIC_MARKET` so every LOT-MEDIA-1 / FARM-MEDIA-1 row keeps
its current rendering behaviour.

## Visibility policy by role

`getDefaultVisibilityForMediaRole(role)` returns these defaults; the
upload UI is expected to surface them and let the partner override.

| Role               | Default visibility | Rationale                                                  |
|--------------------|--------------------|------------------------------------------------------------|
| `FARM`             | `PUBLIC_MARKET`    | Origin marketing                                           |
| `PROCESS`          | `PUBLIC_MARKET`    | Visual story / drying beds / washing station               |
| `PRODUCER`         | `PUBLIC_MARKET`    | Trust signal (partner can opt INTERNAL_ONLY)               |
| `TRACEABILITY_BAG` | `BUYER_PRIVATE`    | Sample / parchment / export bag labels — buyer proof       |
| `PRODUCT_DETAIL`   | `PUBLIC_MARKET`    | Bean / cherry / cup shots                                   |
| `CERTIFICATE`      | `BUYER_PRIVATE`    | Cupping sheets / lab reports unless explicitly public      |
| `EDITORIAL_FALLBACK` | `PUBLIC_MARKET`  | Placeholder visuals (never counts as verified)             |

`TRACEABILITY_BAG` defaulting to `BUYER_PRIVATE` is the single most
important consequence: a partner who uploads the final export bag
photo intending it as buyer proof will *not* leak that label to the
public marketplace.

## Pure helpers added

```ts
normalizeLotMediaVisibility(value): LotMediaVisibility | null

isPublicMarketMedia(item): boolean
isBuyerPrivateMedia(item): boolean
isInternalOnlyMedia(item): boolean

filterLotMediaForPublicMarket(items): LotMediaItem[]   // PUBLIC_MARKET only
filterLotMediaForBuyerPrivate(items): LotMediaItem[]   // PUBLIC_MARKET + BUYER_PRIVATE
filterLotMediaForInternalOps(items):  LotMediaItem[]   // everything

getDefaultVisibilityForMediaRole(role): LotMediaVisibility

buildPublicMarketLotMediaSequence({ lotMedia, farmMedia }): OrderedLotMediaResult
buildBuyerLotMediaSequence({ lotMedia, farmMedia }):        OrderedLotMediaResult
```

Helpers treat missing `visibility` as `PUBLIC_MARKET` so LOT-MEDIA-1 /
FARM-MEDIA-1 fixtures (which never set the field) keep their previous
behaviour.

## Readiness rule changes

`evaluateLotMediaReadiness` now measures **public-listing readiness only**:

- DRAFT mode unchanged — inspects the full sequence and emits soft
  warnings.
- SUBMIT / VERIFY / PUBLISH now filter the combined sequence to
  `PUBLIC_MARKET` before measuring coverage. A `BUYER_PRIVATE` FARM
  photo therefore does **not** satisfy `FARM_MEDIA_REQUIRED` — that
  image would never appear on the marketplace.
- The `TRACEABILITY_MEDIA_RECOMMENDED` warning for
  `EXCLUSIVE` / `FEATURED` / `PREMIUM` lots still inspects the full
  sequence (a `BUYER_PRIVATE` `TRACEABILITY_BAG` suppresses the warning
  because the lot does carry traceability proof, just not publicly).

New buyer-side helper:

```ts
evaluateBuyerProofMediaReadiness({ lotMedia, farmMedia, mode })
// mode: "CONTRACTED" | "SHIPMENT_READY"
```

- `CONTRACTED` — soft warnings when no verified buyer-private
  traceability proof or certificate exists.
- `SHIPMENT_READY` — hard block `BUYER_TRACEABILITY_PROOF_REQUIRED`
  when no verified `BUYER_PRIVATE` `TRACEABILITY_BAG` exists.

The buyer-side helper is **not wired** to any production route in this
sprint. PARTNER-MEDIA-2 will plug it into the contract / shipment flow.

## DTO / API filtering

Marketplace and contract catalog DTOs filter `PUBLIC_MARKET` before
ordering:

```ts
// marketplaceLot.mapper.ts and contractCatalog.mapper.ts
const publicMediaItems = filterLotMediaForPublicMarket(snapshot.media ?? [])
const mediaResult = buildOrderedLotMedia(publicMediaItems)
```

Consequence: `BUYER_PRIVATE` and `INTERNAL_ONLY` rows are never present
on:

- `/api/marketplace/lots`
- `/api/contracts/catalog`
- `/platform/client` dashboard catalog
- `primaryMedia`, `media`, `mediaSummary`, `visual.imageUrl`

A `BUYER_PRIVATE` row flagged `isPrimary=true` does NOT promote to
`primaryMedia` — the filter strips it before primary selection runs.

`mediaSummary.missingRecommendedRoles` is computed on the public subset
only; private traceability proofs do not "satisfy" missing roles in
the public DTO.

`LotAllocationSnapshot.media` still carries all rows so a future
authorized contract-detail endpoint can call
`buildBuyerLotMediaSequence` on the same snapshot.

## Production guards

`verifyLotService` and `POST /api/partner/lots/[id]/publish` now project
`visibility` into `LotMediaItem` and run `evaluateLotMediaReadiness`
exactly as before. The public-only behaviour is enforced inside the
helper, so the guard automatically rejects a draft whose farm has only
`BUYER_PRIVATE` `FARM` photos:

```json
{
  "code": "LOT_MEDIA_NOT_READY",
  "error": "Lot media is not ready for publish.",
  "reasons": [
    {
      "code": "FARM_MEDIA_REQUIRED",
      "message": "Add at least one public farm/origin photo …"
    }
  ]
}
```

Status `400`. Error wording was updated to explicitly mention
"buyer-private images don't count" so the partner understands the
distinction.

## UI

**Skipped this sprint** (per spec — backend filtering is mandatory, UI
is optional). The producer wizard does not yet render a "public listing
vs private buyer proof" notice. PARTNER-MEDIA-2 will add the upload UI
with explicit slot copy:

- **Public listing media** — visible to buyers browsing the marketplace.
  Required before publish.
- **Private buyer proof** — visible only to the buyer after contract.
  Required before shipment.

## Files changed

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `LotMediaVisibility` enum + `visibility` column on `GreenLotMedia` and `FarmMedia` + index per table |
| `prisma/migrations/20260511130000_add_lot_media_visibility/migration.sql` | Migration |
| `src/services/lot-media/lotMedia.types.ts` | `LotMediaVisibility`, optional `visibility` on `LotMediaItem`, `DEFAULT_LOT_MEDIA_VISIBILITY_BY_ROLE`, buyer-proof readiness types |
| `src/services/lot-media/lotMedia.pure.ts` | Normalisation + classifiers + filters + sequence builders + readiness split + `evaluateBuyerProofMediaReadiness` |
| `src/services/lot-media/__tests__/lotMedia.test.ts` | 28 new tests |
| `src/services/allocation/snapshot/lotAllocationSnapshot.service.ts` | `visibility` in Prisma select for `GreenLotMedia` + `FarmMedia` |
| `src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts` | Projects `visibility` onto `LotMediaItem` |
| `src/services/allocation/marketplace/marketplaceLot.mapper.ts` | Filters `PUBLIC_MARKET` before building ordered result |
| `src/services/allocation/contracts/contractCatalog.mapper.ts` | Same filter |
| `src/services/allocation/__tests__/marketplaceLot.mapper.test.ts` | 4 visibility-filtering tests |
| `src/services/partner/lotVerification.service.ts` | Reads `visibility` on `FarmMedia` rows; same readiness helper |
| `app/api/partner/lots/[id]/publish/route.ts` | Reads `visibility` on lot + farm media rows |
| `docs/lot-media/LOT-MEDIA-2.md` | This document |

## Manual validation

After `prisma migrate deploy`:

1. Insert `FarmMedia` `FARM` + `PROCESS` with `visibility=PUBLIC_MARKET`,
   `source=PARTNER_UPLOAD`. Verify and publish a lot — both succeed.
2. `/api/marketplace/lots` and `/api/contracts/catalog` surface those
   media on the row's `primaryMedia` / `media`.
3. Insert a `GreenLotMedia` `TRACEABILITY_BAG` with
   `visibility=BUYER_PRIVATE` and `isPrimary=true`. Reload both
   endpoints — the row must not appear in any field;
   `primaryMedia.url` must still be the public farm photo.
4. Switch the `FarmMedia` rows to `visibility=BUYER_PRIVATE`. Attempt
   publish — expect `400 { code: "LOT_MEDIA_NOT_READY", reasons:
   [FARM_MEDIA_REQUIRED, PROCESS_MEDIA_REQUIRED] }`.
5. Restore `PUBLIC_MARKET`, add an `INTERNAL_ONLY` `CERTIFICATE` row.
   `/api/marketplace/lots` and `/api/contracts/catalog` must not
   expose it.
6. `/dev/scenarios/lots` continues to seed without media; dev factory
   bypass is intentional.

## Known limitations

- No upload UI in producer / partner dashboards. All rows must be
  inserted via Prisma Studio.
- No storage integration — URLs must point to existing local/public
  assets.
- No `/api/contracts/[id]/media` endpoint yet; the buyer-private
  sequence is exposed by the helper but not by any route.
- Buyer-proof helper (`evaluateBuyerProofMediaReadiness`) is not wired
  to the contract / shipment flow. Adding the `SHIPMENT_READY` block
  on real shipments lands in PARTNER-MEDIA-2.
- No carousel / lot detail gallery yet.
- Existing media rows defaulted to `PUBLIC_MARKET` by the migration —
  partners may need to review and re-tag traceability / certificate
  rows that should have been buyer-private.
- `PLATFORM_CURATED` still counts as verified for public-listing
  readiness. Hardening to require partner photos for premium lots is
  a future policy decision.

## Recommended next sprint

- **PARTNER-MEDIA-2** — upload UI + Supabase Storage signed URLs +
  visibility selector ("Public listing" vs "Private buyer proof"
  toggle) in the producer + partner dashboards, plus
  `/api/contracts/[id]/media` reading
  `buildBuyerLotMediaSequence` for contracted buyers.
- **DASHBOARD-IMAGES-1** — render the public sequence as a carousel on
  marketplace / client dashboard cards, with deterministic editorial
  fallbacks for empty lots.
