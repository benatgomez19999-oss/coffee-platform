// =====================================================
// SUPPLY & COMMITMENT HEALTH MONITOR — DATA ACCESS
//
// THIS IS THE ONLY FILE IN THIS MODULE ALLOWED TO:
//   - import the Prisma client
//   - import any business service
//
// Every other file in the module consumes the plain
// shapes returned from here. Metric and detector
// modules MUST NOT import prisma directly.
//
// Read-only. Performs zero writes to business tables.
// =====================================================

import { prisma } from "@/src/database/prisma"
import { getContractableSupply } from "@/src/services/system/supply.service"

import {
  COMMITTED_CONTRACT_STATUSES,
  PUBLISHED_LOT_STATUS,
  INTENT_WINDOW_DAYS,
} from "./constants.ts"

import type {
  DataAccessSnapshot,
  CommittedContractRow,
  OpenIntentRow,
  IntentWindowRow,
  GreenLotAttributionRow,
  FulfilmentRow,
} from "./types.ts"

// =====================================================
// LOAD SNAPSHOT
//
// Performs all reads in one logical pass against the
// shared `prisma` instance. A single `runStartedAt` is
// captured up front so every metric and every window
// boundary uses the same `now`.
//
// =====================================================
// SNAPSHOT CONSISTENCY MODEL — READ THIS BEFORE ASSUMING
// =====================================================
//
// This snapshot is NON-ATOMIC. Each `findMany` below is
// a separate read against the live database. Writes by
// other processes BETWEEN those reads can produce a
// snapshot that is not internally consistent at any
// single point in time (e.g. a contract observed in the
// committed list whose related green lot was modified
// after we read the lot table).
//
// This is intentional for v1. Reasons:
//
//   1. The monitor is read-only and append-only. A
//      slightly inconsistent snapshot can produce a
//      slightly inconsistent number, but cannot corrupt
//      business state.
//
//   2. Wrapping all reads in `prisma.$transaction` would
//      hold a read transaction across half a dozen large
//      table scans for the entire monitor run, which is
//      a worse trade-off than tolerating drift.
//
//   3. Drift IS observable. The deterministic
//      `inputFingerprint` is computed from the exact
//      rows we observed — not from a transactional
//      snapshot — so two consecutive runs that see
//      different drift will have different fingerprints
//      and the audit row will reflect the discrepancy.
//
// Acceptable in v1: small drift between successive
// `findMany` calls.
//
// NOT acceptable: assuming this function returns a
// transactionally consistent picture of the database.
// Future versions (v1.2+) MAY introduce a single
// `prisma.$transaction([...])` wrapper if drift turns
// out to be material; do NOT add one as part of any
// Phase-1 task.
// =====================================================

