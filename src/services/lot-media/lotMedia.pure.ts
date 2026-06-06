//////////////////////////////////////////////////////
// 🖼️ LOT MEDIA — PURE HELPERS (LOT-MEDIA-1)
//
// No Prisma. No fetch. No DB. The single source of truth
// for media ordering, primary selection, trust classification
// and recommended-role coverage.
//
// All helpers are deterministic — the same input array
// produces the same output array regardless of host clock
// or environment. compareLotMediaItems uses a stable id
// fallback so even items with identical role + position
// sort the same way every run.
//
// IMPORTANT: orderLotMedia and buildOrderedLotMedia DO NOT
// mutate their inputs (a sort()-on-copy pattern is used so
// the original array is safe).
//////////////////////////////////////////////////////

import {
  DEFAULT_LOT_MEDIA_VISIBILITY_BY_ROLE,
  LOT_MEDIA_ROLE_PRIORITY,
  RECOMMENDED_LOT_MEDIA_ROLES,
  VERIFIED_LOT_MEDIA_SOURCES,
  FALLBACK_LOT_MEDIA_SOURCES,
  type BuyerProofReadinessBlockingReason,
  type BuyerProofReadinessContext,
  type BuyerProofReadinessCoverage,
  type BuyerProofReadinessResult,
  type BuyerProofReadinessWarning,
  type LotMediaCreateInput,
  type LotMediaItem,
  type LotMediaOwner,
  type LotMediaReadinessBlockingReason,
  type LotMediaReadinessContext,
  type LotMediaReadinessCoverage,
  type LotMediaReadinessPanel,
  type LotMediaReadinessPanelSlot,
  type LotMediaReadinessResult,
  type LotMediaReadinessWarning,
  type LotMediaRole,
  type LotMediaSource,
  type LotMediaUpdateInput,
  type LotMediaVisibility,
  type OrderedLotMediaResult,
} from "./lotMedia.types.ts"

// ------------------------------------------------------
// NORMALISATION
// ------------------------------------------------------

const VALID_ROLES: ReadonlySet<LotMediaRole> = new Set<LotMediaRole>([
  "FARM",
  "PROCESS",
  "PRODUCER",
  "TRACEABILITY_BAG",
  "PRODUCT_DETAIL",
  "CERTIFICATE",
  "EDITORIAL_FALLBACK",
])

const VALID_SOURCES: ReadonlySet<LotMediaSource> = new Set<LotMediaSource>([
  "PARTNER_UPLOAD",
  "PLATFORM_CURATED",
  "GENERATED_EDITORIAL",
  "TONAL_PLACEHOLDER",
])

export function normalizeLotMediaRole(value: unknown): LotMediaRole | null {
  if (typeof value !== "string") return null
  return VALID_ROLES.has(value as LotMediaRole) ? (value as LotMediaRole) : null
}

export function normalizeLotMediaSource(value: unknown): LotMediaSource | null {
  if (typeof value !== "string") return null
  return VALID_SOURCES.has(value as LotMediaSource)
    ? (value as LotMediaSource)
    : null
}

export function isVerifiedLotMediaSource(source: LotMediaSource): boolean {
  return VERIFIED_LOT_MEDIA_SOURCES.has(source)
}

export function isFallbackLotMediaSource(source: LotMediaSource): boolean {
  return FALLBACK_LOT_MEDIA_SOURCES.has(source)
}

// ------------------------------------------------------
// LOT-MEDIA-2 — VISIBILITY
//
// Independent of role + source. Determines who sees the row,
// not what it depicts or how trustworthy it is.
//
// Helpers treat `undefined` visibility as PUBLIC_MARKET so
// LOT-MEDIA-1 / FARM-MEDIA-1 fixtures (which never set the
// field) keep their previous behaviour after this sprint.
// ------------------------------------------------------

const VALID_VISIBILITIES: ReadonlySet<LotMediaVisibility> =
  new Set<LotMediaVisibility>(["PUBLIC_MARKET", "BUYER_PRIVATE", "INTERNAL_ONLY"])

export function normalizeLotMediaVisibility(
  value: unknown,
): LotMediaVisibility | null {
  if (typeof value !== "string") return null
  return VALID_VISIBILITIES.has(value as LotMediaVisibility)
    ? (value as LotMediaVisibility)
    : null
}

function resolveVisibility(item: LotMediaItem): LotMediaVisibility {
  return item.visibility ?? "PUBLIC_MARKET"
}

export function isPublicMarketMedia(item: LotMediaItem): boolean {
  return resolveVisibility(item) === "PUBLIC_MARKET"
}

export function isBuyerPrivateMedia(item: LotMediaItem): boolean {
  return resolveVisibility(item) === "BUYER_PRIVATE"
}

export function isInternalOnlyMedia(item: LotMediaItem): boolean {
  return resolveVisibility(item) === "INTERNAL_ONLY"
}

// ------------------------------------------------------
// FILTERS
//
// Audience-scoped filters. Each is a pure projection — no
// mutation, no sorting. Caller is expected to feed the
// result into buildOrderedLotMedia / buildInheritedLotMediaSequence
// when ordering is needed.
// ------------------------------------------------------

export function filterLotMediaForPublicMarket(
  items: ReadonlyArray<LotMediaItem>,
): LotMediaItem[] {
  if (!items || items.length === 0) return []
  return items.filter(isPublicMarketMedia)
}

