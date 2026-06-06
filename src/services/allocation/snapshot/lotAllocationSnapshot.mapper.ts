//////////////////////////////////////////////////////
// 📦 LOT ALLOCATION SNAPSHOT — PURE MAPPER
//
// Pure helpers used by the snapshot service. Kept Prisma-free
// at runtime (no `import { prisma } from "@/src/database/prisma"`)
// so the mapper can be unit-tested without a database harness.
//
// Two responsibilities:
//   1. Aggregate raw contract / intent rows into per-lot reservations.
//   2. Map a hydrated GreenLot row into a LotAllocationSnapshot.
//
// Numeric guards are deliberate: production snapshots will see
// nulls and stale values, and the engine downstream is pure —
// we'd rather absorb defects here than poison every decision.
//////////////////////////////////////////////////////

import type { LotAllocationSnapshot, LotStatus } from "../domain/types.ts"
import {
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
  withOwner,
} from "../../lot-media/lotMedia.pure.ts"
import type { LotMediaItem } from "../../lot-media/lotMedia.types.ts"

// ------------------------------------------------------
// LOCAL ROW SHAPES
//
// These are the input contracts the mapper expects. They
// intentionally mirror Prisma payloads but stay decoupled
// from @prisma/client so the mapper is independently testable.
// ------------------------------------------------------

export type ContractRowForAllocation = {
  greenLotId: string | null
  monthlyGreenKg: number | null
  monthlyVolumeKg: number | null
  remainingMonths: number | null
}

export type IntentRowForAllocation = {
  greenLotId: string | null
  deltaKg: number | null
}

export type CommitmentAggregate = {
  monthlyGreenKg: number
  horizonGreenKg: number
  longestRemainingMonths: number
}

export type GreenLotRowForAllocation = {
  id: string
  lotNumber: string
  status: string                     // raw Prisma string, mapped via mapLotStatus()
  variety: string
  process: string
  harvestYear: number | null
  scaScore: number | null
  altitude: number | null
  totalKg: number
  availableKg: number
  pricePerKg: number | null
  estimatedRoastYield: number | null
  shipmentId: string | null

  // Display metadata (used by ALLOC-3 marketplace mapper).
  // null/absent here = "not available" — the engine ignores
  // these regardless.
  name?: string | null
  currency?: string | null
  createdAt?: Date | string | null

  pricingSnapshot: {
    clientPricePerKg: number | null
    // PRICING-B2B-3 — persisted client B2B roasted price + audit
    // metadata. Optional + nullable for backwards compatibility.
    clientB2BPricePerKg?: number | null
    clientB2BPricingVersion?: string | null
    clientB2BPricingMode?: string | null
  } | null
  farm: {
    id: string
    name?: string | null
    region: string | null
    altitude: number | null
    producer: {
      name?: string | null
      country: string | null
    } | null
    // FARM-MEDIA-1 — raw rows lifted from FarmMedia. Same
    // normalisation rules as the lot-side media.
    media?: ReadonlyArray<GreenLotMediaRowForAllocation> | null
  } | null

  // LOT-MEDIA-1 — raw rows lifted from GreenLotMedia. Unknown
  // role/source values are filtered out by the mapper rather
  // than poisoning every downstream consumer.
  media?: ReadonlyArray<GreenLotMediaRowForAllocation> | null
}

// Raw shape consumed from the Prisma include. We accept
// the Prisma string union for role/source/visibility (the
// runtime enum values are the same string literals) but
// normalize defensively in case the DB ever holds a stale
// value.
export type GreenLotMediaRowForAllocation = {
  id: string
  url: string
  role: string
  source: string
  // LOT-MEDIA-2 — optional so legacy callers / tests that
  // omit visibility default to PUBLIC_MARKET in the mapper.
  visibility?: string | null
  position: number | null
  isPrimary: boolean | null
  altText?: string | null
  caption?: string | null
  credit?: string | null
}

// ------------------------------------------------------
// NUMERIC GUARDS (mapper-local; partition.ts has its own
// version, but we don't depend on it here to keep the
// mapper a self-contained unit)
// ------------------------------------------------------

function safeNonNegative(value: number | null | undefined): number {
  if (value == null) return 0
  if (typeof value !== "number") return 0
  if (!Number.isFinite(value)) return 0
  return value > 0 ? value : 0
}

// ------------------------------------------------------
// COMMITMENT AGGREGATION
//
// Mirrors src/services/system/supply.service.ts line 82–84
// for the monthly fallback (monthlyGreenKg ?? monthlyVolumeKg)
// — same source of truth so allocation and supply agree on
// what the contract is currently drawing.
//
// Horizon is the conservative obligation: monthly × remaining.
// remainingMonths = null is treated as 1 (assume one more
// delivery is owed). Negative values clamp to 0 — the
// `Math.max(1, ...)` floor below ensures horizon ≥ monthly
// for any contract still considered active.
// ------------------------------------------------------