export async function loadSnapshot(
  now: Date = new Date()
): Promise<DataAccessSnapshot> {

  const runStartedAt = now

  // -------------------------------------------------
  // 1. PUBLISHED GREEN LOTS
  // Mirrors getContractableSupply()'s gross filter:
  //   status = PUBLISHED AND availableKg > 0.
  // -------------------------------------------------

  const greenLots = await prisma.greenLot.findMany({
    where: {
      status: PUBLISHED_LOT_STATUS,
      availableKg: { gt: 0 },
    },
    select: {
      id: true,
      availableKg: true,
      farmId: true,
    },
  })

  const publishedSupplyGreenRows: GreenLotAttributionRow[] = greenLots.map(
    (l) => ({
      id: l.id,
      availableKg: l.availableKg,
      farmId: l.farmId,
    })
  )

  // -------------------------------------------------
  // 2. CONTRACTABLE SUPPLY
  // Pass-through. The monitor never re-derives this.
  //
  // Note: getContractableSupply() applies a DIFFERENT
  // committed-status filter than ours, by design (see
  // constants.ts). The result is consumed wholesale.
  // -------------------------------------------------

  const contractableSupplyResult = await getContractableSupply()

  // -------------------------------------------------
  // 3. COMMITTED CONTRACTS
  // Strict OTP-confirmed set only.
  // -------------------------------------------------

  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: COMMITTED_CONTRACT_STATUSES },
    },
    select: {
      id: true,
      status: true,
      monthlyGreenKg: true,
      monthlyVolumeKg: true,
      greenLotId: true,
      companyId: true,
    },
  })

  const committedContractRows: CommittedContractRow[] = contracts.map((c) => ({
    id: c.id,
    status: c.status,
    // ⚠️ LEGACY COMPATIBILITY FALLBACK — NOT CLEAN DATA ⚠️
    //
    // `monthlyGreenKg` is the canonical green-volume field
    // and is nullable in the schema. When it is NULL we fall
    // back to `monthlyVolumeKg`.
    //
    // `monthlyVolumeKg` IS NOT GUARANTEED TO REPRESENT GREEN
    // VOLUME. On legacy contracts the field was used as a
    // generic "monthly volume" column whose unit was either
    // green or roasted depending on when the contract was
    // written. Treating it as green here is an APPROXIMATION
    // — the only justification is parity with the existing
    // `getContractableSupply()` service, which applies the
    // same fallback so that monitor numbers and platform
    // numbers agree.
    //
    // This fallback MUST be removed once the data migration
    // that backfills `monthlyGreenKg` for all legacy
    // contracts has shipped. Until then, every metric that
    // consumes this field carries an unquantified accuracy
    // tax against the legacy subset of contracts.
    //
    // Do NOT introduce any new code that relies on this
    // fallback being present.
    monthlyGreenKg: c.monthlyGreenKg ?? c.monthlyVolumeKg,
    greenLotId: c.greenLotId,
    companyId: c.companyId,
  }))

  // -------------------------------------------------
  // 4. OPEN DEMAND INTENTS — current pressure
  // status = OPEN AND expiresAt > now
  // -------------------------------------------------

  const openIntents = await prisma.demandIntent.findMany({
    where: {
      status: "OPEN",
      expiresAt: { gt: runStartedAt },
    },
    select: {
      id: true,
      greenLotId: true,
      companyId: true,
      type: true,
      requestedKg: true,
      offeredKg: true,
      deltaKg: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  const openIntentRowsCurrent: OpenIntentRow[] = openIntents.map((i) => ({
    id: i.id,
    greenLotId: i.greenLotId,
    companyId: i.companyId,
    type: i.type,
    requestedKg: i.requestedKg,
    offeredKg: i.offeredKg,
    deltaKg: i.deltaKg,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }))

  // -------------------------------------------------
  // 5. INTENT CONVERSION WINDOWS
  //
  // For INTENT_CONVERSION_DROP we look at intents
  // CREATED in the current 7d window vs the prior 7d
  // window, regardless of current status — conversion
  // is computed in the metric layer from `consumedAt`
  // (CONSUMED → became a contract).
  // -------------------------------------------------

  const dayMs = 24 * 60 * 60 * 1000
  const currentWindowStart = new Date(
    runStartedAt.getTime() - INTENT_WINDOW_DAYS * dayMs
  )
  const priorWindowStart = new Date(
    runStartedAt.getTime() - 2 * INTENT_WINDOW_DAYS * dayMs
  )

  const windowCurrent = await prisma.demandIntent.findMany({
    where: {
      createdAt: { gte: currentWindowStart, lt: runStartedAt },
    },
    select: {
      id: true,
      status: true,
      type: true,
      contractId: true,
      createdAt: true,
      consumedAt: true,
    },
  })

  const windowPrior = await prisma.demandIntent.findMany({
    where: {
      createdAt: { gte: priorWindowStart, lt: currentWindowStart },
    },
    select: {
      id: true,
      status: true,
      type: true,
      contractId: true,
      createdAt: true,
      consumedAt: true,
    },
  })

  const intentWindowCurrent: IntentWindowRow[] = windowCurrent.map((i) => ({
    id: i.id,
    status: i.status,
    type: i.type,
    contractId: i.contractId,
    createdAt: i.createdAt,
    consumedAt: i.consumedAt,
  }))

  const intentWindowPrior: IntentWindowRow[] = windowPrior.map((i) => ({
    id: i.id,
    status: i.status,
    type: i.type,
    contractId: i.contractId,
    createdAt: i.createdAt,
    consumedAt: i.consumedAt,
  }))

  // -------------------------------------------------
  // 6. PRODUCER FULFILMENT ROWS
  // The metric layer applies the AWAITING_CONFIRMATION
  // SLA rule. dataAccess.ts does NOT pre-classify.
  // -------------------------------------------------

  const fulfilments = await prisma.producerFulfilment.findMany({
    select: {
      id: true,
      status: true,
      greenLotId: true,
      producerId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const fulfilmentRows: FulfilmentRow[] = fulfilments.map((f) => ({
    id: f.id,
    status: f.status,
    greenLotId: f.greenLotId,
    producerId: f.producerId,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }))

  // -------------------------------------------------
  // 7. INPUT COUNTS — for audit and drift detection
  // -------------------------------------------------

  const inputCounts = {
    greenLotCount: publishedSupplyGreenRows.length,
    committedContractCount: committedContractRows.length,
    openIntentCount: openIntentRowsCurrent.length,
    fulfilmentRowCount: fulfilmentRows.length,
    windowIntentCountCurrent: intentWindowCurrent.length,
    windowIntentCountPrior: intentWindowPrior.length,
  }

  return {
    runStartedAt,
    publishedSupplyGreenRows,
    contractableSupplyResult,
    committedContractRows,
    openIntentRowsCurrent,
    intentWindowCurrent,
    intentWindowPrior,
    fulfilmentRows,
    inputCounts,
  }
}