export function filterLotMediaForBuyerPrivate(
  items: ReadonlyArray<LotMediaItem>,
): LotMediaItem[] {
  if (!items || items.length === 0) return []
  return items.filter((i) => {
    const v = resolveVisibility(i)
    return v === "PUBLIC_MARKET" || v === "BUYER_PRIVATE"
  })
}

export function filterLotMediaForInternalOps(
  items: ReadonlyArray<LotMediaItem>,
): LotMediaItem[] {
  if (!items || items.length === 0) return []
  return items.slice()
}

// ------------------------------------------------------
// DEFAULT VISIBILITY BY ROLE
//
// Owner-aware (FarmMedia vs GreenLotMedia) — both currently
// match the spec, but kept as an argument so a future
// partner-UI policy can diverge without touching every
// caller.
// ------------------------------------------------------

export function getDefaultVisibilityForMediaRole(
  role: LotMediaRole,
  _context?: { owner?: LotMediaOwner },
): LotMediaVisibility {
  return DEFAULT_LOT_MEDIA_VISIBILITY_BY_ROLE[role]
}

// ------------------------------------------------------
// ORDERING
//
// compareLotMediaItems implements:
//   1. role priority asc (FARM → … → EDITORIAL_FALLBACK)
//   2. position asc within the same role
//   3. owner rank asc: LOT (or undefined) before FARM —
//      so a lot-specific photo wins over an inherited
//      farm photo at the same role+position
//   4. id lexicographic asc (stable tiebreak)
//
// It does NOT consider isPrimary — primary selection is a
// separate concern handled by selectPrimaryLotMedia so the
// ordered display list and the "hero" choice can disagree
// safely (e.g. an explicit PRODUCT_DETAIL primary on a lot
// whose ordered list still starts with FARM).
// ------------------------------------------------------

function ownerRank(owner: LotMediaOwner | undefined): number {
  return owner === "FARM" ? 1 : 0
}

export function compareLotMediaItems(a: LotMediaItem, b: LotMediaItem): number {
  const pa = LOT_MEDIA_ROLE_PRIORITY[a.role]
  const pb = LOT_MEDIA_ROLE_PRIORITY[b.role]
  if (pa !== pb) return pa - pb

  const posA = Number.isFinite(a.position) ? a.position : Number.MAX_SAFE_INTEGER
  const posB = Number.isFinite(b.position) ? b.position : Number.MAX_SAFE_INTEGER
  if (posA !== posB) return posA - posB

  const oa = ownerRank(a.owner)
  const ob = ownerRank(b.owner)
  if (oa !== ob) return oa - ob

  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

export function orderLotMedia(
  items: ReadonlyArray<LotMediaItem>
): LotMediaItem[] {
  if (!items || items.length === 0) return []
  return items.slice().sort(compareLotMediaItems)
}

// ------------------------------------------------------
// PRIMARY SELECTION
//
// Rules (in order):
//   1. Explicit LOT-owned isPrimary=true items take
//      precedence over explicit FARM-owned primaries
//      (FARM-MEDIA-1 inheritance rule — a lot-specific
//      hero photo wins over an inherited farm photo).
//      Owner undefined is treated as LOT.
//   2. Otherwise explicit FARM-owned isPrimary items.
//   3. Otherwise the first item in the ordered list wins.
//   4. Within each tier we apply compareLotMediaItems
//      (role priority → position → owner rank → id) so
//      the choice is deterministic even with malformed
//      data (multiple primaries at different roles).
//   5. Empty input returns null.
// ------------------------------------------------------

function isLotOwned(item: LotMediaItem): boolean {
  return item.owner === undefined || item.owner === "LOT"
}

export function selectPrimaryLotMedia(
  items: ReadonlyArray<LotMediaItem>
): LotMediaItem | null {
  if (!items || items.length === 0) return null

  const explicitLot = items.filter((i) => i.isPrimary === true && isLotOwned(i))
  if (explicitLot.length > 0) {
    return explicitLot.slice().sort(compareLotMediaItems)[0] ?? null
  }

  const explicitFarm = items.filter(
    (i) => i.isPrimary === true && i.owner === "FARM",
  )
  if (explicitFarm.length > 0) {
    return explicitFarm.slice().sort(compareLotMediaItems)[0] ?? null
  }

  return orderLotMedia(items)[0] ?? null
}

// ------------------------------------------------------
// SUMMARY BUILDERS
// ------------------------------------------------------

function anyMatchingSource(
  items: ReadonlyArray<LotMediaItem>,
  predicate: (s: LotMediaSource) => boolean
): boolean {
  for (const it of items) {
    if (predicate(it.source)) return true
  }
  return false
}

function isOnlyFallback(items: ReadonlyArray<LotMediaItem>): boolean {
  if (items.length === 0) return false
  for (const it of items) {
    if (!isFallbackLotMediaSource(it.source)) return false
  }
  return true
}

//////////////////////////////////////////////////////
// missingRecommendedRoles
//
// Returns the recommended roles (FARM / PROCESS /
// TRACEABILITY_BAG) NOT covered by a *verified* media row.
// A FARM image whose source is GENERATED_EDITORIAL or
// TONAL_PLACEHOLDER does NOT satisfy the FARM requirement —
// that's the trust rule. The order of the returned list
// mirrors RECOMMENDED_LOT_MEDIA_ROLES so callers can render
// the gap list deterministically.
//////////////////////////////////////////////////////

function computeMissingRecommendedRoles(
  items: ReadonlyArray<LotMediaItem>
): LotMediaRole[] {
  const verifiedRoles = new Set<LotMediaRole>()
  for (const it of items) {
    if (isVerifiedLotMediaSource(it.source)) {
      verifiedRoles.add(it.role)
    }
  }
  const missing: LotMediaRole[] = []
  for (const role of RECOMMENDED_LOT_MEDIA_ROLES) {
    if (!verifiedRoles.has(role)) missing.push(role)
  }
  return missing
}

//////////////////////////////////////////////////////
// buildOrderedLotMedia
//
// Single-pass helper that produces the canonical view-model
// for downstream consumers: ordered items, the chosen
// primary, and the trust/coverage summary.
//
// Input may be empty; output is well-defined in every case.
//////////////////////////////////////////////////////

export function buildOrderedLotMedia(
  items: ReadonlyArray<LotMediaItem>
): OrderedLotMediaResult {
  const safe: ReadonlyArray<LotMediaItem> = items ?? []
  const ordered = orderLotMedia(safe)
  const primary = selectPrimaryLotMedia(safe)
  return {
    items: ordered,
    primary,
    hasVerifiedMedia: anyMatchingSource(safe, isVerifiedLotMediaSource),
    hasPartnerMedia: anyMatchingSource(safe, (s) => s === "PARTNER_UPLOAD"),
    hasOnlyFallbackMedia: isOnlyFallback(safe),
    missingRecommendedRoles: computeMissingRecommendedRoles(safe),
  }
}

// ------------------------------------------------------
// FARM-MEDIA-1 — INHERITED MEDIA SEQUENCE
//
// Builds a unified ordered sequence from the lot's own media
// rows and its farm's reusable media rows. Each input array
// is tagged with the appropriate owner before merging so
// downstream code (compareLotMediaItems, primary selection,
// UI) can disambiguate provenance.
//
// Behaviour:
//   - lot media outranks farm media at identical role+position
//     ties (owner rank in compareLotMediaItems)
//   - explicit LOT primary beats explicit FARM primary
//   - missing-recommended-roles still requires VERIFIED rows
//     from either layer; fallback rows never satisfy
// ------------------------------------------------------

export function withOwner(
  items: ReadonlyArray<LotMediaItem>,
  owner: LotMediaOwner,
  ownerId?: string | null,
): LotMediaItem[] {
  if (!items || items.length === 0) return []
  const out: LotMediaItem[] = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    out[i] = { ...items[i], owner, ownerId: ownerId ?? null }
  }
  return out
}

