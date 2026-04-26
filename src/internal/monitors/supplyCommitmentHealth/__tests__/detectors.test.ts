// =====================================================
// UNIT TESTS — detectors
//
// Each detector: below WATCH, at each band, far above
// CRITICAL. Plus axis/name regression guards.
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  detectCommitmentLoadHigh,
  detectMonthsOfCoverLow,
  detectMonthsOfCoverCommittedLow,
  detectIntentPressureHigh,
  detectIntentConversionDrop,
  detectFulfilmentOverdue,
  runDetectors,
} from "../detectors/index.ts"

import type { Metrics } from "../types.ts"

// =====================================================
// metrics helper
// =====================================================

function metricsFixture(overrides: Partial<Metrics> = {}): Metrics {
  // Base fixture is intentionally well above every threshold so that
  // detectors only fire when an override moves a metric into a band.
  const base: Metrics = {
    publishedSupplyGreen: 10000,
    contractableGreen: 12000,
    committedGreen: 1000,
    monthlyDrawGreen: 1000,
    monthsOfCover: 12,                     // > MONTHS_OF_COVER_LOW.WATCH (9)
    monthsOfCoverCommittedOnly: 10,        // > MONTHS_OF_COVER_COMMITTED_LOW.WATCH (9)
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
    // Phase 2 supply-axis metrics — neutral defaults so the
    // base fixture does not fire any of the new detectors.
    farmConcentration: {
      topNShare: null,
      topNFarmIds: [],
      distinctFarmCount: 0,
      totalGreen: 0,
    },
    pinnedLotExposure: {
      worstLotId: null,
      worstRatio: null,
      exposedLotCount: 0,
      totalPinnedMonthlyGreen: 0,
      depletedPinnedLotIds: [],
    },
    supplyDiversity: {
      distinctFarmCount: 0,
      distinctLotCount: 0,
    },
    unbackedCommitment: {
      contractCount: 0,
      monthlyGreenKg: 0,
      shareOfMonthlyDraw: null,
      contractIds: [],
    },
  }
  return { ...base, ...overrides }
}

// =====================================================
// COMMITMENT_LOAD_HIGH
// =====================================================

test("COMMITMENT_LOAD_HIGH: below WATCH → null", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 5000, publishedSupplyGreen: 10000 }) // 0.5
  )
  assert.equal(r, null)
})

test("COMMITMENT_LOAD_HIGH: WATCH band", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 7500, publishedSupplyGreen: 10000 }) // 0.75
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "commitment")
  assert.equal(r.name, "COMMITMENT_LOAD_HIGH")
})

test("COMMITMENT_LOAD_HIGH: STRESSED band", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 9500, publishedSupplyGreen: 10000 }) // 0.95
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("COMMITMENT_LOAD_HIGH: CRITICAL at ratio = 1.0", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 10000, publishedSupplyGreen: 10000 })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("COMMITMENT_LOAD_HIGH: CRITICAL when published = 0 with commitments > 0", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 500, publishedSupplyGreen: 0 })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
  assert.equal(r.rationale.reason, "ZERO_PUBLISHED_SUPPLY_WITH_COMMITMENTS")
})

test("COMMITMENT_LOAD_HIGH: nothing fires when both are zero", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 0, publishedSupplyGreen: 0 })
  )
  assert.equal(r, null)
})

// =====================================================
// MONTHS_OF_COVER_LOW
// REGRESSION: axis MUST be "commitment"
// =====================================================

test("MONTHS_OF_COVER_LOW: above WATCH → null", () => {
  const r = detectMonthsOfCoverLow(metricsFixture({ monthsOfCover: 12 }))
  assert.equal(r, null)
})

test("MONTHS_OF_COVER_LOW: WATCH band", () => {
  const r = detectMonthsOfCoverLow(metricsFixture({ monthsOfCover: 8 }))
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
})

