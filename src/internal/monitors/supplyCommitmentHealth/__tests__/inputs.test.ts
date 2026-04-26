// =====================================================
// UNIT TESTS — metrics/inputs.ts
//
// Pure function tests. Zero DB, zero Prisma.
// Run with:
//   node --experimental-strip-types --test \
//     src/internal/monitors/supplyCommitmentHealth/__tests__/inputs.test.ts
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  computePublishedSupplyGreen,
  computeCommittedGreen,
  computeMonthlyDrawGreen,
  computeActiveOpenIntentLoad,
} from "../metrics/inputs.ts"

import type {
  CommittedContractRow,
  OpenIntentRow,
  GreenLotAttributionRow,
} from "../types.ts"

// =====================================================
// publishedSupplyGreen
// =====================================================

test("publishedSupplyGreen sums availableKg across rows", () => {
  const rows: GreenLotAttributionRow[] = [
    { id: "a", availableKg: 100, farmId: "f1" },
    { id: "b", availableKg: 250, farmId: "f1" },
    { id: "c", availableKg: 50, farmId: "f2" },
  ]
  assert.equal(computePublishedSupplyGreen(rows), 400)
})

test("publishedSupplyGreen returns 0 for empty input", () => {
  assert.equal(computePublishedSupplyGreen([]), 0)
})

// =====================================================
// committedGreen — REGRESSION GUARD
// AWAITING_SIGNATURE / PENDING / COMPLETED / CANCELLED
// must contribute zero, even if a future caller passes
// them in. This is the v1 hard rule.
// =====================================================

const mixedStatusContracts: CommittedContractRow[] = [
  { id: "ok-signed",       status: "SIGNED",            monthlyGreenKg: 100, greenLotId: null, companyId: "c1" },
  { id: "ok-payment",      status: "PAYMENT_PENDING",   monthlyGreenKg: 50,  greenLotId: null, companyId: "c1" },
  { id: "ok-active",       status: "ACTIVE",            monthlyGreenKg: 200, greenLotId: null, companyId: "c1" },
  { id: "ok-pastdue",      status: "PAST_DUE",          monthlyGreenKg: 25,  greenLotId: null, companyId: "c1" },

  // The four that MUST be excluded:
  { id: "bad-await",       status: "AWAITING_SIGNATURE", monthlyGreenKg: 9999, greenLotId: null, companyId: "c1" },
  { id: "bad-pending",     status: "PENDING",            monthlyGreenKg: 9999, greenLotId: null, companyId: "c1" },
  { id: "bad-completed",   status: "COMPLETED",          monthlyGreenKg: 9999, greenLotId: null, companyId: "c1" },
  { id: "bad-cancelled",   status: "CANCELLED",          monthlyGreenKg: 9999, greenLotId: null, companyId: "c1" },
]

test("committedGreen sums only SIGNED|PAYMENT_PENDING|ACTIVE|PAST_DUE", () => {
  assert.equal(computeCommittedGreen(mixedStatusContracts), 100 + 50 + 200 + 25)
})

test("committedGreen REGRESSION: AWAITING_SIGNATURE contributes zero (OTP boundary)", () => {
  const onlyAwaiting: CommittedContractRow[] = [
    { id: "x", status: "AWAITING_SIGNATURE", monthlyGreenKg: 1000, greenLotId: null, companyId: "c1" },
  ]
  assert.equal(computeCommittedGreen(onlyAwaiting), 0)
})

test("committedGreen REGRESSION: PENDING contributes zero", () => {
  const onlyPending: CommittedContractRow[] = [
    { id: "x", status: "PENDING", monthlyGreenKg: 1000, greenLotId: null, companyId: "c1" },
  ]
  assert.equal(computeCommittedGreen(onlyPending), 0)
})

test("committedGreen REGRESSION: COMPLETED and CANCELLED contribute zero", () => {
  const finished: CommittedContractRow[] = [
    { id: "a", status: "COMPLETED", monthlyGreenKg: 500, greenLotId: null, companyId: "c1" },
    { id: "b", status: "CANCELLED", monthlyGreenKg: 700, greenLotId: null, companyId: "c1" },
  ]
  assert.equal(computeCommittedGreen(finished), 0)
})

test("committedGreen ignores rows with non-numeric monthlyGreenKg", () => {
  const rows: CommittedContractRow[] = [
    { id: "a", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: null, companyId: "c1" },
    // simulate a corrupt row
    { id: "b", status: "ACTIVE", monthlyGreenKg: NaN, greenLotId: null, companyId: "c1" },
  ]
  assert.equal(computeCommittedGreen(rows), 100)
})

test("committedGreen returns 0 for empty input", () => {
  assert.equal(computeCommittedGreen([]), 0)
})

// =====================================================
// monthlyDrawGreen (Option A: identical formula)
// =====================================================

test("monthlyDrawGreen equals committedGreen for the same input", () => {
  const c = computeCommittedGreen(mixedStatusContracts)
  const d = computeMonthlyDrawGreen(mixedStatusContracts)
  assert.equal(d, c)
})

test("monthlyDrawGreen REGRESSION: AWAITING_SIGNATURE never contributes to draw rate", () => {
  const onlyAwaiting: CommittedContractRow[] = [
    { id: "x", status: "AWAITING_SIGNATURE", monthlyGreenKg: 1000, greenLotId: null, companyId: "c1" },
  ]
  assert.equal(computeMonthlyDrawGreen(onlyAwaiting), 0)
})

// =====================================================
// activeOpenIntentLoad
// =====================================================

const now = new Date("2026-04-10T12:00:00Z")
const future = new Date("2026-05-10T12:00:00Z")

const openIntents: OpenIntentRow[] = [
  { id: "i1", greenLotId: "g1", companyId: "co1", type: "CREATE", requestedKg: 100, offeredKg: 80,   deltaKg: 90, expiresAt: future, createdAt: now },
  { id: "i2", greenLotId: "g2", companyId: "co1", type: "AMEND",  requestedKg: 200, offeredKg: 150,  deltaKg: 60, expiresAt: future, createdAt: now },
  { id: "i3", greenLotId: null, companyId: "co2", type: "CREATE", requestedKg: 50,  offeredKg: null, deltaKg: 40, expiresAt: future, createdAt: now },
]

test("activeOpenIntentLoad aggregates green/roasted/offered and counts by type", () => {
  const load = computeActiveOpenIntentLoad(openIntents)
  assert.equal(load.greenKg, 90 + 60 + 40)
  assert.equal(load.roastedKg, 100 + 200 + 50)
  assert.equal(load.offeredRoastedKg, 80 + 150 + 0)
  assert.equal(load.intentCount, 3)
  assert.equal(load.createCount, 2)
  assert.equal(load.amendCount, 1)
})

test("activeOpenIntentLoad returns zeroed shape on empty input", () => {
  const load = computeActiveOpenIntentLoad([])
  assert.deepEqual(load, {
    greenKg: 0,
    roastedKg: 0,
    offeredRoastedKg: 0,
    intentCount: 0,
    createCount: 0,
    amendCount: 0,
  })
})
