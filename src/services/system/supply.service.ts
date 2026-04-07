import { prisma } from "@/src/database/prisma"
import {
  REGION_REGISTRY
} from "@/src/spatialMarket/registries"

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