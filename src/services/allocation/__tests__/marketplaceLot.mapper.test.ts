//////////////////////////////////////////////////////
// 🧪 MARKETPLACE LOT MAPPER — UNIT TESTS
//
// Exercises mapDecisionToMarketplaceLot, sortMarketplaceLots,
// computeMarketplaceMetrics and computeMarketplaceInsights
// without touching Prisma or the snapshot service.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  computeMarketplaceInsights,
  computeMarketplaceMetrics,
  mapDecisionToMarketplaceLot,
  sortMarketplaceLots,
  stripBracketedPrefix,
  type MarketplaceLotDto,
} from "../marketplace/marketplaceLot.mapper.ts"
import type {
  AllocationReason,
  AllocationSurface,
  LotAllocationDecision,
  LotAllocationSnapshot,
} from "../domain/types.ts"

// ------------------------------------------------------
// FIXTURE BUILDERS
// ------------------------------------------------------

function makeSnapshot(
  overrides: Partial<LotAllocationSnapshot> = {}
): LotAllocationSnapshot {
  return {
    greenLotId: "lot-1",
    lotNumber: "LN-0001",
    status: "PUBLISHED",
    totalGreenKg: 1000,
    availableGreenKg: 1000,
    scaScore: 87,
    variety: "Caturra",
    process: "WASHED",
    harvestYear: 2026,
    estimatedRoastYield: 0.85,
    usedDefaultRoastYield: false,
    greenPricePerKg: 7.5,
    farmId: "farm-1",
    farmRegion: "Huila",
    farmAltitude: 1700,
    producerCountry: "Colombia",
    committedContractGreenKg: 0,
    committedContractMonthsRemaining: 0,
    reservedIntentGreenKg: 0,
    shipmentId: null,
    marketDemandIndex: null,

    name: "Finca Los Andes Caturra",
    producerName: "María González",
    farmName: "Finca Los Andes",
    createdAt: new Date().toISOString(),
    currency: "USD",
    ...overrides,
  }
}

function makeDecision(
  overrides: Partial<LotAllocationDecision> = {}
): LotAllocationDecision {
  return {
    greenLotId: "lot-1",
    lotNumber: "LN-0001",
    totalGreenKg: 1000,
    availableGreenKg: 1000,
    committedContractGreenKg: 0,
    reservedIntentGreenKg: 0,
    safetyBufferGreenKg: 0,
    contractReservedGreenKg: 0,
    contractAssignableGreenKg: 0,
    marketplaceEligibleGreenKg: 1000,
    exclusiveMicrolotGreenKg: 0,
    blockedGreenKg: 0,
    recommendedSurface: "OPEN_MARKETPLACE",
    viableProfiles: [],
    reasons: [],
    confidence: 0.85,
    policyVersion: "allocation-policy-v0",
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ------------------------------------------------------
// PRICING-B2B-3 — persisted client B2B price priority
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — PRICING-B2B-3", () => {
  it("uses persisted clientB2BPricePerKg as roastedPricePerKg when present (no engine path)", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ clientB2BPricePerKg: 32.5 }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.roastedPricePerKg, 32.5)
    assert.equal(dto.clientB2BPricePerKg, 32.5)
    assert.equal(dto.pricingSource, "PERSISTED_CLIENT_B2B")
  })

  it("falls back to ADAPTIVE_RECOMPUTE_FALLBACK source when no persisted price", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ clientB2BPricePerKg: null }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.clientB2BPricePerKg, null)
    // Without injected engine the path falls through to legacy origin-equivalent.
    assert.ok(
      dto.pricingSource === "LEGACY_ORIGIN_EQUIVALENT_FALLBACK" ||
      dto.pricingSource === "ADAPTIVE_RECOMPUTE_FALLBACK"
    )
  })

  it("ignores zero/negative persisted B2B and falls back", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ clientB2BPricePerKg: 0 }),
      makeDecision()
    )
    assert.ok(dto)
    assert.notEqual(dto.pricingSource, "PERSISTED_CLIENT_B2B")
  })
})

