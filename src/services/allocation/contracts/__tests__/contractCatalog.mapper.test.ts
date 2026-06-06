//////////////////////////////////////////////////////
// 🧪 CONTRACT CATALOG MAPPER — UNIT TESTS
//
// Pure tests, no Prisma, no HTTP. Exercises:
//   - mapDecisionToContractCatalogLot
//   - sortContractCatalogLots
//   - computeContractCatalogMetrics
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  computeContractCatalogMetrics,
  mapDecisionToContractCatalogLot,
  sortContractCatalogLots,
  type ContractCatalogLotDto,
} from "../contractCatalog.mapper.ts"
import type {
  AllocationSurface,
  LotAllocationDecision,
  LotAllocationSnapshot,
  ViableProfile,
} from "../../domain/types.ts"

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
    totalGreenKg: 5000,
    availableGreenKg: 5000,
    scaScore: 85,
    variety: "Caturra",
    process: "WASHED",
    harvestYear: 2026,
    estimatedRoastYield: 0.8,
    usedDefaultRoastYield: false,
    greenPricePerKg: 7.5,
    farmId: "farm-1",
    farmRegion: "Huila",
    farmAltitude: 1850,
    producerCountry: "Colombia",
    committedContractGreenKg: 0,
    committedContractMonthsRemaining: 0,
    reservedIntentGreenKg: 0,
    shipmentId: null,
    marketDemandIndex: null,
    name: "Finca Demo Caturra",
    producerName: "Demo Producer",
    farmName: "Finca Demo",
    createdAt: new Date().toISOString(),
    currency: "EUR",
    ...overrides,
  }
}

