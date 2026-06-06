# FARM-MEDIA-1 / PRODUCER-MEDIA-GUARD-1

> Extended by [LOT-MEDIA-2](./LOT-MEDIA-2.md) — visibility separation
> (`PUBLIC_MARKET` / `BUYER_PRIVATE` / `INTERNAL_ONLY`). The readiness
> guard described below now measures public-listing coverage only:
> a `BUYER_PRIVATE` FARM photo no longer satisfies the FARM gate.
>
> Further extended by [PARTNER-MEDIA-2A](./PARTNER-MEDIA-2A.md) —
> producer + partner CRUD endpoints, ownership checks, and a
> producer-facing media management page at `/platform/producer/media`.

Reusable farm-level media + producer-side media-readiness guard for
verified/published lots. Extends [LOT-MEDIA-1](./LOT-MEDIA-1.md) — same
role/source enums, same pure helpers, same DTO surfaces; one new table,
one new pure helper, two server-side guards.

## Why

LOT-MEDIA-1 stored media per lot, but:

1. Farm/origin photos are reusable. A producer's one farm landscape
   covers every lot they will ever publish from that farm.
2. Lots can still reach catalog visually empty under LOT-MEDIA-1 — the
   data model accepts no rows.

This sprint solves both: a `FarmMedia` model lets a partner / producer
upload origin and process photos at the farm level, and a server-side
guard refuses to verify or publish a lot whose farm hasn't covered at
least one verified FARM and one verified PROCESS row.

## Schema

```prisma
model FarmMedia {
  id          String         @id @default(uuid())
  farmId      String
  farm        Farm           @relation(fields: [farmId], references: [id], onDelete: Cascade)

  url         String
  role        LotMediaRole       // reused from LOT-MEDIA-1
  source      LotMediaSource     // reused from LOT-MEDIA-1

  position    Int            @default(0)
  isPrimary   Boolean        @default(false)

  altText     String?
  caption     String?
  credit      String?
  metadata    Json?

  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([farmId])
  @@index([farmId, role])
  @@index([farmId, isPrimary])
}
```

`Farm` gains `media FarmMedia[]`. Additive, no backfill. Existing farms
keep zero rows.

Migration: `prisma/migrations/20260511110000_add_farm_media/migration.sql`.

## FarmMedia vs GreenLotMedia

| Question                       | GreenLotMedia                  | FarmMedia                       |
|--------------------------------|--------------------------------|---------------------------------|
| Scope                          | One row per lot                | One row reusable across lots    |
| Lifecycle                      | Created/edited per shipment    | Stable per farm                 |
| Best for                       | TRACEABILITY_BAG, PRODUCT_DETAIL, CERTIFICATE | FARM, PROCESS, PRODUCER |
| Required for SUBMIT/PUBLISH?   | Lot rows alone are sufficient | FarmMedia alone is sufficient |
| Owner tag in helper output     | `owner = "LOT"`                | `owner = "FARM"`                |

## Inherited media sequence

The new `buildInheritedLotMediaSequence({ lotMedia, farmMedia })` helper
merges the two arrays into a single ordered sequence:

1. Each array is tagged with `owner` (LOT or FARM) via `withOwner`.
2. `compareLotMediaItems` orders by **role priority → position → owner
   rank (LOT before FARM) → id**. The owner rank is the new
   FARM-MEDIA-1 step; previous LOT-MEDIA-1 behaviour is unchanged for
   single-source arrays.
3. `selectPrimaryLotMedia` now picks **explicit LOT primary** first,
   then **explicit FARM primary**, then the first ordered item. This
   means a lot-specific hero image always beats an inherited farm hero
   when both are flagged `isPrimary=true`.

`missingRecommendedRoles` (FARM / PROCESS / TRACEABILITY_BAG) is
satisfied by **either** source as long as the row is verified
(`PARTNER_UPLOAD` or `PLATFORM_CURATED`).

## Readiness evaluation

```ts
type LotMediaReadinessMode = "DRAFT" | "SUBMIT" | "VERIFY" | "PUBLISH"

evaluateLotMediaReadiness({
  lotMedia,          // GreenLotMedia projected as LotMediaItem[]
  farmMedia,         // FarmMedia projected as LotMediaItem[]
  mode,
  lotClass,          // "NORMAL" | "PREMIUM" | "EXCLUSIVE" | "FEATURED"
})
```