export type InheritedLotMediaInput = {
  lotMedia: ReadonlyArray<LotMediaItem>
  farmMedia: ReadonlyArray<LotMediaItem>
  lotId?: string | null
  farmId?: string | null
}

export function buildInheritedLotMediaSequence(
  input: InheritedLotMediaInput,
): OrderedLotMediaResult {
  const lot = withOwner(input.lotMedia ?? [], "LOT", input.lotId ?? null)
  const farm = withOwner(input.farmMedia ?? [], "FARM", input.farmId ?? null)
  const combined = lot.concat(farm)
  return buildOrderedLotMedia(combined)
}

// ------------------------------------------------------
// LOT-MEDIA-2 — AUDIENCE-SCOPED SEQUENCE BUILDERS
//
// `buildInheritedLotMediaSequence` returns the full
// merged sequence without considering visibility. The
// public market and buyer sequences are thin wrappers
// that filter first then re-use the same combine logic
// so ownership tagging + ordering + primary selection
// stay consistent.
//
//   PUBLIC      = PUBLIC_MARKET only
//   BUYER       = PUBLIC_MARKET + BUYER_PRIVATE
//
// INTERNAL_ONLY is intentionally only available via
// filterLotMediaForInternalOps — there is no helper to
// "expose" it on a customer-facing DTO.
// ------------------------------------------------------

export function buildPublicMarketLotMediaSequence(
  input: InheritedLotMediaInput,
): OrderedLotMediaResult {
  return buildInheritedLotMediaSequence({
    lotMedia: filterLotMediaForPublicMarket(input.lotMedia ?? []),
    farmMedia: filterLotMediaForPublicMarket(input.farmMedia ?? []),
    lotId: input.lotId ?? null,
    farmId: input.farmId ?? null,
  })
}

export function buildBuyerLotMediaSequence(
  input: InheritedLotMediaInput,
): OrderedLotMediaResult {
  return buildInheritedLotMediaSequence({
    lotMedia: filterLotMediaForBuyerPrivate(input.lotMedia ?? []),
    farmMedia: filterLotMediaForBuyerPrivate(input.farmMedia ?? []),
    lotId: input.lotId ?? null,
    farmId: input.farmId ?? null,
  })
}

// ------------------------------------------------------
// FARM-MEDIA-1 — READINESS EVALUATION
//
// Determines whether a lot can move forward in the producer
// lifecycle (DRAFT → SUBMIT → VERIFY → PUBLISH) given the
// media currently attached to it and to its farm.
//
// Rules:
//   - DRAFT mode: always ready. The producer must be able
//     to create + save a draft without any media.
//   - SUBMIT / VERIFY / PUBLISH:
//       * require at least one VERIFIED FARM-role row from
//         either layer (lot or farm). Editorial / tonal
//         placeholder sources never satisfy this.
//       * require at least one VERIFIED PROCESS-role row,
//         same rule.
//   - EXCLUSIVE / FEATURED lots additionally produce a
//     TRACEABILITY_MEDIA_RECOMMENDED warning when no
//     verified TRACEABILITY_BAG row exists from either
//     layer. Not blocking — Founder policy.
//   - PLATFORM_CURATED-only coverage produces an informational
//     MEDIA_PLATFORM_CURATED_ONLY warning so the producer
//     dashboard can encourage real partner photos.
// ------------------------------------------------------

