//////////////////////////////////////////////////////
// 🖼️ LOT MEDIA — TYPES (LOT-MEDIA-1)
//
// Pure TypeScript. No Prisma. No @prisma/client.
// These types are the contract between:
//   - the snapshot/mapper layer that reads GreenLotMedia rows
//   - the marketplace + contract catalog DTOs
//   - downstream UI consumers (carousel/gallery later)
//
// The role and source unions are kept as string-literals so
// that adding a new role does not require a TypeScript-level
// migration of consumers — unknown roles fall through to
// "EDITORIAL_FALLBACK" via normalizeLotMediaRole.
//////////////////////////////////////////////////////

export type LotMediaRole =
  | "FARM"
  | "PROCESS"
  | "PRODUCER"
  | "TRACEABILITY_BAG"
  | "PRODUCT_DETAIL"
  | "CERTIFICATE"
  | "EDITORIAL_FALLBACK"

export type LotMediaSource =
  | "PARTNER_UPLOAD"
  | "PLATFORM_CURATED"
  | "GENERATED_EDITORIAL"
  | "TONAL_PLACEHOLDER"

//////////////////////////////////////////////////////
// LOT-MEDIA-2 — VISIBILITY
//
// Independent of role + source. Determines who sees the
// row, not what it depicts or how trustworthy it is.
//
//   PUBLIC_MARKET — surfaced on /api/marketplace/lots,
//                   /api/contracts/catalog and the
//                   /platform/client dashboard catalog.
//   BUYER_PRIVATE — visible only to a contracted buyer
//                   (future contract detail endpoint).
//                   Default for TRACEABILITY_BAG and
//                   most CERTIFICATE rows.
//   INTERNAL_ONLY — partner / ops only. Never surfaced
//                   to marketplace or buyer.
//
// LOT-MEDIA-1 / FARM-MEDIA-1 rows had no visibility
// column. The migration defaults them to PUBLIC_MARKET
// and the pure helpers treat undefined the same way so
// every existing fixture keeps compiling.
//////////////////////////////////////////////////////

export type LotMediaVisibility =
  | "PUBLIC_MARKET"
  | "BUYER_PRIVATE"
  | "INTERNAL_ONLY"

//////////////////////////////////////////////////////
// LotMediaOwner — which table a row originated from.
//
// FARM-MEDIA-1: when an inherited media sequence is built
// from GreenLotMedia + FarmMedia, every projected
// LotMediaItem is tagged with its owner so:
//   - the ordering helper can prefer LOT over FARM at
//     identical role+position ties;
//   - the readiness helper can require coverage from
//     either source without losing provenance;
//   - downstream UI can label inherited farm photos
//     differently if it chooses to.
//
// Optional on LotMediaItem so existing LOT-MEDIA-1 callers
// that construct items without an explicit owner still
// compile. The pure helpers treat `undefined` as LOT.
//////////////////////////////////////////////////////

export type LotMediaOwner = "LOT" | "FARM"

//////////////////////////////////////////////////////
// LotMediaItem — the canonical per-row view-model.
//
// id, position, role, source, isPrimary mirror the Prisma
// row 1:1. altText is normalised to `string | null` (Prisma
// returns `string | null`) so consumers never need to guard
// against `undefined`.
//
// FARM-MEDIA-1: added optional owner/ownerId. owner defaults
// to "LOT" for backwards compatibility — items produced by
// the FarmMedia mapper carry owner="FARM".
//////////////////////////////////////////////////////

export type LotMediaItem = {
  id: string
  url: string
  role: LotMediaRole
  source: LotMediaSource
  position: number
  isPrimary: boolean
  altText: string | null
  caption?: string | null
  credit?: string | null
  owner?: LotMediaOwner
  ownerId?: string | null
  // LOT-MEDIA-2 — optional for backwards compatibility with
  // LOT-MEDIA-1 / FARM-MEDIA-1 fixtures. Helpers treat
  // undefined as PUBLIC_MARKET so existing tests still pass.
  visibility?: LotMediaVisibility
}

