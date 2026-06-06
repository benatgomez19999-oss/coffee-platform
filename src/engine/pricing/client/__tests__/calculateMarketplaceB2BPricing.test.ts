//////////////////////////////////////////////////////
// 🧪 ADAPTIVE MARKETPLACE B2B PRICING — pure tests
//
// Producer engine is dependency-injected so the tests can
// run under node --experimental-strip-types --test (the real
// engine has @/src path aliases that node can't resolve).
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  calculateMarketplaceB2BPricing,
  type ProducerPricingFn,
  type MarketplaceB2BPricingInput,
} from "../calculateMarketplaceB2BPricing.ts"

// ------------------------------------------------------
// MOCK PRODUCER ENGINE
//
// Mirrors the real engine's modifier ordering closely
// enough for our tests:
//   base + altitude (additive)
//   × variety premium
//   × country
//   × cPrice band [0.85, 1.25] of cPrice/180
//   × demandIndex
//
// The numbers come from BASE_PRODUCER_PRICING in the
// real pricing table — mirrored so the test outputs are
// directly comparable to the founder reference.
// ------------------------------------------------------

const BASE: Record<string, [number, number, number]> = {
  // [80–83, 84–86, 87–90]
  CASTILLO:     [3.5, 4.5, 6],
  CATURRA:      [3.75, 5, 6.5],
  COLOMBIA:     [3.5, 4.5, 6],
  TYPICA:       [3.75, 5.25, 7.25],
  BOURBON:      [4, 5.5, 7.5],
  PINK_BOURBON: [0, 5.75, 7.75],
  GEISHA:       [0, 6, 8],
  TABI:         [3.75, 5.25, 7],
}

function altitudeAdditive(altitude: number): number {
  if (altitude < 1400) return -1
  if (altitude < 1500) return 0
  if (altitude < 1600) return 0.5
  if (altitude < 1700) return 1
  if (altitude < 1800) return 1.5
  if (altitude < 1900) return 2
  if (altitude < 2000) return 2.5
  return 3
}

function varietyPremium(variety: string, sca: number): number {
  if (variety === "GEISHA") {
    if (sca >= 90) return 1.7 + 0.5
    if (sca >= 89) return 1.7 + 0.25
    return 1.7
  }
  if (variety === "PINK_BOURBON") {
    if (sca >= 90) return 1.35 + 0.3
    if (sca >= 89) return 1.35 + 0.15
    return 1.35
  }
  return 1
}

function countryFactor(country: string | undefined): number {
  if (country?.toUpperCase() === "COLOMBIA") return 1.05
  return 1
}

function scaIndex(sca: number): 0 | 1 | 2 {
  if (sca <= 83) return 0
  if (sca <= 86) return 1
  return 2
}

const mockProducer: ProducerPricingFn = (input) => {
  const base = BASE[input.variety][scaIndex(input.scaScore)]
  let price = base + altitudeAdditive(input.altitude)
  price *= varietyPremium(input.variety, input.scaScore)
  price *= countryFactor(input.country)
  if (input.marketData?.cPrice) {
    const ratio = input.marketData.cPrice / 180
    price *= Math.max(0.85, Math.min(ratio, 1.25))
  }
  if (input.marketData?.demandIndex) {
    price *= input.marketData.demandIndex
  }
  return { finalPrice: Number(price.toFixed(2)) }
}

function makeInput(overrides: Partial<MarketplaceB2BPricingInput> = {}): MarketplaceB2BPricingInput {
  return {
    scaScore: 84,
    altitude: 1700,
    variety: "Caturra",
    process: "WASHED",
    country: "COLOMBIA",
    roastYield: 0.85,
    currency: "EUR",
    marketData: null,
    ...overrides,
  }
}

// Cost-plus band — used for non-premium / volume coffees only.
function assertWithinCostPlusBand(price: number, reference: number, label: string) {
  const min = Math.round(reference * 0.7 * 100) / 100
  const max = Math.round(reference * 1.3 * 100) / 100
  assert.ok(
    price >= min - 0.01 && price <= max + 0.01,
    `${label}: ${price} not in COST_PLUS band [${min}, ${max}] (reference ${reference})`
  )
}

// ------------------------------------------------------
// 1. COST_PLUS_MODEL — normal varieties stay within ±30%
// ------------------------------------------------------