function rolesWithVerifiedCoverage(
  items: ReadonlyArray<LotMediaItem>,
): Set<LotMediaRole> {
  const out = new Set<LotMediaRole>()
  for (const i of items) {
    if (isVerifiedLotMediaSource(i.source)) out.add(i.role)
  }
  return out
}

function buildCoverage(
  items: ReadonlyArray<LotMediaItem>,
): LotMediaReadinessCoverage {
  const verified = rolesWithVerifiedCoverage(items)
  return {
    hasVerifiedFarmMedia: verified.has("FARM"),
    hasVerifiedProcessMedia: verified.has("PROCESS"),
    hasVerifiedProducerMedia: verified.has("PRODUCER"),
    hasVerifiedTraceabilityMedia: verified.has("TRACEABILITY_BAG"),
    hasAnyVerifiedMedia: verified.size > 0,
  }
}

function isPlatformCuratedOnly(items: ReadonlyArray<LotMediaItem>): boolean {
  let sawAnyVerified = false
  for (const i of items) {
    if (isVerifiedLotMediaSource(i.source)) {
      sawAnyVerified = true
      if (i.source === "PARTNER_UPLOAD") return false
    }
  }
  return sawAnyVerified
}

export function evaluateLotMediaReadiness(
  context: LotMediaReadinessContext,
): LotMediaReadinessResult {

  // LOT-MEDIA-2 — SUBMIT/VERIFY/PUBLISH measure public-listing
  // coverage only. A BUYER_PRIVATE FARM photo cannot satisfy
  // marketplace readiness because it would never reach the
  // marketplace anyway. DRAFT mode still inspects the full
  // sequence so the wizard can warn before any visibility is
  // set.
  const allCombined = (context.lotMedia ?? []).concat(context.farmMedia ?? [])
  const publicCombined =
    context.mode === "DRAFT"
      ? allCombined
      : allCombined.filter(isPublicMarketMedia)

  const coverage = buildCoverage(publicCombined)
  const blockingReasons: LotMediaReadinessBlockingReason[] = []
  const warnings: LotMediaReadinessWarning[] = []
  const lotClass = context.lotClass ?? "NORMAL"

  // DRAFT mode is permissive: we still report coverage so the
  // producer dashboard can surface "needs media" hints, but no
  // hard blocks. The wizard relies on this to let the producer
  // save a draft and come back to add media later.
  if (context.mode === "DRAFT") {
    if (!coverage.hasVerifiedFarmMedia || !coverage.hasVerifiedProcessMedia) {
      // Same wording as the SUBMIT/VERIFY/PUBLISH blocks but
      // surfaced as a warning so the wizard can render the
      // notice without blocking.
      warnings.push({
        code: "FALLBACK_ONLY_MEDIA",
        message:
          "Add at least one farm/origin photo and one process photo before submitting this lot.",
      })
    }
    return {
      ready: true,
      blockingReasons,
      warnings,
      coverage,
    }
  }

  // SUBMIT / VERIFY / PUBLISH — public-listing readiness only.
  if (!coverage.hasVerifiedFarmMedia) {
    blockingReasons.push({
      code: "FARM_MEDIA_REQUIRED",
      message:
        "Add at least one public farm/origin photo before submitting this lot. Editorial, placeholder or buyer-private images don't count.",
    })
  }
  if (!coverage.hasVerifiedProcessMedia) {
    blockingReasons.push({
      code: "PROCESS_MEDIA_REQUIRED",
      message:
        "Add at least one public processing photo (drying beds, washing station, fermentation) before submitting this lot.",
    })
  }

  // EXCLUSIVE / FEATURED / PREMIUM: traceability is strongly
  // recommended (label / sack photo) — warn but do not block.
  // LOT-MEDIA-2 split: traceability proof lives in the
  // BUYER_PRIVATE lane, so we inspect the *full* combined
  // sequence here, not the public-only subset.
  const fullCoverage = buildCoverage(allCombined)
  if (
    (lotClass === "EXCLUSIVE" ||
      lotClass === "FEATURED" ||
      lotClass === "PREMIUM") &&
    !fullCoverage.hasVerifiedTraceabilityMedia
  ) {
    warnings.push({
      code: "TRACEABILITY_MEDIA_RECOMMENDED",
      message:
        "Premium and exclusive lots should include a traceability bag / lot label photo before shipment.",
    })
  }

  // PLATFORM_CURATED is verified but not partner-supplied —
  // surface a soft signal so the producer dashboard can
  // encourage real partner photos when the producer is the
  // only source of those.
  if (isPlatformCuratedOnly(publicCombined)) {
    warnings.push({
      code: "MEDIA_PLATFORM_CURATED_ONLY",
      message:
        "Current public media is platform-curated. Adding partner-uploaded photos strengthens lot traceability.",
    })
  }

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    coverage,
  }
}

// ------------------------------------------------------
// LOT-MEDIA-2 — BUYER PROOF READINESS
//
// Pure helper for the buyer-only side of the lifecycle.
// Not wired to any route in this sprint — PARTNER-MEDIA-2
// will plug it into the contract/shipment flow.
//
//   CONTRACTED     — warn when no verified buyer-private
//                    proof is attached yet. Non-blocking.
//   SHIPMENT_READY — block when no verified BUYER_PRIVATE
//                    TRACEABILITY_BAG row exists. This is
//                    where the "final export bag photo"
//                    requirement lands in a future sprint.
// ------------------------------------------------------