function makeDecision(
  overrides: Partial<LotAllocationDecision> = {}
): LotAllocationDecision {
  return {
    greenLotId: "lot-1",
    lotNumber: "LN-0001",
    totalGreenKg: 5000,
    availableGreenKg: 5000,
    committedContractGreenKg: 0,
    reservedIntentGreenKg: 0,
    safetyBufferGreenKg: 0,
    contractReservedGreenKg: 0,
    contractAssignableGreenKg: 5000,
    marketplaceEligibleGreenKg: 0,
    exclusiveMicrolotGreenKg: 0,
    blockedGreenKg: 0,
    recommendedSurface: "CONTRACT_CATALOG",
    viableProfiles: [],
    reasons: [],
    confidence: 0.9,
    policyVersion: "allocation-policy-v0",
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function profile(
  overrides: Partial<ViableProfile> = {}
): ViableProfile {
  return {
    profileId: "small-roaster",
    monthsCovered: 6,
    monthlyGreenKg: 100,
    coversTypicalConsumption: true,
    ...overrides,
  }
}

// ------------------------------------------------------
// 1. CONTRACT_CATALOG → DTO
// ------------------------------------------------------

describe("mapDecisionToContractCatalogLot — CONTRACT_CATALOG", () => {

  it("maps a CONTRACT_CATALOG decision to a DTO using contractAssignableGreenKg", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ estimatedRoastYield: 0.8 }),
      makeDecision({
        recommendedSurface: "CONTRACT_CATALOG",
        contractAssignableGreenKg: 4000,
        marketplaceEligibleGreenKg: 0,
        exclusiveMicrolotGreenKg: 0,
      })
    )
    assert.ok(dto)
    assert.equal(dto.contractAssignableGreenKg, 4000)
    assert.equal(dto.contractAssignableRoastedKg, 3200) // 4000 × 0.8
    assert.equal(dto.recommendedSurface, "CONTRACT_CATALOG")
  })

  it("propagates altitude from snapshot.farmAltitude", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ farmAltitude: 2050 }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.altitude, 2050)
  })

  it("dto.altitude is null when snapshot.farmAltitude is null", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ farmAltitude: null }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.altitude, null)
  })

  it("strips a [DEV]-style prefix from farmName but keeps name fallback intact", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({
        name: null,
        farmName: "[DEV] Antioquia Volume Farm",
        variety: "Castillo",
      }),
      makeDecision()
    )
    assert.ok(dto)
    assert.equal(dto.farmName, "Antioquia Volume Farm")
    assert.ok(dto.name.startsWith("Antioquia Volume Farm"))
  })

  it("preserves viableProfiles and derives bestProfileId / maxMonthsCovered", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ estimatedRoastYield: 0.8 }),
      makeDecision({
        viableProfiles: [
          profile({ profileId: "small-roaster",  monthsCovered: 6,  monthlyGreenKg: 100, coversTypicalConsumption: true }),
          profile({ profileId: "regional-chain", monthsCovered: 12, monthlyGreenKg: 500, coversTypicalConsumption: false }),
          profile({ profileId: "specialty-shop", monthsCovered: 9,  monthlyGreenKg: 200, coversTypicalConsumption: true }),
        ],
      })
    )
    assert.ok(dto)
    // Best = highest monthsCovered AMONG profiles that cover typical consumption.
    // → "specialty-shop" (9), beating "small-roaster" (6); "regional-chain"
    //    is excluded because coversTypicalConsumption=false.
    assert.equal(dto.bestProfileId, "specialty-shop")
    assert.equal(dto.maxMonthsCovered, 9)
    assert.equal(dto.indicativeCoverageMonths, 9)
    // 200 monthlyGreenKg × 0.8 yield → 160 monthlyRoastedKg.
    assert.equal(dto.indicativeMonthlyRoastedKg, 160)
    assert.equal(dto.viableProfiles.length, 3)
  })

  it("falls back to highest monthsCovered when no profile covers typical consumption", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot(),
      makeDecision({
        viableProfiles: [
          profile({ profileId: "a", monthsCovered: 4, coversTypicalConsumption: false }),
          profile({ profileId: "b", monthsCovered: 8, coversTypicalConsumption: false }),
        ],
      })
    )
    assert.ok(dto)
    assert.equal(dto.bestProfileId, "b")
    assert.equal(dto.maxMonthsCovered, 8)
  })

  it("returns null bests when there are no viable profiles", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot(),
      makeDecision({ viableProfiles: [] })
    )
    assert.ok(dto)
    assert.equal(dto.bestProfileId, null)
    assert.equal(dto.maxMonthsCovered, null)
    assert.equal(dto.indicativeMonthlyRoastedKg, null)
    assert.equal(dto.indicativeCoverageMonths, null)
  })

  it("preserves reasons in shape (code + severity + message)", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot(),
      makeDecision({
        reasons: [
          { code: "CONTRACT_VOLUME_SUFFICIENT", severity: "info", message: "Volume OK" },
          { code: "MONTHLY_CONTRACT_CAPACITY_AVAILABLE", severity: "info", message: "Coverage OK" },
        ],
      })
    )
    assert.ok(dto)
    assert.equal(dto.reasons.length, 2)
    assert.equal(dto.reasons[0].code, "CONTRACT_VOLUME_SUFFICIENT")
    assert.equal(dto.reasons[0].severity, "info")
    assert.equal(dto.reasons[0].message, "Volume OK")
  })

  it("price is null and pricingMode is null when no producer engine is injected", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot(),
      makeDecision()
      // no pricingContext
    )
    assert.ok(dto)
    assert.equal(dto.pricePerKgRoasted, null)
    assert.equal(dto.pricingMode, null)
  })

  it("badges include contract-ready by default and high-sca/high-altitude when warranted", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ scaScore: 87, farmAltitude: 1950 }),
      makeDecision()
    )
    assert.ok(dto)
    assert.ok(dto.badges.includes("contract-ready"))
    assert.ok(dto.badges.includes("high-sca"))
    assert.ok(dto.badges.includes("high-altitude"))
    assert.equal(dto.badges.includes("split-lot"), false)
  })

  it("badge limited-contract-pool fires when assignable roasted kg is small", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ estimatedRoastYield: 0.8 }),
      makeDecision({ contractAssignableGreenKg: 500 }) // 500 × 0.8 = 400 roasted, < 600 limit
    )
    assert.ok(dto)
    assert.ok(dto.badges.includes("limited-contract-pool"))
  })

})

// ------------------------------------------------------
// 2. SPLIT → DTO uses CONTRACT pool, not marketplace residual
// ------------------------------------------------------

describe("mapDecisionToContractCatalogLot — SPLIT", () => {
  it("uses contractAssignableGreenKg, NOT marketplaceEligibleGreenKg", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ estimatedRoastYield: 0.85 }),
      makeDecision({
        recommendedSurface: "SPLIT",
        contractAssignableGreenKg: 12000,
        marketplaceEligibleGreenKg: 4000, // marketplace residual — must NOT show here
        exclusiveMicrolotGreenKg: 0,
      })
    )
    assert.ok(dto)
    assert.equal(dto.contractAssignableGreenKg, 12000)
    assert.equal(dto.contractAssignableRoastedKg, Math.round(12000 * 0.85 * 10) / 10)
    assert.equal(dto.recommendedSurface, "SPLIT")
    // Sanity: nothing on the DTO should expose marketplaceEligibleGreenKg
    // as a contract field.
    const stringified = JSON.stringify(dto)
    assert.equal(stringified.includes("marketplaceEligibleGreenKg"), false)
    assert.equal(stringified.includes("exclusiveMicrolotGreenKg"), false)
  })

  it("adds the split-lot badge for SPLIT surface", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot(),
      makeDecision({
        recommendedSurface: "SPLIT",
        contractAssignableGreenKg: 8000,
        marketplaceEligibleGreenKg: 2000,
      })
    )
    assert.ok(dto)
    assert.ok(dto.badges.includes("split-lot"))
    assert.ok(dto.badges.includes("contract-ready"))
  })
})

