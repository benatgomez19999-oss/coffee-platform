import { prisma } from "@/src/database/prisma"
import { Prisma } from "@prisma/client"
import {
  REGION_REGISTRY
} from "@/src/spatialMarket/registries"

// =====================================================
// SAFETY BUFFER — single authoritative reserve (400 kg)
//
// This is the ONLY place the structural reserve is applied.
// Callers passing contractableKg to evaluateSemaphore must
// set safetyBuffer = 0 to avoid double-deduction.
// The semaphore's internal minimumReserve (400) provides an
// additional post-trade floor — that is a separate check,
// not a duplicate of this buffer.
// =====================================================

const SAFETY_BUFFER_KG = 400

// =====================================================
// CONTRACTABLE SUPPLY
//
// Returns the supply available for new contract commitments.
// This is NOT the same as display supply (getRealSupply).
//
// contractableKg = grossAvailable
//   - committedByContracts (monthly volume of active/pending contracts)
//   - reservedByIntents (OPEN DemandIntents with positive delta)
//   - safetyBuffer (400 kg structural reserve)
//
// Phase 1: reservedByIntents is included but will be 0
// until the demand-intent route is live.
//
// Can optionally scope to a specific GreenLot.
// Can accept a Prisma transaction client for atomic reads.
// =====================================================

export async function getContractableSupply(options?: {
  greenLotId?: string
  excludeIntentId?: string
  tx?: Prisma.TransactionClient
}) {

  const db = options?.tx ?? prisma
  const greenLotId = options?.greenLotId
  const excludeIntentId = options?.excludeIntentId

  // -------------------------------------------------
  // 1. GROSS AVAILABLE — real published supply
  // -------------------------------------------------

  const lotWhere: Prisma.GreenLotWhereInput = {
    status: "PUBLISHED",
    availableKg: { gt: 0 },
    ...(greenLotId ? { id: greenLotId } : {})
  }

  const grossResult = await db.greenLot.aggregate({
    where: lotWhere,
    _sum: { availableKg: true }
  })

  const grossAvailableKg = grossResult._sum.availableKg ?? 0

  // -------------------------------------------------
  // 2. COMMITTED BY CONTRACTS — green equivalent of
  //    contracts that are pending, signed, or active.
  //    Uses monthlyGreenKg (green). Falls back to
  //    monthlyVolumeKg for legacy contracts (was green).
  // -------------------------------------------------

  const contractWhere: Prisma.ContractWhereInput = {
    status: { in: ["AWAITING_SIGNATURE", "SIGNED", "ACTIVE"] },
    ...(greenLotId ? { greenLotId } : {})
  }

  const contracts = await db.contract.findMany({
    where: contractWhere,
    select: { monthlyGreenKg: true, monthlyVolumeKg: true }
  })

  const committedKg = contracts.reduce((sum, c) => {
    return sum + (c.monthlyGreenKg ?? c.monthlyVolumeKg)
  }, 0)

  // -------------------------------------------------
  // 3. RESERVED BY OPEN INTENTS — positive deltaKg
  //    from intents not yet consumed or expired.
  //    Only OPEN intents reserve supply.
  //    COUNTERED intents do NOT reserve.
  // -------------------------------------------------

  const intentWhere: Prisma.DemandIntentWhereInput = {
    status: "OPEN",
    expiresAt: { gt: new Date() },
    deltaKg: { gt: 0 },
    ...(greenLotId ? { greenLotId } : {}),
    ...(excludeIntentId ? { id: { not: excludeIntentId } } : {})
  }

  const intentResult = await db.demandIntent.aggregate({
    where: intentWhere,
    _sum: { deltaKg: true }
  })

  const reservedByIntentsKg = intentResult._sum.deltaKg ?? 0

  // -------------------------------------------------
  // 4. FINAL CALCULATION
  // -------------------------------------------------

  const contractableKg = Math.max(
    0,
    grossAvailableKg - committedKg - reservedByIntentsKg - SAFETY_BUFFER_KG
  )

  return {
    contractableKg,
    grossAvailableKg,
    committedKg,
    reservedByIntentsKg
  }
}

// =====================================================
// DISPLAYABLE SUPPLY — MARKET VIEW ONLY
//
// Wraps getContractableSupply() with a conservative
// adjustment factor for display purposes.
// NEVER used for transactional validation (contract
// creation, intent reservation). Only for market view.
//
// adjustmentFactor is server-side deterministic:
// derived from committed/gross ratio. No engine coupling.
// =====================================================

export async function getDisplayableSupply(options?: {
  greenLotId?: string
}) {
  const supply = await getContractableSupply(options)

  const committedRatio = supply.grossAvailableKg > 0
    ? supply.committedKg / supply.grossAvailableKg
    : 0

  const reservedRatio = supply.grossAvailableKg > 0
    ? supply.reservedByIntentsKg / supply.grossAvailableKg
    : 0

  const adjustmentFactor = Math.max(
    0.70,
    Math.min(1.00, 1.0 - committedRatio * 0.15 - reservedRatio * 0.10)
  )

  const displayableKg = supply.contractableKg * adjustmentFactor

  return {
    ...supply,
    displayableKg,
    adjustmentFactor,
  }
}

type RegionAgg = {
  name: string
  availableKg: number
}

export async function getRealSupply() {

  const lots = await prisma.greenLot.findMany({
    where: {
      status: "PUBLISHED",
      availableKg: { gt: 0 }
    },
    include: {
      farm: true
    }
  })

  // =====================================================
  // REGION AGGREGATION
  // =====================================================

  const regionMap = new Map<string, number>()

  for (const lot of lots) {

    const regionName =
      lot.farm?.name || "Unknown"

    const prev = regionMap.get(regionName) ?? 0

    regionMap.set(
      regionName,
      prev + (lot.availableKg ?? 0)
    )
  }

  const regions: RegionAgg[] = Array.from(regionMap.entries())
    .map(([name, availableKg]) => ({
      name,
      availableKg
    }))

  // =====================================================
  // COUNTRY → HEMISPHERE → REGION TREE
  // =====================================================

  const countryMap = new Map<
    string,
    Map<string, RegionAgg[]>
  >()

  for (const region of regions) {

    const key = region.name as keyof typeof REGION_REGISTRY

    const config = REGION_REGISTRY[key]

    

    if (!config) continue

    const { country, hemisphere } = config

    if (!countryMap.has(country)) {
      countryMap.set(country, new Map())
    }

    const hemisphereMap = countryMap.get(country)!

    if (!hemisphereMap.has(hemisphere)) {
      hemisphereMap.set(hemisphere, [])
    }

    hemisphereMap.get(hemisphere)!.push(region)
  }

  // =====================================================
  // BUILD FINAL STRUCTURE
  // =====================================================

  const countries = Array.from(countryMap.entries())
    .map(([countryName, hemisphereMap]) => {

      const hemispheres = Array.from(hemisphereMap.entries())
        .map(([hemisphereName, regions]) => {

          const totalKg =
            regions.reduce(
              (sum, r) => sum + r.availableKg,
              0
            )

          return {
            name: hemisphereName,
            totalKg,
            regions: regions.sort(
              (a, b) => b.availableKg - a.availableKg
            )
          }
        })

      const totalKg =
        hemispheres.reduce(
          (sum, h) => sum + h.totalKg,
          0
        )

      return {
        name: countryName,
        totalKg,
        hemispheres
      }
    })

  const totalKg =
    countries.reduce(
      (sum, c) => sum + c.totalKg,
      0
    )

  return {
    commodity: "coffee",
    totalKg,
    countries
  }
}