function buildBuyerCoverage(
  items: ReadonlyArray<LotMediaItem>,
): BuyerProofReadinessCoverage {
  let hasTrace = false
  let hasCert = false
  let hasAny = false
  for (const i of items) {
    if (!isBuyerPrivateMedia(i)) continue
    if (!isVerifiedLotMediaSource(i.source)) continue
    hasAny = true
    if (i.role === "TRACEABILITY_BAG") hasTrace = true
    if (i.role === "CERTIFICATE") hasCert = true
  }
  return {
    hasBuyerPrivateTraceabilityProof: hasTrace,
    hasBuyerPrivateCertificate: hasCert,
    hasAnyBuyerPrivateProof: hasAny,
  }
}

export function evaluateBuyerProofMediaReadiness(
  context: BuyerProofReadinessContext,
): BuyerProofReadinessResult {
  const combined = (context.lotMedia ?? []).concat(context.farmMedia ?? [])
  const coverage = buildBuyerCoverage(combined)
  const blockingReasons: BuyerProofReadinessBlockingReason[] = []
  const warnings: BuyerProofReadinessWarning[] = []

  if (context.mode === "CONTRACTED") {
    if (!coverage.hasBuyerPrivateTraceabilityProof) {
      warnings.push({
        code: "BUYER_TRACEABILITY_PROOF_RECOMMENDED",
        message:
          "Upload a buyer-private traceability proof (sample label / parchment tag) before this lot ships.",
      })
    }
    if (!coverage.hasBuyerPrivateCertificate) {
      warnings.push({
        code: "BUYER_CERTIFICATE_RECOMMENDED",
        message:
          "A cupping sheet or quality certificate strengthens the buyer-side proof for this contract.",
      })
    }
    return { ready: true, blockingReasons, warnings, coverage }
  }

  // SHIPMENT_READY: hard block on missing traceability proof.
  if (!coverage.hasBuyerPrivateTraceabilityProof) {
    blockingReasons.push({
      code: "BUYER_TRACEABILITY_PROOF_REQUIRED",
      message:
        "A buyer-private traceability proof (final export bag / shipment label) is required before this lot can ship.",
    })
  }
  if (!coverage.hasBuyerPrivateCertificate) {
    warnings.push({
      code: "BUYER_CERTIFICATE_RECOMMENDED",
      message:
        "Attach a cupping sheet or certificate for the buyer's records.",
    })
  }
  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    coverage,
  }
}

// ------------------------------------------------------
// ALT TEXT
//
// Defensive: helpers receive partial inputs (real DB rows
// often have null region/country). The output is always a
// non-empty string so the consumer can drop it straight into
// <img alt=…>.
//
// Trust note: for GENERATED_EDITORIAL / TONAL_PLACEHOLDER
// sources, the caller should set role=EDITORIAL_FALLBACK so
// this helper produces an illustrative description. The
// helper itself doesn't take a source argument because alt
// text describes the content; the trust label belongs in the
// UI surrounding the image.
// ------------------------------------------------------

export type DefaultLotMediaAltTextInput = {
  lotName?: string | null
  variety?: string | null
  process?: string | null
  region?: string | null
  country?: string | null
  role: LotMediaRole
}

export function buildDefaultLotMediaAltText(
  input: DefaultLotMediaAltTextInput
): string {
  const lotName = clean(input.lotName) || "Coffee lot"
  const process = clean(input.process)
  const region = clean(input.region)
  const country = clean(input.country)
  const origin = joinOrigin(region, country)

  switch (input.role) {
    case "FARM":
      return origin
        ? `${lotName} farm landscape in ${origin}`
        : `${lotName} farm landscape`
    case "PROCESS":
      return process
        ? `${process} processing for ${lotName}`
        : `Processing detail for ${lotName}`
    case "PRODUCER":
      return origin
        ? `Producer of ${lotName} in ${origin}`
        : `Producer of ${lotName}`
    case "TRACEABILITY_BAG":
      return `Traceability label or bag for ${lotName}`
    case "PRODUCT_DETAIL":
      return `Coffee bean detail for ${lotName}`
    case "CERTIFICATE":
      return `Certificate or cupping sheet for ${lotName}`
    case "EDITORIAL_FALLBACK":
      return `Illustrative image for ${lotName}`
  }
}

// ------------------------------------------------------
// SMALL HELPERS (local)
// ------------------------------------------------------

function clean(value: string | null | undefined): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return trimmed
}

function joinOrigin(region: string, country: string): string {
  if (region && country) return `${region}, ${country}`
  if (region) return region
  if (country) return country
  return ""
}

// ------------------------------------------------------
// PARTNER-MEDIA-2A — URL VALIDATION + INPUT NORMALISATION
//
// URL policy for this sprint:
//   - https:// is accepted (real partner-uploaded images)
//   - local /images/* or /uploads/* paths are accepted as
//     a dev/ops bridge until storage integration ships
//   - javascript:, data:, file:, vbscript: are rejected
//   - everything else (including http://) is rejected for
//     safety
//
// Length caps are enforced for altText, caption, credit
// so the database/UI can't be jammed with multi-megabyte
// strings. We DO NOT enforce a server-side URL length
// limit beyond 2048 chars — that's the safe browser cap
// for a one-off display URL.
// ------------------------------------------------------

export const LOT_MEDIA_URL_MAX_LENGTH = 2048
export const LOT_MEDIA_ALT_TEXT_MAX_LENGTH = 240
export const LOT_MEDIA_CAPTION_MAX_LENGTH = 600
export const LOT_MEDIA_CREDIT_MAX_LENGTH = 240