//////////////////////////////////////////////////////
// OrderedLotMediaResult — the helper output.
//
// `items`   ordered for display (role priority, then position).
// `primary` the chosen primary image (null when the lot has none).
// `hasVerifiedMedia` true if any item is PARTNER_UPLOAD or PLATFORM_CURATED.
// `hasPartnerMedia`  true if any item is PARTNER_UPLOAD.
// `hasOnlyFallbackMedia` true when items.length > 0 and every source is
//                        fallback (GENERATED_EDITORIAL / TONAL_PLACEHOLDER).
// `missingRecommendedRoles` recommended roles (FARM / PROCESS /
//                           TRACEABILITY_BAG) NOT satisfied by a verified
//                           row. Fallback rows do not satisfy this list —
//                           that's the whole point of the trust rule.
//////////////////////////////////////////////////////

export type OrderedLotMediaResult = {
  items: LotMediaItem[]
  primary: LotMediaItem | null
  hasVerifiedMedia: boolean
  hasPartnerMedia: boolean
  hasOnlyFallbackMedia: boolean
  missingRecommendedRoles: LotMediaRole[]
}

//////////////////////////////////////////////////////
// LotMediaSummary — compact summary attached to DTOs.
//
// Keeps the DTOs free of the full item array when the
// consumer only needs trust signals. The full ordered list
// is still passed alongside (media field).
//////////////////////////////////////////////////////

export type LotMediaSummary = {
  hasVerifiedMedia: boolean
  hasPartnerMedia: boolean
  hasOnlyFallbackMedia: boolean
  missingRecommendedRoles: LotMediaRole[]
}

//////////////////////////////////////////////////////
// CONSTANTS
//
// LOT_MEDIA_ROLE_PRIORITY — ordering used by orderLotMedia
// and selectPrimaryLotMedia. Numbers are arbitrary — lower
// is more important. Stored as a frozen record so consumers
// can read the priority of any role without recomputing.
//
// RECOMMENDED_LOT_MEDIA_ROLES — the minimum set a lot
// "should" have to feel documentary (farm + process +
// traceability). Used by missingRecommendedRoles to flag
// catalog lots whose verified media is thin.
//////////////////////////////////////////////////////

export const LOT_MEDIA_ROLE_PRIORITY: Readonly<Record<LotMediaRole, number>> = Object.freeze({
  FARM:                0,
  PROCESS:             1,
  PRODUCER:            2,
  TRACEABILITY_BAG:    3,
  PRODUCT_DETAIL:      4,
  CERTIFICATE:         5,
  EDITORIAL_FALLBACK:  6,
})

export const RECOMMENDED_LOT_MEDIA_ROLES: ReadonlyArray<LotMediaRole> = Object.freeze([
  "FARM",
  "PROCESS",
  "TRACEABILITY_BAG",
])

//////////////////////////////////////////////////////
// VERIFIED / FALLBACK source classification.
//
// Kept as frozen sets so the helper module + the DTO mappers
// agree on the trust boundary without duplicating the literal
// strings.
//////////////////////////////////////////////////////

export const VERIFIED_LOT_MEDIA_SOURCES: ReadonlySet<LotMediaSource> =
  new Set<LotMediaSource>(["PARTNER_UPLOAD", "PLATFORM_CURATED"])

export const FALLBACK_LOT_MEDIA_SOURCES: ReadonlySet<LotMediaSource> =
  new Set<LotMediaSource>(["GENERATED_EDITORIAL", "TONAL_PLACEHOLDER"])

