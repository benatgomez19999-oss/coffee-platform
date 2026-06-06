//////////////////////////////////////////////////////
// 🧠 B2B ROASTED PRICING — read-only v0
//
// Founder reference table of final B2B roasted €/kg
// prices. The numbers represent the entire commercial
// chain — green origin price + 15 % roast loss + roasting
// + packaging + brand margin + logistics — collapsed
// into a single value per (altitude bucket, variety,
// SCA bucket).
//
// READ-ONLY for marketplace display in v0.
// Does NOT replace PricingSnapshot.clientPricePerKg —
// that field is still consumed by contracts.service.ts
// as a green-equivalent and changing it here would
// break contract pricing.
//
// Pure module: no Prisma, no env, no fetch, no I/O.
//////////////////////////////////////////////////////

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type B2BRoastedScaBucket = "80_83" | "84_86" | "86_90_PLUS"

export type SupportedB2BVariety =
  | "CASTILLO"
  | "CATURRA"
  | "COLOMBIA"
  | "TYPICA"
  | "BOURBON"
  | "PINK_BOURBON"
  | "GEISHA"
  | "TABI"

export type B2BRoastedFallbackReason =
  | "MISSING_ALTITUDE"
  | "MISSING_SCA"
  | "UNSUPPORTED_VARIETY"
  | "UNAVAILABLE_FOR_SCA_BUCKET"

export type B2BRoastedPricingInput = {
  altitude: number | null
  variety: string
  scaScore: number | null
  // Reserved for future FX. v0 ignores this — the table is
  // EUR-denominated and the result currency is always EUR.
  currency?: string | null
}

export type B2BRoastedPricingBreakdownStep = {
  label: string
  value: string | number | null
}

export type B2BRoastedPricingResult = {
  pricePerKgRoasted: number | null
  currency: string
  altitudeBucket: number | null
  scaBucket: B2BRoastedScaBucket | null
  variety: string
  pricingVersion: "b2b-roasted-reference-v0"
  source: "founder-reference-table"
  fallbackReason?: B2BRoastedFallbackReason
  breakdown: B2BRoastedPricingBreakdownStep[]
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

const VERSION: B2BRoastedPricingResult["pricingVersion"] = "b2b-roasted-reference-v0"
const SOURCE: B2BRoastedPricingResult["source"] = "founder-reference-table"
const RESULT_CURRENCY = "EUR"

const SUPPORTED_VARIETIES: ReadonlyArray<SupportedB2BVariety> = [
  "CASTILLO",
  "CATURRA",
  "COLOMBIA",
  "TYPICA",
  "BOURBON",
  "PINK_BOURBON",
  "GEISHA",
  "TABI",
]

type AltitudeBucket = 1300 | 1400 | 1500 | 1600 | 1700 | 1800 | 1900 | 2000

// Per cell: [80_83, 84_86, 86_90_PLUS]. null = no commercial
// price at this combination (e.g. Geisha at SCA ≤ 83 doesn't
// exist as a B2B product in the founder's catalogue).
type Triplet = readonly [number | null, number | null, number | null]

const SCA_BUCKET_INDEX: Record<B2BRoastedScaBucket, 0 | 1 | 2> = {
  "80_83": 0,
  "84_86": 1,
  "86_90_PLUS": 2,
}

// ------------------------------------------------------
// FOUNDER REFERENCE TABLE
// ------------------------------------------------------

const B2B_TABLE: Record<AltitudeBucket, Record<SupportedB2BVariety, Triplet>> = {
  1300: {
    CASTILLO:     [17, 22, 28],
    CATURRA:      [18, 24, 31],
    COLOMBIA:     [17, 22, 28],
    TYPICA:       [22, 26, 33],
    BOURBON:      [22, 28, 34],
    PINK_BOURBON: [null, 33, 41],
    GEISHA:       [null, 41, 55],
    TABI:         [22, 26, 34],
  },
  1400: {
    CASTILLO:     [19, 24, 32],
    CATURRA:      [20, 26, 34],
    COLOMBIA:     [19, 24, 30],
    TYPICA:       [24, 28, 35],
    BOURBON:      [24, 30, 38],
    PINK_BOURBON: [null, 35, 43],
    GEISHA:       [null, 44, 60],
    TABI:         [24, 28, 35],
  },
  1500: {
    CASTILLO:     [22, 26, 33],
    CATURRA:      [24, 28, 35],
    COLOMBIA:     [22, 26, 34],
    TYPICA:       [26, 30, 38],
    BOURBON:      [26, 32, 40],
    PINK_BOURBON: [null, 37, 45],
    GEISHA:       [null, 48, 68],
    TABI:         [26, 30, 38],
  },
  1600: {
    CASTILLO:     [24, 28, 38],
    CATURRA:      [25, 30, 40],
    COLOMBIA:     [24, 28, 38],
    TYPICA:       [28, 32, 43],
    BOURBON:      [28, 34, 45],
    PINK_BOURBON: [null, 40, 50],
    GEISHA:       [null, 55, 85],
    TABI:         [28, 32, 43],
  },
  1700: {
    CASTILLO:     [26, 32, 42],
    CATURRA:      [28, 34, 44],
    COLOMBIA:     [26, 32, 42],
    TYPICA:       [30, 36, 48],
    BOURBON:      [30, 38, 51],
    PINK_BOURBON: [null, 44, 57],
    GEISHA:       [null, 63, 110],
    TABI:         [30, 36, 48],
  },
  1800: {
    CASTILLO:     [28, 34, 45],
    CATURRA:      [30, 36, 48],
    COLOMBIA:     [28, 34, 44],
    TYPICA:       [32, 38, 52],
    BOURBON:      [32, 38, 55],
    PINK_BOURBON: [null, 48, 63],
    GEISHA:       [null, 70, 140],
    TABI:         [32, 38, 52],
  },
  1900: {
    CASTILLO:     [30, 36, 49],
    CATURRA:      [32, 38, 52],
    COLOMBIA:     [30, 36, 48],
    TYPICA:       [34, 40, 56],
    BOURBON:      [34, 41, 59],
    PINK_BOURBON: [null, 52, 68],
    GEISHA:       [null, 80, 160],
    TABI:         [34, 40, 56],
  },
  2000: {
    CASTILLO:     [32, 38, 52],
    CATURRA:      [34, 40, 55],
    COLOMBIA:     [32, 38, 52],
    TYPICA:       [36, 42, 62],
    BOURBON:      [36, 43, 68],
    PINK_BOURBON: [null, 55, 75],
    GEISHA:       [null, 100, 200],
    TABI:         [36, 42, 62],
  },
}

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

export function normalizeB2BVariety(value: string): SupportedB2BVariety | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.toUpperCase().replace(/[\s\-]+/g, "_")
  return SUPPORTED_VARIETIES.includes(normalized as SupportedB2BVariety)
    ? (normalized as SupportedB2BVariety)
    : null
}

