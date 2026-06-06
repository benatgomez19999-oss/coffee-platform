//////////////////////////////////////////////////////
// 🛍️ MARKETPLACE LOT MAPPER
//
// Pure functions that turn (snapshot + allocation decision)
// pairs into MarketplaceLotDto rows + aggregate
// metrics + insights.
//
// No Prisma. No fetch. The marketplaceView service is
// responsible for orchestrating the snapshot/decision
// pipeline; this file is the boundary that strips the
// engine internals down to a customer-facing shape.
//////////////////////////////////////////////////////

import type {
  AllocationReason,
  AllocationReasonCode,
  AllocationReasonSeverity,
  AllocationSurface,
  LotAllocationDecision,
  LotAllocationSnapshot,
} from "../domain/types.ts"
import {
  buildOrderedLotMedia,
  filterLotMediaForPublicMarket,
} from "../../lot-media/lotMedia.pure.ts"
import type {
  LotMediaItem,
  LotMediaSummary,
} from "../../lot-media/lotMedia.types.ts"
import {
  calculateB2BRoastedPricing,
  type B2BRoastedFallbackReason,
  type B2BRoastedScaBucket,
} from "../../../engine/pricing/client/b2bRoastedPricing.ts"
import {
  calculateMarketplaceB2BPricing,
  type ProducerPricingFn,
  type MarketplacePricingMode,
  type CommercialPricingModel,
  type MarketTargetSummary,
} from "../../../engine/pricing/client/calculateMarketplaceB2BPricing.ts"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type MarketplacePricingSource =
  | "PERSISTED_CLIENT_B2B"
  | "ADAPTIVE_RECOMPUTE_FALLBACK"
  | "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"

export type MarketplaceVisualTone =
  | "misty-green"
  | "golden-hills"
  | "volcanic"
  | "forest"
  | "sunrise"
  | "terracotta"

export type MarketplaceBadgeKey =
  | "exclusive-microlot"
  | "high-sca"
  | "fresh-arrival"
  | "high-traceability"
  | "marketplace-lot"

export type MarketplaceBadgeTone =
  | "amber"
  | "olive"
  | "bronze"
  | "emerald"
  | "gold"

