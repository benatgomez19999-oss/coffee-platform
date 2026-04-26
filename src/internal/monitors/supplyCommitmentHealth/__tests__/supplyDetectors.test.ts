// =====================================================
// UNIT TESTS — Phase 2 supply-axis detectors
//
// Each detector: below WATCH, at each band, edge cases.
// All four land on axis = "supply".
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  detectFarmConcentrationHigh,
  detectSupplyDiversityLow,
  detectPinnedLotOverexposed,
  detectUnbackedCommitmentsHigh,
} from "../detectors/index.ts"

import type { Metrics } from "../types.ts"

// =====================================================
// metrics fixture
//
// Same idea as detectors.test.ts: base is well above
// every threshold so the detector only fires when an
// override moves a metric into a band.
// =====================================================

function metricsFixture(overrides: Partial<Metrics> = {}): Metrics {
  const base: Metrics = {
    publishedSupplyGreen: 10000,
    contractableGreen: 12000,
    committedGreen: 1000,
    monthlyDrawGreen: 1000,
    monthsOfCover: 12,
    monthsOfCoverCommittedOnly: 10,
    activeOpenIntentLoad: {
      greenKg: 0,
      roastedKg: 0,
      offeredRoastedKg: 0,
      intentCount: 0,
      createCount: 0,
      amendCount: 0,
    },
    intentPressureRatio: 0,
    intentConversion: { current7d: null, prior7d: null, deltaPts: null },
    fulfilment: { overdueCount: 0, overdueRatio: null, oldestOverdueDays: null },
    farmConcentration: {
      topNShare: 0.10, // well below WATCH (0.50)
      topNFarmIds: ["fa", "fb", "fc"],
      distinctFarmCount: 20,
      totalGreen: 10000,
    },
    pinnedLotExposure: {
      worstLotId: null,
      worstRatio: null,
      exposedLotCount: 0,
      totalPinnedMonthlyGreen: 0,
      depletedPinnedLotIds: [],
    },
    supplyDiversity: {
      distinctFarmCount: 20, // well above WATCH (8)
      distinctLotCount: 50,
    },
    unbackedCommitment: {
      contractCount: 0,
      monthlyGreenKg: 0,
      shareOfMonthlyDraw: 0, // not null → detector evaluates → 0 < WATCH → no fire
      contractIds: [],
    },
  }
  return { ...base, ...overrides }
}

// =====================================================
// FARM_CONCENTRATION_HIGH
// =====================================================

test("FARM_CONCENTRATION_HIGH: below WATCH → null", () => {
  const r = detectFarmConcentrationHigh(
    metricsFixture({
      farmConcentration: {
        topNShare: 0.40,
        topNFarmIds: ["fa", "fb", "fc"],
        distinctFarmCount: 20,
        totalGreen: 10000,
      },
    })
  )
  assert.equal(r, null)
})

