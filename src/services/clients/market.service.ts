import { prisma } from "@/src/database/prisma"
import { ProcessType } from "@prisma/client"
import { getDisplayableSupply } from "@/src/services/system/supply.service"
import {
  resolveRoastYield,
  greenToRoasted,
  computeRoastedPrice,
} from "@/src/lib/roastYield"

// =====================================================
// MARKET VIEW SERVICE
//
// Transforms published GreenLots into client-facing
// market snapshot with roasted-primary volumes and prices.
//
// All prices are pre-computed server-side.
// Frontend NEVER recomputes price or converts units.
//
// Uses getDisplayableSupply() for display — NEVER used
// for transactional validation.
// =====================================================

export type MarketLot = {
  id: string
  name: string | null
  origin: {
    region: string | null
    farmName: string
    altitude: number | null
  }
  coffee: {
    variety: string
    process: ProcessType
    scaScore: number | null
    harvestYear: number
  }
  volume: {
    roastedAvailableKg: number
    greenAvailableKg: number
    estimatedRoastYield: number
  }
  pricing: {
    roastedPricePerKg: number
    greenPricePerKg: number
  }
}

export type MarketRegion = {
  name: string
  lots: MarketLot[]
  totalRoastedKg: number
  totalGreenKg: number
}

export type MarketView = {
  regions: Record<string, MarketRegion>
  totals: {
    roastedAvailableKg: number
    greenAvailableKg: number
    lotCount: number
  }
}

export async function getMarketView(): Promise<MarketView> {

  // -------------------------------------------------
  // 1. FETCH ALL PUBLISHED LOTS
  // -------------------------------------------------

  const lots = await prisma.greenLot.findMany({
    where: {
      status: "PUBLISHED",
      availableKg: { gt: 0 },
    },
    include: {
      farm: true,
      pricingSnapshot: true,
    },
  })

  // -------------------------------------------------
  // 2. BUILD MARKET LOTS WITH ROASTED CONVERSION
  // -------------------------------------------------

  const regionMap: Record<string, MarketRegion> = {}
  let totalRoastedKg = 0
  let totalGreenKg = 0
  let includedLotCount = 0

  for (const lot of lots) {
    if (!lot.pricingSnapshot) continue

    includedLotCount++

    const roastYield = resolveRoastYield(lot)

    // Get display supply for this lot (risk-adjusted, display-only)
    // NOTE: N+1 query — one getDisplayableSupply call per lot.
    // Acceptable while lot count is small. Batch if this grows.
    const supply = await getDisplayableSupply({ greenLotId: lot.id })
    const displayGreenKg = supply.displayableKg

    const displayRoastedKg = greenToRoasted(displayGreenKg, roastYield)

    const greenPricePerKg = lot.pricingSnapshot.clientPricePerKg
    const roastedPricePerKg = computeRoastedPrice(greenPricePerKg, roastYield)

    const regionName = lot.farm?.region ?? "Unassigned"

    const marketLot: MarketLot = {
      id: lot.id,
      name: lot.name,
      origin: {
        region: lot.farm?.region ?? null,
        farmName: lot.farm?.name ?? "Unknown",
        altitude: lot.farm?.altitude ?? lot.altitude,
      },
      coffee: {
        variety: lot.variety,
        process: lot.process,
        scaScore: lot.scaScore,
        harvestYear: lot.harvestYear,
      },
      volume: {
        roastedAvailableKg: Math.round(displayRoastedKg * 10) / 10,
        greenAvailableKg: Math.round(displayGreenKg * 10) / 10,
        estimatedRoastYield: roastYield,
      },
      pricing: {
        roastedPricePerKg: Math.round(roastedPricePerKg * 100) / 100,
        greenPricePerKg: Math.round(greenPricePerKg * 100) / 100,
      },
    }

    if (!regionMap[regionName]) {
      regionMap[regionName] = {
        name: regionName,
        lots: [],
        totalRoastedKg: 0,
        totalGreenKg: 0,
      }
    }

    regionMap[regionName].lots.push(marketLot)
    regionMap[regionName].totalRoastedKg += marketLot.volume.roastedAvailableKg
    regionMap[regionName].totalGreenKg += marketLot.volume.greenAvailableKg

    totalRoastedKg += marketLot.volume.roastedAvailableKg
    totalGreenKg += marketLot.volume.greenAvailableKg
  }

  // Round region totals
  for (const region of Object.values(regionMap)) {
    region.totalRoastedKg = Math.round(region.totalRoastedKg * 10) / 10
    region.totalGreenKg = Math.round(region.totalGreenKg * 10) / 10
  }

  return {
    regions: regionMap,
    totals: {
      roastedAvailableKg: Math.round(totalRoastedKg * 10) / 10,
      greenAvailableKg: Math.round(totalGreenKg * 10) / 10,
      lotCount: includedLotCount,
    },
  }
}