// ------------------------------------------------------
// 3. EXCLUDED SURFACES
// ------------------------------------------------------

describe("mapDecisionToContractCatalogLot — exclusion rules", () => {

  const EXCLUDED: AllocationSurface[] = [
    "OPEN_MARKETPLACE",
    "EXCLUSIVE_MICROLOT",
    "HOLD",
  ]

  for (const surface of EXCLUDED) {
    it(`returns null for surface ${surface}`, () => {
      const dto = mapDecisionToContractCatalogLot(
        makeSnapshot(),
        makeDecision({
          recommendedSurface: surface,
          contractAssignableGreenKg: 0,
          marketplaceEligibleGreenKg: surface === "OPEN_MARKETPLACE" ? 1000 : 0,
          exclusiveMicrolotGreenKg: surface === "EXCLUSIVE_MICROLOT" ? 1000 : 0,
        })
      )
      assert.equal(dto, null)
    })
  }

  it("returns null when contractAssignableGreenKg is 0 even for CONTRACT_CATALOG", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot(),
      makeDecision({
        recommendedSurface: "CONTRACT_CATALOG",
        contractAssignableGreenKg: 0,
      })
    )
    assert.equal(dto, null)
  })

  it("returns null when greenPricePerKg is missing (no pricing → not actionable)", () => {
    const dto = mapDecisionToContractCatalogLot(
      makeSnapshot({ greenPricePerKg: null }),
      makeDecision({ contractAssignableGreenKg: 4000 })
    )
    assert.equal(dto, null)
  })
})

// ------------------------------------------------------
// 4. SORTING
// ------------------------------------------------------

describe("sortContractCatalogLots", () => {

  function makeLotShell(overrides: Partial<ContractCatalogLotDto>): ContractCatalogLotDto {
    return {
      id: overrides.id ?? "x",
      lotNumber: overrides.lotNumber ?? "X",
      name: "x",
      producerName: null,
      farmName: null,
      region: null,
      country: null,
      process: "Washed",
      variety: "Caturra",
      harvestYear: 2026,
      scaScore: null,
      altitude: null,
      roastYield: 0.8,
      currency: "EUR",
      totalGreenKg: 0,
      availableGreenKg: 0,
      contractAssignableGreenKg: 0,
      contractAssignableRoastedKg: 0,
      committedContractGreenKg: 0,
      reservedIntentGreenKg: 0,
      recommendedSurface: "CONTRACT_CATALOG",
      viableProfiles: [],
      bestProfileId: null,
      maxMonthsCovered: null,
      indicativeMonthlyRoastedKg: null,
      indicativeCoverageMonths: null,
      pricePerKgRoasted: null,
      pricingSource: "ADAPTIVE_RECOMPUTE_FALLBACK",
      clientB2BPricePerKg: null,
      badges: [],
      reasons: [],
      ...overrides,
    }
  }

  it("CONTRACT_CATALOG comes before SPLIT", () => {
    const sorted = sortContractCatalogLots([
      makeLotShell({ id: "a", lotNumber: "LN-A", recommendedSurface: "SPLIT", contractAssignableRoastedKg: 9000 }),
      makeLotShell({ id: "b", lotNumber: "LN-B", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 1000 }),
    ])
    assert.equal(sorted[0].id, "b")
    assert.equal(sorted[1].id, "a")
  })

  it("higher contractAssignableRoastedKg first within the same surface", () => {
    const sorted = sortContractCatalogLots([
      makeLotShell({ id: "small", lotNumber: "LN-1", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 1000 }),
      makeLotShell({ id: "big",   lotNumber: "LN-2", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 8000 }),
    ])
    assert.equal(sorted[0].id, "big")
    assert.equal(sorted[1].id, "small")
  })

  it("higher SCA breaks ties, then lotNumber asc", () => {
    const sorted = sortContractCatalogLots([
      makeLotShell({ id: "low",  lotNumber: "LN-2", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 5000, scaScore: 84 }),
      makeLotShell({ id: "high", lotNumber: "LN-3", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 5000, scaScore: 87 }),
      makeLotShell({ id: "tie",  lotNumber: "LN-1", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 5000, scaScore: 87 }),
    ])
    assert.equal(sorted[0].id, "tie")    // LN-1 < LN-3
    assert.equal(sorted[1].id, "high")
    assert.equal(sorted[2].id, "low")
  })
})

