import { prisma } from "@/src/database/prisma"
import { Prisma } from "@prisma/client"
import { eventBus } from "@/src/events/core/eventBus"
import { EVENTS } from "@/src/events/core/eventTypes"
import { getContractableSupply } from "@/src/services/system/supply.service"

// =====================================================
// CONTRACT SERVICE — UNIFIED BACKEND OWNER
//
// Single source of truth for:
//   - contract creation with supply validation
//   - contract amendment (same-coffee / switch-coffee)
//   - pricing derivation from lockedPricePerKg
//
// Phase 1: called directly by routes.
// Phase 2+: called via DemandIntent consumption.
// =====================================================

const DEFAULT_BAG_SIZE_KG = 20

// =====================================================
// HELPERS
// =====================================================

function derivePricing(lockedPricePerKg: number, monthlyVolumeKg: number, bagSizeKg: number) {
  const pricePerBag = lockedPricePerKg * bagSizeKg
  const bagsPerDelivery = Math.round(monthlyVolumeKg / bagSizeKg)
  const monthlyPrice = bagsPerDelivery * pricePerBag
  return { pricePerBag, bagsPerDelivery, monthlyPrice }
}

async function fetchGreenLotWithPricing(greenLotId: string, tx: Prisma.TransactionClient) {
  const lot = await tx.greenLot.findUnique({
    where: { id: greenLotId },
    include: { pricingSnapshot: true }
  })

  if (!lot) {
    throw new ContractServiceError("GreenLot not found", "LOT_NOT_FOUND")
  }
  if (lot.status !== "PUBLISHED") {
    throw new ContractServiceError("GreenLot is not published", "LOT_NOT_PUBLISHED")
  }
  if (!lot.pricingSnapshot) {
    throw new ContractServiceError(
      "GreenLot has no pricing snapshot — cannot determine price",
      "LOT_NO_PRICING"
    )
  }

  return lot
}

// =====================================================
// ERROR TYPE
// =====================================================

export class ContractServiceError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "ContractServiceError"
    this.code = code
  }
}

// =====================================================
// CREATE CONTRACT WITH SUPPLY VALIDATION
// =====================================================

export async function createContractWithSupplyValidation(input: {
  companyId: string
  monthlyVolumeKg: number
  durationMonths: number
  greenLotId: string
}) {

  const { companyId, monthlyVolumeKg, durationMonths, greenLotId } = input

  const contract = await prisma.$transaction(async (tx) => {

    // -------------------------------------------------
    // 1. RESOLVE LOT + PRICING
    // -------------------------------------------------

    const lot = await fetchGreenLotWithPricing(greenLotId, tx)
    const lockedPricePerKg = lot.pricingSnapshot!.clientPricePerKg

    // -------------------------------------------------
    // 2. VALIDATE CONTRACTABLE SUPPLY
    // -------------------------------------------------

    const supply = await getContractableSupply({
      greenLotId,
      tx
    })

    if (monthlyVolumeKg > supply.contractableKg) {
      throw new ContractServiceError(
        `Requested ${monthlyVolumeKg}kg exceeds contractable supply of ${supply.contractableKg}kg`,
        "INSUFFICIENT_SUPPLY"
      )
    }

    // -------------------------------------------------
    // 3. DERIVE PRICING FROM LOCKED PRICE
    // -------------------------------------------------

    const bagSizeKg = DEFAULT_BAG_SIZE_KG
    const pricing = derivePricing(lockedPricePerKg, monthlyVolumeKg, bagSizeKg)

    // -------------------------------------------------
    // 4. CREATE CONTRACT
    // -------------------------------------------------

    return tx.contract.create({
      data: {
        companyId,
        greenLotId,
        lockedPricePerKg,

        monthlyVolumeKg,
        durationMonths,
        remainingMonths: durationMonths,

        pricePerBag: pricing.pricePerBag,
        bagSizeKg,
        bagsPerDelivery: pricing.bagsPerDelivery,
        monthlyPrice: pricing.monthlyPrice,

        startDate: new Date(),
        status: "AWAITING_SIGNATURE",
      }
    })
  })

  // -------------------------------------------------
  // EVENT (outside transaction)
  // -------------------------------------------------

  eventBus.emit(EVENTS.CONTRACT_CREATED, {
    contractId: contract.id,
    companyId: input.companyId,
  })

  return contract
}

