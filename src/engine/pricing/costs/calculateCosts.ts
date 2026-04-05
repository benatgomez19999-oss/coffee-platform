//////////////////////////////////////////////////////
// 💰 TOTAL COST ENGINE (REAL DATA BASED)
//////////////////////////////////////////////////////

import { COST_STRUCTURE } from "@/src/engine/pricing/costs/costTable"

type CostInput = {
  region: keyof typeof COST_STRUCTURE.internalTransport
  port: keyof typeof COST_STRUCTURE.exportCost
  freightType: "FCL" | "LCL"
}

export function calculateTotalCost(input: CostInput) {
  //////////////////////////////////////////////////////
  // 🌱 ORIGIN
  //////////////////////////////////////////////////////

  const inlandTransport =
    COST_STRUCTURE.internalTransport[input.region]

  const exportCost =
    COST_STRUCTURE.exportCost[input.port]

  const originTotal = inlandTransport + exportCost

  //////////////////////////////////////////////////////
  // 🚢 SHIPPING
  //////////////////////////////////////////////////////

  const freight =
    COST_STRUCTURE.freight[input.freightType]

  //////////////////////////////////////////////////////
  // 🌍 DESTINATION
  //////////////////////////////////////////////////////

  const arrival = COST_STRUCTURE.arrival
  const euTransport = COST_STRUCTURE.euTransport
  const roasting = COST_STRUCTURE.roasting
  const packaging = COST_STRUCTURE.packaging
  const lastMile = COST_STRUCTURE.lastMile

  const destinationTotal =
    arrival +
    euTransport +
    roasting +
    packaging +
    lastMile

  //////////////////////////////////////////////////////
  // 💰 TOTAL
  //////////////////////////////////////////////////////

  const total =
    originTotal +
    freight +
    destinationTotal

  //////////////////////////////////////////////////////
  // 🧾 BREAKDOWN (CLAVE PARA AI)
  //////////////////////////////////////////////////////

  return {
    total,
    breakdown: {
      origin: {
        inlandTransport,
        exportCost,
      },
      shipping: {
        freight,
      },
      destination: {
        arrival,
        euTransport,
        roasting,
        packaging,
        lastMile,
      },
    },
  }
}