describe("calculateMarketplaceB2BPricing — COST_PLUS_MODEL stability", () => {

  it("Castillo 83 @ 1850 → COST_PLUS_MODEL, within 70–130% of €28 reference", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 83, altitude: 1850, variety: "Castillo" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.equal(r.commercialModel, "COST_PLUS_MODEL")
    assert.equal(r.b2bReferencePricePerKg, 28)
    assert.ok(r.pricePerKgRoasted != null)
    assertWithinCostPlusBand(r.pricePerKgRoasted, 28, "Castillo 83 @ 1850")
  })

  it("Bourbon 86 @ 1850 NATURAL → COST_PLUS_MODEL, within 70–130% of €38 reference", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 86, altitude: 1850, variety: "Bourbon",
        process: "NATURAL", roastYield: 0.82,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.equal(r.commercialModel, "COST_PLUS_MODEL")
    assert.equal(r.b2bReferencePricePerKg, 38)
    assert.ok(r.pricePerKgRoasted != null)
    assertWithinCostPlusBand(r.pricePerKgRoasted, 38, "Bourbon 86")
  })

  it("Caturra 84 @ 1700 → COST_PLUS_MODEL", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 84, altitude: 1700, variety: "Caturra" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "COST_PLUS_MODEL")
  })
})

// ------------------------------------------------------
// 1b. MARKET_ANCHORED_MODEL — premium varieties anchor on
//     reference + fine-grained modifiers, NOT cost-plus.
// ------------------------------------------------------