const DISALLOWED_URL_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "blob:",
])

export type LotMediaUrlValidationResult =
  | { ok: true; url: string }
  | {
      ok: false
      code:
        | "URL_REQUIRED"
        | "URL_TOO_LONG"
        | "URL_SCHEME_NOT_ALLOWED"
        | "URL_MALFORMED"
      message: string
    }

export function validateLotMediaUrl(input: unknown): LotMediaUrlValidationResult {
  if (typeof input !== "string") {
    return {
      ok: false,
      code: "URL_REQUIRED",
      message: "Media URL is required.",
    }
  }
  const trimmed = input.trim()
  if (trimmed === "") {
    return {
      ok: false,
      code: "URL_REQUIRED",
      message: "Media URL is required.",
    }
  }
  if (trimmed.length > LOT_MEDIA_URL_MAX_LENGTH) {
    return {
      ok: false,
      code: "URL_TOO_LONG",
      message: `Media URL must be ${LOT_MEDIA_URL_MAX_LENGTH} characters or fewer.`,
    }
  }
  const lower = trimmed.toLowerCase()
  // Block dangerous schemes before any URL parsing — `data:`
  // and `javascript:` URLs would bypass URL() in some
  // environments and we want a hard deny-list anyway.
  for (const scheme of DISALLOWED_URL_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return {
        ok: false,
        code: "URL_SCHEME_NOT_ALLOWED",
        message: `URL scheme not allowed: ${scheme}`,
      }
    }
  }
  // BUYER-PROOF-1 — supabase://<bucket>/<path> references for
  // private storage. The parser enforces a safe bucket /
  // storage-path character set + a max length, so a producer
  // pasting one cannot smuggle traversal sequences. We DO
  // accept any well-formed reference here (regardless of
  // whether the bucket matches the current env) because:
  //   - the value still has to pass the route layer's
  //     create-media auth + ownership checks;
  //   - the proof endpoint that resolves it later refuses to
  //     sign reads against buckets not in the current env.
  if (lower.startsWith("supabase://")) {
    // Cheap parse — same safety rules as the storage-reference
    // helpers in lotMediaStorage.pure.ts. Inlined to avoid a
    // circular import path through the storage module.
    const remainder = trimmed.slice("supabase://".length)
    const slashIdx = remainder.indexOf("/")
    if (slashIdx <= 0 || slashIdx === remainder.length - 1) {
      return {
        ok: false,
        code: "URL_MALFORMED",
        message: "Storage reference is malformed.",
      }
    }
    const bucket = remainder.slice(0, slashIdx)
    const storagePath = remainder.slice(slashIdx + 1)
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,62}$/.test(bucket)) {
      return {
        ok: false,
        code: "URL_MALFORMED",
        message: "Storage reference bucket is malformed.",
      }
    }
    if (
      storagePath.includes("..") ||
      storagePath.includes("//") ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{1,240}[A-Za-z0-9]$/.test(storagePath)
    ) {
      return {
        ok: false,
        code: "URL_MALFORMED",
        message: "Storage reference path is malformed.",
      }
    }
    return { ok: true, url: trimmed }
  }
  // Local public/dev paths: must start with /images/ or
  // /uploads/. Anything else under /-rooted is rejected.
  if (trimmed.startsWith("/")) {
    if (
      trimmed.startsWith("/images/") ||
      trimmed.startsWith("/uploads/")
    ) {
      return { ok: true, url: trimmed }
    }
    return {
      ok: false,
      code: "URL_MALFORMED",
      message:
        "Local URLs must start with /images/ or /uploads/ for safety.",
    }
  }
  // HTTPS only — http:// is rejected because anything mixed
  // content would be blocked by browsers anyway and we don't
  // want to advertise insecure URLs as valid.
  if (!lower.startsWith("https://")) {
    return {
      ok: false,
      code: "URL_SCHEME_NOT_ALLOWED",
      message: "Media URL must be https:// or a local /images/ /uploads/ path.",
    }
  }
  // Best-effort parse — URL is available in Node 18+ globally.
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed)
  } catch {
    return {
      ok: false,
      code: "URL_MALFORMED",
      message: "Media URL is not a valid URL.",
    }
  }
  return { ok: true, url: trimmed }
}

function clampString(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed === "") return null
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength)
}

//////////////////////////////////////////////////////
// CREATE-INPUT NORMALISATION
//
// Used by the service before INSERT. Pure — no DB. Rules:
//   - role must be a known value
//   - source defaults to PARTNER_UPLOAD when the caller is
//     an authenticated producer/partner (matches the route
//     contract; tests can override).
//   - visibility falls through getDefaultVisibilityForMediaRole(role)
//     when not supplied.
//   - URL must pass validateLotMediaUrl.
//   - altText/caption/credit are clamped + trimmed.
//   - position is normalised to a non-negative integer (the
//     service may overwrite with "next slot" if omitted).
//////////////////////////////////////////////////////

export type NormalizedLotMediaCreateInput = {
  url: string
  role: LotMediaRole
  source: LotMediaSource
  visibility: LotMediaVisibility
  position: number | null
  isPrimary: boolean
  altText: string | null
  caption: string | null
  credit: string | null
}

export type LotMediaInputValidationError = {
  code:
    | "ROLE_REQUIRED"
    | "ROLE_INVALID"
    | "SOURCE_INVALID"
    | "VISIBILITY_INVALID"
    | "POSITION_INVALID"
    | "URL_REQUIRED"
    | "URL_TOO_LONG"
    | "URL_SCHEME_NOT_ALLOWED"
    | "URL_MALFORMED"
  message: string
}

