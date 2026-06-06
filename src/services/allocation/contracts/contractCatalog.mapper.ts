//////////////////////////////////////////////////////
// 📄 CONTRACT CATALOG MAPPER
//
// Pure functions that turn (snapshot + allocation decision)
// pairs into ContractCatalogLotDto rows for the client
// dashboard "Coffee for monthly contracts" surface.
//
// READ-ONLY for ALLOC-4. Pricing is the same indicative
// adaptive B2B price the marketplace shows — but it is
// NOT persisted and contract creation still uses the old
// green/yield path until PRICING-B2B-3.
//
// Marketplace lives in marketplace/marketplaceLot.mapper.ts
// and uses marketplaceEligibleGreenKg / exclusiveMicrolotGreenKg.
// THIS mapper uses contractAssignableGreenKg only.
//////////////////////////////////////////////////////

import type {
  AllocationReason,
  AllocationReasonCode,
  AllocationReasonSeverity,
  AllocationSurface,
  LotAllocationDecision,
  LotAllocationSnapshot,
  ViableProfile,
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
  calculateMarketplaceB2BPricing,
  type ProducerPricingFn,
  type MarketplacePricingMode,
  type CommercialPricingModel,
  type MarketTargetSummary,
} from "../../../engine/pricing/client/calculateMarketplaceB2BPricing.ts"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type ContractCatalogSurface = "CONTRACT_CATALOG" | "SPLIT"

export type ContractCatalogPricingSource =
  | "PERSISTED_CLIENT_B2B"
  | "ADAPTIVE_RECOMPUTE_FALLBACK"
  | "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"

export type ContractCatalogBadgeKey =
  | "contract-ready"
  | "split-lot"
  | "high-sca"
  | "high-altitude"
  | "limited-contract-pool"

export type ContractCatalogViableProfile = {
  profileId: string
  monthsCovered: number
  coversTypicalConsumption: boolean
}

export type ContractCatalogLotDto = {
  id: string
  lotNumber: string
  name: string

  producerName: string | null
  farmName: string | null
  region: string | null
  country: string | null

  process: string
  variety: string
  harvestYear: number | null
  scaScore: number | null
  altitude: number | null

  roastYield: number
  currency: string

  totalGreenKg: number
  availableGreenKg: number

  contractAssignableGreenKg: number
  contractAssignableRoastedKg: number

  committedContractGreenKg: number
  committedContractMonthlyGreenKg?: number | null
  committedContractHorizonGreenKg?: number | null
  reservedIntentGreenKg: number

  recommendedSurface: ContractCatalogSurface
  viableProfiles: ContractCatalogViableProfile[]

  bestProfileId: string | null
  maxMonthsCovered: number | null

  // Indicative supply estimate from the best viable profile.
  // monthlyRoastedKg = profile.monthlyGreenKg * roastYield.
  indicativeMonthlyRoastedKg: number | null
  indicativeCoverageMonths: number | null

  // Indicative B2B price — not persisted, not signable.
  pricePerKgRoasted: number | null
  pricingMode?: MarketplacePricingMode | null
  commercialModel?: CommercialPricingModel | null
  marketTarget?: MarketTargetSummary | null
  // PRICING-B2B-3 — auditable price provenance. PERSISTED_CLIENT_B2B
  // when read from PricingSnapshot.clientB2BPricePerKg; otherwise the
  // adaptive recompute path produced the value.
  pricingSource: ContractCatalogPricingSource
  clientB2BPricePerKg: number | null

  badges: ContractCatalogBadgeKey[]
  reasons: Array<{
    code: AllocationReasonCode
    severity: AllocationReasonSeverity
    message: string
  }>

  // LOT-MEDIA-1 — semantic ordered media propagated through the
  // contract catalog. `media` is empty (not undefined) when the
  // mapper has produced the row; the client dashboard falls back
  // to its deterministic tonal placeholder when empty.
  //
  // Optional in the type so pre-LOT-MEDIA-1 fixtures + API clients
  // still satisfy the contract. Real mapper output always sets all
  // three fields (empty array / null / summary with all-false flags).
  media?: LotMediaItem[]
  primaryMedia?: LotMediaItem | null
  mediaSummary?: LotMediaSummary
}

export type ContractCatalogOriginRow = {
  country: string
  roastedKg: number
  percentage: number
}

export type ContractCatalogProfileRow = {
  profileId: string
  lots: number
}