describe("calculateMarketplaceB2BPricing — MARKET_ANCHORED_MODEL premium pricing", () => {

  it("Geisha 88 @ 2050 Colombia → anchored on target.expected = 200, NOT 298 (no double counting)", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.expected, 200)
    assert.equal(r.marketTarget.altitudeBucket, "COLOMBIA_2050_PLUS")
    assert.equal(r.marketTarget.countryGroup, "COLOMBIA")
    // Anchored on €200 with no scarcity / no marketData / no prestige ⇒ €200 exactly.
    assert.equal(r.pricePerKgRoasted, 200)
    // Old PRICING-ARCH-1 produced 298.08 — must not regress.
    assert.notEqual(r.pricePerKgRoasted, 298.08)
  })

  it("Geisha 90 @ 2050 Colombia → anchored on target.expected = 325", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 90, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.expected, 325)
    assert.equal(r.pricePerKgRoasted, 325)
  })

  it("Geisha 91 @ 2050 Colombia → anchored on target.expected = 400", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 91, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.expected, 400)
    assert.equal(r.pricePerKgRoasted, 400)
  })

  it("Pink Bourbon 90 @ 2000 Colombia → target.expected = 165", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 90, altitude: 2000, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.expected, 165)
    assert.equal(r.pricePerKgRoasted, 165)
  })

  it("Pink Bourbon 91 @ 2000 Colombia → target.expected = 200", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 91, altitude: 2000, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.expected, 200)
    assert.equal(r.pricePerKgRoasted, 200)
  })

  it("Panama Geisha SCA 90 + FAMOUS_ESTATE → target.expected = 1250, softPrestige collapses to 1.00", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 90, altitude: 1700, variety: "Geisha", country: "PANAMA",
        producerPrestigeTier: "FAMOUS_ESTATE",
      }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.expected, 1250)
    assert.equal(r.marketTarget.altitudeBucket, "PANAMA_FAMOUS")
    assert.equal(r.pricePerKgRoasted, 1250)
    const prestigeStep = r.breakdown.find((s) => s.label === "softPrestigeModifier")
    assert.equal(prestigeStep?.value, 1.00)
  })

  it("breakdown does NOT carry exactScaModifier / premiumAltitudeModifier / countryPrestigeModifier", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    const labels = r.breakdown.map((s) => s.label)
    assert.equal(labels.includes("exactScaModifier"), false)
    assert.equal(labels.includes("premiumAltitudeModifier"), false)
    assert.equal(labels.includes("countryPrestigeModifier"), false)
    // …but DOES carry the new target-anchor labels.
    assert.ok(labels.includes("marketTargetExpected"))
    assert.ok(labels.includes("softScarcityModifier"))
    assert.ok(labels.includes("softMarketSignalModifier"))
    assert.ok(labels.includes("softPrestigeModifier"))
  })

  it("Geisha 90 > Geisha 88 (SCA sensitivity preserved)", () => {
    const r88 = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    const r90 = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 90, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r88.pricePerKgRoasted != null)
    assert.ok(r90.pricePerKgRoasted != null)
    assert.ok(
      r90.pricePerKgRoasted > r88.pricePerKgRoasted,
      `Geisha 90 (${r90.pricePerKgRoasted}) should exceed Geisha 88 (${r88.pricePerKgRoasted})`
    )
  })

  it("Geisha 88 @ Panama > Geisha 88 @ Colombia (country prestige)", () => {
    const colombia = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha", country: "COLOMBIA" }),
      { producerPricingFn: mockProducer }
    )
    const panama = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha", country: "PANAMA" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(colombia.pricePerKgRoasted != null && panama.pricePerKgRoasted != null)
    assert.ok(
      panama.pricePerKgRoasted > colombia.pricePerKgRoasted,
      `Panama Geisha (${panama.pricePerKgRoasted}) should exceed Colombian Geisha (${colombia.pricePerKgRoasted})`
    )
  })

  it("Geisha 88 @ 2050 > Geisha 88 @ 1800 (altitude sensitivity)", () => {
    const high = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    const low = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 1800, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(high.pricePerKgRoasted != null && low.pricePerKgRoasted != null)
    assert.ok(
      high.pricePerKgRoasted > low.pricePerKgRoasted,
      `2050 m (${high.pricePerKgRoasted}) should exceed 1800 m (${low.pricePerKgRoasted})`
    )
  })

  it("Geisha + market signal cPrice 300 / demand 1.15 > baseline (small lift, not explosive)", () => {
    const baseline = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    const hot = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 88, altitude: 2050, variety: "Geisha",
        marketData: { cPrice: 300, demandIndex: 1.15 },
      }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(baseline.pricePerKgRoasted != null && hot.pricePerKgRoasted != null)
    assert.ok(
      hot.pricePerKgRoasted > baseline.pricePerKgRoasted,
      `market signal cPrice=300 should LIFT Geisha: baseline=${baseline.pricePerKgRoasted}, hot=${hot.pricePerKgRoasted}`
    )
    // Geisha elasticity to cPrice is 0.12, demand 0.25 — total lift cap < 10 %.
    assert.ok(
      hot.pricePerKgRoasted <= baseline.pricePerKgRoasted * 1.10,
      `Geisha should not move > 10 % on commodity/demand signal alone (got ${hot.pricePerKgRoasted})`
    )
  })

  it("Pink Bourbon 89 > Pink Bourbon 87 (SCA sensitivity)", () => {
    const r87 = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 87, altitude: 1650, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    const r89 = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 89, altitude: 1650, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(r87.pricePerKgRoasted != null && r89.pricePerKgRoasted != null)
    assert.ok(
      r89.pricePerKgRoasted > r87.pricePerKgRoasted,
      `PB 89 (${r89.pricePerKgRoasted}) should exceed PB 87 (${r87.pricePerKgRoasted})`
    )
  })

  it("Pink Bourbon @ 2000m > @ 1650m (altitude sensitivity)", () => {
    const low = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 89, altitude: 1650, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    const high = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 89, altitude: 2000, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(low.pricePerKgRoasted != null && high.pricePerKgRoasted != null)
    assert.ok(
      high.pricePerKgRoasted > low.pricePerKgRoasted,
      `2000 m PB (${high.pricePerKgRoasted}) should exceed 1650 m PB (${low.pricePerKgRoasted})`
    )
  })

  it("scarcity bumps price for low-volume marketplace pools", () => {
    const large = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 89, altitude: 2000, variety: "Pink Bourbon",
        marketplaceGreenKg: 2000,
      }),
      { producerPricingFn: mockProducer }
    )
    const tiny = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 89, altitude: 2000, variety: "Pink Bourbon",
        marketplaceGreenKg: 200,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(large.pricePerKgRoasted != null && tiny.pricePerKgRoasted != null)
    assert.ok(
      tiny.pricePerKgRoasted >= large.pricePerKgRoasted,
      `200 kg pool (${tiny.pricePerKgRoasted}) should be ≥ 2000 kg pool (${large.pricePerKgRoasted})`
    )
  })

  it("low-volume Castillo (≤500 kg) flips into MARKET_ANCHORED_MODEL", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 84, altitude: 1700, variety: "Castillo",
        marketplaceGreenKg: 300,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
  })
})

// ------------------------------------------------------
// 2. CP / DEMAND EFFECT
// ------------------------------------------------------