test("FARM_CONCENTRATION_HIGH: WATCH at 0.50", () => {
  const r = detectFarmConcentrationHigh(
    metricsFixture({
      farmConcentration: {
        topNShare: 0.50,
        topNFarmIds: ["fa", "fb", "fc"],
        distinctFarmCount: 20,
        totalGreen: 10000,
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "supply")
})

test("FARM_CONCENTRATION_HIGH: STRESSED at 0.70", () => {
  const r = detectFarmConcentrationHigh(
    metricsFixture({
      farmConcentration: {
        topNShare: 0.70,
        topNFarmIds: ["fa", "fb", "fc"],
        distinctFarmCount: 20,
        totalGreen: 10000,
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("FARM_CONCENTRATION_HIGH: CRITICAL at 0.85", () => {
  const r = detectFarmConcentrationHigh(
    metricsFixture({
      farmConcentration: {
        topNShare: 0.95,
        topNFarmIds: ["fa", "fb", "fc"],
        distinctFarmCount: 20,
        totalGreen: 10000,
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("FARM_CONCENTRATION_HIGH: null share → no fire", () => {
  const r = detectFarmConcentrationHigh(
    metricsFixture({
      farmConcentration: {
        topNShare: null,
        topNFarmIds: [],
        distinctFarmCount: 0,
        totalGreen: 0,
      },
    })
  )
  assert.equal(r, null)
})

// =====================================================
// SUPPLY_DIVERSITY_LOW
// =====================================================

test("SUPPLY_DIVERSITY_LOW: above WATCH → null", () => {
  const r = detectSupplyDiversityLow(
    metricsFixture({
      supplyDiversity: { distinctFarmCount: 20, distinctLotCount: 50 },
    })
  )
  assert.equal(r, null)
})

test("SUPPLY_DIVERSITY_LOW: WATCH (< 8 farms)", () => {
  const r = detectSupplyDiversityLow(
    metricsFixture({
      supplyDiversity: { distinctFarmCount: 7, distinctLotCount: 20 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "supply")
})

test("SUPPLY_DIVERSITY_LOW: STRESSED (< 5 farms)", () => {
  const r = detectSupplyDiversityLow(
    metricsFixture({
      supplyDiversity: { distinctFarmCount: 4, distinctLotCount: 10 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("SUPPLY_DIVERSITY_LOW: CRITICAL (< 3 farms)", () => {
  const r = detectSupplyDiversityLow(
    metricsFixture({
      supplyDiversity: { distinctFarmCount: 2, distinctLotCount: 4 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("SUPPLY_DIVERSITY_LOW: zero farms → no fire (greenfield, not fragility)", () => {
  const r = detectSupplyDiversityLow(
    metricsFixture({
      supplyDiversity: { distinctFarmCount: 0, distinctLotCount: 0 },
    })
  )
  assert.equal(r, null)
})

// =====================================================
// PINNED_LOT_OVEREXPOSED
// =====================================================

test("PINNED_LOT_OVEREXPOSED: null worstRatio and no depleted → null", () => {
  const r = detectPinnedLotOverexposed(metricsFixture())
  assert.equal(r, null)
})

test("PINNED_LOT_OVEREXPOSED: WATCH at ratio = 1.0", () => {
  const r = detectPinnedLotOverexposed(
    metricsFixture({
      pinnedLotExposure: {
        worstLotId: "lot-1",
        worstRatio: 1.0,
        exposedLotCount: 1,
        totalPinnedMonthlyGreen: 100,
        depletedPinnedLotIds: [],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "supply")
})

test("PINNED_LOT_OVEREXPOSED: STRESSED at ratio = 2.0", () => {
  const r = detectPinnedLotOverexposed(
    metricsFixture({
      pinnedLotExposure: {
        worstLotId: "lot-1",
        worstRatio: 2.0,
        exposedLotCount: 1,
        totalPinnedMonthlyGreen: 200,
        depletedPinnedLotIds: [],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("PINNED_LOT_OVEREXPOSED: CRITICAL at ratio = 3.0", () => {
  const r = detectPinnedLotOverexposed(
    metricsFixture({
      pinnedLotExposure: {
        worstLotId: "lot-1",
        worstRatio: 3.5,
        exposedLotCount: 1,
        totalPinnedMonthlyGreen: 300,
        depletedPinnedLotIds: [],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("PINNED_LOT_OVEREXPOSED: depleted lot forces CRITICAL even with low ratio", () => {
  const r = detectPinnedLotOverexposed(
    metricsFixture({
      pinnedLotExposure: {
        worstLotId: "lot-ok",
        worstRatio: 0.1, // would not fire on its own
        exposedLotCount: 0,
        totalPinnedMonthlyGreen: 100,
        depletedPinnedLotIds: ["lot-bad"],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
  assert.deepEqual(r.contributingIds.greenLotIds, ["lot-bad"])
})

test("PINNED_LOT_OVEREXPOSED: contributingIds points at worstLotId on ratio path", () => {
  const r = detectPinnedLotOverexposed(
    metricsFixture({
      pinnedLotExposure: {
        worstLotId: "lot-w",
        worstRatio: 1.5,
        exposedLotCount: 1,
        totalPinnedMonthlyGreen: 150,
        depletedPinnedLotIds: [],
      },
    })
  )
  assert.ok(r)
  assert.deepEqual(r.contributingIds.greenLotIds, ["lot-w"])
})

// =====================================================
// UNBACKED_COMMITMENTS_HIGH
// =====================================================

test("UNBACKED_COMMITMENTS_HIGH: null share → no fire", () => {
  const r = detectUnbackedCommitmentsHigh(
    metricsFixture({
      unbackedCommitment: {
        contractCount: 0,
        monthlyGreenKg: 0,
        shareOfMonthlyDraw: null,
        contractIds: [],
      },
    })
  )
  assert.equal(r, null)
})

test("UNBACKED_COMMITMENTS_HIGH: below WATCH → null", () => {
  const r = detectUnbackedCommitmentsHigh(
    metricsFixture({
      unbackedCommitment: {
        contractCount: 1,
        monthlyGreenKg: 50,
        shareOfMonthlyDraw: 0.05,
        contractIds: ["c1"],
      },
    })
  )
  assert.equal(r, null)
})

test("UNBACKED_COMMITMENTS_HIGH: WATCH at 0.10", () => {
  const r = detectUnbackedCommitmentsHigh(
    metricsFixture({
      unbackedCommitment: {
        contractCount: 1,
        monthlyGreenKg: 100,
        shareOfMonthlyDraw: 0.10,
        contractIds: ["c1"],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "supply")
})

test("UNBACKED_COMMITMENTS_HIGH: STRESSED at 0.25", () => {
  const r = detectUnbackedCommitmentsHigh(
    metricsFixture({
      unbackedCommitment: {
        contractCount: 1,
        monthlyGreenKg: 250,
        shareOfMonthlyDraw: 0.25,
        contractIds: ["c1"],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("UNBACKED_COMMITMENTS_HIGH: CRITICAL at 0.50", () => {
  const r = detectUnbackedCommitmentsHigh(
    metricsFixture({
      unbackedCommitment: {
        contractCount: 3,
        monthlyGreenKg: 500,
        shareOfMonthlyDraw: 0.60,
        contractIds: ["c1", "c2", "c3"],
      },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
  assert.deepEqual(r.contributingIds.contractIds, ["c1", "c2", "c3"])
})
