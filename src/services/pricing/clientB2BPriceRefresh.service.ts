//////////////////////////////////////////////////////
// 🔄 CLIENT B2B PRICE REFRESH SERVICE — Prisma layer
//
// Loads lots + active MarketSignalSnapshot, drives the
// pure helper from clientB2BPriceRefresh.pure.ts, and
// optionally persists updates to PricingSnapshot.
//
// What apply mode UPDATES:
//   • PricingSnapshot.clientB2BPricePerKg
//   • PricingSnapshot.clientB2BPricingVersion
//   • PricingSnapshot.clientB2BPricingMode
//   • PricingSnapshot.clientB2BPriceComputedAt
//
// What apply mode NEVER touches:
//   • producerPricePerKg / clientPricePerKg (legacy green)
//   • GreenLot.pricePerKg
//   • Existing Contract rows (lockedPricePerKg)
//   • Existing DemandIntent rows (previewPricePerKg)
//
// Existing commercial commitments stay historical.
//////////////////////////////////////////////////////

import { Prisma } from "@prisma/client"
import { prisma } from "@/src/database/prisma"
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing"
import type { ProducerPricingFn } from "@/src/engine/pricing/client/calculateMarketplaceB2BPricing"

import {
  recomputeClientB2BPriceForLot,
  summarizeClientB2BRefresh,
  isUsableNumber,
  normaliseStatuses,
  normaliseLimit,
  EMPTY_MARKET_SIGNAL,
  type ClientB2BRefreshMarketSignal,
  type ClientB2BRefreshResult,
  type ClientB2BRefreshScope,
  type ClientB2BRefreshSummary,
  type RefreshLotView,
} from "./clientB2BPriceRefresh.pure"

// Re-export public types so callers don't need to know about the split.
export type {
  ClientB2BRefreshMarketSignal,
  ClientB2BRefreshMode,
  ClientB2BRefreshLotStatus,
  ClientB2BRefreshScope,
  ClientB2BRefreshPriceSource,
  ClientB2BRefreshResult,
  ClientB2BRefreshSummary,
  RefreshLotView,
} from "./clientB2BPriceRefresh.pure"
export {
  recomputeClientB2BPriceForLot,
  summarizeClientB2BRefresh,
} from "./clientB2BPriceRefresh.pure"

// ------------------------------------------------------
// ACTIVE MARKET SIGNAL LOADER
// ------------------------------------------------------

async function loadActiveMarketSignal(): Promise<{
  signal: ClientB2BRefreshMarketSignal
  forEngine: { cPrice: number; demandIndex: number } | null
}> {
  try {
    const snap = await prisma.marketSignalSnapshot.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })
    if (!snap) return { signal: EMPTY_MARKET_SIGNAL, forEngine: null }

    const expired = !!snap.expiresAt && snap.expiresAt <= new Date()
    const inBand =
      Number.isFinite(snap.cPrice) &&
      snap.cPrice >= 50 &&
      snap.cPrice <= 600 &&
      Number.isFinite(snap.demandIndex) &&
      snap.demandIndex >= 0.8 &&
      snap.demandIndex <= 1.2

    const usable = !expired && inBand

    return {
      signal: {
        id: snap.id,
        cPrice: Number.isFinite(snap.cPrice) ? snap.cPrice : null,
        demandIndex: Number.isFinite(snap.demandIndex) ? snap.demandIndex : null,
        source: snap.source ?? null,
        validFrom: snap.validFrom ? snap.validFrom.toISOString() : null,
        expiresAt: snap.expiresAt ? snap.expiresAt.toISOString() : null,
      },
      forEngine: usable
        ? { cPrice: snap.cPrice, demandIndex: snap.demandIndex }
        : null,
    }
  } catch (err) {
    console.warn("[CLIENT_B2B_REFRESH] market signal read failed", err)
    return { signal: EMPTY_MARKET_SIGNAL, forEngine: null }
  }
}

// ------------------------------------------------------
// PRODUCER PRICING ADAPTER
// ------------------------------------------------------

function buildProducerPricingFn(): ProducerPricingFn {
  return ((engineInput: {
    scaScore: number
    altitude: number
    variety: string
    process: string
    country?: string
    marketData?: { cPrice?: number; demandIndex?: number }
  }) =>
    calculateProducerPricing({
      scaScore: engineInput.scaScore,
      altitude: engineInput.altitude,
      variety: engineInput.variety as any,
      process: engineInput.process as any,
      country: engineInput.country,
      marketData: engineInput.marketData,
    })) as any
}

