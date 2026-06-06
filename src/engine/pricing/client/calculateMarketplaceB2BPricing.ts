//////////////////////////////////////////////////////
// 🧠 ADAPTIVE MARKETPLACE B2B PRICING ENGINE — v2 (target-anchored)
//
// PRICING-ARCH-2B re-anchors the MARKET_ANCHORED_MODEL on
// research-backed targets from getMarketTargetPricing()
// instead of multiplying the founder reference by per-
// dimension modifiers (SCA, altitude, country) — which
// was double-counting because the target table already
// encodes those dimensions.
//
// Two commercial models:
//
//   COST_PLUS_MODEL        — normal / volume coffees,
//                            origin-equivalent + roasting
//                            + packaging + logistics + margin,
//                            clamped to ±30% of founder reference.
//                            UNCHANGED in this sprint.
//
//   MARKET_ANCHORED_MODEL  — premium / rare / low-volume coffees,
//                            anchored on getMarketTargetPricing()
//                            .band.expected, with three SOFT
//                            residual modifiers (scarcity, market
//                            signal, prestige) and the cost-plus
//                            value as a floor. Clamp = the target
//                            band's [low, high].
//
// Producer engine is dependency-injected so this module
// stays node --test friendly.
//
// READ-ONLY for marketplace display in v2. Does NOT
// replace PricingSnapshot.clientPricePerKg.
//////////////////////////////////////////////////////

import {
  calculateB2BRoastedPricing,
  type B2BRoastedFallbackReason,
} from "./b2bRoastedPricing.ts"
import {
  getMarketTargetPricing,
  type MarketPricingClass,
  type MarketTargetPricingInput,
  type ProducerPrestigeTier,
} from "./marketTargetPricing.ts"

// ------------------------------------------------------
// PRODUCER PRICING DEPENDENCY
// ------------------------------------------------------

export type ProducerPricingFn = (input: {
  scaScore: number
  altitude: number
  variety: string
  process: string
  country?: string
  marketData?: {
    cPrice?: number
    demandIndex?: number
  }
}) => {
  finalPrice: number
  breakdown?: unknown
}

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type MarketplacePricingMode =
  | "ADAPTIVE_B2B_ENGINE"
  | "B2B_REFERENCE_FALLBACK"
  | "ORIGIN_EQUIVALENT_FALLBACK"

export type CommercialPricingModel =
  | "COST_PLUS_MODEL"
  | "MARKET_ANCHORED_MODEL"

// Re-export ProducerPrestigeTier so callers don't need to know
// it lives in marketTargetPricing.ts.
export type { ProducerPrestigeTier } from "./marketTargetPricing.ts"

export type MarketplaceB2BPricingInput = {
  scaScore: number | null
  altitude: number | null
  variety: string
  process: string
  country: string | null
  roastYield: number
  marketplaceGreenKg?: number | null
  producerPrestigeTier?: ProducerPrestigeTier | null
  currency?: string | null
  marketData?: {
    cPrice?: number | null
    demandIndex?: number | null
  } | null
}

export type MarketTargetSummary = {
  sourceVersion: string
  source: string
  confidence?: string
  low: number
  expected: number
  high: number
  pricingClass?: MarketPricingClass
  scaBucket?: string
  altitudeBucket?: string | null
  countryGroup?: string | null
}

export type MarketplaceB2BPricingResult = {
  pricePerKgRoasted: number | null
  currency: string
  pricingMode: MarketplacePricingMode
  commercialModel: CommercialPricingModel

  producerGreenPricePerKg: number | null
  originEquivalentRoastedPricePerKg: number | null

  b2bReferencePricePerKg: number | null
  adaptiveB2BPricePerKg: number | null

  marketTarget?: MarketTargetSummary

  breakdown: Array<{
    label: string
    value: string | number | boolean | null
  }>

  fallbackReason?: string
  pricingVersion: "marketplace-b2b-target-anchored-v1"
}

// ------------------------------------------------------
// CONSTANTS
//
// Cost-plus layer: unchanged from v1. TODO: founder calibration
// once roasting / packaging / logistics / margin are confirmed.
//
// Soft-modifier tables: derived from PRICING-ARCH-2B spec.
// Higher elasticity ⇒ price moves more with the signal.
// Premium classes are intentionally less elastic so market
// noise can't drag a Geisha out of its target band.
// ------------------------------------------------------