export type LotMediaCreateInputResult =
  | { ok: true; input: NormalizedLotMediaCreateInput }
  | { ok: false; error: LotMediaInputValidationError }

export function normalizeLotMediaCreateInput(
  raw: Partial<LotMediaCreateInput>,
  opts?: { defaultSource?: LotMediaSource },
): LotMediaCreateInputResult {

  // URL
  const url = validateLotMediaUrl(raw?.url)
  if (!url.ok) {
    return { ok: false, error: { code: url.code, message: url.message } }
  }

  // Role — required
  if (raw?.role == null) {
    return {
      ok: false,
      error: { code: "ROLE_REQUIRED", message: "Media role is required." },
    }
  }
  const role = normalizeLotMediaRole(raw.role)
  if (!role) {
    return {
      ok: false,
      error: { code: "ROLE_INVALID", message: `Unknown media role: ${String(raw.role)}` },
    }
  }

  // Source — defaults to opts.defaultSource (route default
  // PARTNER_UPLOAD), then PARTNER_UPLOAD as a final fallback.
  const sourceCandidate = raw.source ?? opts?.defaultSource ?? "PARTNER_UPLOAD"
  const source = normalizeLotMediaSource(sourceCandidate)
  if (!source) {
    return {
      ok: false,
      error: { code: "SOURCE_INVALID", message: `Unknown media source: ${String(sourceCandidate)}` },
    }
  }

  // Visibility — explicit value wins, else role default.
  let visibility: LotMediaVisibility
  if (raw.visibility != null) {
    const v = normalizeLotMediaVisibility(raw.visibility)
    if (!v) {
      return {
        ok: false,
        error: {
          code: "VISIBILITY_INVALID",
          message: `Unknown visibility: ${String(raw.visibility)}`,
        },
      }
    }
    visibility = v
  } else {
    visibility = getDefaultVisibilityForMediaRole(role)
  }

  // Position — null means "service decides next slot".
  let position: number | null = null
  if (raw.position != null) {
    if (
      typeof raw.position !== "number" ||
      !Number.isFinite(raw.position) ||
      raw.position < 0
    ) {
      return {
        ok: false,
        error: {
          code: "POSITION_INVALID",
          message: "Position must be a non-negative number.",
        },
      }
    }
    position = Math.floor(raw.position)
  }

  return {
    ok: true,
    input: {
      url: url.url,
      role,
      source,
      visibility,
      position,
      isPrimary: raw.isPrimary === true,
      altText: clampString(raw.altText, LOT_MEDIA_ALT_TEXT_MAX_LENGTH),
      caption: clampString(raw.caption, LOT_MEDIA_CAPTION_MAX_LENGTH),
      credit: clampString(raw.credit, LOT_MEDIA_CREDIT_MAX_LENGTH),
    },
  }
}

//////////////////////////////////////////////////////
// UPDATE-INPUT NORMALISATION
//
// PATCH-shaped: every field is optional. We return only
// the fields the caller actually supplied so the service
// can build a partial Prisma update without touching
// untouched columns.
//////////////////////////////////////////////////////

export type NormalizedLotMediaUpdateInput = Partial<NormalizedLotMediaCreateInput>

export type LotMediaUpdateInputResult =
  | { ok: true; input: NormalizedLotMediaUpdateInput }
  | { ok: false; error: LotMediaInputValidationError }

export function normalizeLotMediaUpdateInput(
  raw: Partial<LotMediaUpdateInput>,
): LotMediaUpdateInputResult {

  const out: NormalizedLotMediaUpdateInput = {}

  if (raw.url !== undefined) {
    const v = validateLotMediaUrl(raw.url)
    if (!v.ok) {
      return { ok: false, error: { code: v.code, message: v.message } }
    }
    out.url = v.url
  }

  if (raw.role !== undefined) {
    const role = normalizeLotMediaRole(raw.role)
    if (!role) {
      return {
        ok: false,
        error: { code: "ROLE_INVALID", message: `Unknown media role: ${String(raw.role)}` },
      }
    }
    out.role = role
  }

  if (raw.source !== undefined) {
    const source = normalizeLotMediaSource(raw.source)
    if (!source) {
      return {
        ok: false,
        error: { code: "SOURCE_INVALID", message: `Unknown media source: ${String(raw.source)}` },
      }
    }
    out.source = source
  }

  if (raw.visibility !== undefined) {
    const visibility = normalizeLotMediaVisibility(raw.visibility)
    if (!visibility) {
      return {
        ok: false,
        error: {
          code: "VISIBILITY_INVALID",
          message: `Unknown visibility: ${String(raw.visibility)}`,
        },
      }
    }
    out.visibility = visibility
  }

  if (raw.position !== undefined) {
    if (
      typeof raw.position !== "number" ||
      !Number.isFinite(raw.position) ||
      raw.position < 0
    ) {
      return {
        ok: false,
        error: {
          code: "POSITION_INVALID",
          message: "Position must be a non-negative number.",
        },
      }
    }
    out.position = Math.floor(raw.position)
  }

  if (raw.isPrimary !== undefined) out.isPrimary = raw.isPrimary === true
  if (raw.altText !== undefined) out.altText = clampString(raw.altText, LOT_MEDIA_ALT_TEXT_MAX_LENGTH)
  if (raw.caption !== undefined) out.caption = clampString(raw.caption, LOT_MEDIA_CAPTION_MAX_LENGTH)
  if (raw.credit !== undefined) out.credit = clampString(raw.credit, LOT_MEDIA_CREDIT_MAX_LENGTH)

  return { ok: true, input: out }
}