//////////////////////////////////////////////////////
// LOT-MEDIA-2 — DEFAULT VISIBILITY BY ROLE
//
// Used by getDefaultVisibilityForMediaRole when the
// uploader did not pick a visibility explicitly. Kept
// frozen + per-owner so the partner UI can produce the
// right default for FarmMedia.PRODUCER and
// GreenLotMedia.PRODUCER independently (FarmMedia rows
// are more "marketing", GreenLotMedia rows are more
// "this specific lot").
//
// Per spec:
//   FarmMedia.PRODUCER    → PUBLIC_MARKET (partner can override)
//   GreenLotMedia.PRODUCER → PUBLIC_MARKET (partner can override)
//   GreenLotMedia.TRACEABILITY_BAG → BUYER_PRIVATE
//   GreenLotMedia.CERTIFICATE     → BUYER_PRIVATE
//////////////////////////////////////////////////////

export const DEFAULT_LOT_MEDIA_VISIBILITY_BY_ROLE: Readonly<
  Record<LotMediaRole, LotMediaVisibility>
> = Object.freeze({
  FARM:                "PUBLIC_MARKET",
  PROCESS:             "PUBLIC_MARKET",
  PRODUCER:            "PUBLIC_MARKET",
  TRACEABILITY_BAG:    "BUYER_PRIVATE",
  PRODUCT_DETAIL:      "PUBLIC_MARKET",
  CERTIFICATE:         "BUYER_PRIVATE",
  EDITORIAL_FALLBACK:  "PUBLIC_MARKET",
})

//////////////////////////////////////////////////////
// LOT-MEDIA-2 — BUYER PROOF READINESS
//
// Separate helper for the buyer-proof side of the
// lifecycle. Not wired to contract/shipment flows yet —
// pure helper only, ready for PARTNER-MEDIA-2.
//
//   CONTRACTED      — soft warnings only
//   SHIPMENT_READY  — block when no verified BUYER_PRIVATE
//                     TRACEABILITY_BAG exists
//////////////////////////////////////////////////////

export type BuyerProofReadinessMode = "CONTRACTED" | "SHIPMENT_READY"

export type BuyerProofReadinessBlockingCode =
  | "BUYER_TRACEABILITY_PROOF_REQUIRED"

export type BuyerProofReadinessWarningCode =
  | "BUYER_TRACEABILITY_PROOF_RECOMMENDED"
  | "BUYER_CERTIFICATE_RECOMMENDED"

export type BuyerProofReadinessBlockingReason = {
  code: BuyerProofReadinessBlockingCode
  message: string
}

export type BuyerProofReadinessWarning = {
  code: BuyerProofReadinessWarningCode
  message: string
}

export type BuyerProofReadinessCoverage = {
  hasBuyerPrivateTraceabilityProof: boolean
  hasBuyerPrivateCertificate: boolean
  hasAnyBuyerPrivateProof: boolean
}

export type BuyerProofReadinessContext = {
  lotMedia: ReadonlyArray<LotMediaItem>
  farmMedia: ReadonlyArray<LotMediaItem>
  mode: BuyerProofReadinessMode
}

export type BuyerProofReadinessResult = {
  ready: boolean
  blockingReasons: BuyerProofReadinessBlockingReason[]
  warnings: BuyerProofReadinessWarning[]
  coverage: BuyerProofReadinessCoverage
}

//////////////////////////////////////////////////////
// PARTNER-MEDIA-2A — INPUT CONTRACT FOR PRODUCER/PARTNER
// MEDIA MANAGEMENT
//
// The route layer normalises an incoming JSON body into
// this shape before calling the service. role is required;
// everything else is filled with smart defaults by the
// pure helper.
//////////////////////////////////////////////////////

export type LotMediaCreateInput = {
  url: string
  role: LotMediaRole
  source?: LotMediaSource
  visibility?: LotMediaVisibility
  position?: number
  isPrimary?: boolean
  altText?: string | null
  caption?: string | null
  credit?: string | null
}

export type LotMediaUpdateInput = {
  url?: string
  role?: LotMediaRole
  source?: LotMediaSource
  visibility?: LotMediaVisibility
  position?: number
  isPrimary?: boolean
  altText?: string | null
  caption?: string | null
  credit?: string | null
}