export type MarketplaceLotDto = {
  id: string
  greenLotId: string
  lotNumber: string

  name: string
  producerName: string
  farmName: string
  originLabel: string
  country: string
  region: string | null

  process: string
  variety: string
  harvestYear: number | null
  scaScore: number | null
  // Sourced from snapshot.farmAltitude (metres). Null when the farm
  // row has no recorded altitude. Surfaced on cards because altitude
  // is one of the strongest pricing inputs for premium lots.
  altitude: number | null

  // ─── VOLUME (green vs roasted, full lot vs marketplace portion) ───
  // availableGreenKg     = the lot's full available green kg.
  // availableRoastedKg   = full available, converted via roastYield.
  // marketplaceGreenKg   = portion the engine cleared for marketplace
  //                        (residual after contract reserve, OR the
  //                        exclusive microlot pool — whichever applies).
  // marketplaceRoastedKg = marketplaceGreenKg × roastYield (display value).
  availableGreenKg: number
  availableRoastedKg: number
  marketplaceGreenKg: number
  marketplaceRoastedKg: number

  // ─── PRICING (PRICING-B2B-2 adaptive pipeline) ───
  // greenPricePerKg                   = raw green from PricingSnapshot.clientPricePerKg
  //                                     (fallback GreenLot.pricePerKg).
  //                                     Persisted, NOT recomputed here.
  // producerGreenPricePerKg           = producer engine result computed at
  //                                     read time (adaptive — uses fresh
  //                                     altitude/SCA/variety/marketData).
  // originEquivalentRoastedPricePerKg = producerGreenPricePerKg / max(0.5, roastYield).
  //                                     Wholesale-equivalent of green; audit only.
  // b2bReferencePricePerKg            = founder reference table lookup —
  //                                     used as a sanity band, not the primary
  //                                     price.
  // adaptiveB2BPricePerKg             = origin-equivalent + roasting + packaging +
  //                                     logistics + margin × quality multiplier,
  //                                     clamped to [0.7×, 1.3×] of the reference.
  // roastedPricePerKg                 = the value the card actually shows:
  //                                     adaptive ?? reference ?? origin-equivalent.
  // pricingMode                       = which path produced the displayed price.
  // pricingBreakdown                  = full audit trail of every step.
  // pricingReference                  = legacy summary kept for API consumers
  //                                     (altitude bucket, SCA bucket, etc).
  greenPricePerKg: number | null
  producerGreenPricePerKg: number | null
  originEquivalentRoastedPricePerKg: number | null
  b2bReferencePricePerKg: number | null
  adaptiveB2BPricePerKg: number | null
  // PRICING-B2B-3 — persisted client B2B roasted price (null when
  // the lot pre-dates persistence). When present, this is the value
  // contracts.service will lock at; the displayed roastedPricePerKg
  // is sourced from here on the persisted path.
  clientB2BPricePerKg: number | null
  roastedPricePerKg: number | null
  pricingMode: MarketplacePricingMode
  // PRICING-B2B-3 — auditable price provenance:
  //   PERSISTED_CLIENT_B2B           — read from PricingSnapshot.clientB2BPricePerKg
  //   ADAPTIVE_RECOMPUTE_FALLBACK    — recomputed at request time
  //   LEGACY_ORIGIN_EQUIVALENT_FALLBACK — last-resort wholesale-equivalent of green
  pricingSource: MarketplacePricingSource
  // PRICING-ARCH-1: which commercial model produced the price.
  // Optional because the no-producer-engine fallback path doesn't
  // run model selection.
  commercialModel?: CommercialPricingModel
  // PRICING-ARCH-2B: only set on the MARKET_ANCHORED path when the
  // research target lookup succeeded. Carries the bucket info so
  // downstream UI / API consumers can show the target band.
  marketTarget?: MarketTargetSummary
  pricingBreakdown: Array<{
    label: string
    value: string | number | boolean | null
  }>
  pricingReference: {
    altitudeBucket: number | null
    scaBucket: B2BRoastedScaBucket | null
    pricingVersion: string
    source: string
    fallbackReason?: B2BRoastedFallbackReason | string
  }
  currency: string
  roastYield: number

  recommendedSurface: "OPEN_MARKETPLACE" | "EXCLUSIVE_MICROLOT" | "SPLIT"
  badges: MarketplaceBadgeKey[]
  badgeLabel: string
  badgeTone: MarketplaceBadgeTone

  traceabilityLabel: string
  isExclusive: boolean
  isFreshArrival: boolean

  allocation: {
    marketplaceEligibleGreenKg: number
    exclusiveMicrolotGreenKg: number
    confidence: number
    reasons: Array<{
      code: AllocationReasonCode
      severity: AllocationReasonSeverity
    }>
  }

  visual: {
    visualTone: MarketplaceVisualTone
    gradientKey: string
    imageUrl: string | null
  }

  // LOT-MEDIA-1 — semantic ordered media + summary.
  // Empty (not undefined) when the mapper has produced the row; the
  // UI continues to use the tonal placeholder in that case.
  //
  // Optional in the type so pre-LOT-MEDIA-1 fixtures + API clients
  // still satisfy the contract. Real mapper output always sets all
  // three fields. `primaryMedia.url` is also mirrored into
  // visual.imageUrl so single-image consumers (LotImageWell) don't
  // need to know about the new field.
  media?: LotMediaItem[]
  primaryMedia?: LotMediaItem | null
  mediaSummary?: LotMediaSummary
}

export type MarketplaceMetricsDto = {
  availableLots: number
  avgScaScore: number | null
  origins: number
  freshArrivals: number
}

export type OriginVolumeRow = {
  label: string
  volumeKg: number
  percentage: number
}

export type OriginCountRow = {
  label: string
  count: number
}

export type MarketplaceInsightsDto = {
  topOriginsByVolume: OriginVolumeRow[]
  freshArrivalsByOrigin: OriginCountRow[]
}

export type MarketplaceLotsResponse = {
  lots: MarketplaceLotDto[]
  metrics: MarketplaceMetricsDto
  insights: MarketplaceInsightsDto
  generatedAt: string
  policyVersion: string
}

// ------------------------------------------------------
// ROAST-YIELD MATH (mirrored from src/lib/roastYield.ts)
//
// We re-implement the two pure number functions here so this
// mapper stays free of @prisma/client transitive imports
// (the canonical helpers carry a Prisma ProcessType type-only
// dependency that breaks node --test resolution).
//
// ⚠️ KEEP IN SYNC with src/lib/roastYield.ts. If the floor or
// formula changes there, update here too.
// ------------------------------------------------------

