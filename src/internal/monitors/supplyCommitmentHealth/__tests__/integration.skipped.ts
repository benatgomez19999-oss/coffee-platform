// =====================================================
// INTEGRATION TESTS — SKELETON, NOT EXECUTED IN v1
//
// These are written to satisfy the integration-tests
// section of the v1 test plan, but they are NOT run
// during the implementation pass because the project
// has no test database configured (DATABASE_URL_TEST or
// equivalent).
//
// Filename ends in .skipped.ts so it is not picked up
// by `node --test src/internal/monitors/...`.
//
// To execute:
//   1. Provision a test Postgres and set DATABASE_URL
//      (or DATABASE_URL_NEW) to point at it.
//   2. Run `npx prisma migrate deploy` against it.
//   3. Seed minimal fixtures (see seedFixtures below).
//   4. Rename this file to integration.test.ts and run
//      `node --experimental-strip-types --test \
//        src/internal/monitors/supplyCommitmentHealth/__tests__/integration.test.ts`
//
// Listed in the open-questions section of the delivery
// report. Treat as v1.1 work.
// =====================================================

/*
import { test } from "node:test"
import assert from "node:assert/strict"

import { prisma } from "@/src/database/prisma"
import { runSupplyCommitmentHealthMonitor } from "../index"
import { COMMITTED_CONTRACT_STATUSES } from "../constants"

async function checksumBusinessTables() {
  const counts = await Promise.all([
    prisma.contract.count(),
    prisma.demandIntent.count(),
    prisma.greenLot.count(),
    prisma.producerFulfilment.count(),
  ])
  return counts.join("|")
}

async function seedFixtures() {
  // TODO: insert deterministic Producer/Farm/GreenLot/Contract/etc.
  // The seed must include at least one Contract in every committed
  // status AND one in AWAITING_SIGNATURE / PENDING / COMPLETED /
  // CANCELLED so the Q1 regression test can pass.
}

async function clearFixtures() {
  // TODO: tear down everything seedFixtures created.
}

test("INTEGRATION: monitor performs zero writes to business tables", async () => {
  await seedFixtures()
  const before = await checksumBusinessTables()
  await runSupplyCommitmentHealthMonitor()
  const after = await checksumBusinessTables()
  assert.equal(before, after)
  await clearFixtures()
})

test("INTEGRATION: AWAITING_SIGNATURE contracts are excluded from committedGreen", async () => {
  await seedFixtures()
  const report = await runSupplyCommitmentHealthMonitor()
  // Compute expected committedGreen by hand from the same seed.
  const contracts = await prisma.contract.findMany({
    where: { status: { in: COMMITTED_CONTRACT_STATUSES } },
    select: { monthlyGreenKg: true, monthlyVolumeKg: true },
  })
  const expected = contracts.reduce(
    (s, c) => s + (c.monthlyGreenKg ?? c.monthlyVolumeKg),
    0
  )
  assert.equal(report.metrics.committedGreen, expected)
  await clearFixtures()
})

test("INTEGRATION: same input → same fingerprint and same report", async () => {
  await seedFixtures()
  const a = await runSupplyCommitmentHealthMonitor()
  const b = await runSupplyCommitmentHealthMonitor()
  assert.equal(a.meta.inputFingerprint, b.meta.inputFingerprint)
  // Strip per-run meta and compare
  const stripMeta = (r: any) => ({ ...r, meta: { ...r.meta, runId: "X", runStartedAt: "X", runFinishedAt: "X", durationMs: 0 } })
  assert.deepEqual(stripMeta(a), stripMeta(b))
  await clearFixtures()
})

test("INTEGRATION: getContractableSupply() is the only source of contractableGreen", async () => {
  await seedFixtures()
  const report = await runSupplyCommitmentHealthMonitor()
  const { getContractableSupply } = await import("@/src/services/system/supply.service")
  const cs = await getContractableSupply()
  assert.equal(report.metrics.contractableGreen, cs.contractableKg)
  await clearFixtures()
})
*/
