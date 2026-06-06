//////////////////////////////////////////////////////
// 🧪 LOT ALLOCATION ENGINE — GOLDEN TESTS
//
// Pure tests against decideLotAllocation. No Prisma,
// no fixtures from disk — every snapshot is built
// inline so the truth is visible at the call site.
//
// Run with:
//   npm run test:allocation
//
// Which expands to:
//   node --experimental-strip-types --test \
//     src/services/allocation/__tests__/*.test.ts
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { decideLotAllocation } from "../engine/lotAllocationEngine.ts"
import { DEFAULT_ALLOCATION_POLICY } from "../policy/allocationPolicy.ts"
import type {
  AllocationReasonCode,
  LotAllocationDecision,
  LotAllocationSnapshot,
} from "../domain/types.ts"

// ------------------------------------------------------
// SNAPSHOT BUILDER
// Sensible defaults that any test can override per-field.
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
    scaScore: 84,
    variety: "Caturra",
    process: "WASHED",
    harvestYear: 2026,
    estimatedRoastYield: 0.85,
    usedDefaultRoastYield: false,
    greenPricePerKg: 6.5,
    farmId: "farm-1",
    farmRegion: "Huila",
    farmAltitude: 1700,
    producerCountry: "Colombia",
    committedContractGreenKg: 0,
    committedContractMonthsRemaining: 0,
    reservedIntentGreenKg: 0,
    shipmentId: null,
    marketDemandIndex: null,
    ...overrides,
  }
}

function hasReason(d: LotAllocationDecision, code: AllocationReasonCode): boolean {
  return d.reasons.some((r) => r.code === code)
}

function poolSum(d: LotAllocationDecision): number {
  return (
    d.contractReservedGreenKg +
    d.contractAssignableGreenKg +
    d.marketplaceEligibleGreenKg +
    d.exclusiveMicrolotGreenKg +
    d.blockedGreenKg +
    d.safetyBufferGreenKg
  )
}

// ------------------------------------------------------
// GOLDEN CASES
// ------------------------------------------------------

