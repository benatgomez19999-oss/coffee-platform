//////////////////////////////////////////////////////
// 🧪 SNAPSHOT MAPPER — UNIT TESTS
//
// No Prisma. No DB. The mapper accepts plain row shapes
// (see lotAllocationSnapshot.mapper.ts ➜ ContractRow,
// IntentRow, GreenLotRowForAllocation) so we can build
// fixtures inline and assert pure outputs.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  aggregateCommitments,
  aggregateIntentReservations,
  mapGreenLotToAllocationSnapshot,
  mapLotStatus,
  type ContractRowForAllocation,
  type GreenLotRowForAllocation,
  type IntentRowForAllocation,
} from "../snapshot/lotAllocationSnapshot.mapper.ts"
import { decideLotAllocation } from "../engine/lotAllocationEngine.ts"

// ------------------------------------------------------
// Fixture helpers
// ------------------------------------------------------

function makeLotRow(
  overrides: Partial<GreenLotRowForAllocation> = {}
): GreenLotRowForAllocation {
  return {
    id: "lot-1",
    lotNumber: "LN-0001",
    status: "PUBLISHED",
    variety: "Caturra",
    process: "WASHED",
    harvestYear: 2026,
    scaScore: 84,
    altitude: 1700,
    totalKg: 5000,
    availableKg: 5000,
    pricePerKg: 6.5,
    estimatedRoastYield: 0.85,
    shipmentId: null,
    pricingSnapshot: { clientPricePerKg: 7.2 },
    farm: {
      id: "farm-1",
      region: "Huila",
      altitude: 1700,
      producer: { country: "Colombia" },
    },
    ...overrides,
  }
}

// ------------------------------------------------------
// aggregateCommitments
// ------------------------------------------------------

describe("aggregateCommitments", () => {

  it("sums monthly and horizon for the same lot", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: "lot-A", monthlyGreenKg: 100, monthlyVolumeKg: null, remainingMonths: 6 },
      { greenLotId: "lot-A", monthlyGreenKg: 50, monthlyVolumeKg: null, remainingMonths: 2 },
    ]
    const out = aggregateCommitments(rows)
    const a = out.get("lot-A")
    assert.ok(a)
    assert.equal(a.monthlyGreenKg, 150)
    assert.equal(a.horizonGreenKg, 700) // 100*6 + 50*2
    assert.equal(a.longestRemainingMonths, 6)
  })

  it("falls back to monthlyVolumeKg when monthlyGreenKg is null (legacy contracts)", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: "lot-X", monthlyGreenKg: null, monthlyVolumeKg: 80, remainingMonths: 3 },
    ]
    const out = aggregateCommitments(rows)
    const x = out.get("lot-X")
    assert.ok(x)
    assert.equal(x.monthlyGreenKg, 80)
    assert.equal(x.horizonGreenKg, 240)
  })

  it("treats null monthly as zero (ignored)", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: "lot-Y", monthlyGreenKg: null, monthlyVolumeKg: null, remainingMonths: 3 },
    ]
    const out = aggregateCommitments(rows)
    assert.equal(out.has("lot-Y"), false)
  })

  it("treats null remainingMonths as 1", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: "lot-Z", monthlyGreenKg: 200, monthlyVolumeKg: null, remainingMonths: null },
    ]
    const out = aggregateCommitments(rows)
    const z = out.get("lot-Z")
    assert.ok(z)
    assert.equal(z.monthlyGreenKg, 200)
    assert.equal(z.horizonGreenKg, 200)
    assert.equal(z.longestRemainingMonths, 1)
  })

  it("clamps negative remainingMonths but keeps horizon ≥ monthly (1-month floor)", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: "lot-N", monthlyGreenKg: 100, monthlyVolumeKg: null, remainingMonths: -5 },
    ]
    const out = aggregateCommitments(rows)
    const n = out.get("lot-N")
    assert.ok(n)
    assert.equal(n.monthlyGreenKg, 100)
    assert.equal(n.horizonGreenKg, 100) // max(1, 0) * 100
    assert.equal(n.longestRemainingMonths, 0)
  })

  it("ignores rows without greenLotId", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: null, monthlyGreenKg: 999, monthlyVolumeKg: null, remainingMonths: 12 },
    ]
    const out = aggregateCommitments(rows)
    assert.equal(out.size, 0)
  })

  it("treats negative monthly as zero (ignored)", () => {
    const rows: ContractRowForAllocation[] = [
      { greenLotId: "lot-Q", monthlyGreenKg: -100, monthlyVolumeKg: null, remainingMonths: 6 },
    ]
    const out = aggregateCommitments(rows)
    assert.equal(out.has("lot-Q"), false)
  })

})