//////////////////////////////////////////////////////
// SINGLE-PRIMARY HELPER
//
// Pure transformation used by the service inside the
// setPrimary transaction. Given a list of media rows that
// belong to the same owner (FarmMedia for a farm OR
// GreenLotMedia for a lot), returns the row ids that must
// be flipped to false to ensure only `nextPrimaryId` is
// primary. We do NOT mutate input; we just return ids.
//
// If `nextPrimaryId` is not in the list (caller passed an
// id that doesn't belong), we return every currently-primary
// id so the caller can clear the slate and the service
// will reject the new-primary update.
//////////////////////////////////////////////////////

export function pickSiblingPrimariesToUnset(
  rows: ReadonlyArray<{ id: string; isPrimary: boolean }>,
  nextPrimaryId: string,
): string[] {
  if (!rows || rows.length === 0) return []
  const out: string[] = []
  for (const r of rows) {
    if (r.id === nextPrimaryId) continue
    if (r.isPrimary === true) out.push(r.id)
  }
  return out
}

//////////////////////////////////////////////////////
// READINESS PANEL — UI PROJECTION
//
// Turns a (lotMedia, farmMedia, lotClass) tuple into the
// two-column checklist the producer wizard renders. The
// blocking publicListing.ready flag mirrors what the
// backend guard will say at verify/publish time.
//
// Slot codes are stable so the UI can attach copy without
// pattern-matching strings.
//////////////////////////////////////////////////////

export function buildLotMediaReadinessPanel(input: {
  lotMedia: ReadonlyArray<LotMediaItem>
  farmMedia: ReadonlyArray<LotMediaItem>
  lotClass?: "NORMAL" | "PREMIUM" | "EXCLUSIVE" | "FEATURED"
}): LotMediaReadinessPanel {

  const all = (input.lotMedia ?? []).concat(input.farmMedia ?? [])
  const publicItems = all.filter(isPublicMarketMedia)
  const buyerItems = all.filter(isBuyerPrivateMedia)

  const verifiedRolesInPublic = new Set<LotMediaRole>()
  for (const i of publicItems) {
    if (isVerifiedLotMediaSource(i.source)) verifiedRolesInPublic.add(i.role)
  }

  const hasFarm = verifiedRolesInPublic.has("FARM")
  const hasProcessOrProduct =
    verifiedRolesInPublic.has("PROCESS") ||
    verifiedRolesInPublic.has("PRODUCT_DETAIL")
  const hasProducer = verifiedRolesInPublic.has("PRODUCER")

  const verifiedRolesInBuyer = new Set<LotMediaRole>()
  for (const i of buyerItems) {
    if (isVerifiedLotMediaSource(i.source)) verifiedRolesInBuyer.add(i.role)
  }

  const hasTraceability = verifiedRolesInBuyer.has("TRACEABILITY_BAG")
  const hasCertificate = verifiedRolesInBuyer.has("CERTIFICATE")

  const publicSlots: LotMediaReadinessPanelSlot[] = [
    {
      code: "PUBLIC_FARM_PHOTO",
      label: "Farm / origin photo",
      description:
        "Visible to buyers browsing the marketplace. Required before publish.",
      state: hasFarm ? "SATISFIED" : "MISSING",
      required: true,
    },
    {
      code: "PUBLIC_PROCESS_OR_PRODUCT_PHOTO",
      label: "Process or product photo",
      description:
        "Drying beds, washing station, cherry / green / roasted detail. Required before publish.",
      state: hasProcessOrProduct ? "SATISFIED" : "MISSING",
      required: true,
    },
    {
      code: "PUBLIC_PRODUCER_PHOTO",
      label: "Producer / team photo (optional)",
      description:
        "Strengthens the public story but isn't required for publish.",
      state: hasProducer ? "SATISFIED" : "MISSING",
      required: false,
    },
  ]

  const buyerSlots: LotMediaReadinessPanelSlot[] = [
    {
      code: "BUYER_TRACEABILITY_PROOF",
      label: "Lot label / traceability proof",
      description:
        "Sample tag, parchment label or lot code. Required later before shipment, not before publish.",
      state: hasTraceability ? "SATISFIED" : "MISSING",
      required: false,
    },
    {
      code: "BUYER_CERTIFICATE",
      label: "Cupping sheet / certificate",
      description:
        "Cupping sheet or quality certificate for the buyer's records.",
      state: hasCertificate ? "SATISFIED" : "MISSING",
      required: false,
    },
    {
      code: "BUYER_FINAL_EXPORT_BAG",
      label: "Final export bag / shipment prep",
      description:
        "Export-bag photo and shipment label. Required later before shipment, not before publish.",
      // We can't distinguish a "final export bag" from a
      // generic traceability proof today, so we tie it to
      // the same coverage signal for now.
      state: hasTraceability ? "SATISFIED" : "MISSING",
      required: false,
    },
  ]

  const ready = publicSlots
    .filter((s) => s.required)
    .every((s) => s.state === "SATISFIED")

  return {
    publicListing: { ready, slots: publicSlots },
    // PARTNER-MEDIA-2A: buyer-proof never blocks publish in
    // this sprint. Future PARTNER-MEDIA-2B wires SHIPMENT_READY
    // to fulfilment and flips this to true.
    buyerProof: {
      blocking: false,
      slots: buyerSlots,
    },
  }
}