test("MONTHS_OF_COVER_LOW: STRESSED band", () => {
  const r = detectMonthsOfCoverLow(metricsFixture({ monthsOfCover: 5 }))
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("MONTHS_OF_COVER_LOW: CRITICAL band", () => {
  const r = detectMonthsOfCoverLow(metricsFixture({ monthsOfCover: 2 }))
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("MONTHS_OF_COVER_LOW REGRESSION: axis must be 'commitment', not 'supply'", () => {
  const r = detectMonthsOfCoverLow(metricsFixture({ monthsOfCover: 1 }))
  assert.ok(r)
  assert.equal(r.axis, "commitment")
})

test("MONTHS_OF_COVER_LOW: null metric → no fire", () => {
  const r = detectMonthsOfCoverLow(metricsFixture({ monthsOfCover: null }))
  assert.equal(r, null)
})

// =====================================================
// MONTHS_OF_COVER_COMMITTED_LOW
// =====================================================

test("MONTHS_OF_COVER_COMMITTED_LOW: above WATCH → null", () => {
  const r = detectMonthsOfCoverCommittedLow(
    metricsFixture({ monthsOfCoverCommittedOnly: 12 })
  )
  assert.equal(r, null)
})

test("MONTHS_OF_COVER_COMMITTED_LOW: CRITICAL when value is 0 (catastrophic)", () => {
  const r = detectMonthsOfCoverCommittedLow(
    metricsFixture({ monthsOfCoverCommittedOnly: 0 })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
  assert.equal(r.axis, "commitment")
})

test("MONTHS_OF_COVER_COMMITTED_LOW: null → no fire (no commitments, no risk)", () => {
  const r = detectMonthsOfCoverCommittedLow(
    metricsFixture({ monthsOfCoverCommittedOnly: null })
  )
  assert.equal(r, null)
})

// =====================================================
// INTENT_PRESSURE_HIGH
// =====================================================

test("INTENT_PRESSURE_HIGH: below WATCH → null", () => {
  const r = detectIntentPressureHigh(metricsFixture({ intentPressureRatio: 0.1 }))
  assert.equal(r, null)
})

test("INTENT_PRESSURE_HIGH: WATCH band", () => {
  const r = detectIntentPressureHigh(metricsFixture({ intentPressureRatio: 0.4 }))
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "demand")
})

test("INTENT_PRESSURE_HIGH: CRITICAL band", () => {
  const r = detectIntentPressureHigh(metricsFixture({ intentPressureRatio: 0.9 }))
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("INTENT_PRESSURE_HIGH: null → no fire", () => {
  const r = detectIntentPressureHigh(metricsFixture({ intentPressureRatio: null }))
  assert.equal(r, null)
})

// =====================================================
// INTENT_CONVERSION_DROP — bands are negative
// =====================================================

test("INTENT_CONVERSION_DROP: positive delta → null", () => {
  const r = detectIntentConversionDrop(
    metricsFixture({
      intentConversion: { current7d: 0.8, prior7d: 0.6, deltaPts: 20 },
    })
  )
  assert.equal(r, null)
})

test("INTENT_CONVERSION_DROP: small drop above WATCH → null", () => {
  const r = detectIntentConversionDrop(
    metricsFixture({
      intentConversion: { current7d: 0.6, prior7d: 0.65, deltaPts: -5 },
    })
  )
  assert.equal(r, null)
})

test("INTENT_CONVERSION_DROP: WATCH at -10pts", () => {
  const r = detectIntentConversionDrop(
    metricsFixture({
      intentConversion: { current7d: 0.5, prior7d: 0.6, deltaPts: -10 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "demand")
})

test("INTENT_CONVERSION_DROP: CRITICAL at -35pts", () => {
  const r = detectIntentConversionDrop(
    metricsFixture({
      intentConversion: { current7d: 0.25, prior7d: 0.6, deltaPts: -35 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

test("INTENT_CONVERSION_DROP: null delta → no fire", () => {
  const r = detectIntentConversionDrop(
    metricsFixture({
      intentConversion: { current7d: null, prior7d: 0.5, deltaPts: null },
    })
  )
  assert.equal(r, null)
})

// =====================================================
// FULFILMENT_OVERDUE
// =====================================================

test("FULFILMENT_OVERDUE: zero overdue → null", () => {
  const r = detectFulfilmentOverdue(
    metricsFixture({
      fulfilment: { overdueCount: 0, overdueRatio: 0, oldestOverdueDays: null },
    })
  )
  assert.equal(r, null)
})

test("FULFILMENT_OVERDUE: WATCH on first overdue", () => {
  const r = detectFulfilmentOverdue(
    metricsFixture({
      fulfilment: { overdueCount: 1, overdueRatio: 0.01, oldestOverdueDays: 4 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "WATCH")
  assert.equal(r.axis, "fulfilment")
})

test("FULFILMENT_OVERDUE: STRESSED via ratio", () => {
  const r = detectFulfilmentOverdue(
    metricsFixture({
      fulfilment: { overdueCount: 5, overdueRatio: 0.06, oldestOverdueDays: 4 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("FULFILMENT_OVERDUE: STRESSED via age", () => {
  const r = detectFulfilmentOverdue(
    metricsFixture({
      fulfilment: { overdueCount: 1, overdueRatio: 0.01, oldestOverdueDays: 9 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "STRESSED")
})

test("FULFILMENT_OVERDUE: CRITICAL via age", () => {
  const r = detectFulfilmentOverdue(
    metricsFixture({
      fulfilment: { overdueCount: 1, overdueRatio: 0.01, oldestOverdueDays: 16 },
    })
  )
  assert.ok(r)
  assert.equal(r.severity, "CRITICAL")
})

// =====================================================
// runDetectors registry — deterministic order
// =====================================================

test("runDetectors returns empty list when nothing fires", () => {
  const out = runDetectors(metricsFixture())
  assert.deepEqual(out, [])
})

test("runDetectors returns multiple fired detectors in stable order", () => {
  const m = metricsFixture({
    committedGreen: 9500,                    // COMMITMENT_LOAD_HIGH STRESSED
    publishedSupplyGreen: 10000,
    monthsOfCover: 2,                        // MONTHS_OF_COVER_LOW CRITICAL
    monthsOfCoverCommittedOnly: 1,           // MONTHS_OF_COVER_COMMITTED_LOW CRITICAL
    intentPressureRatio: 0.6,                // INTENT_PRESSURE_HIGH STRESSED
  })
  const a = runDetectors(m)
  const b = runDetectors(m)
  assert.equal(a.length, 4)
  assert.deepEqual(
    a.map((d) => d.name),
    b.map((d) => d.name)
  )
})

// =====================================================
// REGRESSION: detector name string is "COMMITMENT_LOAD_HIGH"
// (not the old "COMMITTED_OVER_PUBLISHED")
// =====================================================

test("REGRESSION: detector name is COMMITMENT_LOAD_HIGH (renamed from COMMITTED_OVER_PUBLISHED)", () => {
  const r = detectCommitmentLoadHigh(
    metricsFixture({ committedGreen: 10000, publishedSupplyGreen: 10000 })
  )
  assert.ok(r)
  assert.equal(r.name, "COMMITMENT_LOAD_HIGH")
  // Sanity: the old name is NOT used.
  assert.notEqual(r.name as string, "COMMITTED_OVER_PUBLISHED")
})
