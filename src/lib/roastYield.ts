import { ProcessType } from "@prisma/client"

// =====================================================
// ROAST YIELD — GREEN-TO-ROASTED CONVERSION
//
// Single source of truth for all green↔roasted math.
// Called by: market view service, demand intent service,
// contract service.
// =====================================================

const DEFAULT_YIELDS: Record<ProcessType, number> = {
  WASHED: 0.85,
  NATURAL: 0.82,
  HONEY: 0.84,
  ANAEROBIC: 0.82,
}

const MIN_YIELD = 0.50
const MAX_YIELD = 1.00

export function resolveRoastYield(lot: {
  estimatedRoastYield?: number | null
  process: ProcessType
}): number {
  const raw = lot.estimatedRoastYield ?? DEFAULT_YIELDS[lot.process] ?? 0.83
  return Math.max(MIN_YIELD, Math.min(MAX_YIELD, raw))
}

export function greenToRoasted(greenKg: number, roastYield: number): number {
  return greenKg * roastYield
}

export function roastedToGreen(roastedKg: number, roastYield: number): number {
  const safeYield = Math.max(MIN_YIELD, roastYield)
  return roastedKg / safeYield
}

export function computeRoastedPrice(
  greenPricePerKg: number,
  roastYield: number
): number {
  const safeYield = Math.max(MIN_YIELD, roastYield)
  return greenPricePerKg / safeYield
}
