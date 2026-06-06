//////////////////////////////////////////////////////
// 🧪 CLIENT DASHBOARD — PURE SELECTOR TESTS
//
// Exercises the dashboard selectors that derive view
// models from the existing dashboard data feeds.
// No DB. No HTTP. No React.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  pickRecommendedContractLots,
  DEFAULT_RECOMMENDED_LIMIT,
} from "../recommendedContractLots.ts"
import { computePortfolioMetrics } from "../contractPortfolioMetrics.ts"
import type { ContractCatalogLotDto } from "../../allocation/contracts/contractCatalog.mapper.ts"

// ------------------------------------------------------
// FIXTURE BUILDERS
// ------------------------------------------------------

function catalogLot(
  overrides: Partial<ContractCatalogLotDto>
): ContractCatalogLotDto {
  return {
    id: overrides.id ?? "lot",
    lotNumber: overrides.lotNumber ?? "LN-X",
    name: overrides.name ?? "Demo Lot",
    producerName: null,
    farmName: null,
    region: overrides.region ?? "Huila",
    country: overrides.country ?? "Colombia",
    process: "Washed",
    variety: "Caturra",
    harvestYear: 2026,
    scaScore: overrides.scaScore ?? 85,
    altitude: overrides.altitude ?? 1850,
    roastYield: 0.8,
    currency: "EUR",
    totalGreenKg: 5000,
    availableGreenKg: 5000,
    contractAssignableGreenKg: overrides.contractAssignableGreenKg ?? 5000,
    contractAssignableRoastedKg: overrides.contractAssignableRoastedKg ?? 4000,
    committedContractGreenKg: 0,
    reservedIntentGreenKg: 0,
    recommendedSurface: overrides.recommendedSurface ?? "CONTRACT_CATALOG",
    viableProfiles: [],
    bestProfileId: null,
    maxMonthsCovered: null,
    indicativeMonthlyRoastedKg: null,
    indicativeCoverageMonths: null,
    pricePerKgRoasted: overrides.pricePerKgRoasted ?? 14.5,
    pricingSource: "ADAPTIVE_RECOMPUTE_FALLBACK",
    clientB2BPricePerKg: null,
    badges: overrides.badges ?? ["contract-ready"],
    reasons: [],
    ...overrides,
  }
}

// ------------------------------------------------------
// pickRecommendedContractLots
// ------------------------------------------------------