Returns:

```ts
{
  ready: boolean
  blockingReasons: Array<{ code, message }>
  warnings: Array<{ code, message }>
  coverage: {
    hasVerifiedFarmMedia,
    hasVerifiedProcessMedia,
    hasVerifiedProducerMedia,
    hasVerifiedTraceabilityMedia,
    hasAnyVerifiedMedia,
  }
}
```

### Rules

- `DRAFT` — always ready. A producer must be able to save a draft
  before uploading any media. A `FALLBACK_ONLY_MEDIA` warning is
  surfaced when coverage is thin so the wizard can nudge.
- `SUBMIT` / `VERIFY` / `PUBLISH` — require **at least one verified
  FARM row** from either layer and **at least one verified PROCESS
  row**. Blocks with `FARM_MEDIA_REQUIRED` / `PROCESS_MEDIA_REQUIRED`.
- `EXCLUSIVE` / `FEATURED` / `PREMIUM` lots additionally warn with
  `TRACEABILITY_MEDIA_RECOMMENDED` when no verified TRACEABILITY_BAG
  exists. Non-blocking by Founder policy.
- `PLATFORM_CURATED`-only coverage emits a non-blocking
  `MEDIA_PLATFORM_CURATED_ONLY` warning so the producer dashboard can
  prompt for real partner photos.

Fallback sources (`GENERATED_EDITORIAL`, `TONAL_PLACEHOLDER`) never
satisfy any blocking gate.

## Producer flow changes

### Production path — guarded
1. `POST /api/producer/lot-draft` — **unchanged**, no media required.
   Creates a `ProducerLotDraft`.
2. `POST /api/partner/lots/[id]/verify` → `verifyLotService` — **guarded**.
   Loads `FarmMedia` for the draft's farm, runs `evaluateLotMediaReadiness({ mode: "VERIFY" })`.
   Failure throws `LotMediaNotReadyError` which the route surfaces as:
   ```json
   {
     "code": "LOT_MEDIA_NOT_READY",
     "error": "Lot media is not ready for verification.",
     "reasons": [
       { "code": "FARM_MEDIA_REQUIRED", "message": "Add at least one real farm/origin photo …" },
       { "code": "PROCESS_MEDIA_REQUIRED", "message": "Add at least one processing photo …" }
     ]
   }
   ```
   Status `400`.
3. `POST /api/partner/lots/[id]/publish` — **guarded**. Loads
   `GreenLot.media` + `GreenLot.farm.media`, runs
   `evaluateLotMediaReadiness({ mode: "PUBLISH" })`. Same `LOT_MEDIA_NOT_READY`
   shape on failure.

### Dev path — bypassed
`src/services/dev/scenarios/devLotScenario.service.ts` continues to
create GreenLots directly. It never calls `verifyLotService` or the
publish route, so it bypasses the guard intentionally — dev seeds
remain visually empty until a future sprint seeds placeholder media.
Production partner verification has **no bypass**.

### UI
**Skipped this sprint** (per spec — backend guard is mandatory, UI is
optional). The verify/publish error responses carry the exact
human-readable messages the wizard can render verbatim; a dedicated
producer-side readiness notice ships with PARTNER-MEDIA-1.

## DTO / API propagation

The marketplace + contract catalog DTOs gained `media` / `primaryMedia`
/ `mediaSummary` in LOT-MEDIA-1; this sprint keeps the shape but
populates the sequence from both lot and farm media via the snapshot
service:

- `lotAllocationSnapshot.service.ts` now includes
  `Farm.media` in the GreenLot select (same column list as
  GreenLotMedia, sorted by position+createdAt).
- `lotAllocationSnapshot.mapper.ts` concatenates the two row sets,
  tagging each item with `owner`, and stores them on
  `LotAllocationSnapshot.media`.