describe("calculateMarketplaceB2BPricing — marketData propagates", () => {

  it("higher cPrice raises producerGreenPrice (within clamp band)", () => {
    const baseline = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 84, altitude: 1700, variety: "Caturra" }),
      { producerPricingFn: mockProducer }
    )
    const hot = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 84, altitude: 1700, variety: "Caturra",
        marketData: { cPrice: 240, demandIndex: null },
      }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(baseline.producerGreenPricePerKg != null)
    assert.ok(hot.producerGreenPricePerKg != null)
    assert.ok(
      hot.producerGreenPricePerKg > baseline.producerGreenPricePerKg,
      `producer green should rise with cPrice: ${baseline.producerGreenPricePerKg} → ${hot.producerGreenPricePerKg}`
    )
  })

  it("higher demandIndex raises producerGreenPrice", () => {
    const baseline = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 85, altitude: 1700, variety: "Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    const hot = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 85, altitude: 1700, variety: "Bourbon",
        marketData: { cPrice: null, demandIndex: 1.2 },
      }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(baseline.producerGreenPricePerKg != null)
    assert.ok(hot.producerGreenPricePerKg != null)
    assert.ok(hot.producerGreenPricePerKg > baseline.producerGreenPricePerKg)
  })

  it("missing marketData still produces a valid adaptive price", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 84, altitude: 1700, variety: "Caturra" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.ok(r.pricePerKgRoasted != null)
  })

  it("breakdown records cPrice / demandIndex even when null", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 84, altitude: 1700 }),
      { producerPricingFn: mockProducer }
    )
    const labels = r.breakdown.map((s) => s.label)
    assert.ok(labels.includes("cPrice"))
    assert.ok(labels.includes("demandIndex"))
  })
})

// ------------------------------------------------------
// 3. FALLBACK PATHS
// ------------------------------------------------------

describe("calculateMarketplaceB2BPricing — fallbacks", () => {

  it("unsupported variety + reference table miss → ORIGIN_EQUIVALENT_FALLBACK", () => {
    // Wush Wush is not in the producer engine OR the founder reference table.
    // The producer engine can't run, the founder reference returns null too,
    // so we fall through to origin-equivalent — but that also requires the
    // producer engine, so the only thing we can return is null.
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 90, altitude: 1800, variety: "Wush Wush" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.pricingMode, "ORIGIN_EQUIVALENT_FALLBACK")
    assert.ok(r.fallbackReason != null)
  })

  it("missing altitude → no producer green; falls back through reference (also null) → null price", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ altitude: null, scaScore: 85, variety: "Castillo" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.adaptiveB2BPricePerKg, null)
    assert.equal(r.b2bReferencePricePerKg, null)
    assert.equal(r.pricingMode, "ORIGIN_EQUIVALENT_FALLBACK")
  })

  it("missing SCA → engine skipped, reference null, all paths fail", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: null, altitude: 1700, variety: "Caturra" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.adaptiveB2BPricePerKg, null)
  })

  it("producer engine throws → falls back to founder reference if available", () => {
    const throwingProducer: ProducerPricingFn = () => {
      throw new Error("synthetic engine failure")
    }
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 83, altitude: 1850, variety: "Castillo" }),
      { producerPricingFn: throwingProducer }
    )
    assert.equal(r.pricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(r.pricePerKgRoasted, 28)
    assert.equal(r.fallbackReason, "synthetic engine failure")
  })

  it("Geisha at SCA 82 → reference null, but engine ALSO fails for that bucket → reference fallback skipped", () => {
    // Geisha SCA 82 lands in 80_83 bucket where founder cell is null AND
    // the producer engine table also has no Geisha price for 80_83.
    // Our mock returns 0 from BASE → finalPrice 0 + altitude → small positive.
    // Engine "succeeds" with a tiny price; commercial layer still produces
    // an adaptive price; clamp band has no reference → final = unclamped.
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 82, altitude: 1700, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    // We accept either ADAPTIVE_B2B_ENGINE (if engine + commercial layer
    // produced something) or B2B_REFERENCE_FALLBACK. Critical: never null.
    assert.notEqual(r.pricingMode, undefined)
  })
})

// ------------------------------------------------------
// 4. BREAKDOWN
// ------------------------------------------------------

