// =====================================================
// FOUNDER BRIEFING — DATA ACCESS
//
// The ONLY file in the briefing module that touches
// Prisma or calls the monitor. Everything else operates
// on the snapshot returned here.
//
// Read-only: findMany / findFirst / count / groupBy.
// No create / update / delete / upsert / executeRaw.
// =====================================================

import { prisma } from "@/src/database/prisma"
import { runSupplyCommitmentHealthMonitor } from "@/src/internal/monitors/supplyCommitmentHealth/index.ts"

import type { ContractStatus } from "@prisma/client"
import type { CommitmentHealthReport } from "@/src/internal/monitors/supplyCommitmentHealth/types.ts"

// -----------------------------------------------------
// SNAPSHOT TYPES
// -----------------------------------------------------

export type ContractAgeRow = {
  id: string
  status: ContractStatus
  createdAt: Date
  remainingMonths: number
}

export type OpenIntentAgeRow = {
  id: string
  createdAt: Date
  deltaKg: number               // GREEN
}

export type FounderBriefingSnapshot = {
  now: Date
  monitorReport:  CommitmentHealthReport
  contractRows:   ContractAgeRow[]
  contractCounts: Record<ContractStatus, number>
  openIntentRows: OpenIntentAgeRow[]
  inputCounts: {
    greenLots:   number
    contracts:   number
    intents:     number
    fulfilments: number
  }
}

const ALL_CONTRACT_STATUSES: ContractStatus[] = [
  "PENDING",
  "AWAITING_SIGNATURE",
  "SIGNED",
  "PAYMENT_PENDING",
  "ACTIVE",
  "PAST_DUE",
  "COMPLETED",
  "CANCELLED",
]

// -----------------------------------------------------
// SNAPSHOT LOADER
// -----------------------------------------------------

export async function loadFounderBriefingSnapshot(
  now: Date,
): Promise<FounderBriefingSnapshot> {

  // Run the monitor first. We forward its metrics, axes,
  // detectors, and inputFingerprint as-is; we do not
  // re-derive any of those.
  const monitorReport = await runSupplyCommitmentHealthMonitor({ now })

  const [
    contractRows,
    contractGroupBy,
    openIntentRows,
    greenLotCount,
    contractCount,
    intentCount,
    fulfilmentCount,
  ] = await Promise.all([
    prisma.contract.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        remainingMonths: true,
      },
    }),
    prisma.contract.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // OPEN intents that actually reserve supply — same
    // filter as src/services/system/supply.service.ts
    // getContractableSupply.
    prisma.demandIntent.findMany({
      where: {
        status: "OPEN",
        expiresAt: { gt: now },
        deltaKg:   { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        deltaKg:   true,
      },
    }),
    prisma.greenLot.count(),
    prisma.contract.count(),
    prisma.demandIntent.count(),
    prisma.producerFulfilment.count(),
  ])

  // Initialise every status to zero so consumers can
  // safely index into the record without optional checks.
  const contractCounts = ALL_CONTRACT_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0
      return acc
    },
    {} as Record<ContractStatus, number>,
  )
  for (const row of contractGroupBy) {
    contractCounts[row.status] = row._count._all
  }

  return {
    now,
    monitorReport,
    contractRows,
    contractCounts,
    openIntentRows,
    inputCounts: {
      greenLots:   greenLotCount,
      contracts:   contractCount,
      intents:     intentCount,
      fulfilments: fulfilmentCount,
    },
  }
}
