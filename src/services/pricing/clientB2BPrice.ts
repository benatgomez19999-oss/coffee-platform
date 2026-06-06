//////////////////////////////////////////////////////
// 💰 CLIENT B2B PRICE RESOLVER
//
// Single source of truth for "what €/kg roasted does the
// client sign at?" — used by contracts.service,
// demandIntent.service, marketplace mapper and contract
// catalog mapper.
//
// Priority:
//   1. PricingSnapshot.clientB2BPricePerKg (PRICING-B2B-3)
//      — the persisted target-anchored adaptive B2B price.
//   2. Legacy fallback:
//      computeRoastedPrice(clientPricePerKg, roastYield)
//      — for rows that pre-date PRICING-B2B-3, where
//      clientPricePerKg is misleadingly named (it is GREEN).
//
// Pure function, no Prisma. The lot input is a structural
// shape that matches what the production services already
// fetch (see contracts.service / demandIntent.service).
//////////////////////////////////////////////////////

// Relative .ts import so this module is consumable under node --test
// (the @/src/* alias and extensionless imports don't resolve outside
// the Next/TS build pipeline).
import { resolveRoastYield, computeRoastedPrice } from "../../lib/roastYield.ts"

export type ClientB2BPriceSource =
  | "CLIENT_B2B_PERSISTED"
  | "LEGACY_GREEN_EQUIVALENT"

export type ResolvedClientB2BPrice = {
  pricePerKgRoasted: number
  source: ClientB2BPriceSource
  legacyGreenPricePerKg: number | null
  roastYield: number
}

export type LotForB2BResolution = {
  estimatedRoastYield?: number | null
  process: "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC" | string
  pricingSnapshot:
    | {
        clientB2BPricePerKg?: number | null
        clientPricePerKg: number
      }
    | null
}

export class ClientB2BPriceError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "ClientB2BPriceError"
    this.code = code
  }
}

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function resolveClientB2BPriceForLot(
  lot: LotForB2BResolution
): ResolvedClientB2BPrice {

  if (!lot.pricingSnapshot) {
    throw new ClientB2BPriceError(
      "GreenLot has no pricing snapshot — cannot determine price",
      "LOT_NO_PRICING"
    )
  }

  const roastYield = resolveRoastYield({
    estimatedRoastYield: lot.estimatedRoastYield ?? null,
    process: lot.process as "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC",
  })

  const persisted = lot.pricingSnapshot.clientB2BPricePerKg
  if (isUsableNumber(persisted)) {
    return {
      pricePerKgRoasted: persisted,
      source: "CLIENT_B2B_PERSISTED",
      legacyGreenPricePerKg: lot.pricingSnapshot.clientPricePerKg ?? null,
      roastYield,
    }
  }

  const legacyGreen = lot.pricingSnapshot.clientPricePerKg
  if (isUsableNumber(legacyGreen)) {
    return {
      pricePerKgRoasted: computeRoastedPrice(legacyGreen, roastYield),
      source: "LEGACY_GREEN_EQUIVALENT",
      legacyGreenPricePerKg: legacyGreen,
      roastYield,
    }
  }

  throw new ClientB2BPriceError(
    "PricingSnapshot has no usable price (clientB2BPricePerKg and clientPricePerKg both invalid)",
    "LOT_NO_PRICING"
  )
}