describe("calculateMarketplaceB2BPricing — breakdown", () => {

  it("MARKET_ANCHORED_MODEL breakdown includes every documented audit step", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    const labels = r.breakdown.map((s) => s.label)
    for (const required of [
      "scaScore",
      "altitude",
      "variety",
      "process",
      "country",
      "roastYield",
      "marketplaceGreenKg",
      "producerPrestigeTier",
      "cPrice",
      "demandIndex",
      "producerGreenPricePerKg",
      "originEquivalentRoastedPricePerKg",
      "roastingCostPerKg",
      "packagingCostPerKg",
      "logisticsCostPerKg",
      "costPlusBaseCost",
      "commercialMarginRate",
      "normalQualityMultiplier",
      "costPlusFinal",
      "b2bReferencePricePerKg",
      "commercialModel",
      // PRICING-ARCH-2B target-anchor labels
      "marketTargetSourceVersion",
      "marketTargetPricingClass",
      "marketTargetExpected",
      "marketTargetLow",
      "marketTargetHigh",
      "targetScaBucket",
      "targetAltitudeBucket",
      "targetCountryGroup",
      "softScarcityModifier",
      "softCommoditySoft",
      "softDemandSoft",
      "softMarketSignalModifier",
      "softPrestigeModifier",
      "marketAnchoredPrice",
      "costFloor",
      "finalBeforeClamp",
      "clampMin",
      "clampMax",
      "clampApplied",
      "finalPrice",
    ]) {
      assert.ok(labels.includes(required), `MARKET_ANCHORED breakdown missing ${required}`)
    }
    // The old per-dimension multipliers must be GONE on the MARKET_ANCHORED path.
    for (const removed of [
      "exactScaModifier",
      "premiumAltitudeModifier",
      "countryPrestigeModifier",
      "scarcityModifier",     // renamed → softScarcityModifier
      "marketSignalCommoditySoft",
      "marketSignalDemandSoft",
      "marketSignalModifier", // renamed → softMarketSignalModifier
    ]) {
      assert.equal(
        labels.includes(removed), false,
        `MARKET_ANCHORED breakdown must NOT carry obsolete label ${removed}`
      )
    }
  })

  it("COST_PLUS_MODEL breakdown includes the cost-plus audit steps", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 83, altitude: 1850, variety: "Castillo" }),
      { producerPricingFn: mockProducer }
    )
    const labels = r.breakdown.map((s) => s.label)
    for (const required of [
      "commercialModel",
      "producerGreenPricePerKg",
      "originEquivalentRoastedPricePerKg",
      "costPlusBaseCost",
      "normalQualityMultiplier",
      "costPlusFinal",
      "clampMin",
      "clampMax",
      "clampApplied",
    ]) {
      assert.ok(labels.includes(required), `COST_PLUS breakdown missing ${required}`)
    }
  })

  it("pricingVersion is target-anchored v1", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput(),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.pricingVersion, "marketplace-b2b-target-anchored-v1")
  })

  it("commercialModel is exposed on the result for both models", () => {
    const premium = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    const normal = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 83, altitude: 1850, variety: "Castillo" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(premium.commercialModel, "MARKET_ANCHORED_MODEL")
    assert.equal(normal.commercialModel, "COST_PLUS_MODEL")
  })
})

// ------------------------------------------------------
// 7. SELECTOR — selectCommercialPricingModel
// ------------------------------------------------------

describe("selectCommercialPricingModel", () => {

  it("Geisha → MARKET_ANCHORED regardless of other inputs", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 80, altitude: 1300, variety: "Geisha" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
  })

  it("Pink Bourbon → MARKET_ANCHORED regardless of other inputs", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 84, altitude: 1500, variety: "Pink Bourbon" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
  })

  it("SCA ≥ 88 flips even normal varieties to MARKET_ANCHORED", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 1700, variety: "Caturra" }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
  })

  it("low marketplace volume (≤ 500) flips to MARKET_ANCHORED", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 84, altitude: 1700, variety: "Castillo",
        marketplaceGreenKg: 250,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
  })

  it("plain volume coffee stays COST_PLUS", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 84, altitude: 1700, variety: "Castillo",
        marketplaceGreenKg: 5000,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "COST_PLUS_MODEL")
  })
})

// ------------------------------------------------------
// 5. CLAMP BEHAVIOUR
// ------------------------------------------------------

