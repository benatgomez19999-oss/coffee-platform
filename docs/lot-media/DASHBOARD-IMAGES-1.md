# DASHBOARD-IMAGES-1 — Public media carousel for cards

Renders the public media sequence introduced by
[LOT-MEDIA-1](./LOT-MEDIA-1.md) / [FARM-MEDIA-1](./FARM-MEDIA-1.md) /
[LOT-MEDIA-2](./LOT-MEDIA-2.md) / [PARTNER-MEDIA-2A](./PARTNER-MEDIA-2A.md)
as a compact carousel inside marketplace + client dashboard cards.
Public-only by contract — the carousel never re-filters; it consumes
what the DTO mappers already filtered to `PUBLIC_MARKET`.

## Summary

- One new shared component: `LotMediaCarousel` (client component,
  client-side state only, no fetch).
- One new pure helper module: `lotMediaCarousel.helpers.ts`
  (`buildLotMediaDisplaySequence`, `buildLotMediaTrustBadge`).
- Marketplace cards (`MarketplaceLotCard`, `FeaturedLotCard`) now use
  the carousel; the old `LotImageWell` import is dropped.
- Client dashboard cards (`SupplyDeskPanel` recommended cards,
  `ClientContractCatalogPanel` catalog cards) use the carousel; the
  inline `Thumbnail` helpers are removed.
- `MarketplacePage` view-mapping now forwards `media` / `primaryMedia`
  / `mediaSummary`.
- `pickRecommendedContractLots` selector now propagates the same three
  fields onto `RecommendedContractLot`.
- `Dashboard.catalogStripLots` projection forwards them onto
  `ContractCatalogStripLot`.
- No new dependencies. No schema changes.

## Files changed

| File | Purpose |
|---|---|
| `src/components/platform/media/LotMediaCarousel.tsx` | **New** — shared carousel component |
| `src/components/platform/media/lotMediaCarousel.helpers.ts` | **New** — pure helpers |
| `src/components/platform/media/__tests__/lotMediaCarousel.helpers.test.ts` | **New** — 13 helper tests |
| `src/components/platform/marketplace/mock-marketplace-data.ts` | `MarketplaceLot` gains optional `media` / `primaryMedia` / `mediaSummary` |
| `src/components/platform/marketplace/MarketplaceLotCard.tsx` | Carousel replaces `LotImageWell`, trust badge suppressed |
| `src/components/platform/marketplace/FeaturedLotCard.tsx` | Carousel replaces `LotImageWell`, trust badge enabled |
| `src/components/platform/marketplace/MarketplacePage.tsx` | DTO→view mapping forwards media fields |
| `src/services/client-dashboard/recommendedContractLots.ts` | `RecommendedContractLot` carries media + propagated by selector |
| `src/components/platform/client/SupplyDeskPanel.tsx` | Carousel replaces inline `Thumbnail`; obsolete helpers removed |
| `src/components/platform/client/ClientContractCatalogPanel.tsx` | `ContractCatalogStripLot` carries media; carousel replaces `Thumbnail` |
| `src/components/platform/client/Dashboard.tsx` | `catalogStripLots` mapping forwards media fields |
| `src/services/client-dashboard/__tests__/clientDashboard.test.ts` | +2 selector-propagation tests |
| `package.json` | `test:allocation` glob picks up the new carousel-helper tests |

## Carousel component behaviour

`LotMediaCarousel`:

- Builds display sequence via `buildLotMediaDisplaySequence({ media, primaryMedia })`:
  - `primaryMedia` first if present.
  - Then the remaining `media` rows in the order the DTO supplied
    them.
  - Duplicates removed by `id`. Rows without an `id` are skipped.
- **0 media** → deterministic tonal gradient picked by hashing
  `fallbackKey` (same six tones used elsewhere) + a muted "Image
  pending" microcopy chip (skipped on the featured aspect).
- **1 medium** → `<img>` only, dots + arrows suppressed.
- **2+ media** → dots at the bottom, optional prev/next buttons. Both
  buttons + dots have `aria-label`s; the carousel wrapper is
  `role="group" aria-roledescription="carousel"`.
- Broken images call `onError` and the carousel quietly falls back to
  the tonal placeholder for that slot, so a bad URL never breaks the
  card.
- Local React state only — no fetch, no DOM measurements.
- Three aspect presets: `"card"` (16:10), `"featured"` (21:9),
  `"compact"` (4:3).
- Optional `children` slot stacks above the image (badges, favorite
  toggles) — preserves the LotImageWell layout contract.

`alt` text fallback: `media.altText || title || "Coffee lot image"`.

## Marketplace card changes

- `MarketplaceLotCard` now wraps the image area in `LotMediaCarousel`
  with `aspect="card"` and a fixed `h-[148px]` height. The primary
  badge + favorite heart sit in the same overlay positions as before
  via the carousel's `children` slot. Trust badge is suppressed
  (`showTrustBadge={false}`) because the card already shows a
  marketplace badge pill.
- `FeaturedLotCard` uses `aspect="featured"` with `absolute inset-0`
  to fill the editorial hero card. Trust badge is enabled because the
  featured hero benefits from the verification chip in the corner.
- `MarketplacePage.toMarketplaceLot` forwards `dto.media`,
  `dto.primaryMedia`, `dto.mediaSummary` onto the client-side
  `MarketplaceLot` view-model.
- The legacy `imageUrl` field is still propagated for backwards
  compatibility but the carousel no longer reads it — it uses the full
  `primaryMedia` / `media` payload, so the URL displayed always
  matches what the public sequence would yield.

