// =====================================================
// UNIT TESTS — healthAxes.ts
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import { rollupHealthAxes } from "../healthAxes.ts"
import type { DetectorResult } from "../types.ts"

function fired(
  name: DetectorResult["name"],
  axis: DetectorResult["axis"],
  severity: DetectorResult["severity"]
): DetectorResult {
  return {
    name,
    axis,
    severity,
    observed: 0,
    threshold: 0,
    rationale: {},
    contributingIds: {},
  }
}

test("rollup: no detectors → all axes OK", () => {
  const a = rollupHealthAxes([])
  assert.equal(a.supplyHealth, "OK")
  assert.equal(a.demandHealth, "OK")
  assert.equal(a.commitmentHealth, "OK")
  assert.equal(a.fulfilmentHealth, "OK")
  assert.equal(a.overallHealth, "OK")
})

test("rollup: one detector per axis at WATCH", () => {
  const a = rollupHealthAxes([
    fired("COMMITMENT_LOAD_HIGH", "commitment", "WATCH"),
    fired("INTENT_PRESSURE_HIGH", "demand", "WATCH"),
    fired("FULFILMENT_OVERDUE", "fulfilment", "WATCH"),
  ])
  assert.equal(a.commitmentHealth, "WATCH")
  assert.equal(a.demandHealth, "WATCH")
  assert.equal(a.fulfilmentHealth, "WATCH")
  assert.equal(a.supplyHealth, "OK")
  assert.equal(a.overallHealth, "WATCH")
})

test("rollup: conservative-max wins on the same axis", () => {
  const a = rollupHealthAxes([
    fired("COMMITMENT_LOAD_HIGH", "commitment", "WATCH"),
    fired("MONTHS_OF_COVER_LOW", "commitment", "CRITICAL"),
    fired("MONTHS_OF_COVER_COMMITTED_LOW", "commitment", "STRESSED"),
  ])
  assert.equal(a.commitmentHealth, "CRITICAL")
  assert.equal(a.overallHealth, "CRITICAL")
})

test("rollup: overall is the max of all axes", () => {
  const a = rollupHealthAxes([
    fired("INTENT_PRESSURE_HIGH", "demand", "STRESSED"),
    fired("FULFILMENT_OVERDUE", "fulfilment", "WATCH"),
  ])
  assert.equal(a.demandHealth, "STRESSED")
  assert.equal(a.fulfilmentHealth, "WATCH")
  assert.equal(a.commitmentHealth, "OK")
  assert.equal(a.overallHealth, "STRESSED")
})

test("rollup: supplyHealth has no detectors in v1 → always OK in this rollup test", () => {
  // Even with everything else firing, supplyHealth is OK because
  // no v1 detector maps to the supply axis.
  const a = rollupHealthAxes([
    fired("COMMITMENT_LOAD_HIGH", "commitment", "CRITICAL"),
    fired("INTENT_PRESSURE_HIGH", "demand", "CRITICAL"),
    fired("FULFILMENT_OVERDUE", "fulfilment", "CRITICAL"),
  ])
  assert.equal(a.supplyHealth, "OK")
  assert.equal(a.overallHealth, "CRITICAL")
})

test("rollup: overall is never less severe than any individual axis (invariant)", () => {
  const samples: Array<DetectorResult["severity"]> = ["WATCH", "STRESSED", "CRITICAL"]
  for (const s of samples) {
    const a = rollupHealthAxes([
      fired("FULFILMENT_OVERDUE", "fulfilment", s),
    ])
    const order = { OK: 0, WATCH: 1, STRESSED: 2, CRITICAL: 3 }
    assert.ok(order[a.overallHealth] >= order[a.fulfilmentHealth])
  }
})