// PARTNER-MEDIA-2A — UI readiness checklist (split projection)
//
// The wizard renders two columns:
//   - PUBLIC listing readiness (blocks publish)
//   - BUYER-private proof readiness (warnings only, will
//     block shipment in a future sprint)
//
// Each entry is "satisfied" / "missing" with a stable code
// so the UI can render copy + state without re-implementing
// the rules.

export type LotMediaSlotState = "SATISFIED" | "MISSING"

export type LotMediaReadinessPanelSlot = {
  code:
    | "PUBLIC_FARM_PHOTO"
    | "PUBLIC_PROCESS_OR_PRODUCT_PHOTO"
    | "PUBLIC_PRODUCER_PHOTO"
    | "BUYER_TRACEABILITY_PROOF"
    | "BUYER_CERTIFICATE"
    | "BUYER_FINAL_EXPORT_BAG"
  label: string
  description: string
  state: LotMediaSlotState
  required: boolean
}

export type LotMediaReadinessPanel = {
  publicListing: {
    ready: boolean
    slots: LotMediaReadinessPanelSlot[]
  }
  buyerProof: {
    // Always false in this sprint until the shipment guard
    // is wired (PARTNER-MEDIA-2B). The UI shows the panel as
    // informational.
    blocking: boolean
    slots: LotMediaReadinessPanelSlot[]
  }
}

//////////////////////////////////////////////////////
// FARM-MEDIA-1 — readiness contract
//
// Drives the producer/partner side of the lifecycle:
//   DRAFT   — always passes (lot can exist without media)
//   SUBMIT  — partner submission; requires verified FARM + PROCESS
//   VERIFY  — partner verification (creates GreenLot); same gates as SUBMIT
//   PUBLISH — DRAFT → PUBLISHED; same gates as SUBMIT
//
// Readiness reads media from both layers (lot + farm) so a
// producer who has uploaded farm-level FARM + PROCESS photos
// can publish a brand-new lot without uploading lot-specific
// media first.
//
// lotClass widens the warning surface (EXCLUSIVE / FEATURED
// produce a TRACEABILITY_BAG warning when missing) but does
// not currently widen the blocking set — Founder policy.
//////////////////////////////////////////////////////

export type LotMediaReadinessMode = "DRAFT" | "SUBMIT" | "VERIFY" | "PUBLISH"

export type LotClass = "NORMAL" | "PREMIUM" | "EXCLUSIVE" | "FEATURED"

export type LotMediaReadinessBlockingCode =
  | "FARM_MEDIA_REQUIRED"
  | "PROCESS_MEDIA_REQUIRED"
  | "TRACEABILITY_MEDIA_RECOMMENDED"
  | "PREMIUM_MEDIA_INCOMPLETE"

export type LotMediaReadinessWarningCode =
  | "TRACEABILITY_MEDIA_RECOMMENDED"
  | "PRODUCER_MEDIA_RECOMMENDED"
  | "MEDIA_PLATFORM_CURATED_ONLY"
  | "FALLBACK_ONLY_MEDIA"

export type LotMediaReadinessBlockingReason = {
  code: LotMediaReadinessBlockingCode
  message: string
}

export type LotMediaReadinessWarning = {
  code: LotMediaReadinessWarningCode
  message: string
}

export type LotMediaReadinessCoverage = {
  hasVerifiedFarmMedia: boolean
  hasVerifiedProcessMedia: boolean
  hasVerifiedProducerMedia: boolean
  hasVerifiedTraceabilityMedia: boolean
  hasAnyVerifiedMedia: boolean
}

export type LotMediaReadinessContext = {
  lotMedia: ReadonlyArray<LotMediaItem>
  farmMedia: ReadonlyArray<LotMediaItem>
  mode: LotMediaReadinessMode
  lotClass?: LotClass
}

export type LotMediaReadinessResult = {
  ready: boolean
  blockingReasons: LotMediaReadinessBlockingReason[]
  warnings: LotMediaReadinessWarning[]
  coverage: LotMediaReadinessCoverage
}