// ------------------------------------------------------
// aggregateIntentReservations
// ------------------------------------------------------

describe("aggregateIntentReservations", () => {

  it("sums deltaKg per lot", () => {
    const rows: IntentRowForAllocation[] = [
      { greenLotId: "lot-A", deltaKg: 100 },
      { greenLotId: "lot-A", deltaKg: 50 },
      { greenLotId: "lot-B", deltaKg: 30 },
    ]
    const out = aggregateIntentReservations(rows)
    assert.equal(out.get("lot-A"), 150)
    assert.equal(out.get("lot-B"), 30)
  })

  it("ignores null / negative / non-finite deltas", () => {
    const rows: IntentRowForAllocation[] = [
      { greenLotId: "lot-A", deltaKg: null },
      { greenLotId: "lot-A", deltaKg: -50 },
      { greenLotId: "lot-A", deltaKg: Number.NaN },
      { greenLotId: "lot-A", deltaKg: 25 },
    ]
    const out = aggregateIntentReservations(rows)
    assert.equal(out.get("lot-A"), 25)
  })

  it("ignores rows without greenLotId", () => {
    const rows: IntentRowForAllocation[] = [
      { greenLotId: null, deltaKg: 1000 },
    ]
    const out = aggregateIntentReservations(rows)
    assert.equal(out.size, 0)
  })

})

// ------------------------------------------------------
// mapLotStatus
// ------------------------------------------------------

describe("mapLotStatus", () => {

  it("passes through known statuses", () => {
    assert.equal(mapLotStatus("DRAFT"), "DRAFT")
    assert.equal(mapLotStatus("PUBLISHED"), "PUBLISHED")
    assert.equal(mapLotStatus("RESERVED"), "RESERVED")
    assert.equal(mapLotStatus("SOLD"), "SOLD")
  })

  it("falls back to DRAFT for unknown values", () => {
    assert.equal(mapLotStatus("BANANA"), "DRAFT")
    assert.equal(mapLotStatus(""), "DRAFT")
  })

})

// ------------------------------------------------------
// mapGreenLotToAllocationSnapshot
// ------------------------------------------------------