// ------------------------------------------------------
// 1. OPEN_MARKETPLACE → DTO
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — OPEN_MARKETPLACE", () => {
  it("maps marketplaceEligibleGreenKg into both green and roasted display kg", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ estimatedRoastYield: 0.85 }),
      makeDecision({
        recommendedSurface: "OPEN_MARKETPLACE",
        marketplaceEligibleGreenKg: 750,
        exclusiveMicrolotGreenKg: 0,
      })
    )
    assert.ok(dto)
    assert.equal(dto.marketplaceGreenKg, 750)
    assert.equal(dto.marketplaceRoastedKg, 637.5)   // 750 × 0.85
    assert.equal(dto.recommendedSurface, "OPEN_MARKETPLACE")
    assert.equal(dto.isExclusive, false)
    assert.ok(dto.allocation.marketplaceEligibleGreenKg === 750)
  })

  it("propagates farmAltitude from snapshot to dto.altitude", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ farmAltitude: 2050 }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.altitude, 2050)
  })

  it("dto.altitude is null when snapshot.farmAltitude is null", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ farmAltitude: null }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.altitude, null)
  })

  it("uses lot.name when present, builds composite otherwise", () => {
    const a = mapDecisionToMarketplaceLot(
      makeSnapshot({ name: "Special Bourbon Lot" }),
      makeDecision()
    )
    assert.equal(a?.name, "Special Bourbon Lot")

    const b = mapDecisionToMarketplaceLot(
      makeSnapshot({
        name: null,
        farmName: "Finca El Sol",
        variety: "Bourbon",
        process: "NATURAL",
      }),
      makeDecision()
    )
    assert.equal(b?.name, "Finca El Sol Bourbon Natural")

    const c = mapDecisionToMarketplaceLot(
      makeSnapshot({
        name: null,
        farmName: null,
        variety: "Caturra",
      }),
      makeDecision()
    )
    assert.equal(c?.name, "LN-0001")
  })
})

// ------------------------------------------------------
// 2. EXCLUSIVE_MICROLOT → DTO
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — EXCLUSIVE_MICROLOT", () => {
  it("uses exclusiveMicrolotGreenKg as marketplaceGreenKg, roasted derived via yield", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ scaScore: 91, variety: "Geisha", estimatedRoastYield: 0.85 }),
      makeDecision({
        recommendedSurface: "EXCLUSIVE_MICROLOT",
        marketplaceEligibleGreenKg: 0,
        exclusiveMicrolotGreenKg: 400,
      })
    )
    assert.ok(dto)
    assert.equal(dto.recommendedSurface, "EXCLUSIVE_MICROLOT")
    assert.equal(dto.marketplaceGreenKg, 400)
    assert.equal(dto.marketplaceRoastedKg, 340)    // 400 × 0.85
    assert.equal(dto.isExclusive, true)
    assert.ok(dto.badges.includes("exclusive-microlot"))
    assert.equal(dto.badgeLabel, "Exclusive microlot")
    assert.equal(dto.badgeTone, "gold")
  })
})

// ------------------------------------------------------
// 3. SPLIT → DTO  (only marketplace residual exposed)
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — SPLIT", () => {
  it("exposes marketplace residual only, never contract assignable", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ estimatedRoastYield: 0.85 }),
      makeDecision({
        recommendedSurface: "SPLIT",
        marketplaceEligibleGreenKg: 500,
        exclusiveMicrolotGreenKg: 0,
        contractAssignableGreenKg: 4000,    // must NOT leak
        contractReservedGreenKg: 1200,      // must NOT leak
      })
    )
    assert.ok(dto)
    assert.equal(dto.marketplaceGreenKg, 500)
    assert.equal(dto.marketplaceRoastedKg, 425)   // 500 × 0.85
    // The DTO's allocation object only carries marketplace + exclusive figures.
    assert.equal(dto.allocation.marketplaceEligibleGreenKg, 500)
    assert.equal(dto.allocation.exclusiveMicrolotGreenKg, 0)
    // Confirm contract-related fields are not on the DTO at all.
    assert.equal(
      Object.prototype.hasOwnProperty.call(dto.allocation, "contractAssignableGreenKg"),
      false
    )
  })
})

