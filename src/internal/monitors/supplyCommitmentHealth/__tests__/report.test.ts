// =====================================================
// UNIT TESTS — report.ts
//
// signals ranking, monitorVersion stamping, top-N cap.
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import { assembleReport } from "../report.ts"
import { MONITOR_VERSION } from "../constants.ts"
import { SIGNAL_TOP_N } from "../config.ts"

import type {
  DetectorResult,
  Metrics,
  HealthAxes,
  InputCounts,
  Attribution,
} from "../types.ts"

const FIXED_START = new Date("2026-04-10T12:00:00Z")
const FIXED_END = new Date("2026-04-10T12:00:00.500Z")

function fired(
  name: DetectorResult["name"],
  severity: DetectorResult["severity"],
  observed: number,
  threshold: number
): DetectorResult {
  return {
    name,
    severity,
    axis: "commitment",
    observed,
    threshold,
    rationale: {},
    contributingIds: {},
  }
}

function emptyMetrics(): Metrics {
  return {
    publishedSupplyGreen: 0,
    contractableGreen: 0,
    committedGreen: 0,
    monthlyDrawGreen: 0,
    monthsOfCover: null,
    monthsOfCoverCommittedOnly: null,
    activeOpenIntentLoad: {
      greenKg: 0,
      roastedKg: 0,
      offeredRoastedKg: 0,
      intentCount: 0,
      createCount: 0,
      amendCount: 0,
    },
    intentPressureRatio: null,
    intentConversion: { current7d: null, prior7d: null, deltaPts: null },
    fulfilment: { overdueCount: 0, overdueRatio: null, oldestOverdueDays: null },
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
}

function emptyAxes(): HealthAxes {
  return {
    supplyHealth: "OK",
    demandHealth: "OK",
    commitmentHealth: "OK",
    fulfilmentHealth: "OK",
    overallHealth: "OK",
  }
}

const emptyCounts: InputCounts = {
  greenLotCount: 0,
  committedContractCount: 0,
  openIntentCount: 0,
  fulfilmentRowCount: 0,
  windowIntentCountCurrent: 0,
  windowIntentCountPrior: 0,
}

const emptyAttribution: Attribution = { byDetector: {} }

function build(detectors: DetectorResult[]) {
  return assembleReport({
    runStartedAt: FIXED_START,
    runFinishedAt: FIXED_END,
    inputFingerprint: "fp-test",
    inputCounts: emptyCounts,
    metrics: emptyMetrics(),
    detectors,
    axes: emptyAxes(),
    attribution: emptyAttribution,
    runId: "run-test",
  })
}

test("report: meta fields are stamped correctly", () => {
  const r = build([])
  assert.equal(r.meta.runId, "run-test")
  assert.equal(r.meta.monitorVersion, MONITOR_VERSION)
  assert.equal(r.meta.runStartedAt, FIXED_START.toISOString())
  assert.equal(r.meta.runFinishedAt, FIXED_END.toISOString())
  assert.equal(r.meta.durationMs, 500)
  assert.equal(r.meta.inputFingerprint, "fp-test")
})

test("report: signals are ranked severity-DESC then magnitude-DESC", () => {
  const detectors: DetectorResult[] = [
    fired("INTENT_PRESSURE_HIGH", "WATCH", 0.31, 0.30),  // tiny over WATCH
    fired("MONTHS_OF_COVER_LOW", "CRITICAL", 0.5, 3),    // big under CRITICAL
    fired("COMMITMENT_LOAD_HIGH", "STRESSED", 0.95, 0.9), // small over STRESSED
    fired("MONTHS_OF_COVER_COMMITTED_LOW", "CRITICAL", 1, 3), // smaller magnitude under CRITICAL
  ]
  const r = build(detectors)
  // Critical first, then stressed, then watch
  assert.equal(r.signals[0].severity, "CRITICAL")
  assert.equal(r.signals[1].severity, "CRITICAL")
  assert.equal(r.signals[2].severity, "STRESSED")
  assert.equal(r.signals[3].severity, "WATCH")
  // Within CRITICAL, biggest magnitude first
  assert.equal(r.signals[0].name, "MONTHS_OF_COVER_LOW")
  assert.equal(r.signals[1].name, "MONTHS_OF_COVER_COMMITTED_LOW")
})

test("report: signals are capped at SIGNAL_TOP_N", () => {
  const lots: DetectorResult[] = []
  for (let i = 0; i < 20; i++) {
    lots.push(fired("INTENT_PRESSURE_HIGH", "WATCH", 0.31 + i / 100, 0.30))
  }
  const r = build(lots)
  assert.equal(r.signals.length, SIGNAL_TOP_N)
  // detectors array is the full ranked list, not capped
  assert.equal(r.detectors.length, 20)
})

test("report: empty detectors → empty signals, empty detectors", () => {
  const r = build([])
  assert.equal(r.signals.length, 0)
  assert.equal(r.detectors.length, 0)
})

test("report: monitorVersion stamp matches constants.ts", () => {
  const r = build([])
  assert.equal(r.meta.monitorVersion, MONITOR_VERSION)
})