export function aggregateCommitments(
  contracts: ReadonlyArray<ContractRowForAllocation>
): Map<string, CommitmentAggregate> {

  const out = new Map<string, CommitmentAggregate>()

  for (const c of contracts) {
    if (!c.greenLotId) continue

    // Prefer monthlyGreenKg; fall back to monthlyVolumeKg for
    // legacy contracts where green wasn't snapshotted at sign.
    const rawMonthly =
      c.monthlyGreenKg ?? c.monthlyVolumeKg ?? 0
    const monthly = safeNonNegative(rawMonthly)
    if (monthly === 0) continue

    let cleanedRemaining: number
    if (c.remainingMonths == null) {
      cleanedRemaining = 1
    } else if (!Number.isFinite(c.remainingMonths)) {
      cleanedRemaining = 1
    } else if (c.remainingMonths < 0) {
      cleanedRemaining = 0
    } else {
      cleanedRemaining = c.remainingMonths
    }

    // Horizon multiplier: at least 1 month — even an
    // "ending this month" contract owes one more delivery.
    const horizonMonths = Math.max(1, cleanedRemaining)
    const horizon = monthly * horizonMonths

    const prev =
      out.get(c.greenLotId) ?? {
        monthlyGreenKg: 0,
        horizonGreenKg: 0,
        longestRemainingMonths: 0,
      }

    prev.monthlyGreenKg += monthly
    prev.horizonGreenKg += horizon
    if (cleanedRemaining > prev.longestRemainingMonths) {
      prev.longestRemainingMonths = cleanedRemaining
    }

    out.set(c.greenLotId, prev)
  }

  return out
}

// ------------------------------------------------------
// INTENT AGGREGATION
// ------------------------------------------------------

export function aggregateIntentReservations(
  intents: ReadonlyArray<IntentRowForAllocation>
): Map<string, number> {

  const out = new Map<string, number>()

  for (const i of intents) {
    if (!i.greenLotId) continue
    const delta = safeNonNegative(i.deltaKg)
    if (delta === 0) continue
    out.set(i.greenLotId, (out.get(i.greenLotId) ?? 0) + delta)
  }

  return out
}

// ------------------------------------------------------
// LOT-MEDIA-1 — RAW ROW → LotMediaItem
//
// Drops rows with unknown role/source, missing url, or
// negative/NaN position. The mapper does NOT sort here —
// the lot-media/lotMedia.pure helper owns ordering. We only
// project a Prisma row into the pure view-model.
// ------------------------------------------------------

export function mapLotMediaRows(
  rows: ReadonlyArray<GreenLotMediaRowForAllocation> | null | undefined
): LotMediaItem[] {
  if (!rows || rows.length === 0) return []
  const out: LotMediaItem[] = []
  for (const r of rows) {
    if (!r || typeof r.url !== "string" || r.url.trim() === "") continue
    const role = normalizeLotMediaRole(r.role)
    const source = normalizeLotMediaSource(r.source)
    if (!role || !source) continue
    const position =
      typeof r.position === "number" && Number.isFinite(r.position) && r.position >= 0
        ? r.position
        : 0
    // LOT-MEDIA-2 — visibility defaults to PUBLIC_MARKET when
    // the column is missing (legacy rows) or holds an unknown
    // value. This matches the migration default so LOT-MEDIA-1
    // rows continue to render in marketplace/catalog.
    const visibility = normalizeLotMediaVisibility(r.visibility) ?? "PUBLIC_MARKET"
    out.push({
      id: r.id,
      url: r.url,
      role,
      source,
      visibility,
      position,
      isPrimary: r.isPrimary === true,
      altText: r.altText ?? null,
      caption: r.caption ?? null,
      credit: r.credit ?? null,
    })
  }
  return out
}

// ------------------------------------------------------
// LOT STATUS MAPPING
//
// Prisma's LotStatus enum is a string literal at runtime;
// we accept any string and project onto the allocation
// status union. Anything unrecognised falls back to DRAFT
// (engine treats DRAFT as a structural hold, which is the
// safe default for unknown lot states).
// ------------------------------------------------------

export function mapLotStatus(raw: string): LotStatus {
  switch (raw) {
    case "DRAFT":
    case "PUBLISHED":
    case "RESERVED":
    case "SOLD":
      return raw
    default:
      return "DRAFT"
  }
}

// ------------------------------------------------------
// MAIN MAPPER
//
// All inputs are local types (see GreenLotRowForAllocation)
// so this function does not depend on @prisma/client.
// ------------------------------------------------------

export type MapToSnapshotInput = {
  lot: GreenLotRowForAllocation
  committedContractMonthlyGreenKg: number
  committedContractHorizonGreenKg: number
  committedContractMonthsRemaining: number
  reservedIntentGreenKg: number
  resolvedRoastYield: number
  usedDefaultRoastYield: boolean
}