const ROASTING_COST_PER_KG = 5.5
const PACKAGING_COST_PER_KG = 1.0
const LOGISTICS_COST_PER_KG = 1.5
const COMMERCIAL_MARGIN_RATE = 0.35

const COST_PLUS_CLAMP_FLOOR = 0.7
const COST_PLUS_CLAMP_CEILING = 1.3
const NORMAL_QUALITY_MULTIPLIER_CAP = 1.6

const ROAST_YIELD_FLOOR = 0.5

// MARKET_ANCHORED soft commodity layer (separate from the
// producer engine's hard 180 c/lb baseline).
const SOFT_COMMODITY_BASELINE = 290
const SOFT_COMMODITY_FLOOR = 0.85
const SOFT_COMMODITY_CEILING = 1.30

const SOFT_COMMODITY_ELASTICITY: Record<MarketPricingClass, number> = {
  NORMAL_SPECIALTY:   1.00,
  PREMIUM_SPECIALTY:  0.45,
  RARE_PINK_BOURBON:  0.25,
  ULTRA_RARE_GEISHA:  0.12,
}

const SOFT_DEMAND_BANDS: Record<
  MarketPricingClass,
  { min: number; max: number; elasticity: number }
> = {
  NORMAL_SPECIALTY:   { min: 0.85, max: 1.15, elasticity: 1.00 },
  PREMIUM_SPECIALTY:  { min: 0.82, max: 1.20, elasticity: 0.60 },
  RARE_PINK_BOURBON:  { min: 0.78, max: 1.25, elasticity: 0.40 },
  ULTRA_RARE_GEISHA:  { min: 0.75, max: 1.35, elasticity: 0.25 },
}

const PRICING_VERSION: MarketplaceB2BPricingResult["pricingVersion"] =
  "marketplace-b2b-target-anchored-v1"

const PRODUCER_VARIETY_SET: ReadonlyArray<string> = [
  "CASTILLO",
  "CATURRA",
  "COLOMBIA",
  "TYPICA",
  "BOURBON",
  "PINK_BOURBON",
  "GEISHA",
  "TABI",
]

// ------------------------------------------------------
// PURE HELPERS
// ------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function computeRoastedFromGreen(green: number, roastYield: number): number {
  return green / Math.max(ROAST_YIELD_FLOOR, roastYield)
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function normaliseProducerVariety(raw: string): string {
  if (typeof raw !== "string") return ""
  return raw.trim().toUpperCase().replace(/[\s\-]+/g, "_")
}

