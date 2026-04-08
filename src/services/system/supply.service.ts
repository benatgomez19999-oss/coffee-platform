import { prisma } from "@/src/database/prisma"
import { Prisma } from "@prisma/client"
import {
  REGION_REGISTRY
} from "@/src/spatialMarket/registries"

// =====================================================
// SAFETY BUFFER — minimum kg reserved from contracting
// Matches the minimumReserve in semaphoreEvaluator.ts
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
  // 2. COMMITTED BY CONTRACTS — monthly volume of
  //    contracts that are pending, signed, or active.
  //    Conservative: we count monthly commitment, not
  //    lifetime volume, because supply is replenished.
  // -------------------------------------------------

  const contractWhere: Prisma.ContractWhereInput = {
    status: { in: ["AWAITING_SIGNATURE", "SIGNED", "ACTIVE"] },
    ...(greenLotId ? { greenLotId } : {})
  }

  const committedResult = await db.contract.aggregate({
    where: contractWhere,
    _sum: { monthlyVolumeKg: true }
  })

  const committedKg = committedResult._sum.monthlyVolumeKg ?? 0

  // -------------------------------------------------
  // 3. RESERVED BY OPEN INTENTS — positive deltaKg
  //    from intents not yet consumed or expired.
  //    Phase 1: this will return 0 until demand-intent
  //    route is live. Included for correctness.
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