//////////////////////////////////////////////////////
// 🧠 MARKET TARGET PRICING — research-backed B2B €/kg targets
//
// Pure data + pure selector. NO Prisma, NO env, NO fetch.
// NO mutation of marketplace runtime prices in this sprint.
//
// Encodes the May 2026 specialty-coffee research benchmark
// for B2B roasted prices per (variety, country, altitude,
// integer SCA, optional producer prestige tier).
//
// PRICING-ARCH-2B will consume `.expected` from this module
// to re-anchor MARKET_ANCHORED_MODEL and avoid the
// double-counting risk of the v1 modifier stack.
//////////////////////////////////////////////////////

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

export const MARKET_TARGET_SOURCE_VERSION = "research-2026-05" as const

// Geisha cells in the research report come as a single
// `expected` number per (origin, SCA) pair. We derive a
// symmetrical band of ±20%/+25% (i.e. low=expected×0.80,
// high=expected×1.25) so the result shape stays uniform
// across all classes. The other classes ship low/expected/
// high as-is from research.
const GEISHA_BAND_LOW_FACTOR = 0.80
const GEISHA_BAND_HIGH_FACTOR = 1.25

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type MarketTargetVariety =
  | "CASTILLO"
  | "CATURRA"
  | "COLOMBIA"
  | "TYPICA"
  | "BOURBON"
  | "PINK_BOURBON"
  | "GEISHA"
  | "TABI"

export type MarketPricingClass =
  | "NORMAL_SPECIALTY"
  | "PREMIUM_SPECIALTY"
  | "RARE_PINK_BOURBON"
  | "ULTRA_RARE_GEISHA"

export type ProducerPrestigeTier =
  | "UNKNOWN"
  | "STANDARD"
  | "NAMED"
  | "FAMOUS_ESTATE"

export type MarketTargetSource =
  | "RESEARCH_2026_05_TABLE"
  | "DERIVED_FROM_NORMAL_TABLE"
  | "REFERENCE_FALLBACK"

export type MarketTargetConfidence =
  | "low"
  | "medium"
  | "medium-high"
  | "high"

export type MarketTargetReasonCode =
  | "NORMAL_TABLE_MATCH"
  | "PINK_BOURBON_TABLE_MATCH"
  | "GEISHA_TABLE_MATCH"
  | "COUNTRY_GROUPED"
  | "ALTITUDE_BUCKETED"
  | "PRESTIGE_TIER_APPLIED"
  | "SCA_BUCKETED"
  | "SCA_CLAMPED_LOW"
  | "SCA_CLAMPED_HIGH"
  | "UNSUPPORTED_VARIETY"
  | "MISSING_SCA"
  | "MISSING_ALTITUDE"
  | "FALLBACK_USED"

export type MarketTargetPriceBand = {
  low: number
  expected: number
  high: number
}

export type MarketTargetPricingInput = {
  variety: string
  country?: string | null
  altitude?: number | null
  scaScore?: number | null
  producerPrestigeTier?: ProducerPrestigeTier | null
}

export type MarketTargetPricingResult =
  | {
      ok: true
      variety: MarketTargetVariety
      pricingClass: MarketPricingClass
      band: MarketTargetPriceBand
      source: MarketTargetSource
      confidence: MarketTargetConfidence
      sourceVersion: typeof MARKET_TARGET_SOURCE_VERSION
      bucket: {
        scaBucket: string
        altitudeBucket: string | null
        countryGroup: string | null
        producerPrestigeTier: ProducerPrestigeTier
      }
      reasons: MarketTargetReasonCode[]
    }
  | {
      ok: false
      sourceVersion: typeof MARKET_TARGET_SOURCE_VERSION
      reasons: MarketTargetReasonCode[]
    }

// ------------------------------------------------------
// VARIETY NORMALISATION + CLASSIFICATION
// ------------------------------------------------------

