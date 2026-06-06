//////////////////////////////////////////////////////
// 📦 LOT ALLOCATION SNAPSHOT — PRISMA SERVICE
//
// Single source of truth for converting real DB state
// into LotAllocationSnapshot[] consumed by the pure
// engine in src/services/allocation/engine.
//
// Performance contract — three queries, never per-lot:
//   1. greenLot.findMany(...)
//   2. contract.findMany(...)
//   3. demandIntent.groupBy(...)
//
// Aggregation happens in memory via the pure mapper.
// Roast yield resolution uses the existing helper in
// src/lib/roastYield.ts — we do NOT reimplement it here.
//
// SAFETY: No writes. No side effects. Read-only.
//////////////////////////////////////////////////////

import { Prisma } from "@prisma/client"
import { prisma } from "@/src/database/prisma"
import { resolveRoastYield } from "@/src/lib/roastYield"

import type { LotAllocationSnapshot } from "../domain/types.ts"
import {
  aggregateCommitments,
  aggregateIntentReservations,
  mapGreenLotToAllocationSnapshot,
  type ContractRowForAllocation,
  type GreenLotRowForAllocation,
  type IntentRowForAllocation,
} from "./lotAllocationSnapshot.mapper.ts"

//////////////////////////////////////////////////////
// PROCESS TYPE BRIDGE
//
// resolveRoastYield is typed against Prisma's ProcessType
// enum. The mapper carries process as a plain string. We
// narrow safely here; unknown values fall back to WASHED
// for yield resolution (the helper has its own clamp so
// even an unexpected default lands in [0.50, 1.00]).
//////////////////////////////////////////////////////

import { ProcessType } from "@prisma/client"

function asProcessType(value: string): ProcessType {
  if (
    value === "WASHED" ||
    value === "NATURAL" ||
    value === "HONEY" ||
    value === "ANAEROBIC"
  ) {
    return value
  }
  return ProcessType.WASHED
}

//////////////////////////////////////////////////////
// PUBLIC API
//////////////////////////////////////////////////////

export type BuildAllocationSnapshotsOptions = {
  greenLotId?: string
  tx?: Prisma.TransactionClient
}