describe("decideLotAllocation — golden", () => {

  // === 1 =========================================
  it("1. Large lot 5000kg, SCA 84, Caturra, no commitments → contract eligible", () => {
    const snap = makeSnapshot({
      totalGreenKg: 5000,
      availableGreenKg: 5000,
      scaScore: 84,
      variety: "Caturra",
    })
    const d = decideLotAllocation(snap)

    assert.ok(
      d.recommendedSurface === "CONTRACT_CATALOG" || d.recommendedSurface === "SPLIT",
      `expected CONTRACT_CATALOG or SPLIT, got ${d.recommendedSurface}`
    )
    assert.ok(d.contractAssignableGreenKg > 0, "contractAssignableGreenKg should be > 0")
    assert.ok(hasReason(d, "CONTRACT_VOLUME_SUFFICIENT"))
    assert.ok(d.viableProfiles.length > 0)
  })

  // === 2 =========================================
  it("2. Very large lot 30000kg → SPLIT with marketplace residual", () => {
    const snap = makeSnapshot({
      totalGreenKg: 30000,
      availableGreenKg: 30000,
      scaScore: 84,
      variety: "Caturra",
    })
    const d = decideLotAllocation(snap)

    assert.equal(d.recommendedSurface, "SPLIT")
    assert.ok(d.contractAssignableGreenKg > 0)
    assert.ok(
      d.marketplaceEligibleGreenKg >= DEFAULT_ALLOCATION_POLICY.minMarketplaceKg,
      `marketplace residual should clear minMarketplaceKg, got ${d.marketplaceEligibleGreenKg}`
    )
    assert.ok(hasReason(d, "RESIDUAL_MARKETPLACE_ELIGIBLE"))
    assert.ok(hasReason(d, "CONTRACT_VOLUME_SUFFICIENT"))
  })

  // === 3 =========================================
  it("3. Small lot 300kg, SCA 85 → OPEN_MARKETPLACE + LOW_VOLUME_LOT", () => {
    const snap = makeSnapshot({
      totalGreenKg: 300,
      availableGreenKg: 300,
      scaScore: 85,
      variety: "Caturra",
    })
    const d = decideLotAllocation(snap)

    assert.equal(d.recommendedSurface, "OPEN_MARKETPLACE")
    assert.ok(hasReason(d, "LOW_VOLUME_LOT"))
    assert.equal(d.marketplaceEligibleGreenKg, 300)
    // Safety buffer must NOT be applied to a small lot — otherwise
    // the entire 300 kg disappears.
    assert.equal(d.safetyBufferGreenKg, 0)
  })

  // === 4 =========================================
  it("4. Geisha SCA 91, 400kg → EXCLUSIVE_MICROLOT (rare variety)", () => {
    const snap = makeSnapshot({
      totalGreenKg: 400,
      availableGreenKg: 400,
      scaScore: 91,
      variety: "Geisha",
    })
    const d = decideLotAllocation(snap)

    assert.equal(d.recommendedSurface, "EXCLUSIVE_MICROLOT")
    assert.ok(d.exclusiveMicrolotGreenKg > 0)
    assert.ok(
      hasReason(d, "RARE_VARIETY_EXCLUSIVE") || hasReason(d, "HIGH_SCA_EXCLUSIVE")
    )
    assert.equal(d.safetyBufferGreenKg, 0)
  })

  // === 5 =========================================
  it("5. Caturra SCA 90, 2000kg → NOT exclusive, contract route", () => {
    const snap = makeSnapshot({
      totalGreenKg: 2000,
      availableGreenKg: 2000,
      scaScore: 90,
      variety: "Caturra",
    })
    const d = decideLotAllocation(snap)

    assert.notEqual(
      d.recommendedSurface,
      "EXCLUSIVE_MICROLOT",
      "high SCA on a 2000 kg non-rare lot must NOT trigger exclusive"
    )
    assert.ok(
      d.recommendedSurface === "CONTRACT_CATALOG" || d.recommendedSurface === "SPLIT",
      `expected CONTRACT_CATALOG or SPLIT, got ${d.recommendedSurface}`
    )
    assert.ok(d.contractAssignableGreenKg > 0)
  })

  // === 6 =========================================
  it("6. Lot with active committedContractGreenKg → CONTRACT_COMMITTED reason", () => {
    const snap = makeSnapshot({
      totalGreenKg: 5000,
      availableGreenKg: 5000,
      scaScore: 84,
      variety: "Caturra",
      committedContractGreenKg: 1200,
      committedContractMonthsRemaining: 12,
    })
    const d = decideLotAllocation(snap)

    assert.ok(hasReason(d, "CONTRACT_COMMITTED"))
    assert.equal(d.committedContractGreenKg, 1200)
    assert.equal(d.contractReservedGreenKg, 1200)
  })

  // === 7 =========================================
  it("7. Lot with reservedIntentGreenKg → DEMAND_INTENT_RESERVED + deduction", () => {
    const snap = makeSnapshot({
      totalGreenKg: 5000,
      availableGreenKg: 5000,
      scaScore: 84,
      variety: "Caturra",
      reservedIntentGreenKg: 800,
    })
    const d = decideLotAllocation(snap)

    assert.ok(hasReason(d, "DEMAND_INTENT_RESERVED"))
    assert.equal(d.reservedIntentGreenKg, 800)
    // Pool sum may not exceed available − reservedIntents (intents are
    // honoured but not displayed as a separate bucket).
    assert.ok(
      poolSum(d) <= snap.availableGreenKg - 800 + 1e-6,
      `pool sum ${poolSum(d)} must respect intent reservation 800`
    )
  })

  // === 8 =========================================
  it("8. Shipment-bound lot (status RESERVED + shipmentId) → HOLD", () => {
    const snap = makeSnapshot({
      status: "RESERVED",
      shipmentId: "ship-001",
      totalGreenKg: 5000,
      availableGreenKg: 5000,
    })
    const d = decideLotAllocation(snap)

    assert.equal(d.recommendedSurface, "HOLD")
    assert.ok(hasReason(d, "SHIPMENT_ALREADY_RESERVED"))
    assert.equal(d.contractAssignableGreenKg, 0)
    assert.equal(d.marketplaceEligibleGreenKg, 0)
    assert.equal(d.exclusiveMicrolotGreenKg, 0)
  })

  // === 9 =========================================
  it("9. Missing pricing → HOLD + MISSING_PRICING", () => {
    const snap = makeSnapshot({ greenPricePerKg: null })
    const d = decideLotAllocation(snap)

    assert.equal(d.recommendedSurface, "HOLD")
    assert.ok(hasReason(d, "MISSING_PRICING"))
  })

  // === 10 ========================================
  it("10. Default roast yield → confidence < 1 + MISSING_ROAST_YIELD warning", () => {
    const snap = makeSnapshot({ usedDefaultRoastYield: true })
    const d = decideLotAllocation(snap)

    assert.ok(hasReason(d, "MISSING_ROAST_YIELD"))
    assert.ok(d.confidence < 1, `confidence should drop below 1, got ${d.confidence}`)
    const warning = d.reasons.find((r) => r.code === "MISSING_ROAST_YIELD")
    assert.equal(warning?.severity, "warning")
  })

  // === 11 ========================================
  it("11. DRAFT lot → HOLD + LOT_NOT_PUBLISHED", () => {
    const snap = makeSnapshot({ status: "DRAFT" })
    const d = decideLotAllocation(snap)

    assert.equal(d.recommendedSurface, "HOLD")
    assert.ok(hasReason(d, "LOT_NOT_PUBLISHED"))
  })

  // === 12 ========================================
  it("12. Free pool below minMarketplace and no viable contract → HOLD", () => {
    // Lot is contract-sized (so we apply buffer + viability check),
    // but committed eats almost everything so the buffer-deducted
    // residual is below minMarketplaceKg.
    const snap = makeSnapshot({
      totalGreenKg: 2000,
      availableGreenKg: 2000,
      scaScore: 84,
      variety: "Caturra",
      committedContractGreenKg: 1597,         // leaves 403 unclaimed
      committedContractMonthsRemaining: 6,
      reservedIntentGreenKg: 0,
    })
    const d = decideLotAllocation(snap)

    // unclaimed = 403, buffer = 400, free = 3 → below minMarketplaceKg (5)
    assert.equal(d.recommendedSurface, "HOLD")
    assert.ok(hasReason(d, "RESIDUAL_TOO_SMALL_FOR_CONTRACT"))
    assert.equal(d.marketplaceEligibleGreenKg, 0)
    assert.equal(d.contractAssignableGreenKg, 0)
  })

})