const SUPPORTED_VARIETIES: ReadonlyArray<MarketTargetVariety> = [
  "CASTILLO",
  "CATURRA",
  "COLOMBIA",
  "TYPICA",
  "BOURBON",
  "PINK_BOURBON",
  "GEISHA",
  "TABI",
]

export function normalizeMarketTargetVariety(
  value: string
): MarketTargetVariety | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalised = trimmed.toUpperCase().replace(/[\s\-]+/g, "_")

  // Spelling-tolerance: research and roasters use "Gesha" and "Geisha"
  // interchangeably. Both map to the same target row.
  if (normalised === "GESHA") return "GEISHA"

  if (SUPPORTED_VARIETIES.includes(normalised as MarketTargetVariety)) {
    return normalised as MarketTargetVariety
  }
  return null
}

export function classifyMarketPricingVariety(
  variety: MarketTargetVariety
): MarketPricingClass {
  switch (variety) {
    case "CASTILLO":
    case "CATURRA":
    case "COLOMBIA":
      return "NORMAL_SPECIALTY"
    case "TYPICA":
    case "BOURBON":
    case "TABI":
      return "PREMIUM_SPECIALTY"
    case "PINK_BOURBON":
      return "RARE_PINK_BOURBON"
    case "GEISHA":
      return "ULTRA_RARE_GEISHA"
  }
}

// ------------------------------------------------------
// COUNTRY NORMALISATION
// ------------------------------------------------------

type CountryGroup =
  | "COLOMBIA"
  | "PANAMA"
  | "COSTA_RICA"
  | "BOLIVIA"
  | "ECUADOR"
  | "ETHIOPIA"
  | "UNKNOWN"

function normaliseCountry(country: string | null | undefined): CountryGroup {
  if (!country) return "UNKNOWN"
  const trimmed = country.trim()
  if (!trimmed) return "UNKNOWN"
  const n = trimmed.toUpperCase().replace(/[\s\-]+/g, "_")
  if (
    n === "COLOMBIA" ||
    n === "PANAMA" ||
    n === "COSTA_RICA" ||
    n === "BOLIVIA" ||
    n === "ECUADOR" ||
    n === "ETHIOPIA"
  ) {
    return n
  }
  return "UNKNOWN"
}

// ------------------------------------------------------
// SCA BUCKETING (integer SCA only)
//
// Math.round() — documented choice. Decimal SCA support is
// out of scope per the integer-SCA founder direction.
// ------------------------------------------------------

const SCA_HIGH_BOUNDARY = 93   // SCA > 93 ⇒ SCA_CLAMPED_HIGH
const SCA_LOW_BOUNDARY_NORMAL = 80
const SCA_LOW_BOUNDARY_RARE = 87

type NormalScaBucket = "80_83" | "84_86" | "87_88" | "89_90" | "91_PLUS"
type PinkBourbonScaBucket = "87" | "88" | "89" | "90" | "91_PLUS"
type GeishaScaBucket = "87" | "88" | "89" | "90" | "91" | "92_PLUS" | "93_PLUS"

type ScaBucketResult<B extends string> = {
  bucket: B
  clamped: "low" | "high" | null
}

function bucketScaForNormal(sca: number): ScaBucketResult<NormalScaBucket> {
  let bucket: NormalScaBucket
  let clamped: "low" | "high" | null = null

  if (sca < SCA_LOW_BOUNDARY_NORMAL) {
    bucket = "80_83"
    clamped = "low"
  } else if (sca <= 83) bucket = "80_83"
  else if (sca <= 86)   bucket = "84_86"
  else if (sca <= 88)   bucket = "87_88"
  else if (sca <= 90)   bucket = "89_90"
  else                  bucket = "91_PLUS"

  if (clamped == null && sca > SCA_HIGH_BOUNDARY) clamped = "high"
  return { bucket, clamped }
}