function sanitiseMarketData(
  md: MarketplaceB2BPricingInput["marketData"]
): { cPrice?: number; demandIndex?: number } | undefined {
  if (!md) return undefined
  const out: { cPrice?: number; demandIndex?: number } = {}
  if (typeof md.cPrice === "number" && Number.isFinite(md.cPrice)) {
    out.cPrice = md.cPrice
  }
  if (typeof md.demandIndex === "number" && Number.isFinite(md.demandIndex)) {
    out.demandIndex = md.demandIndex
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function canRunProducerEngine(input: MarketplaceB2BPricingInput): boolean {
  return (
    typeof input.scaScore === "number" &&
    Number.isFinite(input.scaScore) &&
    input.scaScore >= 80 &&
    typeof input.altitude === "number" &&
    Number.isFinite(input.altitude) &&
    typeof input.process === "string" &&
    input.process.length > 0 &&
    PRODUCER_VARIETY_SET.includes(normaliseProducerVariety(input.variety))
  )
}

function computeNormalQualityMultiplier(opts: {
  scaScore: number
  variety: string
}): number {
  let m = 1.0
  if (opts.scaScore >= 87) m += 0.10
  if (opts.scaScore >= 89) m += 0.20  // additional, on top of 87+
  if (
    opts.variety === "BOURBON" ||
    opts.variety === "TYPICA" ||
    opts.variety === "TABI"
  ) {
    m += 0.10
  }
  if (m > NORMAL_QUALITY_MULTIPLIER_CAP) m = NORMAL_QUALITY_MULTIPLIER_CAP
  return m
}

// ------------------------------------------------------
// COMMERCIAL MODEL SELECTION  (unchanged from PRICING-ARCH-1)
// ------------------------------------------------------

export function selectCommercialPricingModel(input: {
  variety: string
  scaScore: number | null
  marketplaceGreenKg: number | null
  b2bReferencePricePerKg: number | null
}): CommercialPricingModel {
  if (input.variety === "GEISHA") return "MARKET_ANCHORED_MODEL"
  if (input.variety === "PINK_BOURBON") return "MARKET_ANCHORED_MODEL"
  if (
    typeof input.scaScore === "number" &&
    Number.isFinite(input.scaScore) &&
    input.scaScore >= 88
  ) {
    return "MARKET_ANCHORED_MODEL"
  }
  if (
    typeof input.marketplaceGreenKg === "number" &&
    Number.isFinite(input.marketplaceGreenKg) &&
    input.marketplaceGreenKg <= 500
  ) {
    return "MARKET_ANCHORED_MODEL"
  }
  if (
    typeof input.b2bReferencePricePerKg === "number" &&
    Number.isFinite(input.b2bReferencePricePerKg) &&
    input.b2bReferencePricePerKg >= 50
  ) {
    return "MARKET_ANCHORED_MODEL"
  }
  return "COST_PLUS_MODEL"
}

// ------------------------------------------------------
// SOFT MODIFIERS (MARKET_ANCHORED only)
// ------------------------------------------------------

// Scarcity — research targets already include some premium
// for low-volume lots, so this is intentionally tighter
// than the v1 modifier.
export function getSoftScarcityModifier(
  marketplaceGreenKg: number | null
): number {
  if (
    typeof marketplaceGreenKg !== "number" ||
    !Number.isFinite(marketplaceGreenKg)
  ) {
    return 1.00
  }
  if (marketplaceGreenKg <= 50) return 1.18
  if (marketplaceGreenKg <= 100) return 1.12
  if (marketplaceGreenKg <= 250) return 1.08
  if (marketplaceGreenKg <= 500) return 1.05
  if (marketplaceGreenKg <= 1000) return 1.02
  return 1.00
}

// Soft market signal — class-sensitive, baseline 290 c/lb
// (current "elevated normal"). Premium coffees are less
// elastic so commodity noise doesn't dominate target prices.
export function getSoftMarketSignalModifier(input: {
  cPrice?: number
  demandIndex?: number
  pricingClass: MarketPricingClass
}): { factor: number; commoditySoft: number; demandSoft: number } {
  let commoditySoft = 1.00
  let demandSoft = 1.00

  if (typeof input.cPrice === "number" && Number.isFinite(input.cPrice)) {
    const ratio = input.cPrice / SOFT_COMMODITY_BASELINE
    const raw = clamp(ratio, SOFT_COMMODITY_FLOOR, SOFT_COMMODITY_CEILING)
    const elasticity = SOFT_COMMODITY_ELASTICITY[input.pricingClass]
    commoditySoft = 1 + (raw - 1) * elasticity
  }

  if (typeof input.demandIndex === "number" && Number.isFinite(input.demandIndex)) {
    const band = SOFT_DEMAND_BANDS[input.pricingClass]
    const clamped = clamp(input.demandIndex, band.min, band.max)
    demandSoft = 1 + (clamped - 1) * band.elasticity
  }

  return {
    factor: commoditySoft * demandSoft,
    commoditySoft,
    demandSoft,
  }
}

// Soft prestige — minimal residual on top of the target row.
// FAMOUS_ESTATE × Panama Geisha collapses to 1.00 because the
// PANAMA_FAMOUS target row already encodes that premium.
export function getSoftPrestigeModifier(input: {
  producerPrestigeTier: ProducerPrestigeTier | null | undefined
  pricingClass: MarketPricingClass
  targetAltitudeBucket: string | null | undefined
}): number {
  const tier = input.producerPrestigeTier ?? "UNKNOWN"
  if (tier === "UNKNOWN" || tier === "STANDARD") return 1.00

  if (tier === "NAMED") {
    if (input.pricingClass === "ULTRA_RARE_GEISHA")  return 1.08
    if (input.pricingClass === "RARE_PINK_BOURBON")  return 1.05
    return 1.02
  }

  // FAMOUS_ESTATE
  if (input.targetAltitudeBucket === "PANAMA_FAMOUS") return 1.00
  if (input.pricingClass === "ULTRA_RARE_GEISHA")  return 1.25
  if (input.pricingClass === "RARE_PINK_BOURBON")  return 1.12
  return 1.05
}

// ------------------------------------------------------
// MAIN
// ------------------------------------------------------

export function calculateMarketplaceB2BPricing(
  input: MarketplaceB2BPricingInput,
  deps: { producerPricingFn: ProducerPricingFn }
): MarketplaceB2BPricingResult {

  const breakdown: Array<{ label: string; value: string | number | boolean | null }> = []
  const md = sanitiseMarketData(input.marketData ?? null)
  const normalisedVariety = normaliseProducerVariety(input.variety)

  // ─── INPUT AUDIT ──────────────────────────────────
  breakdown.push({ label: "scaScore",              value: input.scaScore })
  breakdown.push({ label: "altitude",              value: input.altitude })
  breakdown.push({ label: "variety",               value: input.variety })
  breakdown.push({ label: "process",               value: input.process })
  breakdown.push({ label: "country",               value: input.country })
  breakdown.push({ label: "roastYield",            value: input.roastYield })
  breakdown.push({ label: "marketplaceGreenKg",    value: input.marketplaceGreenKg ?? null })
  breakdown.push({ label: "producerPrestigeTier",  value: input.producerPrestigeTier ?? null })
  breakdown.push({ label: "cPrice",                value: md?.cPrice ?? null })
  breakdown.push({ label: "demandIndex",           value: md?.demandIndex ?? null })

  // ─── 1. PRODUCER ENGINE ──────────────────────────
  let producerGreenPricePerKg: number | null = null
  let originEquivalentRoastedPricePerKg: number | null = null
  let costPlusBaseCost: number | null = null
  let costPlusFinal: number | null = null
  let normalQualityMultiplier: number | null = null
  let producerError: string | null = null

  if (canRunProducerEngine(input)) {
    try {
      const producer = deps.producerPricingFn({
        scaScore: input.scaScore as number,
        altitude: input.altitude as number,
        variety: normalisedVariety,
        process: input.process,
        country: input.country ?? undefined,
        marketData: md,
      })

      producerGreenPricePerKg = round2(producer.finalPrice)
      originEquivalentRoastedPricePerKg = round2(
        computeRoastedFromGreen(producer.finalPrice, input.roastYield)
      )

      costPlusBaseCost = round2(
        originEquivalentRoastedPricePerKg
        + ROASTING_COST_PER_KG
        + PACKAGING_COST_PER_KG
        + LOGISTICS_COST_PER_KG
      )

      const margined = costPlusBaseCost * (1 + COMMERCIAL_MARGIN_RATE)
      normalQualityMultiplier = computeNormalQualityMultiplier({
        scaScore: input.scaScore as number,
        variety: normalisedVariety,
      })
      costPlusFinal = round2(margined * normalQualityMultiplier)

      breakdown.push({ label: "producerGreenPricePerKg",          value: producerGreenPricePerKg })
      breakdown.push({ label: "originEquivalentRoastedPricePerKg", value: originEquivalentRoastedPricePerKg })
      breakdown.push({ label: "roastingCostPerKg",     value: ROASTING_COST_PER_KG })
      breakdown.push({ label: "packagingCostPerKg",    value: PACKAGING_COST_PER_KG })
      breakdown.push({ label: "logisticsCostPerKg",    value: LOGISTICS_COST_PER_KG })
      breakdown.push({ label: "costPlusBaseCost",      value: costPlusBaseCost })
      breakdown.push({ label: "commercialMarginRate",  value: COMMERCIAL_MARGIN_RATE })
      breakdown.push({ label: "normalQualityMultiplier", value: normalQualityMultiplier })
      breakdown.push({ label: "costPlusFinal",         value: costPlusFinal })
    } catch (err) {
      producerError = err instanceof Error ? err.message : String(err)
      breakdown.push({ label: "producerEngineError", value: producerError })
    }
  } else {
    breakdown.push({ label: "producerEngineSkipped", value: "preconditions failed" })
  }

  // ─── 2. FOUNDER REFERENCE TABLE  (kept for selector + COST_PLUS clamp) ──
  const reference = calculateB2BRoastedPricing({
    altitude: input.altitude,
    variety: input.variety,
    scaScore: input.scaScore,
    currency: input.currency ?? null,
  })
  const b2bReferencePricePerKg = reference.pricePerKgRoasted
  breakdown.push({ label: "b2bReferencePricePerKg", value: b2bReferencePricePerKg })

  // ─── 3. SELECT COMMERCIAL MODEL ──────────────────
  const commercialModel = selectCommercialPricingModel({
    variety: normalisedVariety,
    scaScore: input.scaScore,
    marketplaceGreenKg: input.marketplaceGreenKg ?? null,
    b2bReferencePricePerKg,
  })
  breakdown.push({ label: "commercialModel", value: commercialModel })

  // ─── 4. COMPUTE BY MODEL ─────────────────────────
  let adaptiveB2BPricePerKg: number | null = null
  let finalPrice: number | null = null
  let marketTarget: MarketTargetSummary | undefined

  if (commercialModel === "COST_PLUS_MODEL") {
    if (costPlusFinal != null) {
      adaptiveB2BPricePerKg = costPlusFinal
      let final = costPlusFinal

      if (b2bReferencePricePerKg != null) {
        const min = round2(b2bReferencePricePerKg * COST_PLUS_CLAMP_FLOOR)
        const max = round2(b2bReferencePricePerKg * COST_PLUS_CLAMP_CEILING)
        const clamped = clamp(final, min, max)
        const clampApplied = clamped !== final
        breakdown.push({ label: "clampMin", value: min })
        breakdown.push({ label: "clampMax", value: max })
        breakdown.push({ label: "clampApplied", value: clampApplied })
        breakdown.push({ label: "costPlusPostClamp", value: clamped })
        final = clamped
      } else {
        breakdown.push({ label: "clampSkipped", value: "no founder reference" })
      }

      finalPrice = round2(final)
    }
  } else {
    // MARKET_ANCHORED_MODEL — anchor on research target.
    const targetInput: MarketTargetPricingInput = {
      variety: input.variety,
      country: input.country,
      altitude: input.altitude,
      scaScore: input.scaScore,
      producerPrestigeTier: input.producerPrestigeTier ?? null,
    }
    const target = getMarketTargetPricing(targetInput)

    if (target.ok) {
      const anchor = target.band.expected

      const scarcity = getSoftScarcityModifier(input.marketplaceGreenKg ?? null)
      const signal = getSoftMarketSignalModifier({
        cPrice: md?.cPrice,
        demandIndex: md?.demandIndex,
        pricingClass: target.pricingClass,
      })
      const prestige = getSoftPrestigeModifier({
        producerPrestigeTier: input.producerPrestigeTier ?? null,
        pricingClass: target.pricingClass,
        targetAltitudeBucket: target.bucket.altitudeBucket,
      })

      const marketAnchoredRaw = anchor * scarcity * signal.factor * prestige
      const marketAnchored = round2(marketAnchoredRaw)
      const costFloor = costPlusFinal ?? 0
      const finalBeforeClamp = round2(Math.max(marketAnchoredRaw, costFloor))
      const clamped = clamp(finalBeforeClamp, target.band.low, target.band.high)
      const clampApplied = clamped !== finalBeforeClamp

      adaptiveB2BPricePerKg = round2(marketAnchoredRaw)
      finalPrice = round2(clamped)

      marketTarget = {
        sourceVersion: target.sourceVersion,
        source: target.source,
        confidence: target.confidence,
        low: target.band.low,
        expected: target.band.expected,
        high: target.band.high,
        pricingClass: target.pricingClass,
        scaBucket: target.bucket.scaBucket,
        altitudeBucket: target.bucket.altitudeBucket,
        countryGroup: target.bucket.countryGroup,
      }

      breakdown.push({ label: "marketTargetSourceVersion",  value: target.sourceVersion })
      breakdown.push({ label: "marketTargetPricingClass",   value: target.pricingClass })
      breakdown.push({ label: "marketTargetExpected",       value: target.band.expected })
      breakdown.push({ label: "marketTargetLow",            value: target.band.low })
      breakdown.push({ label: "marketTargetHigh",           value: target.band.high })
      breakdown.push({ label: "targetScaBucket",            value: target.bucket.scaBucket })
      breakdown.push({ label: "targetAltitudeBucket",       value: target.bucket.altitudeBucket })
      breakdown.push({ label: "targetCountryGroup",         value: target.bucket.countryGroup })
      breakdown.push({ label: "softScarcityModifier",       value: scarcity })
      breakdown.push({ label: "softCommoditySoft",          value: signal.commoditySoft })
      breakdown.push({ label: "softDemandSoft",             value: signal.demandSoft })
      breakdown.push({ label: "softMarketSignalModifier",   value: signal.factor })
      breakdown.push({ label: "softPrestigeModifier",       value: prestige })
      breakdown.push({ label: "marketAnchoredPrice",        value: marketAnchored })
      breakdown.push({ label: "costFloor",                  value: round2(costFloor) })
      breakdown.push({ label: "finalBeforeClamp",           value: finalBeforeClamp })
      breakdown.push({ label: "clampMin",                   value: target.band.low })
      breakdown.push({ label: "clampMax",                   value: target.band.high })
      breakdown.push({ label: "clampApplied",               value: clampApplied })
      breakdown.push({ label: "finalPrice",                 value: finalPrice })
    } else {
      // Target lookup failed — surface the reason and let the
      // post-branch fallback chain decide the price.
      const targetReason = target.reasons.join(",")
      breakdown.push({ label: "marketTargetUnavailable", value: targetReason || "unknown" })
    }
  }

  // ─── 5. RETURN ─────────────────────────────────
  if (finalPrice != null) {
    return {
      pricePerKgRoasted: finalPrice,
      currency: "EUR",
      pricingMode: "ADAPTIVE_B2B_ENGINE",
      commercialModel,
      producerGreenPricePerKg,
      originEquivalentRoastedPricePerKg,
      b2bReferencePricePerKg,
      adaptiveB2BPricePerKg,
      ...(marketTarget ? { marketTarget } : {}),
      breakdown,
      pricingVersion: PRICING_VERSION,
    }
  }

  // Adaptive failed → fall back to founder reference if available.
  if (b2bReferencePricePerKg != null) {
    return {
      pricePerKgRoasted: b2bReferencePricePerKg,
      currency: "EUR",
      pricingMode: "B2B_REFERENCE_FALLBACK",
      commercialModel,
      producerGreenPricePerKg,
      originEquivalentRoastedPricePerKg,
      b2bReferencePricePerKg,
      adaptiveB2BPricePerKg: null,
      breakdown,
      fallbackReason:
        producerError ?? reference.fallbackReason ?? "ADAPTIVE_UNAVAILABLE",
      pricingVersion: PRICING_VERSION,
    }
  }

  if (originEquivalentRoastedPricePerKg != null) {
    return {
      pricePerKgRoasted: originEquivalentRoastedPricePerKg,
      currency: (input.currency ?? "EUR").trim() || "EUR",
      pricingMode: "ORIGIN_EQUIVALENT_FALLBACK",
      commercialModel,
      producerGreenPricePerKg,
      originEquivalentRoastedPricePerKg,
      b2bReferencePricePerKg: null,
      adaptiveB2BPricePerKg: null,
      breakdown,
      fallbackReason:
        producerError ?? reference.fallbackReason ?? "B2B_REFERENCE_UNAVAILABLE",
      pricingVersion: PRICING_VERSION,
    }
  }

  return {
    pricePerKgRoasted: null,
    currency: (input.currency ?? "EUR").trim() || "EUR",
    pricingMode: "ORIGIN_EQUIVALENT_FALLBACK",
    commercialModel,
    producerGreenPricePerKg,
    originEquivalentRoastedPricePerKg: null,
    b2bReferencePricePerKg: null,
    adaptiveB2BPricePerKg: null,
    breakdown,
    fallbackReason:
      producerError ?? reference.fallbackReason ?? "ALL_PATHS_FAILED",
    pricingVersion: PRICING_VERSION,
  }
}

// Re-export for convenience.
export type { B2BRoastedFallbackReason }
export type { MarketPricingClass } from "./marketTargetPricing.ts"