const ROAST_YIELD_FLOOR = 0.5

function computeRoastedPriceFromGreen(
  greenPricePerKg: number,
  roastYield: number
): number {
  const safeYield = Math.max(ROAST_YIELD_FLOOR, roastYield)
  return greenPricePerKg / safeYield
}

function greenKgToRoastedKg(greenKg: number, roastYield: number): number {
  return greenKg * roastYield
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

const FRESH_ARRIVAL_DAYS = 14

const BADGE_LABELS: Record<MarketplaceBadgeKey, string> = {
  "exclusive-microlot": "Exclusive microlot",
  "high-sca": "High SCA",
  "fresh-arrival": "Fresh arrival",
  "high-traceability": "High traceability",
  "marketplace-lot": "Marketplace lot",
}

const BADGE_TONES: Record<MarketplaceBadgeKey, MarketplaceBadgeTone> = {
  "exclusive-microlot": "gold",
  "high-sca": "bronze",
  "fresh-arrival": "amber",
  "high-traceability": "olive",
  "marketplace-lot": "olive",
}

// Country → tone palette. Falls back to a deterministic
// hash on lotNumber when the country isn't in the table —
// stable per lot, good enough for v0.
const TONE_BY_COUNTRY: Record<string, MarketplaceVisualTone> = {
  Colombia: "sunrise",
  Ethiopia: "forest",
  Kenya: "misty-green",
  Guatemala: "volcanic",
  Rwanda: "terracotta",
  Brazil: "golden-hills",
  Peru: "forest",
  "Costa Rica": "golden-hills",
  Honduras: "terracotta",
  Panama: "misty-green",
  Mexico: "volcanic",
  Indonesia: "forest",
}

const TONE_FALLBACK_ORDER: MarketplaceVisualTone[] = [
  "misty-green",
  "golden-hills",
  "volcanic",
  "forest",
  "sunrise",
  "terracotta",
]

// ------------------------------------------------------
// SMALL HELPERS
// ------------------------------------------------------

function titleCase(value: string): string {
  if (!value) return ""
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function safeNonNegative(value: number | null | undefined): number {
  if (value == null) return 0
  if (typeof value !== "number") return 0
  if (!Number.isFinite(value)) return 0
  return value > 0 ? value : 0
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function pickVisualTone(country: string, lotNumber: string): MarketplaceVisualTone {
  const direct = TONE_BY_COUNTRY[country]
  if (direct) return direct
  // Stable hash so the same lot always shows the same tone.
  let h = 0
  for (let i = 0; i < lotNumber.length; i++) {
    h = (h * 31 + lotNumber.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % TONE_FALLBACK_ORDER.length
  return TONE_FALLBACK_ORDER[idx] ?? "misty-green"
}

function isWithinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  const now = Date.now()
  return now - t <= days * 24 * 60 * 60 * 1000
}

// Strips a single leading bracketed token (e.g. "[DEV] " or
// "[allocation_engine_decides] ") from the start of a string.
// Defensive — protects against pre-DEV-LOTS-3 rows that still
// carry the old scenario-prefixed name. New seeds never produce
// these prefixes.
export function stripBracketedPrefix(value: string): string {
  if (typeof value !== "string") return ""
  return value.replace(/^\[[^\]]+\]\s+/, "")
}

function buildName(snap: LotAllocationSnapshot): string {
  const fromLot = stripBracketedPrefix(snap.name?.trim() ?? "")
  if (fromLot) return fromLot

  const farm = stripBracketedPrefix(snap.farmName?.trim() ?? "")
  const variety = snap.variety?.trim()
  const process = snap.process ? titleCase(snap.process) : ""

  if (farm && variety && process) return `${farm} ${variety} ${process}`
  if (farm && variety) return `${farm} ${variety}`
  if (farm) return `${farm} Lot`
  return snap.lotNumber
}

function buildOriginLabel(country: string, region: string | null): string {
  if (region && country) return `${region}, ${country}`
  if (country) return country
  if (region) return region
  return "Origin pending"
}

// Allocation surface narrowing — the engine emits five
// surfaces; only three reach marketplace.
function isMarketplaceSurface(
  s: AllocationSurface
): s is "OPEN_MARKETPLACE" | "EXCLUSIVE_MICROLOT" | "SPLIT" {
  return (
    s === "OPEN_MARKETPLACE" ||
    s === "EXCLUSIVE_MICROLOT" ||
    s === "SPLIT"
  )
}

// ------------------------------------------------------
// MAIN MAPPER
// ------------------------------------------------------

export type MarketplacePricingContext = {
  marketData?: {
    cPrice?: number | null
    demandIndex?: number | null
  } | null
  producerPricingFn?: ProducerPricingFn
}

export function mapDecisionToMarketplaceLot(
  snapshot: LotAllocationSnapshot,
  decision: LotAllocationDecision,
  pricingContext: MarketplacePricingContext = {}
): MarketplaceLotDto | null {

  const marketplace = safeNonNegative(decision.marketplaceEligibleGreenKg)
  const exclusive = safeNonNegative(decision.exclusiveMicrolotGreenKg)

  // Spec: filter to marketplaceEligibleGreenKg > 0 OR exclusiveMicrolotGreenKg > 0
  if (marketplace <= 0 && exclusive <= 0) return null

  // Surface narrowing — we never expose CONTRACT_CATALOG-only or HOLD lots.
  if (!isMarketplaceSurface(decision.recommendedSurface)) return null

  const isExclusive = exclusive > 0

  // Marketplace kg: exclusive wins over marketplace residual,
  // so a SPLIT lot only shows its residual marketplace pool
  // and an EXCLUSIVE_MICROLOT only shows its exclusive pool.
  const marketplaceGreenKg = isExclusive ? exclusive : marketplace

  // Roast yield is already resolved by the snapshot builder
  // (src/services/allocation/snapshot/lotAllocationSnapshot.service.ts
  // calls resolveRoastYield). We just trust the number here.
  const roastYield = snapshot.estimatedRoastYield

  const availableRoastedKg = round1(
    greenKgToRoastedKg(safeNonNegative(snapshot.availableGreenKg), roastYield)
  )
  const marketplaceRoastedKg = round1(
    greenKgToRoastedKg(marketplaceGreenKg, roastYield)
  )

  // PRICING — three-layer adaptive pipeline (PRICING-B2B-2):
  //
  //   1. snapshot.greenPricePerKg is the persisted PricingSnapshot.clientPricePerKg.
  //      Kept on the DTO for backwards compatibility; NOT used as the marketplace
  //      display value (the producer engine is re-run at read time so the
  //      marketplace responds to fresh marketData even on already-verified lots).
  //   2. calculateMarketplaceB2BPricing produces:
  //        - producerGreenPricePerKg     (full producer engine, with marketData)
  //        - originEquivalentRoastedPricePerKg
  //        - b2bReferencePricePerKg      (founder table — sanity band only)
  //        - adaptiveB2BPricePerKg       (commercial layer × quality × clamp)
  //   3. The displayed roasted price is adaptive ?? reference ?? origin-equiv.
  //
  // PricingSnapshot.clientPricePerKg is NOT modified by this mapper.
  // Contracts.service.ts still reads it as green-equivalent.
  const greenPricePerKg = snapshot.greenPricePerKg ?? null

  // ─── B2B reference lookup (always run for sanity band + DTO) ──
  const b2bResult = calculateB2BRoastedPricing({
    altitude: snapshot.farmAltitude,
    variety: snapshot.variety,
    scaScore: snapshot.scaScore,
    currency: snapshot.currency ?? "EUR",
  })

  // ─── Adaptive pricing (only when producer engine is injected) ─
  let producerGreenPricePerKg: number | null = null
  let originEquivalentRoastedPricePerKg: number | null = null
  let adaptiveB2BPricePerKg: number | null = null
  let pricingMode: MarketplacePricingMode = "ORIGIN_EQUIVALENT_FALLBACK"
  let commercialModel: CommercialPricingModel | undefined
  let marketTarget: MarketTargetSummary | undefined
  let roastedPricePerKg: number | null = null
  let pricingBreakdown: Array<{ label: string; value: string | number | boolean | null }> = []
  let pricingFallbackReason: string | undefined

  // PRICING-B2B-3 — persisted client B2B price (read from snapshot).
  // When valid (>0, finite), it becomes the displayed roastedPricePerKg
  // and pricingSource = PERSISTED_CLIENT_B2B. Otherwise we fall through
  // to the adaptive-recompute path below for backwards compatibility.
  const persistedClientB2B =
    typeof snapshot.clientB2BPricePerKg === "number" &&
    Number.isFinite(snapshot.clientB2BPricePerKg) &&
    snapshot.clientB2BPricePerKg > 0
      ? snapshot.clientB2BPricePerKg
      : null
  let pricingSource: MarketplacePricingSource =
    persistedClientB2B != null
      ? "PERSISTED_CLIENT_B2B"
      : "ADAPTIVE_RECOMPUTE_FALLBACK"

  if (pricingContext.producerPricingFn) {
    const adaptive = calculateMarketplaceB2BPricing(
      {
        scaScore: snapshot.scaScore,
        altitude: snapshot.farmAltitude,
        variety: snapshot.variety,
        process: snapshot.process,
        country: snapshot.producerCountry,
        roastYield,
        currency: snapshot.currency ?? "EUR",
        // PRICING-ARCH-1: the marketplace portion (residual or
        // exclusive pool) drives the model selection + scarcity
        // modifier. NOT the full lot.
        marketplaceGreenKg,
        marketData: pricingContext.marketData ?? null,
      },
      { producerPricingFn: pricingContext.producerPricingFn }
    )

    producerGreenPricePerKg = adaptive.producerGreenPricePerKg
    originEquivalentRoastedPricePerKg = adaptive.originEquivalentRoastedPricePerKg
    adaptiveB2BPricePerKg = adaptive.adaptiveB2BPricePerKg
    // PRICING-B2B-3: persisted B2B wins over the just-recomputed adaptive
    // value so the marketplace and contract surfaces always render the
    // exact number contracts.service will lock at.
    roastedPricePerKg = persistedClientB2B ?? adaptive.pricePerKgRoasted
    pricingMode = adaptive.pricingMode
    commercialModel = adaptive.commercialModel
    marketTarget = adaptive.marketTarget
    pricingBreakdown = adaptive.breakdown
    pricingFallbackReason = adaptive.fallbackReason
  } else {
    // No producer engine injected (e.g. test path that doesn't pass
    // producerPricingFn). Use the persisted green price for origin-equivalent
    // and pick founder reference if available — same behaviour PRICING-B2B-1
    // shipped, just with the new pricingMode names.
    originEquivalentRoastedPricePerKg =
      greenPricePerKg != null
        ? round2(computeRoastedPriceFromGreen(greenPricePerKg, roastYield))
        : null

    if (persistedClientB2B != null) {
      // PRICING-B2B-3 — persisted price wins even on the no-engine path.
      roastedPricePerKg = persistedClientB2B
      pricingMode = "ADAPTIVE_B2B_ENGINE"
    } else if (b2bResult.pricePerKgRoasted != null) {
      roastedPricePerKg = b2bResult.pricePerKgRoasted
      pricingMode = "B2B_REFERENCE_FALLBACK"
      pricingSource = "ADAPTIVE_RECOMPUTE_FALLBACK"
    } else if (originEquivalentRoastedPricePerKg != null) {
      roastedPricePerKg = originEquivalentRoastedPricePerKg
      pricingMode = "ORIGIN_EQUIVALENT_FALLBACK"
      pricingSource = "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"
      pricingFallbackReason = b2bResult.fallbackReason ?? "B2B_REFERENCE_UNAVAILABLE"
    } else {
      roastedPricePerKg = null
      pricingMode = "ORIGIN_EQUIVALENT_FALLBACK"
      pricingSource = "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"
      pricingFallbackReason = "NO_PRICING_AVAILABLE"
    }

    pricingBreakdown = [
      { label: "scaScore",                          value: snapshot.scaScore },
      { label: "altitude",                          value: snapshot.farmAltitude },
      { label: "variety",                           value: snapshot.variety },
      { label: "process",                           value: snapshot.process },
      { label: "roastYield",                        value: roastYield },
      { label: "greenPricePerKgPersisted",          value: greenPricePerKg },
      { label: "originEquivalentRoastedPricePerKg", value: originEquivalentRoastedPricePerKg },
      { label: "b2bReferencePricePerKg",            value: b2bResult.pricePerKgRoasted },
      { label: "producerEngineSkipped",             value: "no producerPricingFn injected" },
    ]
  }

  const b2bReferencePricePerKg = b2bResult.pricePerKgRoasted

  const pricingReference: {
    altitudeBucket: number | null
    scaBucket: B2BRoastedScaBucket | null
    pricingVersion: string
    source: string
    fallbackReason?: B2BRoastedFallbackReason | string
  } = {
    altitudeBucket: b2bResult.altitudeBucket,
    scaBucket: b2bResult.scaBucket,
    pricingVersion: b2bResult.pricingVersion,
    source: b2bResult.source,
    ...(pricingFallbackReason && { fallbackReason: pricingFallbackReason }),
  }

  // Display currency: adaptive + reference paths are EUR (commercial layer
  // and founder table are EUR-denominated). Origin-equivalent fallback
  // respects the lot's stored currency.
  const displayCurrency =
    pricingMode === "ORIGIN_EQUIVALENT_FALLBACK"
      ? ((snapshot.currency ?? "EUR").trim() || "EUR")
      : "EUR"

  const country = (snapshot.producerCountry ?? "").trim()
  const region = snapshot.farmRegion ?? null
  const originLabel = buildOriginLabel(country, region)

  // Badges
  const badges: MarketplaceBadgeKey[] = []
  if (isExclusive) badges.push("exclusive-microlot")
  if (snapshot.scaScore != null && snapshot.scaScore >= 86) badges.push("high-sca")
  const isFreshArrival = isWithinDays(snapshot.createdAt ?? null, FRESH_ARRIVAL_DAYS)
  if (isFreshArrival) badges.push("fresh-arrival")
  const hasFullProvenance =
    !!snapshot.farmName && !!snapshot.producerName && !!country
  if (hasFullProvenance) badges.push("high-traceability")
  if (badges.length === 0) badges.push("marketplace-lot")

  const primaryBadge = badges[0] ?? "marketplace-lot"
  const badgeLabel = BADGE_LABELS[primaryBadge]
  const badgeTone = BADGE_TONES[primaryBadge]

  const tone = pickVisualTone(country, snapshot.lotNumber)

  const traceabilityLabel = hasFullProvenance
    ? "Farm traceability"
    : "Traceability pending"

  // LOT-MEDIA-1 — derive ordered list + primary + summary.
  // snapshot.media is empty (not undefined) when the snapshot
  // builder did not load media rows. Either case is safe; the
  // helper returns a well-defined result for empty input.
  //
  // LOT-MEDIA-2 — filter PUBLIC_MARKET BEFORE building the
  // ordered result so BUYER_PRIVATE / INTERNAL_ONLY rows
  // never reach the marketplace DTO, including via
  // primaryMedia and visual.imageUrl.
  const publicMediaItems = filterLotMediaForPublicMarket(snapshot.media ?? [])
  const mediaResult = buildOrderedLotMedia(publicMediaItems)

  return {
    id: snapshot.greenLotId,
    greenLotId: snapshot.greenLotId,
    lotNumber: snapshot.lotNumber,

    name: buildName(snapshot),
    producerName: snapshot.producerName?.trim() || "Producer pending",
    // Strip "[DEV] " from dev-scenario farm names so the public card
    // doesn't surface the internal marker. Reset still works because
    // the prefix lives on the underlying Farm row.
    farmName: stripBracketedPrefix(snapshot.farmName?.trim() ?? "") || "Farm pending",
    originLabel,
    country: country || "Unknown",
    region: region ?? null,

    process: titleCase(snapshot.process || ""),
    variety: snapshot.variety?.trim() || "—",
    harvestYear: snapshot.harvestYear ?? null,
    scaScore: snapshot.scaScore ?? null,
    altitude: snapshot.farmAltitude ?? null,

    availableGreenKg: round1(safeNonNegative(snapshot.availableGreenKg)),
    availableRoastedKg,
    marketplaceGreenKg: round1(marketplaceGreenKg),
    marketplaceRoastedKg,

    greenPricePerKg: greenPricePerKg != null ? round2(greenPricePerKg) : null,
    producerGreenPricePerKg,
    originEquivalentRoastedPricePerKg,
    b2bReferencePricePerKg,
    adaptiveB2BPricePerKg,
    clientB2BPricePerKg: persistedClientB2B,
    roastedPricePerKg,
    pricingMode,
    pricingSource,
    ...(commercialModel != null ? { commercialModel } : {}),
    ...(marketTarget != null ? { marketTarget } : {}),
    pricingBreakdown,
    pricingReference,
    currency: displayCurrency,
    roastYield,

    recommendedSurface: decision.recommendedSurface,

    badges,
    badgeLabel,
    badgeTone,

    traceabilityLabel,
    isExclusive,
    isFreshArrival,

    allocation: {
      marketplaceEligibleGreenKg: marketplace,
      exclusiveMicrolotGreenKg: exclusive,
      confidence: decision.confidence,
      reasons: decision.reasons.map((r: AllocationReason) => ({
        code: r.code,
        severity: r.severity,
      })),
    },

    visual: {
      visualTone: tone,
      gradientKey: tone,
      // Wire the primary media URL into the existing single-image
      // slot when available. Existing consumers (LotImageWell) already
      // swap to the real <img> when imageUrl is truthy and fall back
      // to the tonal placeholder otherwise — no UI change required.
      imageUrl: mediaResult.primary?.url ?? null,
    },

    media: mediaResult.items,
    primaryMedia: mediaResult.primary,
    mediaSummary: {
      hasVerifiedMedia: mediaResult.hasVerifiedMedia,
      hasPartnerMedia: mediaResult.hasPartnerMedia,
      hasOnlyFallbackMedia: mediaResult.hasOnlyFallbackMedia,
      missingRecommendedRoles: mediaResult.missingRecommendedRoles,
    },
  }
}

// ------------------------------------------------------
// SORTING
//
// Spec:
//   - EXCLUSIVE_MICROLOT first
//   - then highest SCA
//   - then lotNumber stable fallback
// ------------------------------------------------------

export function sortMarketplaceLots(
  lots: ReadonlyArray<MarketplaceLotDto>
): MarketplaceLotDto[] {
  return [...lots].sort((a, b) => {
    const ax = a.isExclusive ? 0 : 1
    const bx = b.isExclusive ? 0 : 1
    if (ax !== bx) return ax - bx

    const sa = a.scaScore ?? -Infinity
    const sb = b.scaScore ?? -Infinity
    if (sa !== sb) return sb - sa

    return a.lotNumber.localeCompare(b.lotNumber)
  })
}

// ------------------------------------------------------
// METRICS
// ------------------------------------------------------

export function computeMarketplaceMetrics(
  lots: ReadonlyArray<MarketplaceLotDto>
): MarketplaceMetricsDto {

  const availableLots = lots.length

  const scaScores = lots
    .map((l) => l.scaScore)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s))

  const avgScaScore = scaScores.length
    ? Math.round(
        (scaScores.reduce((sum, s) => sum + s, 0) / scaScores.length) * 10
      ) / 10
    : null

  const countries = new Set<string>()
  for (const l of lots) {
    if (l.country && l.country !== "Unknown") countries.add(l.country)
  }

  const freshArrivals = lots.filter((l) => l.isFreshArrival).length

  return {
    availableLots,
    avgScaScore,
    origins: countries.size,
    freshArrivals,
  }
}

// ------------------------------------------------------
// INSIGHTS
// ------------------------------------------------------

export function computeMarketplaceInsights(
  lots: ReadonlyArray<MarketplaceLotDto>
): MarketplaceInsightsDto {

  // Group by country (fallback to region when country is empty).
  // Volume = marketplaceRoastedKg, the display kg the cards show.
  const volumeByOrigin = new Map<string, number>()
  let totalVolumeKg = 0

  for (const l of lots) {
    const label = (l.country && l.country !== "Unknown")
      ? l.country
      : (l.region ?? "Unknown")
    const kg = safeNonNegative(l.marketplaceRoastedKg)
    if (kg <= 0) continue
    volumeByOrigin.set(label, (volumeByOrigin.get(label) ?? 0) + kg)
    totalVolumeKg += kg
  }

  const topOriginsByVolume: OriginVolumeRow[] = Array.from(volumeByOrigin.entries())
    .map(([label, volumeKg]) => ({
      label,
      volumeKg: Math.round(volumeKg),
      percentage:
        totalVolumeKg > 0
          ? Math.round((volumeKg / totalVolumeKg) * 100)
          : 0,
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg)
    .slice(0, 5)

  const freshByOrigin = new Map<string, number>()
  for (const l of lots) {
    if (!l.isFreshArrival) continue
    const label = (l.country && l.country !== "Unknown")
      ? l.country
      : (l.region ?? "Unknown")
    freshByOrigin.set(label, (freshByOrigin.get(label) ?? 0) + 1)
  }

  const freshArrivalsByOrigin: OriginCountRow[] = Array.from(freshByOrigin.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    topOriginsByVolume,
    freshArrivalsByOrigin,
  }
}