function bucketScaForPinkBourbon(sca: number): ScaBucketResult<PinkBourbonScaBucket> {
  let bucket: PinkBourbonScaBucket
  let clamped: "low" | "high" | null = null

  if (sca < SCA_LOW_BOUNDARY_RARE) {
    bucket = "87"
    clamped = "low"
  } else if (sca === 87) bucket = "87"
  else if (sca === 88)   bucket = "88"
  else if (sca === 89)   bucket = "89"
  else if (sca === 90)   bucket = "90"
  else                   bucket = "91_PLUS" // sca >= 91

  if (clamped == null && sca > SCA_HIGH_BOUNDARY) clamped = "high"
  return { bucket, clamped }
}

function bucketScaForGeisha(sca: number): ScaBucketResult<GeishaScaBucket> {
  let bucket: GeishaScaBucket
  let clamped: "low" | "high" | null = null

  if (sca < SCA_LOW_BOUNDARY_RARE) {
    bucket = "87"
    clamped = "low"
  } else if (sca === 87) bucket = "87"
  else if (sca === 88)   bucket = "88"
  else if (sca === 89)   bucket = "89"
  else if (sca === 90)   bucket = "90"
  else if (sca === 91)   bucket = "91"
  else if (sca === 92)   bucket = "92_PLUS"
  else                   bucket = "93_PLUS" // sca >= 93

  if (clamped == null && sca > SCA_HIGH_BOUNDARY) clamped = "high"
  return { bucket, clamped }
}

// ------------------------------------------------------
// BAND HELPER — Geisha cells ship `expected` only.
// ------------------------------------------------------

function band(expected: number): MarketTargetPriceBand {
  return {
    low: Math.round(expected * GEISHA_BAND_LOW_FACTOR),
    expected,
    high: Math.round(expected * GEISHA_BAND_HIGH_FACTOR),
  }
}

// ======================================================
// TARGET TABLES
//
// Values are realistic B2B roasted €/kg from the May 2026
// research benchmark. Encoded by hand — no JSON, no
// runtime fetch — to keep the module pure.
// ======================================================

// ------------------------------------------------------
// NORMAL / PREMIUM SPECIALTY (CASTILLO, CATURRA, COLOMBIA,
// TYPICA, BOURBON, TABI)
// ------------------------------------------------------

type NormalRow = Record<NormalScaBucket, MarketTargetPriceBand>

type NormalVariety =
  | "CASTILLO"
  | "CATURRA"
  | "COLOMBIA"
  | "TYPICA"
  | "BOURBON"
  | "TABI"

export const NORMAL_SPECIALTY_TARGETS: Record<NormalVariety, NormalRow> = {
  CASTILLO: {
    "80_83":   { low: 22, expected: 28, high: 35 },
    "84_86":   { low: 32, expected: 40, high: 50 },
    "87_88":   { low: 48, expected: 60, high: 75 },
    "89_90":   { low: 65, expected: 85, high: 110 },
    "91_PLUS": { low: 90, expected: 120, high: 150 },
  },
  CATURRA: {
    "80_83":   { low: 22, expected: 28, high: 35 },
    "84_86":   { low: 32, expected: 40, high: 50 },
    "87_88":   { low: 48, expected: 60, high: 75 },
    "89_90":   { low: 65, expected: 85, high: 110 },
    "91_PLUS": { low: 90, expected: 120, high: 150 },
  },
  COLOMBIA: {
    "80_83":   { low: 22, expected: 28, high: 35 },
    "84_86":   { low: 32, expected: 40, high: 50 },
    "87_88":   { low: 48, expected: 60, high: 75 },
    "89_90":   { low: 65, expected: 85, high: 110 },
    "91_PLUS": { low: 85, expected: 115, high: 145 },
  },
  TYPICA: {
    "80_83":   { low: 26, expected: 33,  high: 42 },
    "84_86":   { low: 38, expected: 48,  high: 60 },
    "87_88":   { low: 56, expected: 72,  high: 92 },
    "89_90":   { low: 80, expected: 105, high: 135 },
    "91_PLUS": { low: 115, expected: 150, high: 200 },
  },
  BOURBON: {
    "80_83":   { low: 26, expected: 33,  high: 42 },
    "84_86":   { low: 38, expected: 48,  high: 60 },
    "87_88":   { low: 56, expected: 72,  high: 92 },
    "89_90":   { low: 80, expected: 105, high: 135 },
    "91_PLUS": { low: 115, expected: 150, high: 200 },
  },
  TABI: {
    "80_83":   { low: 24, expected: 31,  high: 39 },
    "84_86":   { low: 35, expected: 44,  high: 56 },
    "87_88":   { low: 52, expected: 67,  high: 85 },
    "89_90":   { low: 72, expected: 95,  high: 125 },
    "91_PLUS": { low: 100, expected: 135, high: 175 },
  },
} as const