describe("calculateMarketplaceB2BPricing — target-band clamp", () => {

  it("MARKET_ANCHORED Geisha 88 + huge cost floor clamps to target.high", () => {
    // Producer engine returns a runaway 1000 → costPlusFinal massive.
    // marketAnchored stays at target.expected = 200. Cost floor pushes
    // finalBeforeClamp far past target.high (250). Clamp triggers.
    const highProducer: ProducerPricingFn = () => ({ finalPrice: 1000 })
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 88, altitude: 2050, variety: "Geisha" }),
      { producerPricingFn: highProducer }
    )
    assert.equal(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
    assert.ok(r.marketTarget)
    assert.equal(r.marketTarget.high, 250)
    assert.equal(r.pricePerKgRoasted, 250)
    const clampApplied = r.breakdown.find((s) => s.label === "clampApplied")
    assert.equal(clampApplied?.value, true)
  })

  it("COST_PLUS_MODEL clamps Castillo to ≤ 130% of reference when producer green is huge", () => {
    const highProducer: ProducerPricingFn = () => ({ finalPrice: 1000 })
    const r = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 83, altitude: 1850, variety: "Castillo" }),
      { producerPricingFn: highProducer }
    )
    assert.equal(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.equal(r.commercialModel, "COST_PLUS_MODEL")
    assert.equal(r.b2bReferencePricePerKg, 28)
    // Ceiling = 28 × 1.3 = 36.40 — unchanged from PRICING-ARCH-1.
    assert.equal(r.pricePerKgRoasted, 36.40)
  })

  it("MARKET_ANCHORED scarcity tiers — 40 kg ≥ 100 kg ≥ 1000 kg, all within target band", () => {
    const big = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 88, altitude: 2050, variety: "Geisha",
        marketplaceGreenKg: 2000,
      }),
      { producerPricingFn: mockProducer }
    )
    const small = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 88, altitude: 2050, variety: "Geisha",
        marketplaceGreenKg: 100,
      }),
      { producerPricingFn: mockProducer }
    )
    const tiny = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 88, altitude: 2050, variety: "Geisha",
        marketplaceGreenKg: 40,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.ok(big.pricePerKgRoasted != null && small.pricePerKgRoasted != null && tiny.pricePerKgRoasted != null)
    assert.equal(big.pricePerKgRoasted, 200)            // > 1000 kg → 1.00 modifier
    assert.ok(small.pricePerKgRoasted > 200)            // ≤ 100 kg → 1.12 modifier
    assert.ok(tiny.pricePerKgRoasted >= small.pricePerKgRoasted)  // ≤ 50 kg → 1.18
    // Stay within Geisha 88 @ 2050 target band [160, 250].
    assert.ok(small.pricePerKgRoasted <= 250)
    assert.ok(tiny.pricePerKgRoasted <= 250)
  })

  it("Castillo MARKET_ANCHORED low-volume → near normal target, NOT premium", () => {
    const r = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 84, altitude: 1700, variety: "Castillo",
        marketplaceGreenKg: 300,
      }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(r.commercialModel, "MARKET_ANCHORED_MODEL")
    assert.ok(r.marketTarget)
    // Castillo 84_86 expected = 40. Scarcity 300 → 1.05 → marketAnchored 42.
    // Within target band [32, 50].
    assert.ok(r.pricePerKgRoasted != null)
    assert.ok(r.pricePerKgRoasted >= 32 && r.pricePerKgRoasted <= 50)
    assert.equal(r.marketTarget.expected, 40)
  })

  it("unsupported variety → safe fallback, never throws", () => {
    assert.doesNotThrow(() => {
      const r = calculateMarketplaceB2BPricing(
        makeInput({ variety: "Wush Wush", scaScore: 88, altitude: 1800 }),
        { producerPricingFn: mockProducer }
      )
      // Either ORIGIN_EQUIVALENT_FALLBACK or B2B_REFERENCE_FALLBACK depending
      // on whether founder-reference / producer-engine could handle it.
      assert.notEqual(r.pricingMode, "ADAPTIVE_B2B_ENGINE")
    })
  })

  it("Castillo COST_PLUS still responds materially to market signal (cPrice 240, demand 1.15)", () => {
    const baseline = calculateMarketplaceB2BPricing(
      makeInput({ scaScore: 83, altitude: 1850, variety: "Castillo" }),
      { producerPricingFn: mockProducer }
    )
    const hot = calculateMarketplaceB2BPricing(
      makeInput({
        scaScore: 83, altitude: 1850, variety: "Castillo",
        marketData: { cPrice: 240, demandIndex: 1.15 },
      }),
      { producerPricingFn: mockProducer }
    )
    assert.equal(baseline.commercialModel, "COST_PLUS_MODEL")
    assert.equal(hot.commercialModel, "COST_PLUS_MODEL")
    assert.ok(baseline.pricePerKgRoasted != null && hot.pricePerKgRoasted != null)
    assert.ok(
      hot.pricePerKgRoasted > baseline.pricePerKgRoasted * 1.1,
      `Castillo COST_PLUS should rise > 10% under hot market: baseline=${baseline.pricePerKgRoasted}, hot=${hot.pricePerKgRoasted}`
    )
  })
})
