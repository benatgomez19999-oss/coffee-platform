// =====================================================
// UNIT TESTS — metrics/derived.ts
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  safeDiv,
  computeMonthsOfCover,
  computeMonthsOfCoverCommittedOnly,
  computeIntentPressureRatio,
  computeIntentConversion,
  computeFulfilmentMetrics,
} from "../metrics/derived.ts"

import type { IntentWindowRow, FulfilmentRow } from "../types.ts"

// =====================================================
// safeDiv — never throws, never returns Infinity/NaN
// =====================================================

test("safeDiv normal division", () => {
  assert.equal(safeDiv(10, 2), 5)
})

test("safeDiv returns null on zero denominator", () => {
  assert.equal(safeDiv(10, 0), null)
})

test("safeDiv returns null on NaN", () => {
  assert.equal(safeDiv(NaN, 2), null)
  assert.equal(safeDiv(2, NaN), null)
})

test("safeDiv returns null on Infinity inputs", () => {
  assert.equal(safeDiv(Infinity, 1), null)
  assert.equal(safeDiv(1, Infinity), null)
})

// =====================================================
// monthsOfCover — operational runway
// =====================================================

test("monthsOfCover normal case", () => {
  // 1200 contractable / 100 monthly draw = 12 months
  assert.equal(computeMonthsOfCover(1200, 100), 12)
})

test("monthsOfCover returns null when monthlyDrawGreen = 0", () => {
  assert.equal(computeMonthsOfCover(1000, 0), null)
})

test("monthsOfCover returns 0 when contractable = 0 and draw > 0", () => {
  assert.equal(computeMonthsOfCover(0, 100), 0)
})

// =====================================================
// monthsOfCoverCommittedOnly — structural floor
// =====================================================

test("monthsOfCoverCommittedOnly normal case", () => {
  // 600 published / 100 committed = 6
  assert.equal(computeMonthsOfCoverCommittedOnly(600, 100), 6)
})

test("monthsOfCoverCommittedOnly returns null when committed = 0 (no floor risk)", () => {
  assert.equal(computeMonthsOfCoverCommittedOnly(1000, 0), null)
})

test("monthsOfCoverCommittedOnly REGRESSION: published = 0 with committed > 0 → 0 (catastrophic)", () => {
  // Catastrophic case: nothing published, contracts owed.
  assert.equal(computeMonthsOfCoverCommittedOnly(0, 100), 0)
})

// =====================================================
// intentPressureRatio
// =====================================================

test("intentPressureRatio normal case", () => {
  assert.equal(computeIntentPressureRatio(300, 1000), 0.3)
})

test("intentPressureRatio returns null on zero contractable", () => {
  assert.equal(computeIntentPressureRatio(100, 0), null)
})

// =====================================================
// intentConversion
// =====================================================

const t = (id: string, consumed: boolean): IntentWindowRow => ({
  id,
  status: consumed ? "CONSUMED" : "OPEN",
  type: "CREATE",
  contractId: consumed ? "ctr-" + id : null,
  createdAt: new Date("2026-04-01T00:00:00Z"),
  consumedAt: consumed ? new Date("2026-04-02T00:00:00Z") : null,
})

test("intentConversion normal case", () => {
  // current: 4 of 10 consumed = 0.4
  // prior: 8 of 10 consumed = 0.8
  // delta = (0.4 - 0.8) * 100 = -40 pts
  const current: IntentWindowRow[] = [
    t("c1", true), t("c2", true), t("c3", true), t("c4", true),
    t("c5", false), t("c6", false), t("c7", false), t("c8", false),
    t("c9", false), t("c10", false),
  ]
  const prior: IntentWindowRow[] = [
    t("p1", true), t("p2", true), t("p3", true), t("p4", true),
    t("p5", true), t("p6", true), t("p7", true), t("p8", true),
    t("p9", false), t("p10", false),
  ]
  const conv = computeIntentConversion(current, prior)
  assert.equal(conv.current7d, 0.4)
  assert.equal(conv.prior7d, 0.8)
  assert.equal(conv.deltaPts, -40)
})

test("intentConversion returns null deltaPts when a window is empty", () => {
  const conv = computeIntentConversion([], [t("p", true)])
  assert.equal(conv.current7d, null)
  assert.equal(conv.prior7d, 1)
  assert.equal(conv.deltaPts, null)
})

test("intentConversion returns null deltaPts when both windows are empty", () => {
  const conv = computeIntentConversion([], [])
  assert.equal(conv.current7d, null)
  assert.equal(conv.prior7d, null)
  assert.equal(conv.deltaPts, null)
})

// =====================================================
// fulfilment metrics
// =====================================================

const NOW = new Date("2026-04-10T12:00:00Z")
const dayMs = 24 * 60 * 60 * 1000

function fulfilment(
  id: string,
  status: string,
  ageDays: number
): FulfilmentRow {
  return {
    id,
    status,
    greenLotId: "g-" + id,
    producerId: "p1",
    createdAt: new Date(NOW.getTime() - ageDays * dayMs),
    updatedAt: new Date(NOW.getTime() - ageDays * dayMs),
  }
}

test("fulfilment metrics: empty input → all null/zero", () => {
  const m = computeFulfilmentMetrics([], NOW)
  assert.equal(m.overdueCount, 0)
  assert.equal(m.overdueRatio, null)
  assert.equal(m.oldestOverdueDays, null)
})

test("fulfilment metrics: SLA = 3 days, 5-day-old AWAITING is overdue", () => {
  // v1.0.1: denominator is the AWAITING_CONFIRMATION subset only,
  // so 2 overdue out of 3 awaiting = 2/3, NOT 2/4. The CONFIRMED
  // row is excluded from the denominator because it is not
  // eligible to become overdue.
  const rows: FulfilmentRow[] = [
    fulfilment("a", "AWAITING_CONFIRMATION", 5),
    fulfilment("b", "AWAITING_CONFIRMATION", 1),  // not overdue
    fulfilment("c", "CONFIRMED", 30),             // not awaiting → not in denominator
    fulfilment("d", "AWAITING_CONFIRMATION", 8),
  ]
  const m = computeFulfilmentMetrics(rows, NOW)
  assert.equal(m.overdueCount, 2)
  assert.equal(m.overdueRatio, 2 / 3)
  assert.ok(m.oldestOverdueDays !== null && m.oldestOverdueDays >= 7.99 && m.oldestOverdueDays <= 8.01)
})

test("fulfilment metrics: nothing AWAITING → ratio is null (safeDiv parity)", () => {
  // v1.0.1: with the denominator restricted to AWAITING_CONFIRMATION,
  // a snapshot with zero such rows has no eligible base, so the
  // ratio is `null` (matching safeDiv semantics elsewhere). The
  // FULFILMENT_OVERDUE detector treats null ratios as "no fire on
  // the ratio path."
  const rows: FulfilmentRow[] = [
    fulfilment("a", "CONFIRMED", 10),
    fulfilment("b", "COURIER_VERIFIED", 20),
  ]
  const m = computeFulfilmentMetrics(rows, NOW)
  assert.equal(m.overdueCount, 0)
  assert.equal(m.overdueRatio, null)
  assert.equal(m.oldestOverdueDays, null)
})