export function mapGreenLotToAllocationSnapshot(
  input: MapToSnapshotInput
): LotAllocationSnapshot {

  const { lot } = input

  // Pricing: pricingSnapshot.clientPricePerKg is the
  // authoritative client-facing green price (see
  // src/services/clients/market.service.ts). Fall back to
  // GreenLot.pricePerKg only when the snapshot row is
  // missing. Null when neither is available.
  const greenPricePerKg: number | null =
    lot.pricingSnapshot?.clientPricePerKg ??
    (typeof lot.pricePerKg === "number" && Number.isFinite(lot.pricePerKg)
      ? lot.pricePerKg
      : null)

  const farmAltitude =
    (lot.farm?.altitude ?? null) ??
    (typeof lot.altitude === "number" ? lot.altitude : null)

  const monthly = safeNonNegative(input.committedContractMonthlyGreenKg)
  const horizon = safeNonNegative(input.committedContractHorizonGreenKg)

  // ALLOC-1 compatibility: committedContractGreenKg is the
  // figure the engine deducts from available. Use the full
  // horizon so marketplace residual logic doesn't release
  // volume promised to long contracts.
  const committedForEngine = horizon

  return {
    greenLotId: lot.id,
    lotNumber: lot.lotNumber,
    status: mapLotStatus(lot.status),

    totalGreenKg: safeNonNegative(lot.totalKg),
    availableGreenKg: safeNonNegative(lot.availableKg),
    scaScore:
      typeof lot.scaScore === "number" && Number.isFinite(lot.scaScore)
        ? lot.scaScore
        : null,
    variety: typeof lot.variety === "string" ? lot.variety : "",
    process: typeof lot.process === "string" ? lot.process : "",
    harvestYear:
      typeof lot.harvestYear === "number" && Number.isFinite(lot.harvestYear)
        ? lot.harvestYear
        : null,

    estimatedRoastYield: input.resolvedRoastYield,
    usedDefaultRoastYield: input.usedDefaultRoastYield,

    greenPricePerKg,

    // PRICING-B2B-3 — propagate persisted B2B fields. Null when the
    // row is pre-B2B; downstream mappers fall back to legacy
    // green/yield via resolveClientB2BPriceForLot.
    clientB2BPricePerKg: lot.pricingSnapshot?.clientB2BPricePerKg ?? null,
    clientB2BPricingVersion: lot.pricingSnapshot?.clientB2BPricingVersion ?? null,
    clientB2BPricingMode: lot.pricingSnapshot?.clientB2BPricingMode ?? null,

    farmId: lot.farm?.id ?? "",
    farmRegion: lot.farm?.region ?? null,
    farmAltitude,
    producerCountry: lot.farm?.producer?.country ?? null,

    committedContractGreenKg: committedForEngine,
    committedContractMonthsRemaining: safeNonNegative(
      input.committedContractMonthsRemaining
    ),
    committedContractMonthlyGreenKg: monthly,
    committedContractHorizonGreenKg: horizon,
    reservedIntentGreenKg: safeNonNegative(input.reservedIntentGreenKg),

    shipmentId: lot.shipmentId ?? null,
    marketDemandIndex: null,

    // Display metadata
    name: lot.name ?? null,
    producerName: lot.farm?.producer?.name ?? null,
    farmName: lot.farm?.name ?? null,
    createdAt:
      lot.createdAt instanceof Date
        ? lot.createdAt.toISOString()
        : typeof lot.createdAt === "string"
          ? lot.createdAt
          : null,
    currency: typeof lot.currency === "string" ? lot.currency : null,

    // LOT-MEDIA-1 + FARM-MEDIA-1 — combined ordered media sequence.
    // Lot-owned rows are tagged owner="LOT"; farm-owned rows are
    // tagged owner="FARM". Downstream mappers call
    // buildOrderedLotMedia(snapshot.media) which honours the
    // owner-aware tiebreak (LOT beats FARM at equal role+position).
    media: combineLotAndFarmMedia({
      lotRows: lot.media,
      lotId: lot.id,
      farmRows: lot.farm?.media,
      farmId: lot.farm?.id ?? null,
    }),
  }
}

// FARM-MEDIA-1 — merge raw lot and farm media rows into the
// LotAllocationSnapshot.media field while tagging each item with
// its owner. The order of the returned array is purely the
// concatenation order (lot rows first, farm rows second); the
// final ordering is decided by buildOrderedLotMedia downstream.
type CombineLotAndFarmMediaInput = {
  lotRows: ReadonlyArray<GreenLotMediaRowForAllocation> | null | undefined
  lotId: string
  farmRows: ReadonlyArray<GreenLotMediaRowForAllocation> | null | undefined
  farmId: string | null
}

function combineLotAndFarmMedia(input: CombineLotAndFarmMediaInput): LotMediaItem[] {
  const lotItems = withOwner(mapLotMediaRows(input.lotRows), "LOT", input.lotId)
  const farmItems = withOwner(mapLotMediaRows(input.farmRows), "FARM", input.farmId)
  if (lotItems.length === 0) return farmItems
  if (farmItems.length === 0) return lotItems
  return lotItems.concat(farmItems)
}