// ------------------------------------------------------
// 4. FILTER — non-marketplace surfaces and zero-volume
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — filter", () => {
  it("returns null for CONTRACT_CATALOG", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot(),
      makeDecision({
        recommendedSurface: "CONTRACT_CATALOG",
        marketplaceEligibleGreenKg: 0,
        exclusiveMicrolotGreenKg: 0,
      })
    )
    assert.equal(dto, null)
  })

  it("returns null for HOLD even if marketplace kg is non-zero", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot(),
      makeDecision({
        recommendedSurface: "HOLD",
        marketplaceEligibleGreenKg: 100,
      })
    )
    assert.equal(dto, null)
  })

  const nonMarketSurfaces: AllocationSurface[] = ["CONTRACT_CATALOG", "HOLD"]
  for (const s of nonMarketSurfaces) {
    it(`returns null for surface ${s}`, () => {
      const dto = mapDecisionToMarketplaceLot(
        makeSnapshot(),
        makeDecision({ recommendedSurface: s, marketplaceEligibleGreenKg: 0, exclusiveMicrolotGreenKg: 0 })
      )
      assert.equal(dto, null)
    })
  }

  it("returns null when both pools are zero", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot(),
      makeDecision({
        recommendedSurface: "OPEN_MARKETPLACE",
        marketplaceEligibleGreenKg: 0,
        exclusiveMicrolotGreenKg: 0,
      })
    )
    assert.equal(dto, null)
  })
})

// ------------------------------------------------------
// 4b. PRICING — roasted derived from green via roast yield
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — pricing (origin-equivalent + B2B)", () => {

  it("originEquivalentRoastedPricePerKg = greenPricePerKg / roastYield", () => {
    // Use a snapshot whose (variety, SCA, altitude) is NOT in the B2B
    // table so the origin-equivalent path is the one driving the
    // displayed price — easier to assert in isolation.
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Wush Wush",   // unsupported by B2B engine
        greenPricePerKg: 6.8,
        estimatedRoastYield: 0.85,
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.greenPricePerKg, 6.8)
    assert.equal(dto.originEquivalentRoastedPricePerKg, 8)   // 6.8 / 0.85
    assert.equal(dto.b2bReferencePricePerKg, null)
    assert.equal(dto.roastedPricePerKg, 8)                    // fallback wins
    assert.equal(dto.pricingMode, "ORIGIN_EQUIVALENT_FALLBACK")
    assert.equal(dto.pricingReference.fallbackReason, "UNSUPPORTED_VARIETY")
    assert.equal(dto.roastYield, 0.85)
  })

  it("respects the 0.5 yield floor on the origin-equivalent path", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Wush Wush",      // forces fallback path
        greenPricePerKg: 5,
        estimatedRoastYield: 0.1,
      }),
      makeDecision()
    )
    assert.ok(dto)
    // Floor kicks in at 0.5 — 5 / 0.5 = 10
    assert.equal(dto.originEquivalentRoastedPricePerKg, 10)
    assert.equal(dto.roastedPricePerKg, 10)
  })

  it("returns null on both paths when green price is missing AND B2B unavailable", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Wush Wush", greenPricePerKg: null }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.greenPricePerKg, null)
    assert.equal(dto.originEquivalentRoastedPricePerKg, null)
    assert.equal(dto.b2bReferencePricePerKg, null)
    assert.equal(dto.roastedPricePerKg, null)
  })

  it("uses the founder B2B table when (altitude, variety, SCA) lookup hits", () => {
    // Castillo SCA 83 @ 1850 m → bucket 1800 / 80_83 → €28/kg roasted.
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Castillo",
        scaScore: 83,
        farmAltitude: 1850,
        greenPricePerKg: 5.78,    // origin-equivalent would be ~6.80
        estimatedRoastYield: 0.85,
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.b2bReferencePricePerKg, 28)
    assert.equal(dto.roastedPricePerKg, 28)
    assert.equal(dto.pricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(dto.pricingReference.altitudeBucket, 1800)
    assert.equal(dto.pricingReference.scaBucket, "80_83")
    assert.equal(dto.pricingReference.pricingVersion, "b2b-roasted-reference-v0")
    assert.equal(dto.pricingReference.source, "founder-reference-table")
    assert.equal(dto.pricingReference.fallbackReason, undefined)
    // Origin-equivalent must still be exposed for audit.
    assert.ok(typeof dto.originEquivalentRoastedPricePerKg === "number")
  })

  it("preserves origin-equivalent even when B2B price is shown", () => {
    // Geisha 88 @ 2050 → bucket 2000 / 86_90_PLUS → €200/kg roasted.
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Geisha",
        scaScore: 88,
        farmAltitude: 2050,
        greenPricePerKg: 19.64,
        estimatedRoastYield: 0.85,
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.b2bReferencePricePerKg, 200)
    assert.equal(dto.roastedPricePerKg, 200)
    assert.equal(dto.pricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(dto.originEquivalentRoastedPricePerKg, 23.11) // 19.64 / 0.85
  })

  it("falls back to origin-equivalent when B2B cell is null (Geisha at low SCA)", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Geisha",
        scaScore: 82,             // 80_83 bucket has no Geisha cell
        farmAltitude: 1800,
        greenPricePerKg: 7.5,
        estimatedRoastYield: 0.85,
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.b2bReferencePricePerKg, null)
    assert.equal(dto.pricingMode, "ORIGIN_EQUIVALENT_FALLBACK")
    assert.equal(dto.pricingReference.fallbackReason, "UNAVAILABLE_FOR_SCA_BUCKET")
    assert.equal(dto.originEquivalentRoastedPricePerKg, 8.82) // 7.5 / 0.85
    assert.equal(dto.roastedPricePerKg, 8.82)
  })

  it("currency is EUR on B2B path regardless of snapshot currency", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Castillo",
        scaScore: 83,
        farmAltitude: 1850,
        currency: "USD",
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.pricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(dto.currency, "EUR")
  })

  it("currency follows the snapshot when on origin-equivalent fallback path", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Wush Wush", currency: "USD" }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.pricingMode, "ORIGIN_EQUIVALENT_FALLBACK")
    assert.equal(dto.currency, "USD")
  })
})