// ------------------------------------------------------
// PINK BOURBON
// ------------------------------------------------------

type PinkBourbonRow = Record<PinkBourbonScaBucket, MarketTargetPriceBand>

type PinkBourbonOriginKey =
  | "COLOMBIA_1700"
  | "COLOMBIA_1900"
  | "COLOMBIA_2000"
  | "COSTA_RICA"
  | "PANAMA"

export const PINK_BOURBON_TARGETS: Record<PinkBourbonOriginKey, PinkBourbonRow> = {
  COLOMBIA_1700: {
    "87":      { low: 55,  expected: 70,  high: 85 },
    "88":      { low: 70,  expected: 85,  high: 105 },
    "89":      { low: 85,  expected: 105, high: 130 },
    "90":      { low: 100, expected: 125, high: 155 },
    "91_PLUS": { low: 120, expected: 150, high: 180 },
  },
  COLOMBIA_1900: {
    "87":      { low: 70,  expected: 85,  high: 105 },
    "88":      { low: 85,  expected: 105, high: 130 },
    "89":      { low: 100, expected: 125, high: 155 },
    "90":      { low: 125, expected: 150, high: 180 },
    "91_PLUS": { low: 150, expected: 180, high: 215 },
  },
  COLOMBIA_2000: {
    "87":      { low: 80,  expected: 100, high: 120 },
    "88":      { low: 100, expected: 120, high: 145 },
    "89":      { low: 115, expected: 140, high: 170 },
    "90":      { low: 140, expected: 165, high: 200 },
    "91_PLUS": { low: 165, expected: 200, high: 235 },
  },
  COSTA_RICA: {
    "87":      { low: 80,  expected: 100, high: 120 },
    "88":      { low: 100, expected: 125, high: 150 },
    "89":      { low: 120, expected: 145, high: 175 },
    "90":      { low: 145, expected: 175, high: 210 },
    "91_PLUS": { low: 175, expected: 215, high: 260 },
  },
  PANAMA: {
    "87":      { low: 90,  expected: 110, high: 135 },
    "88":      { low: 110, expected: 135, high: 165 },
    "89":      { low: 130, expected: 160, high: 195 },
    "90":      { low: 160, expected: 195, high: 235 },
    "91_PLUS": { low: 200, expected: 240, high: 295 },
  },
} as const

// ------------------------------------------------------
// GEISHA
//
// The research report ships a single `expected` per cell
// for Geisha. We derive low/high via the GEISHA_BAND_*
// factors above. Mark anything that ships triplets later
// by replacing band(...) with an explicit object.
// ------------------------------------------------------

type GeishaRow = Record<GeishaScaBucket, MarketTargetPriceBand>

type GeishaOriginKey =
  | "COLOMBIA_1800"
  | "COLOMBIA_2000"
  | "COLOMBIA_2050_PLUS"
  | "PANAMA_NON_FAMOUS"
  | "PANAMA_FAMOUS"
  | "ETHIOPIA_NAMED"
  | "COSTA_RICA_BOLIVIA_ECUADOR"

