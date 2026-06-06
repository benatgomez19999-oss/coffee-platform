//////////////////////////////////////////////////////
// 📑 DEV CONTRACT SCENARIO — PURE HELPERS
//
// No Prisma, no HTTP. Importable under node --test.
//
// The service uses these to:
//   • pick deterministic eligible lots for a scenario
//   • compute contract payloads (monthlyVolumeKg roasted,
//     monthlyGreenKg green, pricePerBag, bagsPerDelivery,
//     monthlyPrice, dates)
//
// `hasClientActivity` is exposed for the client dashboard
// conditional-layout logic.
//////////////////////////////////////////////////////

import {
  getDevContractScenarioSpec,
  type DevContractScenarioKind,
  type DevContractRecipe,
} from "./devContractScenario.types.ts"

// ------------------------------------------------------
// ELIGIBLE LOT SHAPE
// ------------------------------------------------------

export type EligibleContractLot = {
  id: string
  lotNumber: string
  variety: string
  process: string
  scaScore: number | null
  altitude: number | null
  estimatedRoastYield: number | null
  availableGreenKg: number
  clientB2BPricePerKg: number | null
  legacyGreenPricePerKg: number | null
  status: string
}

// ------------------------------------------------------
// SORT + PICK
// ------------------------------------------------------

/**
 * Deterministic sort for dev contract scenarios:
 *   1. SCA score desc (higher first)
 *   2. clientB2BPricePerKg desc (premium first)
 *   3. lotNumber asc (stable tie-break)
 */
export function sortEligibleContractLots(
  lots: ReadonlyArray<EligibleContractLot>,
): EligibleContractLot[] {
  return [...lots].sort((a, b) => {
    const sa = a.scaScore ?? -Infinity
    const sb = b.scaScore ?? -Infinity
    if (sa !== sb) return sb - sa
    const pa = a.clientB2BPricePerKg ?? -Infinity
    const pb = b.clientB2BPricePerKg ?? -Infinity
    if (pa !== pb) return pb - pa
    return a.lotNumber.localeCompare(b.lotNumber)
  })
}

export function pickEligibleLotsForContractScenario(
  scenario: DevContractScenarioKind,
  lots: ReadonlyArray<EligibleContractLot>,
): {
  ok: boolean
  picked: EligibleContractLot[]
  needed: number
  message?: string
} {
  const spec = getDevContractScenarioSpec(scenario)
  const needed = spec.contracts.length + spec.demandIntents.length

  if (needed === 0) {
    return { ok: true, picked: [], needed: 0 }
  }

  const sorted = sortEligibleContractLots(lots)
  if (sorted.length < needed) {
    return {
      ok: false,
      picked: [],
      needed,
      message:
        `Scenario "${scenario}" needs ${needed} eligible dev lot${needed === 1 ? "" : "s"}, found ${sorted.length}. ` +
        `Seed marketplace/contract catalog lots first via /dev/scenarios/lots.`,
    }
  }

  return { ok: true, picked: sorted.slice(0, needed), needed }
}

// ------------------------------------------------------
// PRICING / VOLUME HELPERS
//
// Local copies — we intentionally don't import the
// production helper to keep this module pure.
// Mirror src/lib/roastYield.ts.
// ------------------------------------------------------

const MIN_YIELD = 0.5
const MAX_YIELD = 1.0
const PROCESS_YIELDS: Record<string, number> = {
  WASHED: 0.85,
  NATURAL: 0.82,
  HONEY: 0.84,
  ANAEROBIC: 0.82,
}

export function resolveDevContractRoastYield(input: {
  estimatedRoastYield: number | null
  process: string
}): number {
  const fromProcess = PROCESS_YIELDS[(input.process || "").toUpperCase()]
  const raw =
    typeof input.estimatedRoastYield === "number" && Number.isFinite(input.estimatedRoastYield)
      ? input.estimatedRoastYield
      : fromProcess ?? 0.83
  return Math.max(MIN_YIELD, Math.min(MAX_YIELD, raw))
}

export function roastedToGreenLocal(roastedKg: number, yieldRate: number): number {
  const safe = Math.max(MIN_YIELD, yieldRate)
  return roastedKg / safe
}

// ------------------------------------------------------
// CONTRACT PAYLOAD BUILDER
// ------------------------------------------------------

export const DEV_CONTRACT_BAG_SIZE_KG = 20

export type DevContractWritePayload = {
  greenLotId: string
  status: ContractStatusName

  monthlyVolumeKg: number     // ROASTED
  monthlyGreenKg: number      // GREEN (derived from yield)
  durationMonths: number
  remainingMonths: number

  lockedPricePerKg: number    // €/kg ROASTED
  roastYieldAtCreation: number
  pricePerBag: number
  bagSizeKg: number
  bagsPerDelivery: number
  monthlyPrice: number

  startDate: Date
  endDate: Date
  nextExecution: Date | null
}

import type { ContractStatusName } from "./devContractScenario.types.ts"

export function buildDevContractPayload(input: {
  lot: EligibleContractLot
  recipe: DevContractRecipe
  resolvedPricePerKgRoasted: number
  now: Date
}): DevContractWritePayload {

  const roastYield = resolveDevContractRoastYield({
    estimatedRoastYield: input.lot.estimatedRoastYield,
    process: input.lot.process,
  })

  const monthlyVolumeKg = input.recipe.monthlyRoastedKg
  const monthlyGreenKg = roastedToGreenLocal(monthlyVolumeKg, roastYield)

  const bagSizeKg = DEV_CONTRACT_BAG_SIZE_KG
  const pricePerBag = input.resolvedPricePerKgRoasted * bagSizeKg
  const bagsPerDelivery = Math.max(1, Math.round(monthlyVolumeKg / bagSizeKg))
  const monthlyPrice = bagsPerDelivery * pricePerBag

  const startDate = new Date(input.now.getTime() + input.recipe.startOffsetDays * 24 * 60 * 60 * 1000)
  const endDate = new Date(startDate.getTime() + input.recipe.durationMonths * 30 * 24 * 60 * 60 * 1000)
  const nextExecution =
    input.recipe.status === "ACTIVE"
      ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null

  return {
    greenLotId: input.lot.id,
    status: input.recipe.status,
    monthlyVolumeKg,
    monthlyGreenKg,
    durationMonths: input.recipe.durationMonths,
    remainingMonths: input.recipe.remainingMonths,
    lockedPricePerKg: input.resolvedPricePerKgRoasted,
    roastYieldAtCreation: roastYield,
    pricePerBag,
    bagSizeKg,
    bagsPerDelivery,
    monthlyPrice,
    startDate,
    endDate,
    nextExecution,
  }
}

// ------------------------------------------------------
// hasClientActivity — used by /platform/client to flip
// the dashboard into catalog-first mode.
// ------------------------------------------------------

export type ClientActivityMetrics = {
  activeContracts: number
  pendingSignatureContracts: number
  pendingPaymentContracts: number
  pendingRequests: number
}

export function hasClientActivity(metrics: ClientActivityMetrics): boolean {
  return (
    (metrics.activeContracts ?? 0) > 0 ||
    (metrics.pendingSignatureContracts ?? 0) > 0 ||
    (metrics.pendingPaymentContracts ?? 0) > 0 ||
    (metrics.pendingRequests ?? 0) > 0
  )
}