## Client dashboard card changes

- `SupplyDeskPanel` recommended cards use the carousel with
  `aspect="card"`, height `180px`, and the trust badge enabled so the
  recommended supply hero surfaces the "Partner media" /
  "Curated media" / "Illustrative" chip when applicable.
- `ClientContractCatalogPanel` cards use `aspect="compact"` and height
  `116px` (matching the previous `Thumbnail` height). Trust badge
  suppressed to keep the dense grid clean; the existing role/score
  badges still appear in the top-left.
- The selector `pickRecommendedContractLots` now requires the catalog
  DTO to expose `media`, `primaryMedia`, `mediaSummary` (already true
  via LOT-MEDIA-2) and surfaces them as required fields on
  `RecommendedContractLot`.
- `ContractCatalogStripLot` gains optional `media` / `primaryMedia` /
  `mediaSummary`; `Dashboard.catalogStripLots` projection forwards
  the DTO fields through.

## Trust badge behaviour

`buildLotMediaTrustBadge({ summary, hasAnyMedia })` returns at most
one of three labels:

| Condition | Label | Tone |
|---|---|---|
| `summary.hasPartnerMedia === true`     | `Partner media`  | gold |
| else `summary.hasVerifiedMedia === true` | `Curated media` | emerald |
| else `summary.hasOnlyFallbackMedia === true` | `Illustrative` | muted |
| no media / no summary                  | (no badge)       | — |

The label set never contains technical source names; the carousel
never claims `GENERATED_EDITORIAL` or `TONAL_PLACEHOLDER` as verified.
Cards opt in via `showTrustBadge` — currently the featured marketplace
card + supply desk recommended cards opt in; the dense card grid
suppresses the badge to avoid visual noise.

## Tests added

13 new pure tests in `src/components/platform/media/__tests__/lotMediaCarousel.helpers.test.ts`:

- `buildLotMediaDisplaySequence` — primary first, dedup, falls back to
  media order when no primary, empty/null inputs, dedupes by id (not
  url), ignores entries without ids, no input mutation.
- `buildLotMediaTrustBadge` — empty/missing summary → null,
  partner > curated > illustrative precedence, never claims
  verification without a source signal.

2 new selector-propagation tests in `clientDashboard.test.ts`:

- `pickRecommendedContractLots` propagates `media` / `primaryMedia` /
  `mediaSummary` through to the recommendation.
- Defaults to safe empty values when the DTO has no media.

Totals (full project): **126 lot-media + carousel-helper tests** and
**696 allocation suite** all green (110 prior lot-media + 13 carousel
helpers + ~3 selector / mapper / portfolio additions). tsc clean.

## Manual validation

1. Migrations already applied (no new migration in this sprint).
2. Add media via `/platform/producer/media`:
   - `FARM`, `visibility=PUBLIC_MARKET`, source `PARTNER_UPLOAD`,
     URL `/images/marketplace_main_card.png`.
   - `PROCESS`, `visibility=PUBLIC_MARKET`, same URL.
   - `TRACEABILITY_BAG`, `visibility=BUYER_PRIVATE`, any URL.
3. `/api/marketplace/lots` returns the two public media in the row's
   `media` field; `primaryMedia.url` is set; the buyer-private bag is
   not present.
4. `/platform/marketplace` renders the card with the carousel — dots
   appear under the image, prev/next arrows surface on hover, alt
   text reads from the row's `altText`.
5. `/platform/client` recommended supply card renders the carousel
   with the trust badge ("Partner media") in the corner. Catalog card
   renders the carousel in compact aspect with the role badge.
6. Set a different primary via `/platform/producer/media` — the first
   image in the carousel changes after the page reloads.
7. Delete all media — carousel returns to the tonal fallback with
   "Image pending" microcopy on the dashboard catalog card. Featured
   card keeps the clean fallback gradient.
8. Resize the viewport to mobile — dots stay visible, arrows shrink
   gracefully, no layout shift.
9. Verify on `/platform/client` that no `BUYER_PRIVATE` row appears
   anywhere on the page — open browser devtools and inspect the
   carousel's `<img>` source attributes.

## Known limitations

- No upload UI / storage integration (carryover from PARTNER-MEDIA-2A).
- No AI fallback generation; `EDITORIAL_FALLBACK` rows are visible if
  the partner adds them but the trust badge is "Illustrative".
- No lot-detail gallery; the carousel only renders inside the card
  image well.
- No buyer-private endpoint for contracted buyers; the helper
  `buildBuyerLotMediaSequence` exists but no route exposes it.
- No shipment / export proof guard.
- Carousel uses public DTO media only; image quality depends on the
  partner-provided URL (no compression, no responsive `srcset`).
- The carousel's prev/next buttons fade in on `group-hover` from the
  card wrapper — touch devices won't see them until the wrapping card
  receives focus or tap. Future sprint can add a swipe gesture handler.
- `LotImageWell` is still present in the codebase but no longer
  imported by cards — keeping it short-term for the partner lot
  publish UI (which still uses the placeholder) and other consumers.
  Safe to remove in a future cleanup once those surfaces also migrate.

## Recommended next sprint

- **STORAGE-MEDIA-1 / PARTNER-MEDIA-2B** — Supabase Storage signed
  uploads + file picker UI, replacing the URL paste flow.
- **CONTRACT-REQUEST-1** — activate the disabled "Configure monthly
  supply" CTA so the recommended supply card can complete the
  contract-request flow.