// ------------------------------------------------------
// LOAD LOTS
// ------------------------------------------------------

async function loadLots(scope: ClientB2BRefreshScope): Promise<RefreshLotView[]> {
  const statuses = normaliseStatuses(scope.includeStatuses)
  const limit = normaliseLimit(scope.limit)

  const where: Prisma.GreenLotWhereInput = {
    status: { in: [...statuses] },
    ...(scope.greenLotId ? { id: scope.greenLotId } : {}),
  }

  const rows = await prisma.greenLot.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      lotNumber: true,
      name: true,
      status: true,
      variety: true,
      process: true,
      scaScore: true,
      availableKg: true,
      estimatedRoastYield: true,
      currency: true,
      farm: {
        select: {
          altitude: true,
          producer: { select: { country: true } },
        },
      },
      pricingSnapshot: {
        select: {
          clientPricePerKg: true,
          clientB2BPricePerKg: true,
        },
      },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    lotNumber: r.lotNumber,
    name: r.name,
    status: r.status,
    variety: r.variety,
    process: r.process,
    scaScore: r.scaScore,
    availableKg: r.availableKg,
    estimatedRoastYield: r.estimatedRoastYield,
    currency: r.currency,
    farm: r.farm
      ? {
          altitude: r.farm.altitude,
          producer: r.farm.producer
            ? { country: r.farm.producer.country }
            : null,
        }
      : null,
    pricingSnapshot: r.pricingSnapshot
      ? {
          clientPricePerKg: r.pricingSnapshot.clientPricePerKg,
          clientB2BPricePerKg: r.pricingSnapshot.clientB2BPricePerKg ?? null,
        }
      : null,
  }))
}

// ------------------------------------------------------
// ENTRY POINTS
// ------------------------------------------------------

export async function previewClientB2BRefresh(
  scope: ClientB2BRefreshScope = {}
): Promise<ClientB2BRefreshSummary> {

  const { signal, forEngine } = await loadActiveMarketSignal()
  const lots = await loadLots(scope)
  const producerPricingFn = buildProducerPricingFn()

  const results: ClientB2BRefreshResult[] = lots.map((lot) =>
    recomputeClientB2BPriceForLot(lot, {
      marketSignal: signal,
      marketSignalForEngine: forEngine,
      producerPricingFn,
    })
  )

  return summarizeClientB2BRefresh({
    results,
    mode: "dry_run",
    applied: false,
    marketSignal: signal,
  })
}

export async function applyClientB2BRefresh(
  scope: ClientB2BRefreshScope = {}
): Promise<ClientB2BRefreshSummary> {

  const preview = await previewClientB2BRefresh(scope)
  const updated: ClientB2BRefreshResult[] = []

  for (const r of preview.results) {
    if (r.skipped) {
      updated.push(r)
      continue
    }
    if (!isUsableNumber(r.recomputedClientB2BPricePerKg)) {
      updated.push({
        ...r,
        skipped: true,
        skipReason: "RECOMPUTED_PRICE_NOT_USABLE",
        warnings: [
          ...r.warnings,
          "Recomputed B2B price was null/non-positive; row left untouched.",
        ],
      })
      continue
    }

    try {
      await prisma.pricingSnapshot.update({
        where: { lotId: r.greenLotId },
        data: {
          clientB2BPricePerKg: r.recomputedClientB2BPricePerKg,
          clientB2BPricingVersion: r.recomputedPricingVersion,
          clientB2BPricingMode: r.recomputedPricingMode,
          clientB2BPriceComputedAt: new Date(),
        },
      })
      updated.push({ ...r, applied: true })
    } catch (err) {
      console.warn("[CLIENT_B2B_REFRESH] update failed for lot", r.greenLotId, err)
      updated.push({
        ...r,
        skipped: true,
        skipReason: "DB_UPDATE_FAILED",
        warnings: [
          ...r.warnings,
          `DB update failed: ${err instanceof Error ? err.message : String(err)}`,
        ],
      })
    }
  }

  return summarizeClientB2BRefresh({
    results: updated,
    mode: "apply",
    applied: true,
    marketSignal: preview.marketSignal,
  })
}