export const GEISHA_TARGETS: Record<GeishaOriginKey, GeishaRow> = {
  COLOMBIA_1800: {
    "87":      band(130),
    "88":      band(160),
    "89":      band(200),
    "90":      band(250),
    "91":      band(305),
    "92_PLUS": band(365),
    "93_PLUS": band(445),
  },
  COLOMBIA_2000: {
    "87":      band(150),
    "88":      band(185),
    "89":      band(235),
    "90":      band(295),
    "91":      band(360),
    "92_PLUS": band(435),
    "93_PLUS": band(530),
  },
  COLOMBIA_2050_PLUS: {
    "87":      band(160),
    "88":      band(200),
    "89":      band(260),
    "90":      band(325),
    "91":      band(400),
    "92_PLUS": band(485),
    "93_PLUS": band(595),
  },
  PANAMA_NON_FAMOUS: {
    "87":      band(240),
    "88":      band(320),
    "89":      band(440),
    "90":      band(615),
    "91":      band(870),
    "92_PLUS": band(1200),
    "93_PLUS": band(1650),
  },
  PANAMA_FAMOUS: {
    "87":      band(410),
    "88":      band(580),
    "89":      band(850),
    "90":      band(1250),
    "91":      band(1800),
    "92_PLUS": band(2500),
    "93_PLUS": band(3500),
  },
  ETHIOPIA_NAMED: {
    "87":      band(235),
    "88":      band(310),
    "89":      band(415),
    "90":      band(565),
    "91":      band(760),
    "92_PLUS": band(1030),
    "93_PLUS": band(1400),
  },
  COSTA_RICA_BOLIVIA_ECUADOR: {
    "87":      band(155),
    "88":      band(210),
    "89":      band(280),
    "90":      band(370),
    "91":      band(480),
    "92_PLUS": band(625),
    "93_PLUS": band(810),
  },
} as const

// ------------------------------------------------------
// ROW SELECTION HELPERS
// ------------------------------------------------------

type PinkBourbonRowSelection = {
  rowKey: PinkBourbonOriginKey
  rowReasons: MarketTargetReasonCode[]
  countryGroup: string
}

function selectPinkBourbonRow(
  country: CountryGroup,
  altitude: number | null
): PinkBourbonRowSelection {

  if (country === "COLOMBIA") {
    if (altitude == null || !Number.isFinite(altitude)) {
      return {
        rowKey: "COLOMBIA_1900",
        rowReasons: ["MISSING_ALTITUDE", "ALTITUDE_BUCKETED"],
        countryGroup: "COLOMBIA",
      }
    }
    if (altitude < 1800) {
      return { rowKey: "COLOMBIA_1700", rowReasons: ["ALTITUDE_BUCKETED"], countryGroup: "COLOMBIA" }
    }
    if (altitude < 1950) {
      return { rowKey: "COLOMBIA_1900", rowReasons: ["ALTITUDE_BUCKETED"], countryGroup: "COLOMBIA" }
    }
    return { rowKey: "COLOMBIA_2000", rowReasons: ["ALTITUDE_BUCKETED"], countryGroup: "COLOMBIA" }
  }

  if (country === "COSTA_RICA") {
    return { rowKey: "COSTA_RICA", rowReasons: [], countryGroup: "COSTA_RICA" }
  }

  if (country === "PANAMA") {
    return { rowKey: "PANAMA", rowReasons: [], countryGroup: "PANAMA" }
  }

  // Unknown / unsupported origin — fall back to the Colombia 1900 m row.
  return {
    rowKey: "COLOMBIA_1900",
    rowReasons: ["COUNTRY_GROUPED"],
    countryGroup: "COLOMBIA",
  }
}

type GeishaRowSelection = {
  rowKey: GeishaOriginKey
  rowReasons: MarketTargetReasonCode[]
  countryGroup: string
  prestigeUsedForRow: boolean
}