// ------------------------------------------------------
// 5. VISUAL — gradientKey is deterministic
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — visual", () => {
  it("imageUrl is null in v0 (no real images yet)", () => {
    const dto = mapDecisionToMarketplaceLot(makeSnapshot(), makeDecision())
    assert.ok(dto)
    assert.equal(dto.visual.imageUrl, null)
  })

  it("known producer countries map to a stable visual tone", () => {
    const a = mapDecisionToMarketplaceLot(
      makeSnapshot({ producerCountry: "Colombia" }),
      makeDecision()
    )
    const b = mapDecisionToMarketplaceLot(
      makeSnapshot({ producerCountry: "Colombia", lotNumber: "LN-9999" }),
      makeDecision({ lotNumber: "LN-9999" })
    )
    assert.ok(a)
    assert.ok(b)
    assert.equal(a.visual.gradientKey, "sunrise")
    assert.equal(b.visual.gradientKey, "sunrise")
  })

  it("unknown countries fall back to a stable hash on lotNumber", () => {
    const a = mapDecisionToMarketplaceLot(
      makeSnapshot({ producerCountry: "Atlantis", lotNumber: "LN-0042" }),
      makeDecision({ lotNumber: "LN-0042" })
    )
    const b = mapDecisionToMarketplaceLot(
      makeSnapshot({ producerCountry: "Atlantis", lotNumber: "LN-0042" }),
      makeDecision({ lotNumber: "LN-0042" })
    )
    assert.ok(a)
    assert.ok(b)
    assert.equal(a.visual.gradientKey, b.visual.gradientKey)
  })
})

// ------------------------------------------------------
// 6. METRICS
// ------------------------------------------------------