// ------------------------------------------------------
// 5. METRICS
// ------------------------------------------------------

describe("computeContractCatalogMetrics", () => {

  function lot(overrides: Partial<ContractCatalogLotDto>): ContractCatalogLotDto {
    return {
      id: overrides.id ?? "x",
      lotNumber: overrides.lotNumber ?? "X",
      name: "x",
      producerName: null,
      farmName: null,
      region: null,
      country: overrides.country ?? "Colombia",
      process: "Washed",
      variety: "Caturra",
      harvestYear: 2026,
      scaScore: overrides.scaScore ?? 86,
      altitude: 1850,
      roastYield: 0.8,
      currency: "EUR",
      totalGreenKg: 5000,
      availableGreenKg: 5000,
      contractAssignableGreenKg: overrides.contractAssignableGreenKg ?? 5000,
      contractAssignableRoastedKg: overrides.contractAssignableRoastedKg ?? 4000,
      committedContractGreenKg: 0,
      reservedIntentGreenKg: 0,
      recommendedSurface: overrides.recommendedSurface ?? "CONTRACT_CATALOG",
      viableProfiles: overrides.viableProfiles ?? [],
      bestProfileId: null,
      maxMonthsCovered: null,
      indicativeMonthlyRoastedKg: null,
      indicativeCoverageMonths: null,
      pricePerKgRoasted: null,
      pricingSource: "ADAPTIVE_RECOMPUTE_FALLBACK",
      clientB2BPricePerKg: null,
      badges: [],
      reasons: [],
      ...overrides,
    }
  }

  it("totals assignable green and roasted kg correctly", () => {
    const m = computeContractCatalogMetrics([
      lot({ id: "a", contractAssignableGreenKg: 4000, contractAssignableRoastedKg: 3200 }),
      lot({ id: "b", contractAssignableGreenKg: 8000, contractAssignableRoastedKg: 6400 }),
    ])
    assert.equal(m.totalLots, 2)
    assert.equal(m.totalAssignableGreenKg, 12000)
    assert.equal(m.totalAssignableRoastedKg, 9600)
  })

  it("groups roasted kg by country and reports percentage shares", () => {
    const m = computeContractCatalogMetrics([
      lot({ id: "a", country: "Colombia", contractAssignableRoastedKg: 3000 }),
      lot({ id: "b", country: "Colombia", contractAssignableRoastedKg: 1000 }),
      lot({ id: "c", country: "Ethiopia", contractAssignableRoastedKg: 1000 }),
    ])
    const colombia = m.origins.find((o) => o.country === "Colombia")
    const ethiopia = m.origins.find((o) => o.country === "Ethiopia")
    assert.ok(colombia)
    assert.ok(ethiopia)
    assert.equal(colombia.roastedKg, 4000)
    assert.equal(ethiopia.roastedKg, 1000)
    assert.equal(colombia.percentage, 80)
    assert.equal(ethiopia.percentage, 20)
    assert.equal(m.origins[0].country, "Colombia") // sorted by volume desc
  })

  it("rounds avgScaScore to one decimal across lots that have an SCA", () => {
    const m = computeContractCatalogMetrics([
      lot({ id: "a", scaScore: 86 }),
      lot({ id: "b", scaScore: 87 }),
      lot({ id: "c", scaScore: 88 }),
    ])
    assert.equal(m.avgScaScore, 87)
  })

  it("avgScaScore is null when no lot has a numeric SCA", () => {
    const m = computeContractCatalogMetrics([
      lot({ id: "a", scaScore: null }),
    ])
    assert.equal(m.avgScaScore, null)
  })

  it("topProfiles counts each profileId across viableProfiles", () => {
    const m = computeContractCatalogMetrics([
      lot({
        id: "a",
        viableProfiles: [
          { profileId: "small-roaster",  monthsCovered: 6,  coversTypicalConsumption: true },
          { profileId: "regional-chain", monthsCovered: 12, coversTypicalConsumption: false },
        ],
      }),
      lot({
        id: "b",
        viableProfiles: [
          { profileId: "small-roaster", monthsCovered: 4, coversTypicalConsumption: true },
        ],
      }),
    ])
    const small = m.topProfiles.find((p) => p.profileId === "small-roaster")
    const regional = m.topProfiles.find((p) => p.profileId === "regional-chain")
    assert.ok(small)
    assert.ok(regional)
    assert.equal(small.lots, 2)
    assert.equal(regional.lots, 1)
    assert.equal(m.topProfiles[0].profileId, "small-roaster") // sorted by lots desc
  })
})