function selectGeishaRow(
  country: CountryGroup,
  altitude: number | null,
  prestige: ProducerPrestigeTier
): GeishaRowSelection {

  if (country === "COLOMBIA") {
    if (altitude == null || !Number.isFinite(altitude)) {
      return {
        rowKey: "COLOMBIA_2000",
        rowReasons: ["MISSING_ALTITUDE", "ALTITUDE_BUCKETED"],
        countryGroup: "COLOMBIA",
        prestigeUsedForRow: false,
      }
    }
    if (altitude < 1900) {
      return { rowKey: "COLOMBIA_1800", rowReasons: ["ALTITUDE_BUCKETED"], countryGroup: "COLOMBIA", prestigeUsedForRow: false }
    }
    if (altitude < 2025) {
      return { rowKey: "COLOMBIA_2000", rowReasons: ["ALTITUDE_BUCKETED"], countryGroup: "COLOMBIA", prestigeUsedForRow: false }
    }
    return { rowKey: "COLOMBIA_2050_PLUS", rowReasons: ["ALTITUDE_BUCKETED"], countryGroup: "COLOMBIA", prestigeUsedForRow: false }
  }

  if (country === "PANAMA") {
    if (prestige === "FAMOUS_ESTATE") {
      return {
        rowKey: "PANAMA_FAMOUS",
        rowReasons: ["PRESTIGE_TIER_APPLIED"],
        countryGroup: "PANAMA",
        prestigeUsedForRow: true,
      }
    }
    return {
      rowKey: "PANAMA_NON_FAMOUS",
      rowReasons: [],
      countryGroup: "PANAMA",
      prestigeUsedForRow: false,
    }
  }

  if (country === "ETHIOPIA") {
    return {
      rowKey: "ETHIOPIA_NAMED",
      rowReasons: [],
      countryGroup: "ETHIOPIA",
      prestigeUsedForRow: false,
    }
  }

  if (country === "COSTA_RICA" || country === "BOLIVIA" || country === "ECUADOR") {
    return {
      rowKey: "COSTA_RICA_BOLIVIA_ECUADOR",
      rowReasons: [],
      countryGroup: country,
      prestigeUsedForRow: false,
    }
  }

  // Unknown / unsupported origin — fall back to Colombia 2000 m.
  return {
    rowKey: "COLOMBIA_2000",
    rowReasons: ["COUNTRY_GROUPED"],
    countryGroup: "COLOMBIA",
    prestigeUsedForRow: false,
  }
}

// ------------------------------------------------------
// MAIN SELECTOR
// ------------------------------------------------------