export async function buildAllocationSnapshots(
  options: BuildAllocationSnapshotsOptions = {}
): Promise<LotAllocationSnapshot[]> {

  const db = options.tx ?? prisma
  const now = new Date()

  // ---------------------------------------------------
  // 1. LOTS
  //
  // Include all four lifecycle states so the engine can
  // emit the correct hold reasons (e.g.
  // SHIPMENT_ALREADY_RESERVED for status RESERVED, or
  // LOT_NOT_PUBLISHED for status DRAFT). Filtering them
  // out here would silently drop entries the dry-run
  // dashboard needs to see.
  // ---------------------------------------------------

  const lotWhere: Prisma.GreenLotWhereInput = {
    status: { in: ["DRAFT", "PUBLISHED", "RESERVED", "SOLD"] },
    ...(options.greenLotId ? { id: options.greenLotId } : {}),
  }

  const lots = await db.greenLot.findMany({
    where: lotWhere,
    select: {
      id: true,
      lotNumber: true,
      status: true,
      name: true,
      variety: true,
      process: true,
      harvestYear: true,
      scaScore: true,
      altitude: true,
      totalKg: true,
      availableKg: true,
      pricePerKg: true,
      currency: true,
      estimatedRoastYield: true,
      shipmentId: true,
      createdAt: true,
      pricingSnapshot: {
        select: {
          clientPricePerKg: true,
          // PRICING-B2B-3 — persisted client B2B roasted price + audit.
          clientB2BPricePerKg: true,
          clientB2BPricingVersion: true,
          clientB2BPricingMode: true,
        },
      },
      farm: {
        select: {
          id: true,
          name: true,
          region: true,
          altitude: true,
          producer: {
            select: { name: true, country: true },
          },
          // FARM-MEDIA-1 — reusable farm-level media. The mapper
          // composes this with GreenLotMedia via
          // buildInheritedLotMediaSequence so the marketplace
          // and contract catalog DTOs surface inherited media
          // automatically.
          // LOT-MEDIA-2 — visibility column for public-only filtering.
          media: {
            select: {
              id: true,
              url: true,
              role: true,
              source: true,
              visibility: true,
              position: true,
              isPrimary: true,
              altText: true,
              caption: true,
              credit: true,
            },
            orderBy: [
              { position: "asc" },
              { createdAt: "asc" },
            ],
          },
        },
      },
      // LOT-MEDIA-1 — semantic ordered media. Ordering is finalised
      // by the pure helper (orderLotMedia) downstream; we just provide
      // a stable read order so the mapper input is deterministic.
      // LOT-MEDIA-2 — visibility added so the marketplace + contract
      // catalog mappers can filter PUBLIC_MARKET only.
      media: {
        select: {
          id: true,
          url: true,
          role: true,
          source: true,
          visibility: true,
          position: true,
          isPrimary: true,
          altText: true,
          caption: true,
          credit: true,
        },
        orderBy: [
          { position: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  })

  if (lots.length === 0) return []

  const lotIds = lots.map((l) => l.id)

  // ---------------------------------------------------
  // 2. CONTRACTS  (commitments)
  //
  // findMany (not groupBy) because we need to multiply
  // monthly × remainingMonths per row before summing.
  // groupBy would force us into raw SQL or a second pass.
  // ---------------------------------------------------

  const contractRows = await db.contract.findMany({
    where: {
      status: { in: ["AWAITING_SIGNATURE", "SIGNED", "ACTIVE"] },
      greenLotId: { in: lotIds },
    },
    select: {
      greenLotId: true,
      monthlyGreenKg: true,
      monthlyVolumeKg: true,
      remainingMonths: true,
    },
  })

  const contractRowsForMapper: ContractRowForAllocation[] =
    contractRows.map((c) => ({
      greenLotId: c.greenLotId,
      monthlyGreenKg: c.monthlyGreenKg,
      monthlyVolumeKg: c.monthlyVolumeKg,
      remainingMonths: c.remainingMonths,
    }))

  const commitmentByLot = aggregateCommitments(contractRowsForMapper)

  // ---------------------------------------------------
  // 3. DEMAND INTENTS  (reservations)
  //
  // groupBy is clean here — single sum per lot, no
  // multiplication needed.
  // ---------------------------------------------------

  const intentGroups = await db.demandIntent.groupBy({
    by: ["greenLotId"],
    where: {
      status: "OPEN",
      expiresAt: { gt: now },
      deltaKg: { gt: 0 },
      greenLotId: { in: lotIds },
    },
    _sum: { deltaKg: true },
  })

  const intentRowsForMapper: IntentRowForAllocation[] = intentGroups.map(
    (g) => ({
      greenLotId: g.greenLotId,
      deltaKg: g._sum.deltaKg ?? 0,
    })
  )

  const intentByLot = aggregateIntentReservations(intentRowsForMapper)

  // ---------------------------------------------------
  // 4. STITCH
  // ---------------------------------------------------

  const snapshots: LotAllocationSnapshot[] = []

  for (const lot of lots) {

    const commitment = commitmentByLot.get(lot.id) ?? {
      monthlyGreenKg: 0,
      horizonGreenKg: 0,
      longestRemainingMonths: 0,
    }
    const reservedIntentGreenKg = intentByLot.get(lot.id) ?? 0

    // Roast yield via the canonical helper. We mark
    // usedDefaultRoastYield true whenever the lot row had
    // no explicit value — even if the helper applied its
    // own clamp on top.
    const resolvedRoastYield = resolveRoastYield({
      estimatedRoastYield: lot.estimatedRoastYield,
      process: asProcessType(lot.process),
    })
    const usedDefaultRoastYield = lot.estimatedRoastYield == null

    const row: GreenLotRowForAllocation = {
      id: lot.id,
      lotNumber: lot.lotNumber,
      status: lot.status,
      name: lot.name,
      variety: lot.variety,
      process: lot.process,
      harvestYear: lot.harvestYear,
      scaScore: lot.scaScore,
      altitude: lot.altitude,
      totalKg: lot.totalKg,
      availableKg: lot.availableKg,
      pricePerKg: lot.pricePerKg,
      currency: lot.currency,
      createdAt: lot.createdAt,
      estimatedRoastYield: lot.estimatedRoastYield,
      shipmentId: lot.shipmentId,
      pricingSnapshot: lot.pricingSnapshot
        ? {
            clientPricePerKg: lot.pricingSnapshot.clientPricePerKg,
            clientB2BPricePerKg: lot.pricingSnapshot.clientB2BPricePerKg ?? null,
            clientB2BPricingVersion: lot.pricingSnapshot.clientB2BPricingVersion ?? null,
            clientB2BPricingMode: lot.pricingSnapshot.clientB2BPricingMode ?? null,
          }
        : null,
      farm: lot.farm
        ? {
            id: lot.farm.id,
            name: lot.farm.name,
            region: lot.farm.region,
            altitude: lot.farm.altitude,
            producer: lot.farm.producer
              ? {
                  name: lot.farm.producer.name,
                  country: lot.farm.producer.country,
                }
              : null,
            // FARM-MEDIA-1 — reusable farm media.
            media: lot.farm.media ?? null,
          }
        : null,
      // LOT-MEDIA-1 — pass-through raw rows. The pure mapper
      // normalizes unknown role/source values and drops invalid
      // urls before they reach DTOs.
      media: lot.media ?? null,
    }

    snapshots.push(
      mapGreenLotToAllocationSnapshot({
        lot: row,
        committedContractMonthlyGreenKg: commitment.monthlyGreenKg,
        committedContractHorizonGreenKg: commitment.horizonGreenKg,
        committedContractMonthsRemaining: commitment.longestRemainingMonths,
        reservedIntentGreenKg,
        resolvedRoastYield,
        usedDefaultRoastYield,
      })
    )
  }

  return snapshots
}