describe("pickRecommendedContractLots", () => {

  it("defaults to 3 recommendations", () => {
    const lots = [
      catalogLot({ id: "a", lotNumber: "LN-1" }),
      catalogLot({ id: "b", lotNumber: "LN-2" }),
      catalogLot({ id: "c", lotNumber: "LN-3" }),
      catalogLot({ id: "d", lotNumber: "LN-4" }),
      catalogLot({ id: "e", lotNumber: "LN-5" }),
    ]
    const out = pickRecommendedContractLots(lots)
    assert.equal(out.length, DEFAULT_RECOMMENDED_LIMIT)
  })

  it("never exceeds the available lot count", () => {
    const out = pickRecommendedContractLots(
      [catalogLot({ id: "a" }), catalogLot({ id: "b" })],
      5
    )
    assert.equal(out.length, 2)
  })

  it("ranks CONTRACT_CATALOG before SPLIT", () => {
    const lots = [
      catalogLot({ id: "split-big", lotNumber: "LN-1", recommendedSurface: "SPLIT", contractAssignableRoastedKg: 9000, scaScore: 85 }),
      catalogLot({ id: "cat-small", lotNumber: "LN-2", recommendedSurface: "CONTRACT_CATALOG", contractAssignableRoastedKg: 1000, scaScore: 84 }),
    ]
    const out = pickRecommendedContractLots(lots, 2)
    assert.equal(out[0].id, "cat-small")
    assert.equal(out[1].id, "split-big")
  })

  it("breaks ties on SCA, then assignable kg, then lotNumber", () => {
    const lots = [
      catalogLot({ id: "a", lotNumber: "LN-2", recommendedSurface: "CONTRACT_CATALOG", scaScore: 85, contractAssignableRoastedKg: 5000 }),
      catalogLot({ id: "b", lotNumber: "LN-1", recommendedSurface: "CONTRACT_CATALOG", scaScore: 88, contractAssignableRoastedKg: 1000 }),
      catalogLot({ id: "c", lotNumber: "LN-3", recommendedSurface: "CONTRACT_CATALOG", scaScore: 88, contractAssignableRoastedKg: 9000 }),
    ]
    const out = pickRecommendedContractLots(lots, 3)
    // SCA 88 → c (9000 kg), b (1000 kg); then SCA 85 → a
    assert.equal(out[0].id, "c")
    assert.equal(out[1].id, "b")
    assert.equal(out[2].id, "a")
  })

  it("preserves altitude on the recommendation", () => {
    const out = pickRecommendedContractLots([
      catalogLot({ id: "a", altitude: 2050 }),
    ], 1)
    assert.equal(out[0].altitude, 2050)
  })

  it("composes a region+country origin label", () => {
    const out = pickRecommendedContractLots([
      catalogLot({ id: "a", region: "Huila", country: "Colombia" }),
      catalogLot({ id: "b", region: null, country: "Ethiopia" }),
      catalogLot({ id: "c", region: "Antigua", country: null }),
    ], 3)
    const byId = Object.fromEntries(out.map((l) => [l.id, l]))
    assert.equal(byId.a.origin, "Huila, Colombia")
    assert.equal(byId.b.origin, "Ethiopia")
    assert.equal(byId.c.origin, "Antigua")
  })

  it("preserves price + badges + recommendedSurface", () => {
    const out = pickRecommendedContractLots([
      catalogLot({
        id: "a",
        pricePerKgRoasted: 18.4,
        badges: ["contract-ready", "high-sca", "split-lot"],
        recommendedSurface: "SPLIT",
      }),
    ], 1)
    assert.equal(out[0].pricePerKgRoasted, 18.4)
    assert.deepEqual(out[0].badges, ["contract-ready", "high-sca", "split-lot"])
    assert.equal(out[0].recommendedSurface, "SPLIT")
  })

  it("returns an empty array when given no lots", () => {
    assert.deepEqual(pickRecommendedContractLots([]), [])
  })

  it("clamps a negative limit to zero", () => {
    const out = pickRecommendedContractLots(
      [catalogLot({ id: "a" })],
      -1
    )
    assert.equal(out.length, 0)
  })

  // DASHBOARD-IMAGES-1 — media propagation
  it("propagates media, primaryMedia and mediaSummary through to the recommendation", () => {
    const farmImg = {
      id: "m-farm",
      url: "https://example.com/farm.jpg",
      role: "FARM" as const,
      source: "PARTNER_UPLOAD" as const,
      visibility: "PUBLIC_MARKET" as const,
      position: 0,
      isPrimary: true,
      altText: null,
    }
    const out = pickRecommendedContractLots([
      catalogLot({
        id: "a",
        media: [farmImg],
        primaryMedia: farmImg,
        mediaSummary: {
          hasVerifiedMedia: true,
          hasPartnerMedia: true,
          hasOnlyFallbackMedia: false,
          missingRecommendedRoles: ["PROCESS", "TRACEABILITY_BAG"],
        },
      }),
    ], 1)
    assert.equal(out[0].media.length, 1)
    assert.equal(out[0].media[0].id, "m-farm")
    assert.equal(out[0].primaryMedia?.id, "m-farm")
    assert.equal(out[0].mediaSummary?.hasPartnerMedia, true)
  })

  it("defaults media fields to safe empty values when the DTO has no media", () => {
    const out = pickRecommendedContractLots([
      catalogLot({ id: "a" }),
    ], 1)
    assert.deepEqual(out[0].media, [])
    assert.equal(out[0].primaryMedia, null)
    assert.equal(out[0].mediaSummary, null)
  })
})

// ------------------------------------------------------
// computePortfolioMetrics
// ------------------------------------------------------