export function getMarketTargetPricing(
  input: MarketTargetPricingInput
): MarketTargetPricingResult {

  // 1. Variety
  const variety = normalizeMarketTargetVariety(input.variety)
  if (!variety) {
    return {
      ok: false,
      sourceVersion: MARKET_TARGET_SOURCE_VERSION,
      reasons: ["UNSUPPORTED_VARIETY"],
    }
  }

  // 2. SCA presence (integer rounding documented)
  if (
    input.scaScore == null ||
    typeof input.scaScore !== "number" ||
    !Number.isFinite(input.scaScore)
  ) {
    return {
      ok: false,
      sourceVersion: MARKET_TARGET_SOURCE_VERSION,
      reasons: ["MISSING_SCA"],
    }
  }
  const scaInteger = Math.round(input.scaScore)

  // 3. Class
  const pricingClass = classifyMarketPricingVariety(variety)
  const prestigeTier: ProducerPrestigeTier =
    input.producerPrestigeTier ?? "UNKNOWN"

  // 4. Branch by class
  if (
    pricingClass === "NORMAL_SPECIALTY" ||
    pricingClass === "PREMIUM_SPECIALTY"
  ) {
    const { bucket, clamped } = bucketScaForNormal(scaInteger)
    const row = NORMAL_SPECIALTY_TARGETS[variety as NormalVariety]
    const targetBand = row[bucket]

    const reasons: MarketTargetReasonCode[] = ["NORMAL_TABLE_MATCH", "SCA_BUCKETED"]
    if (clamped === "low") reasons.push("SCA_CLAMPED_LOW")
    if (clamped === "high") reasons.push("SCA_CLAMPED_HIGH")
    if (prestigeTier !== "UNKNOWN") reasons.push("PRESTIGE_TIER_APPLIED")

    const confidence: MarketTargetConfidence =
      pricingClass === "NORMAL_SPECIALTY" ? "medium-high" : "medium"

    return {
      ok: true,
      variety,
      pricingClass,
      band: targetBand,
      source: "RESEARCH_2026_05_TABLE",
      confidence,
      sourceVersion: MARKET_TARGET_SOURCE_VERSION,
      bucket: {
        scaBucket: bucket,
        altitudeBucket: null,
        countryGroup: null,
        producerPrestigeTier: prestigeTier,
      },
      reasons,
    }
  }

  if (pricingClass === "RARE_PINK_BOURBON") {
    const country = normaliseCountry(input.country)
    const rowSelection = selectPinkBourbonRow(country, input.altitude ?? null)
    const { bucket, clamped } = bucketScaForPinkBourbon(scaInteger)

    const tableRow = PINK_BOURBON_TARGETS[rowSelection.rowKey]
    const targetBand = tableRow[bucket]

    const reasons: MarketTargetReasonCode[] = [
      "PINK_BOURBON_TABLE_MATCH",
      "SCA_BUCKETED",
      ...rowSelection.rowReasons,
    ]
    if (clamped === "low") reasons.push("SCA_CLAMPED_LOW")
    if (clamped === "high") reasons.push("SCA_CLAMPED_HIGH")
    if (prestigeTier !== "UNKNOWN" && !reasons.includes("PRESTIGE_TIER_APPLIED")) {
      reasons.push("PRESTIGE_TIER_APPLIED")
    }

    return {
      ok: true,
      variety,
      pricingClass,
      band: targetBand,
      source: "RESEARCH_2026_05_TABLE",
      confidence: "medium",
      sourceVersion: MARKET_TARGET_SOURCE_VERSION,
      bucket: {
        scaBucket: bucket,
        altitudeBucket: rowSelection.rowKey,
        countryGroup: rowSelection.countryGroup,
        producerPrestigeTier: prestigeTier,
      },
      reasons,
    }
  }

  // ULTRA_RARE_GEISHA
  const country = normaliseCountry(input.country)
  const rowSelection = selectGeishaRow(country, input.altitude ?? null, prestigeTier)
  const { bucket, clamped } = bucketScaForGeisha(scaInteger)

  const tableRow = GEISHA_TARGETS[rowSelection.rowKey]
  const targetBand = tableRow[bucket]

  const reasons: MarketTargetReasonCode[] = [
    "GEISHA_TABLE_MATCH",
    "SCA_BUCKETED",
    ...rowSelection.rowReasons,
  ]
  if (clamped === "low") reasons.push("SCA_CLAMPED_LOW")
  if (clamped === "high") reasons.push("SCA_CLAMPED_HIGH")
  if (
    prestigeTier !== "UNKNOWN" &&
    !rowSelection.prestigeUsedForRow &&
    !reasons.includes("PRESTIGE_TIER_APPLIED")
  ) {
    // Carry the tier in result.bucket but flag that we did not modify
    // the band (see selector docs — non-Panama Geisha doesn't multiply
    // by prestige in this sprint).
    reasons.push("PRESTIGE_TIER_APPLIED")
  }

  // Confidence: Colombia is the most data-dense origin, others are medium.
  const confidence: MarketTargetConfidence =
    rowSelection.countryGroup === "COLOMBIA" ? "medium-high" : "medium"

  return {
    ok: true,
    variety,
    pricingClass,
    band: targetBand,
    source: "RESEARCH_2026_05_TABLE",
    confidence,
    sourceVersion: MARKET_TARGET_SOURCE_VERSION,
    bucket: {
      scaBucket: bucket,
      altitudeBucket: rowSelection.rowKey,
      countryGroup: rowSelection.countryGroup,
      producerPrestigeTier: prestigeTier,
    },
    reasons,
  }
}