describe("computeMarketplaceMetrics", () => {
  function dto(overrides: Partial<MarketplaceLotDto>): MarketplaceLotDto {
    const base = mapDecisionToMarketplaceLot(makeSnapshot(), makeDecision())!
    return { ...base, ...overrides }
  }

  it("counts lots, computes avg SCA, counts origins, counts fresh arrivals", () => {
    const lots: MarketplaceLotDto[] = [
      dto({ id: "a", scaScore: 86, country: "Colombia", isFreshArrival: true }),
      dto({ id: "b", scaScore: 88, country: "Ethiopia", isFreshArrival: true }),
      dto({ id: "c", scaScore: null, country: "Ethiopia", isFreshArrival: false }),
    ]
    const m = computeMarketplaceMetrics(lots)
    assert.equal(m.availableLots, 3)
    assert.equal(m.avgScaScore, 87)             // (86+88)/2 = 87
    assert.equal(m.origins, 2)                   // Colombia, Ethiopia
    assert.equal(m.freshArrivals, 2)
  })

  it("avgScaScore is null when no lot has a score", () => {
    const lots: MarketplaceLotDto[] = [
      dto({ id: "a", scaScore: null }),
      dto({ id: "b", scaScore: null }),
    ]
    const m = computeMarketplaceMetrics(lots)
    assert.equal(m.avgScaScore, null)
  })

  it("does not count Unknown country toward origins", () => {
    const lots: MarketplaceLotDto[] = [
      dto({ id: "a", country: "Unknown" }),
      dto({ id: "b", country: "Unknown" }),
    ]
    const m = computeMarketplaceMetrics(lots)
    assert.equal(m.origins, 0)
  })
})

// ------------------------------------------------------
// 7. INSIGHTS
// ------------------------------------------------------

describe("computeMarketplaceInsights", () => {
  function dto(overrides: Partial<MarketplaceLotDto>): MarketplaceLotDto {
    const base = mapDecisionToMarketplaceLot(makeSnapshot(), makeDecision())!
    return { ...base, ...overrides }
  }

  it("groups marketplace volume by country and computes percentages", () => {
    const lots: MarketplaceLotDto[] = [
      dto({ id: "a", country: "Colombia", marketplaceRoastedKg: 600 }),
      dto({ id: "b", country: "Colombia", marketplaceRoastedKg: 200 }),
      dto({ id: "c", country: "Ethiopia", marketplaceRoastedKg: 200 }),
    ]
    const ins = computeMarketplaceInsights(lots)

    assert.equal(ins.topOriginsByVolume.length, 2)
    const colombia = ins.topOriginsByVolume[0]
    assert.equal(colombia.label, "Colombia")
    assert.equal(colombia.volumeKg, 800)
    assert.equal(colombia.percentage, 80)
    const ethiopia = ins.topOriginsByVolume[1]
    assert.equal(ethiopia.label, "Ethiopia")
    assert.equal(ethiopia.volumeKg, 200)
    assert.equal(ethiopia.percentage, 20)
  })

  it("freshArrivalsByOrigin counts only fresh lots", () => {
    const lots: MarketplaceLotDto[] = [
      dto({ id: "a", country: "Colombia", isFreshArrival: true }),
      dto({ id: "b", country: "Colombia", isFreshArrival: false }),
      dto({ id: "c", country: "Ethiopia", isFreshArrival: true }),
    ]
    const ins = computeMarketplaceInsights(lots)
    const colombia = ins.freshArrivalsByOrigin.find((r) => r.label === "Colombia")
    const ethiopia = ins.freshArrivalsByOrigin.find((r) => r.label === "Ethiopia")
    assert.equal(colombia?.count, 1)
    assert.equal(ethiopia?.count, 1)
  })
})

// ------------------------------------------------------
// 8. SORT
// ------------------------------------------------------