// ------------------------------------------------------
// CROSS-CASE INVARIANTS
// ------------------------------------------------------

describe("decideLotAllocation — invariants", () => {

  it("evaluatedAt is a valid ISO-8601 timestamp", () => {
    const d = decideLotAllocation(makeSnapshot())
    assert.ok(!Number.isNaN(Date.parse(d.evaluatedAt)))
  })

  it("policyVersion matches the policy used", () => {
    const d = decideLotAllocation(makeSnapshot())
    assert.equal(d.policyVersion, DEFAULT_ALLOCATION_POLICY.policyVersion)
  })

  it("partition pools are never negative for any golden case", () => {
    const cases: Array<Partial<LotAllocationSnapshot>> = [
      {},
      { totalGreenKg: 30000, availableGreenKg: 30000 },
      { totalGreenKg: 300, availableGreenKg: 300 },
      { totalGreenKg: 400, availableGreenKg: 400, variety: "Geisha", scaScore: 91 },
      { totalGreenKg: 2000, availableGreenKg: 2000, scaScore: 90 },
      { committedContractGreenKg: 1200, committedContractMonthsRemaining: 12 },
      { reservedIntentGreenKg: 800 },
      { status: "RESERVED", shipmentId: "ship-1" },
      { greenPricePerKg: null },
      { usedDefaultRoastYield: true },
      { status: "DRAFT" },
    ]

    for (const partial of cases) {
      const d = decideLotAllocation(makeSnapshot(partial))
      assert.ok(d.contractReservedGreenKg >= 0)
      assert.ok(d.contractAssignableGreenKg >= 0)
      assert.ok(d.marketplaceEligibleGreenKg >= 0)
      assert.ok(d.exclusiveMicrolotGreenKg >= 0)
      assert.ok(d.blockedGreenKg >= 0)
      assert.ok(d.safetyBufferGreenKg >= 0)
    }
  })

  it("pool sum never exceeds availableGreenKg for any golden case", () => {
    const cases: Array<Partial<LotAllocationSnapshot>> = [
      {},
      { totalGreenKg: 30000, availableGreenKg: 30000 },
      { totalGreenKg: 300, availableGreenKg: 300 },
      { totalGreenKg: 400, availableGreenKg: 400, variety: "Geisha", scaScore: 91 },
      { totalGreenKg: 2000, availableGreenKg: 2000, scaScore: 90 },
      { committedContractGreenKg: 1200, committedContractMonthsRemaining: 12 },
      { reservedIntentGreenKg: 800 },
    ]

    for (const partial of cases) {
      const snap = makeSnapshot(partial)
      const d = decideLotAllocation(snap)
      assert.ok(
        poolSum(d) <= snap.availableGreenKg + 1e-6,
        `pool sum ${poolSum(d)} > available ${snap.availableGreenKg} for ${JSON.stringify(partial)}`
      )
    }
  })

})