export function getB2BAltitudeBucket(altitude: number | null): number | null {
  if (altitude == null) return null
  if (typeof altitude !== "number") return null
  if (!Number.isFinite(altitude)) return null
  // Floor at 1300, cap at 2000, otherwise round down to the nearest 100m.
  if (altitude < 1300) return 1300
  if (altitude >= 2000) return 2000
  return Math.floor(altitude / 100) * 100
}

export function getB2BScaBucket(scaScore: number | null): B2BRoastedScaBucket | null {
  if (scaScore == null) return null
  if (typeof scaScore !== "number") return null
  if (!Number.isFinite(scaScore)) return null
  if (scaScore <= 83) return "80_83"
  if (scaScore <= 86) return "84_86"
  return "86_90_PLUS"
}

// ------------------------------------------------------
// MAIN
// ------------------------------------------------------

export function calculateB2BRoastedPricing(
  input: B2BRoastedPricingInput
): B2BRoastedPricingResult {

  const altitudeBucket = getB2BAltitudeBucket(input.altitude)
  const scaBucket = getB2BScaBucket(input.scaScore)
  const normalizedVariety = normalizeB2BVariety(input.variety)

  const breakdown: B2BRoastedPricingBreakdownStep[] = [
    { label: "altitudeRaw",     value: input.altitude },
    { label: "altitudeBucket",  value: altitudeBucket },
    { label: "scaRaw",          value: input.scaScore },
    { label: "scaBucket",       value: scaBucket },
    { label: "varietyRaw",      value: input.variety },
    { label: "varietyResolved", value: normalizedVariety },
  ]

  const baseResult = {
    currency: RESULT_CURRENCY,
    pricingVersion: VERSION,
    source: SOURCE,
    breakdown,
  } as const

  if (altitudeBucket == null) {
    return {
      ...baseResult,
      pricePerKgRoasted: null,
      altitudeBucket: null,
      scaBucket,
      variety: normalizedVariety ?? input.variety,
      fallbackReason: "MISSING_ALTITUDE",
    }
  }

  if (scaBucket == null) {
    return {
      ...baseResult,
      pricePerKgRoasted: null,
      altitudeBucket,
      scaBucket: null,
      variety: normalizedVariety ?? input.variety,
      fallbackReason: "MISSING_SCA",
    }
  }

  if (normalizedVariety == null) {
    return {
      ...baseResult,
      pricePerKgRoasted: null,
      altitudeBucket,
      scaBucket,
      variety: input.variety,
      fallbackReason: "UNSUPPORTED_VARIETY",
    }
  }

  const triplet = B2B_TABLE[altitudeBucket as AltitudeBucket][normalizedVariety]
  const idx = SCA_BUCKET_INDEX[scaBucket]
  const raw = triplet[idx]

  if (raw == null) {
    return {
      ...baseResult,
      breakdown: [...breakdown, { label: "tableCell", value: null }],
      pricePerKgRoasted: null,
      altitudeBucket,
      scaBucket,
      variety: normalizedVariety,
      fallbackReason: "UNAVAILABLE_FOR_SCA_BUCKET",
    }
  }

  const pricePerKgRoasted = Math.round(raw * 100) / 100

  return {
    ...baseResult,
    breakdown: [
      ...breakdown,
      { label: "tableCell", value: raw },
      { label: "pricePerKgRoasted", value: pricePerKgRoasted },
    ],
    pricePerKgRoasted,
    altitudeBucket,
    scaBucket,
    variety: normalizedVariety,
  }
}