- `marketplaceLot.mapper.ts` and `contractCatalog.mapper.ts` keep
  calling `buildOrderedLotMedia(snapshot.media ?? [])`, which now picks
  up the inherited rows automatically. `mediaSummary.hasVerifiedMedia`,
  `hasPartnerMedia`, and `missingRecommendedRoles` reflect the combined
  sequence; `primaryMedia` follows the new owner-aware selection rule.

No API consumer changes were required — the DTO shape is unchanged,
the new fields are still optional, and the inherited rows are
transparent to clients that only consume `primaryMedia.url`.

## Tests

Added to [src/services/lot-media/__tests__/lotMedia.test.ts](../../src/services/lot-media/__tests__/lotMedia.test.ts):

- `buildInheritedLotMediaSequence` — combines arrays, lot beats farm
  at same role/position, farm primary surfaces when lot is empty,
  explicit lot primary beats farm primary across roles, fallback to
  farm primary when no lot primary, verified farm satisfies
  recommended-role coverage, no input mutation.
- `withOwner` — tagging + immutability.
- `evaluateLotMediaReadiness` — DRAFT always ready, SUBMIT/VERIFY/PUBLISH
  blocks on missing FARM and PROCESS independently, verified coverage
  from either layer satisfies the gate, fallback sources never satisfy,
  PLATFORM_CURATED-only emits a warning, PARTNER_UPLOAD suppresses that
  warning, EXCLUSIVE / FEATURED produces the traceability warning,
  coverage flags expose role-level state, stable blocking-reason codes,
  no input mutation.

50 lot-media tests pass total (29 from LOT-MEDIA-1 + 21 new).
Full allocation suite passes too.

## Manual validation

After `prisma migrate deploy`:

1. Producer creates a draft via `POST /api/producer/lot-draft` (no media
   required).
2. Partner attempts `POST /api/partner/lots/[draftId]/verify` — expect
   **400** with:
   ```json
   {
     "code": "LOT_MEDIA_NOT_READY",
     "reasons": [
       { "code": "FARM_MEDIA_REQUIRED", "message": "..." },
       { "code": "PROCESS_MEDIA_REQUIRED", "message": "..." }
     ]
   }
   ```
3. In Prisma Studio, insert two rows on `FarmMedia` for the draft's
   farm (`role=FARM`, `role=PROCESS`, both `source=PARTNER_UPLOAD`,
   any safe URL).
4. Retry verification — expect success, GreenLot created in DRAFT.
5. Publish: `POST /api/partner/lots/[greenLotId]/publish` — expect
   success. If the farm media is removed first, the publish call
   returns the same `LOT_MEDIA_NOT_READY` shape.
6. Hit `/api/marketplace/lots` — if `GreenLotMedia` is empty but
   `FarmMedia` exists, `primaryMedia.url` is the farm photo.
7. Add a `GreenLotMedia` row with `isPrimary=true` — `primaryMedia.url`
   now uses the lot photo (LOT beats FARM).
8. `/api/contracts/catalog` reflects the same inherited sequence.
9. `/dev/scenarios/lots` reset + seed continues to work unchanged.

## Known limitations

- No upload UI yet (producer dashboard, partner dashboard, anywhere).
  All FarmMedia/GreenLotMedia rows must be inserted via Prisma Studio
  or a future API.
- No storage integration. URLs must point to existing local/public
  assets.
- No AI generation. `GENERATED_EDITORIAL` is reserved for a later
  sprint and will not satisfy readiness even when implemented.
- No carousel / lot detail gallery.
- Existing farms need a media backfill — until a partner uploads, every
  attempt to verify/publish that farm's lots is blocked. Dev factory
  bypasses by design.
- `PLATFORM_CURATED` is allowed to satisfy readiness today; if Founder
  wants to require partner photos for premium lots, harden later.
- The producer wizard does not yet surface a "your farm needs photos"
  notice — backend guard is the source of truth for now.

## Recommended next sprint

- **PARTNER-MEDIA-1** — partner/producer dashboard upload UI, storage
  integration (Supabase Storage / signed URLs), slot-per-role
  configuration, real-time readiness display in the wizard.
- **DASHBOARD-IMAGES-1** — render the inherited media sequence as a
  carousel on dashboard cards + a full gallery on the lot detail page,
  with deterministic editorial fallbacks for empty lots.