describe("sortMarketplaceLots", () => {
  function dto(overrides: Partial<MarketplaceLotDto>): MarketplaceLotDto {
    const base = mapDecisionToMarketplaceLot(makeSnapshot(), makeDecision())!
    return { ...base, ...overrides }
  }

  it("places exclusive microlots first, then sorts by SCA desc, then by lotNumber", () => {
    const a = dto({ id: "a", lotNumber: "LN-0001", scaScore: 87, isExclusive: false })
    const b = dto({ id: "b", lotNumber: "LN-0002", scaScore: null, isExclusive: false })
    const c = dto({ id: "c", lotNumber: "LN-0003", scaScore: 91, isExclusive: true })
    const d = dto({ id: "d", lotNumber: "LN-0004", scaScore: 90, isExclusive: false })

    const sorted = sortMarketplaceLots([a, b, c, d])
    assert.deepEqual(
      sorted.map((l) => l.id),
      ["c", "d", "a", "b"]
    )
  })
})

// ------------------------------------------------------
// 8b. SANITIZER — bracketed-prefix strip on stale rows
// ------------------------------------------------------

describe("stripBracketedPrefix", () => {

  it("strips a leading [scenario] prefix", () => {
    assert.equal(
      stripBracketedPrefix("[allocation_engine_decides] Geisha WASHED"),
      "Geisha WASHED"
    )
  })

  it("strips a leading [DEV] farm prefix", () => {
    assert.equal(
      stripBracketedPrefix("[DEV] Nariño Micro Farm"),
      "Nariño Micro Farm"
    )
  })

  it("only strips a single leading bracket — does not touch internal brackets", () => {
    assert.equal(
      stripBracketedPrefix("Finca [El Paraíso]"),
      "Finca [El Paraíso]"
    )
  })

  it("returns the input unchanged when no bracket present", () => {
    assert.equal(stripBracketedPrefix("Nariño Geisha Reserve"), "Nariño Geisha Reserve")
  })

  it("returns empty string for non-string input", () => {
    // @ts-expect-error — guard against runtime nulls
    assert.equal(stripBracketedPrefix(null), "")
    // @ts-expect-error — guard against runtime undefined
    assert.equal(stripBracketedPrefix(undefined), "")
  })

  it("produces a clean buildName output for stale dev rows via the mapper", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        name: "[allocation_engine_decides] Geisha WASHED",
        farmName: "[DEV] Nariño Micro Farm",
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.name, "Geisha WASHED")
    assert.equal(dto.farmName, "Nariño Micro Farm")
  })
})

// ------------------------------------------------------
// 9. ALLOCATION REASONS — pass-through
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — allocation reasons", () => {
  it("forwards reason codes and severities only (no message text leaks)", () => {
    const reasons: AllocationReason[] = [
      { code: "PREMIUM_MICROLOT_MARKETPLACE", severity: "info", message: "noise" },
      { code: "MISSING_ROAST_YIELD", severity: "warning", message: "noise" },
    ]
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot(),
      makeDecision({ reasons })
    )
    assert.ok(dto)
    assert.deepEqual(dto.allocation.reasons, [
      { code: "PREMIUM_MICROLOT_MARKETPLACE", severity: "info" },
      { code: "MISSING_ROAST_YIELD", severity: "warning" },
    ])
  })
})

// ------------------------------------------------------
// 10. ADAPTIVE PRICING — producer engine injected
//
// Verifies that when marketplaceView.service injects a
// producerPricingFn, the mapper switches to ADAPTIVE_B2B_ENGINE
// and exposes producerGreenPricePerKg + adaptiveB2BPricePerKg.
// ------------------------------------------------------