// =====================================================
// AMEND CONTRACT WITH SUPPLY VALIDATION
//
// Handles three cases:
//   A) Same-coffee increase — locked price, validate delta
//   B) Same-coffee decrease — locked price, no validation
//   C) Switch coffee — new price from target lot, validate full volume
//
// Legacy contracts (greenLotId = null):
//   - If newGreenLotId provided → treat as switch
//   - If newGreenLotId not provided → treat as same-coffee
//     using existing pricePerBag-derived lock
// =====================================================

export async function amendContractWithSupplyValidation(input: {
  contractId: string
  companyId: string
  monthlyVolumeKg: number
  greenLotId?: string | null
}) {

  const { contractId, companyId, monthlyVolumeKg, greenLotId: newGreenLotId } = input

  const updated = await prisma.$transaction(async (tx) => {

    // -------------------------------------------------
    // 1. FETCH EXISTING CONTRACT
    // -------------------------------------------------

    const contract = await tx.contract.findUnique({
      where: { id: contractId }
    })

    if (!contract) {
      throw new ContractServiceError("Contract not found", "CONTRACT_NOT_FOUND")
    }
    if (contract.companyId !== companyId) {
      throw new ContractServiceError("Forbidden", "FORBIDDEN")
    }

    // -------------------------------------------------
    // 2. DETERMINE: SAME COFFEE OR SWITCH
    // -------------------------------------------------

    const isSwitchCoffee = (
      newGreenLotId != null &&
      newGreenLotId !== contract.greenLotId
    )

    const bagSizeKg = contract.bagSizeKg || DEFAULT_BAG_SIZE_KG

    if (isSwitchCoffee) {
      // -------------------------------------------------
      // CASE C: SWITCH COFFEE
      // Validate full volume against new lot.
      // Reprice from new lot's PricingSnapshot.
      // -------------------------------------------------

      const lot = await fetchGreenLotWithPricing(newGreenLotId!, tx)
      const newLockedPrice = lot.pricingSnapshot!.clientPricePerKg

      const supply = await getContractableSupply({
        greenLotId: newGreenLotId!,
        tx
      })

      if (monthlyVolumeKg > supply.contractableKg) {
        throw new ContractServiceError(
          `Requested ${monthlyVolumeKg}kg exceeds contractable supply of ${supply.contractableKg}kg for target lot`,
          "INSUFFICIENT_SUPPLY"
        )
      }

      const pricing = derivePricing(newLockedPrice, monthlyVolumeKg, bagSizeKg)

      return tx.contract.update({
        where: { id: contractId },
        data: {
          greenLotId: newGreenLotId,
          lockedPricePerKg: newLockedPrice,
          monthlyVolumeKg,
          pricePerBag: pricing.pricePerBag,
          bagsPerDelivery: pricing.bagsPerDelivery,
          monthlyPrice: pricing.monthlyPrice,
        }
      })

    } else {
      // -------------------------------------------------
      // CASE A/B: SAME COFFEE (increase or decrease)
      // Price stays locked. Only volume + derived totals change.
      // -------------------------------------------------

      const delta = monthlyVolumeKg - contract.monthlyVolumeKg

      // CASE A: Increase — validate that the delta is available
      if (delta > 0) {
        const supply = await getContractableSupply({
          greenLotId: contract.greenLotId ?? undefined,
          tx
        })

        if (delta > supply.contractableKg) {
          throw new ContractServiceError(
            `Volume increase of ${delta}kg exceeds contractable supply of ${supply.contractableKg}kg`,
            "INSUFFICIENT_SUPPLY"
          )
        }
      }
      // CASE B: Decrease — no supply validation needed

      // Use existing locked price. For legacy contracts without
      // lockedPricePerKg, derive it from existing pricePerBag.
      const lockedPrice = contract.lockedPricePerKg
        ?? (contract.pricePerBag / bagSizeKg)

      const pricing = derivePricing(lockedPrice, monthlyVolumeKg, bagSizeKg)

      return tx.contract.update({
        where: { id: contractId },
        data: {
          monthlyVolumeKg,
          pricePerBag: pricing.pricePerBag,
          bagsPerDelivery: pricing.bagsPerDelivery,
          monthlyPrice: pricing.monthlyPrice,
        }
      })
    }
  })

  return updated
}