describe("computePortfolioMetrics", () => {

  it("returns safe zeroes for empty inputs", () => {
    const m = computePortfolioMetrics({
      contracts: [],
      intents: [],
      market: null,
      catalog: null,
    })
    assert.equal(m.activeContracts, 0)
    assert.equal(m.pendingSignatureContracts, 0)
    assert.equal(m.pendingPaymentContracts, 0)
    assert.equal(m.monthlyGreenKg, 0)
    assert.equal(m.availableRoastedKg, 0)
    assert.equal(m.publishedLots, 0)
    assert.equal(m.pendingRequests, 0)
    assert.equal(m.uniqueOrigins, 0)
    assert.equal(m.contractCatalogRoastedKg, 0)
    assert.equal(m.contractCatalogLots, 0)
    assert.equal(m.nextShipment.dateIso, null)
    assert.equal(m.nextShipment.country, null)
  })

  it("counts active vs pending statuses correctly", () => {
    const m = computePortfolioMetrics({
      contracts: [
        { status: "ACTIVE",            monthlyGreenKg: 100 },
        { status: "active",            monthlyGreenKg: 50  }, // case-insensitive
        { status: "PENDING_SIGNATURE", monthlyGreenKg: 80  },
        { status: "PILOT_PENDING",     monthlyGreenKg: 80  },
        { status: "PENDING_PAYMENT",   monthlyGreenKg: 200 },
        { status: "CANCELLED",         monthlyGreenKg: 999 }, // ignored
      ],
      intents: [],
      market: null,
      catalog: null,
    })
    assert.equal(m.activeContracts, 2)
    assert.equal(m.pendingSignatureContracts, 2)
    assert.equal(m.pendingPaymentContracts, 1)
    // Only ACTIVE contracts feed monthlyGreenKg.
    assert.equal(m.monthlyGreenKg, 150)
  })

  it("falls back to monthlyVolumeKg when monthlyGreenKg is missing (legacy contracts)", () => {
    const m = computePortfolioMetrics({
      contracts: [
        { status: "ACTIVE", monthlyGreenKg: null, monthlyVolumeKg: 75 },
      ],
      intents: [],
      market: null,
      catalog: null,
    })
    assert.equal(m.monthlyGreenKg, 75)
  })

  it("counts open / countered / waiting intents as pending requests", () => {
    const m = computePortfolioMetrics({
      contracts: [],
      intents: [
        { status: "OPEN" },
        { status: "COUNTERED" },
        { status: "WAITING" },
        { status: "ACCEPTED" }, // ignored
      ],
      market: null,
      catalog: null,
    })
    assert.equal(m.pendingRequests, 3)
  })

  it("counts unique origin countries across active contracts only", () => {
    const m = computePortfolioMetrics({
      contracts: [
        { status: "ACTIVE", greenLot: { producer: { country: "Colombia" } } },
        { status: "ACTIVE", greenLot: { producer: { country: "Colombia" } } }, // same
        { status: "ACTIVE", origin: { country: "Ethiopia" } },                  // legacy shape
        { status: "PENDING_SIGNATURE", greenLot: { producer: { country: "Kenya" } } }, // ignored
      ],
      intents: [],
      market: null,
      catalog: null,
    })
    assert.equal(m.uniqueOrigins, 2)
  })

  it("propagates roastedAvailableKg + lotCount from market totals", () => {
    const m = computePortfolioMetrics({
      contracts: [],
      intents: [],
      market: { totals: { roastedAvailableKg: 18340, lotCount: 23 } },
      catalog: null,
    })
    assert.equal(m.availableRoastedKg, 18340)
    assert.equal(m.publishedLots, 23)
  })

  it("propagates catalog totals (rounded roasted kg, count of lots)", () => {
    const m = computePortfolioMetrics({
      contracts: [],
      intents: [],
      market: null,
      catalog: { totalAssignableRoastedKg: 12345.67, totalLots: 5 },
    })
    assert.equal(m.contractCatalogRoastedKg, 12346)
    assert.equal(m.contractCatalogLots, 5)
  })

  it("picks the earliest upcoming shipment from active contracts", () => {
    const m = computePortfolioMetrics({
      contracts: [
        { status: "ACTIVE", nextShipmentAt: "2025-08-15T00:00:00Z", greenLot: { producer: { country: "Colombia" } } },
        { status: "ACTIVE", nextShipmentAt: "2025-05-28T00:00:00Z", greenLot: { producer: { country: "Colombia" } } },
        { status: "ACTIVE", nextShipmentAt: "2025-09-10T00:00:00Z", greenLot: { producer: { country: "Ethiopia" } } },
        { status: "PENDING_SIGNATURE", nextShipmentAt: "2025-01-01T00:00:00Z" }, // not active → ignored
      ],
      intents: [],
      market: null,
      catalog: null,
    })
    assert.equal(m.nextShipment.dateIso, "2025-05-28T00:00:00.000Z")
    assert.equal(m.nextShipment.country, "Colombia")
  })
})