describe("mapDecisionToMarketplaceLot — adaptive pricing path", () => {

  // Fixed mock: returns a green producer price that scales with marketData.
  // Used to verify the adaptive engine integrates marketData and clamps
  // to the founder reference band.
  function makeMockProducer(baseGreen: number) {
    return (input: {
      scaScore: number
      altitude: number
      variety: string
      process: string
      country?: string
      marketData?: { cPrice?: number; demandIndex?: number }
    }) => {
      let p = baseGreen
      if (input.marketData?.cPrice) p *= input.marketData.cPrice / 180
      if (input.marketData?.demandIndex) p *= input.marketData.demandIndex
      return { finalPrice: Number(p.toFixed(2)) }
    }
  }

  it("flips pricingMode to ADAPTIVE_B2B_ENGINE when producerPricingFn is injected", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({
        variety: "Castillo",
        scaScore: 83,
        farmAltitude: 1850,
      }),
      makeDecision(),
      { producerPricingFn: makeMockProducer(5.78) }
    )
    assert.ok(dto)
    assert.equal(dto.pricingMode, "ADAPTIVE_B2B_ENGINE")
    assert.ok(typeof dto.adaptiveB2BPricePerKg === "number")
    assert.ok(typeof dto.producerGreenPricePerKg === "number")
    // Sanity band [reference × 0.7, reference × 1.3] = [19.6, 36.4] for Castillo 83 @ 1800.
    assert.ok(dto.roastedPricePerKg != null && dto.roastedPricePerKg >= 19.6)
    assert.ok(dto.roastedPricePerKg != null && dto.roastedPricePerKg <= 36.4)
  })

  it("propagates marketData — higher cPrice raises producerGreenPrice", () => {
    const baseline = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Caturra", scaScore: 84, farmAltitude: 1700 }),
      makeDecision(),
      { producerPricingFn: makeMockProducer(7) }
    )
    const hot = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Caturra", scaScore: 84, farmAltitude: 1700 }),
      makeDecision(),
      {
        marketData: { cPrice: 240, demandIndex: null },
        producerPricingFn: makeMockProducer(7),
      }
    )
    assert.ok(baseline?.producerGreenPricePerKg != null)
    assert.ok(hot?.producerGreenPricePerKg != null)
    assert.ok(
      hot.producerGreenPricePerKg > baseline.producerGreenPricePerKg,
      `producer green should rise with cPrice: ${baseline.producerGreenPricePerKg} → ${hot.producerGreenPricePerKg}`
    )
  })

  it("preserves origin-equivalent on the adaptive path", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Bourbon", scaScore: 86, farmAltitude: 1850 }),
      makeDecision(),
      { producerPricingFn: makeMockProducer(7.88) }
    )
    assert.ok(dto)
    assert.equal(dto.pricingMode, "ADAPTIVE_B2B_ENGINE")
    // origin-equivalent = 7.88 / 0.85 = 9.27 (NATURAL would be 0.82, but
    // the snapshot fixture uses WASHED at 0.85 by default).
    assert.ok(dto.originEquivalentRoastedPricePerKg != null)
  })

  it("keeps B2B reference price visible alongside adaptive (audit)", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Castillo", scaScore: 83, farmAltitude: 1850 }),
      makeDecision(),
      { producerPricingFn: makeMockProducer(5.78) }
    )
    assert.ok(dto)
    assert.equal(dto.b2bReferencePricePerKg, 28)
    assert.equal(dto.pricingReference.altitudeBucket, 1800)
    assert.equal(dto.pricingReference.scaBucket, "80_83")
  })

  it("falls back to B2B_REFERENCE_FALLBACK when producer engine throws", () => {
    const throwing: Parameters<typeof mapDecisionToMarketplaceLot>[2] = {
      producerPricingFn: () => { throw new Error("boom") },
    }
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Castillo", scaScore: 83, farmAltitude: 1850 }),
      makeDecision(),
      throwing
    )
    assert.ok(dto)
    assert.equal(dto.pricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(dto.roastedPricePerKg, 28)
  })

  it("DTO with no producerPricingFn falls back to B2B_REFERENCE_FALLBACK (no adaptive recompute)", () => {
    const dto = mapDecisionToMarketplaceLot(
      makeSnapshot({ variety: "Castillo", scaScore: 83, farmAltitude: 1850 }),
      makeDecision()
      // no third argument — covers test paths that don't inject the engine
    )
    assert.ok(dto)
    assert.equal(dto.pricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(dto.adaptiveB2BPricePerKg, null)
    assert.equal(dto.producerGreenPricePerKg, null)
  })

  // ------------------------------------------------------
  // LOT-MEDIA-2 — visibility filtering
  // ------------------------------------------------------

  describe("LOT-MEDIA-2 visibility filtering", () => {

    it("BUYER_PRIVATE rows are excluded from media + primaryMedia + imageUrl", () => {
      const snapshot = makeSnapshot({
        media: [
          {
            id: "pub-farm",
            url: "https://example.com/farm.jpg",
            role: "FARM",
            source: "PARTNER_UPLOAD",
            visibility: "PUBLIC_MARKET",
            position: 0,
            isPrimary: false,
            altText: null,
          },
          {
            id: "private-bag",
            url: "https://example.com/bag.jpg",
            role: "TRACEABILITY_BAG",
            source: "PARTNER_UPLOAD",
            visibility: "BUYER_PRIVATE",
            position: 0,
            isPrimary: true,
            altText: null,
          },
        ],
      })

      const dto = mapDecisionToMarketplaceLot(snapshot, makeDecision())
      assert.ok(dto)
      const ids = (dto.media ?? []).map((m) => m.id)
      assert.ok(!ids.includes("private-bag"))
      assert.ok(ids.includes("pub-farm"))
      // BUYER_PRIVATE isPrimary must not promote to primaryMedia
      assert.equal(dto.primaryMedia?.id, "pub-farm")
      assert.equal(dto.visual.imageUrl, "https://example.com/farm.jpg")
    })

    it("INTERNAL_ONLY rows are excluded from the marketplace DTO", () => {
      const snapshot = makeSnapshot({
        media: [
          {
            id: "pub-farm",
            url: "https://example.com/farm.jpg",
            role: "FARM",
            source: "PARTNER_UPLOAD",
            visibility: "PUBLIC_MARKET",
            position: 0,
            isPrimary: false,
            altText: null,
          },
          {
            id: "internal-cert",
            url: "https://example.com/cert.pdf",
            role: "CERTIFICATE",
            source: "PARTNER_UPLOAD",
            visibility: "INTERNAL_ONLY",
            position: 0,
            isPrimary: false,
            altText: null,
          },
        ],
      })

      const dto = mapDecisionToMarketplaceLot(snapshot, makeDecision())
      assert.ok(dto)
      const ids = (dto.media ?? []).map((m) => m.id)
      assert.ok(!ids.includes("internal-cert"))
      assert.equal(dto.mediaSummary?.hasVerifiedMedia, true)
    })

    it("mediaSummary only describes public-emitted media", () => {
      const snapshot = makeSnapshot({
        media: [
          {
            id: "pub-farm",
            url: "https://example.com/farm.jpg",
            role: "FARM",
            source: "PARTNER_UPLOAD",
            visibility: "PUBLIC_MARKET",
            position: 0,
            isPrimary: false,
            altText: null,
          },
          {
            id: "private-bag",
            url: "https://example.com/bag.jpg",
            role: "TRACEABILITY_BAG",
            source: "PARTNER_UPLOAD",
            visibility: "BUYER_PRIVATE",
            position: 0,
            isPrimary: false,
            altText: null,
          },
        ],
      })

      const dto = mapDecisionToMarketplaceLot(snapshot, makeDecision())
      // hasVerifiedMedia is true because the public FARM is verified.
      assert.equal(dto?.mediaSummary?.hasVerifiedMedia, true)
      // Recommended-role coverage should miss PROCESS + TRACEABILITY_BAG
      // because only the public FARM is visible to this filter.
      const missing = dto?.mediaSummary?.missingRecommendedRoles ?? []
      assert.ok(missing.includes("PROCESS"))
      assert.ok(missing.includes("TRACEABILITY_BAG"))
    })

    it("legacy media rows without visibility default to PUBLIC_MARKET", () => {
      const snapshot = makeSnapshot({
        media: [
          {
            id: "legacy-farm",
            url: "https://example.com/legacy.jpg",
            role: "FARM",
            source: "PARTNER_UPLOAD",
            // visibility omitted — legacy LOT-MEDIA-1 fixture
            position: 0,
            isPrimary: false,
            altText: null,
          } as any,
        ],
      })

      const dto = mapDecisionToMarketplaceLot(snapshot, makeDecision())
      assert.ok(dto)
      assert.equal(dto.media?.[0]?.id, "legacy-farm")
      assert.equal(dto.primaryMedia?.id, "legacy-farm")
    })
  })
})