export type ContractCatalogMetrics = {
  totalLots: number
  totalAssignableGreenKg: number
  totalAssignableRoastedKg: number
  avgScaScore: number | null
  origins: ContractCatalogOriginRow[]
  topProfiles: ContractCatalogProfileRow[]
}

export type ContractCatalogResponse = {
  generatedAt: string
  policyVersion: string
  count: number
  lots: ContractCatalogLotDto[]
  metrics: ContractCatalogMetrics
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

const ROAST_YIELD_FLOOR = 0.5
const HIGH_SCA_THRESHOLD = 86
const HIGH_ALTITUDE_THRESHOLD = 1900
const LIMITED_CONTRACT_POOL_ROASTED_KG = 600

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

function greenKgToRoastedKg(greenKg: number, roastYield: number): number {
  const safeYield = Math.max(ROAST_YIELD_FLOOR, roastYield)
  return greenKg * safeYield
}

// Strips a single leading bracketed token from display strings
// (e.g. "[DEV] Foo Farm" → "Foo Farm"). Mirrors the marketplace
// mapper helper so dev seeds don't leak the [DEV] marker into
// the client-facing catalog.
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

function isContractCatalogSurface(
  s: AllocationSurface
): s is ContractCatalogSurface {
  return s === "CONTRACT_CATALOG" || s === "SPLIT"
}

// Pick the "best" profile for indicative coverage display:
//   1. profile that covers typical consumption AND has the
//      most months covered
//   2. else any profile with the most months covered
//   3. else null
function pickBestProfile(
  profiles: ReadonlyArray<ViableProfile>
): ViableProfile | null {
  if (profiles.length === 0) return null
  const covering = profiles.filter((p) => p.coversTypicalConsumption)
  const pool = covering.length > 0 ? covering : profiles
  return pool.reduce<ViableProfile>((acc, p) =>
    p.monthsCovered > acc.monthsCovered ? p : acc, pool[0])
}

function buildBadges(input: {
  recommendedSurface: ContractCatalogSurface
  scaScore: number | null
  altitude: number | null
  contractAssignableRoastedKg: number
}): ContractCatalogBadgeKey[] {
  const badges: ContractCatalogBadgeKey[] = ["contract-ready"]
  if (input.recommendedSurface === "SPLIT") badges.push("split-lot")
  if (input.scaScore != null && input.scaScore >= HIGH_SCA_THRESHOLD) {
    badges.push("high-sca")
  }
  if (input.altitude != null && input.altitude >= HIGH_ALTITUDE_THRESHOLD) {
    badges.push("high-altitude")
  }
  if (
    input.contractAssignableRoastedKg > 0 &&
    input.contractAssignableRoastedKg < LIMITED_CONTRACT_POOL_ROASTED_KG
  ) {
    badges.push("limited-contract-pool")
  }
  return badges
}

// ------------------------------------------------------
// MAIN MAPPER
// ------------------------------------------------------

export type ContractCatalogPricingContext = {
  marketData?: {
    cPrice?: number | null
    demandIndex?: number | null
  } | null
  producerPricingFn?: ProducerPricingFn
}

export function mapDecisionToContractCatalogLot(
  snapshot: LotAllocationSnapshot,
  decision: LotAllocationDecision,
  pricingContext: ContractCatalogPricingContext = {}
): ContractCatalogLotDto | null {

  // ─── HARD FILTERS ──────────────────────────────────
  // Spec: contractAssignableGreenKg > 0 AND surface ∈ {CONTRACT_CATALOG, SPLIT}.
  // Anything else (HOLD, OPEN_MARKETPLACE-only, EXCLUSIVE_MICROLOT-only,
  // zero-pool lots) is excluded.
  if (!isContractCatalogSurface(decision.recommendedSurface)) return null
  const contractAssignableGreenKg =
    safeNonNegative(decision.contractAssignableGreenKg)
  if (contractAssignableGreenKg <= 0) return null

  // Pricing is required for the catalog — a row without an indicative
  // price is not actionable for a buyer. The engine sets a MISSING_PRICING
  // reason in this case anyway.
  const greenPricePerKg = snapshot.greenPricePerKg
  if (greenPricePerKg == null) return null

  const roastYield = snapshot.estimatedRoastYield
  const contractAssignableRoastedKg = round1(
    greenKgToRoastedKg(contractAssignableGreenKg, roastYield)
  )

  // ─── PRICING (PRICING-B2B-3) ──────────────────────
  // Priority order:
  //   1. snapshot.clientB2BPricePerKg (persisted) — same value
  //      contracts.service will lock at.
  //   2. Adaptive recompute via calculateMarketplaceB2BPricing
  //      for old rows that pre-date PRICING-B2B-3.
  //   3. null when neither is available.
  let pricePerKgRoasted: number | null = null
  let pricingMode: MarketplacePricingMode | null = null
  let commercialModel: CommercialPricingModel | null = null
  let marketTarget: MarketTargetSummary | null = null

  const persistedClientB2B =
    typeof snapshot.clientB2BPricePerKg === "number" &&
    Number.isFinite(snapshot.clientB2BPricePerKg) &&
    snapshot.clientB2BPricePerKg > 0
      ? snapshot.clientB2BPricePerKg
      : null
  let pricingSource: ContractCatalogPricingSource =
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
        // The contract pool drives scarcity / model selection — same
        // semantics as marketplace, just on the contract side of the lot.
        marketplaceGreenKg: contractAssignableGreenKg,
        marketData: pricingContext.marketData ?? null,
      },
      { producerPricingFn: pricingContext.producerPricingFn }
    )
    // Persisted price wins over recomputed adaptive so the catalog
    // matches what contracts.service will lock.
    pricePerKgRoasted = persistedClientB2B ?? adaptive.pricePerKgRoasted
    pricingMode = adaptive.pricingMode
    commercialModel = adaptive.commercialModel ?? null
    marketTarget = adaptive.marketTarget ?? null
  } else if (persistedClientB2B != null) {
    // No engine injected (test path) but we still have a persisted
    // price — surface it so the DTO is complete.
    pricePerKgRoasted = persistedClientB2B
    pricingMode = "ADAPTIVE_B2B_ENGINE"
  } else {
    pricingSource = "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"
  }

  // ─── VIABLE PROFILES ──────────────────────────────
  const viableProfiles: ContractCatalogViableProfile[] =
    decision.viableProfiles.map((p) => ({
      profileId: p.profileId,
      monthsCovered: p.monthsCovered,
      coversTypicalConsumption: p.coversTypicalConsumption,
    }))

  const best = pickBestProfile(decision.viableProfiles)
  const bestProfileId = best?.profileId ?? null
  const maxMonthsCovered = best?.monthsCovered ?? null
  const indicativeMonthlyRoastedKg = best
    ? round1(greenKgToRoastedKg(best.monthlyGreenKg, roastYield))
    : null
  const indicativeCoverageMonths = best?.monthsCovered ?? null

  const country = snapshot.producerCountry?.trim() || null
  const region = snapshot.farmRegion ?? null
  const altitude = snapshot.farmAltitude ?? null

  const recommendedSurface = decision.recommendedSurface as ContractCatalogSurface
  const badges = buildBadges({
    recommendedSurface,
    scaScore: snapshot.scaScore,
    altitude,
    contractAssignableRoastedKg,
  })

  // LOT-MEDIA-1 — derive ordered list + primary + summary.
  // LOT-MEDIA-2 — filter PUBLIC_MARKET first so buyer-private
  // and internal-only rows never reach the client dashboard's
  // monthly contract catalog.
  const publicMediaItems = filterLotMediaForPublicMarket(snapshot.media ?? [])
  const mediaResult = buildOrderedLotMedia(publicMediaItems)

  // Display currency: adaptive pricing path produces EUR; in the
  // no-producer-engine fallback path we just echo the lot's stored
  // currency (defaulting to EUR).
  const displayCurrency =
    pricingMode === "ORIGIN_EQUIVALENT_FALLBACK" || pricingMode == null
      ? ((snapshot.currency ?? "EUR").trim() || "EUR")
      : "EUR"

  return {
    id: snapshot.greenLotId,
    lotNumber: snapshot.lotNumber,
    name: buildName(snapshot),

    producerName: snapshot.producerName?.trim() || null,
    farmName: stripBracketedPrefix(snapshot.farmName?.trim() ?? "") || null,
    region,
    country,

    process: titleCase(snapshot.process || ""),
    variety: snapshot.variety?.trim() || "—",
    harvestYear: snapshot.harvestYear ?? null,
    scaScore: snapshot.scaScore ?? null,
    altitude,

    roastYield,
    currency: displayCurrency,

    totalGreenKg: round1(safeNonNegative(snapshot.totalGreenKg)),
    availableGreenKg: round1(safeNonNegative(snapshot.availableGreenKg)),

    contractAssignableGreenKg: round1(contractAssignableGreenKg),
    contractAssignableRoastedKg,

    committedContractGreenKg: round1(
      safeNonNegative(snapshot.committedContractGreenKg)
    ),
    committedContractMonthlyGreenKg:
      snapshot.committedContractMonthlyGreenKg ?? null,
    committedContractHorizonGreenKg:
      snapshot.committedContractHorizonGreenKg ?? null,
    reservedIntentGreenKg: round1(
      safeNonNegative(snapshot.reservedIntentGreenKg)
    ),

    recommendedSurface,
    viableProfiles,
    bestProfileId,
    maxMonthsCovered,
    indicativeMonthlyRoastedKg,
    indicativeCoverageMonths,

    pricePerKgRoasted,
    pricingMode,
    commercialModel,
    marketTarget,
    pricingSource,
    clientB2BPricePerKg: persistedClientB2B,

    badges,
    reasons: decision.reasons.map((r: AllocationReason) => ({
      code: r.code,
      severity: r.severity,
      message: r.message,
    })),

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
//   1. CONTRACT_CATALOG before SPLIT (volume-reliable first).
//   2. Higher contractAssignableRoastedKg first.
//   3. Higher SCA score.
//   4. lotNumber asc (stable).
// ------------------------------------------------------

export function sortContractCatalogLots(
  lots: ReadonlyArray<ContractCatalogLotDto>
): ContractCatalogLotDto[] {
  return [...lots].sort((a, b) => {
    const sa = a.recommendedSurface === "CONTRACT_CATALOG" ? 0 : 1
    const sb = b.recommendedSurface === "CONTRACT_CATALOG" ? 0 : 1
    if (sa !== sb) return sa - sb

    if (b.contractAssignableRoastedKg !== a.contractAssignableRoastedKg) {
      return b.contractAssignableRoastedKg - a.contractAssignableRoastedKg
    }

    const scaA = a.scaScore ?? -Infinity
    const scaB = b.scaScore ?? -Infinity
    if (scaA !== scaB) return scaB - scaA

    return a.lotNumber.localeCompare(b.lotNumber)
  })
}

// ------------------------------------------------------
// METRICS
// ------------------------------------------------------

export function computeContractCatalogMetrics(
  lots: ReadonlyArray<ContractCatalogLotDto>
): ContractCatalogMetrics {

  const totalLots = lots.length
  let totalAssignableGreenKg = 0
  let totalAssignableRoastedKg = 0

  const scaScores: number[] = []
  const volumeByCountry = new Map<string, number>()
  const lotsByProfile = new Map<string, number>()

  for (const l of lots) {
    totalAssignableGreenKg += l.contractAssignableGreenKg
    totalAssignableRoastedKg += l.contractAssignableRoastedKg
    if (typeof l.scaScore === "number" && Number.isFinite(l.scaScore)) {
      scaScores.push(l.scaScore)
    }
    const country = (l.country && l.country.trim()) || "Unknown"
    volumeByCountry.set(
      country,
      (volumeByCountry.get(country) ?? 0) + l.contractAssignableRoastedKg
    )
    for (const p of l.viableProfiles) {
      lotsByProfile.set(p.profileId, (lotsByProfile.get(p.profileId) ?? 0) + 1)
    }
  }

  const avgScaScore = scaScores.length
    ? Math.round(
        (scaScores.reduce((s, v) => s + v, 0) / scaScores.length) * 10
      ) / 10
    : null

  const totalRoastedForPct = totalAssignableRoastedKg
  const origins: ContractCatalogOriginRow[] = Array.from(
    volumeByCountry.entries()
  )
    .map(([country, roastedKg]) => ({
      country,
      roastedKg: Math.round(roastedKg),
      percentage:
        totalRoastedForPct > 0
          ? Math.round((roastedKg / totalRoastedForPct) * 100)
          : 0,
    }))
    .sort((a, b) => b.roastedKg - a.roastedKg)

  const topProfiles: ContractCatalogProfileRow[] = Array.from(
    lotsByProfile.entries()
  )
    .map(([profileId, lotsCount]) => ({ profileId, lots: lotsCount }))
    .sort((a, b) => b.lots - a.lots)

  return {
    totalLots,
    totalAssignableGreenKg: round1(totalAssignableGreenKg),
    totalAssignableRoastedKg: round1(totalAssignableRoastedKg),
    avgScaScore,
    origins,
    topProfiles,
  }
}