describe("mapGreenLotToAllocationSnapshot", () => {

  it("maps a hydrated row to a complete snapshot", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow(),
      committedContractMonthlyGreenKg: 150,
      committedContractHorizonGreenKg: 700,
      committedContractMonthsRemaining: 6,
      reservedIntentGreenKg: 80,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })

    assert.equal(snap.greenLotId, "lot-1")
    assert.equal(snap.lotNumber, "LN-0001")
    assert.equal(snap.status, "PUBLISHED")
    assert.equal(snap.greenPricePerKg, 7.2)            // pricingSnapshot wins
    assert.equal(snap.scaScore, 84)
    assert.equal(snap.estimatedRoastYield, 0.85)
    assert.equal(snap.usedDefaultRoastYield, false)
    assert.equal(snap.committedContractGreenKg, 700)   // horizon, not monthly
    assert.equal(snap.committedContractHorizonGreenKg, 700)
    assert.equal(snap.committedContractMonthlyGreenKg, 150)
    assert.equal(snap.committedContractMonthsRemaining, 6)
    assert.equal(snap.reservedIntentGreenKg, 80)
    assert.equal(snap.shipmentId, null)
    assert.equal(snap.farmRegion, "Huila")
    assert.equal(snap.farmAltitude, 1700)
    assert.equal(snap.producerCountry, "Colombia")
  })

  it("falls back to GreenLot.pricePerKg when pricingSnapshot is missing", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({ pricingSnapshot: null, pricePerKg: 5.5 }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })
    assert.equal(snap.greenPricePerKg, 5.5)
  })

  it("propagates persisted clientB2BPricePerKg from pricingSnapshot (PRICING-B2B-3)", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({
        pricingSnapshot: {
          clientPricePerKg: 7.2,
          clientB2BPricePerKg: 32.5,
          clientB2BPricingVersion: "marketplace-b2b-target-anchored-v1",
          clientB2BPricingMode: "ADAPTIVE_B2B_ENGINE",
        },
      }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })
    assert.equal(snap.clientB2BPricePerKg, 32.5)
    assert.equal(snap.clientB2BPricingVersion, "marketplace-b2b-target-anchored-v1")
    assert.equal(snap.clientB2BPricingMode, "ADAPTIVE_B2B_ENGINE")
  })

  it("clientB2BPricePerKg passes through as null when absent (legacy row)", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({
        pricingSnapshot: { clientPricePerKg: 7.2 },
      }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })
    assert.equal(snap.clientB2BPricePerKg, null)
  })

  it("returns null pricing when neither source is set", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({ pricingSnapshot: null, pricePerKg: null }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })
    assert.equal(snap.greenPricePerKg, null)
  })

  it("preserves shipmentId for reserved lots", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({ status: "RESERVED", shipmentId: "ship-001" }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })
    assert.equal(snap.status, "RESERVED")
    assert.equal(snap.shipmentId, "ship-001")
  })

  it("clamps negative numeric inputs to zero", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({ totalKg: -100, availableKg: -50 }),
      committedContractMonthlyGreenKg: -10,
      committedContractHorizonGreenKg: -20,
      committedContractMonthsRemaining: -3,
      reservedIntentGreenKg: -5,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })
    assert.equal(snap.totalGreenKg, 0)
    assert.equal(snap.availableGreenKg, 0)
    assert.equal(snap.committedContractGreenKg, 0)
    assert.equal(snap.committedContractMonthlyGreenKg, 0)
    assert.equal(snap.committedContractHorizonGreenKg, 0)
    assert.equal(snap.committedContractMonthsRemaining, 0)
    assert.equal(snap.reservedIntentGreenKg, 0)
  })

})

// ------------------------------------------------------
// END-TO-END: mapper output flows through the engine
// ------------------------------------------------------

describe("mapper → engine integration", () => {

  it("RESERVED lot with shipmentId yields HOLD + SHIPMENT_ALREADY_RESERVED", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({ status: "RESERVED", shipmentId: "ship-XYZ" }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: false,
    })

    const decision = decideLotAllocation(snap)
    assert.equal(decision.recommendedSurface, "HOLD")
    assert.ok(
      decision.reasons.some((r) => r.code === "SHIPMENT_ALREADY_RESERVED")
    )
  })

  it("default-yield mapping flows the warning into the decision", () => {
    const snap = mapGreenLotToAllocationSnapshot({
      lot: makeLotRow({ estimatedRoastYield: null }),
      committedContractMonthlyGreenKg: 0,
      committedContractHorizonGreenKg: 0,
      committedContractMonthsRemaining: 0,
      reservedIntentGreenKg: 0,
      resolvedRoastYield: 0.85,
      usedDefaultRoastYield: true,
    })

    const decision = decideLotAllocation(snap)
    assert.ok(decision.reasons.some((r) => r.code === "MISSING_ROAST_YIELD"))
    assert.ok(decision.confidence < 1)
  })

})
