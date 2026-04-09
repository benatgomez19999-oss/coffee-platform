import { prisma } from "@/src/database/prisma"
import { Prisma } from "@prisma/client"
import { eventBus } from "@/src/events/core/eventBus"
import { EVENTS } from "@/src/events/core/eventTypes"
import { getContractableSupply } from "@/src/services/system/supply.service"
import { resolveRoastYield, roastedToGreen, computeRoastedPrice } from "@/src/lib/roastYield"

// =====================================================
// CONTRACT SERVICE — UNIFIED BACKEND OWNER
//
// Single source of truth for:
//   - contract creation with supply validation
//   - contract amendment (same-coffee / switch-coffee)
//   - pricing derivation from lockedPricePerKg
//
// UNIT SEMANTICS:
//   - Contract.monthlyVolumeKg = ROASTED (client commitment)
//   - Contract.monthlyGreenKg = GREEN (supply accounting)
//   - Contract.lockedPricePerKg = per ROASTED kg
//   - Supply validation uses GREEN internally
//
// Phase 2: called directly by routes.
// Phase 3+: called via DemandIntent consumption.
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
  monthlyVolumeKg: number  // ROASTED kg — what the client commits to
  durationMonths: number
  greenLotId: string
  demandIntentId?: string
}) {

  const { companyId, monthlyVolumeKg, durationMonths, greenLotId } = input

  const contract = await prisma.$transaction(async (tx) => {

    // -------------------------------------------------
    // 1. RESOLVE LOT + PRICING + YIELD
    // -------------------------------------------------

    const lot = await fetchGreenLotWithPricing(greenLotId, tx)
    const roastYield = resolveRoastYield(lot)
    const greenPricePerKg = lot.pricingSnapshot!.clientPricePerKg
    const lockedPricePerKg = computeRoastedPrice(greenPricePerKg, roastYield)

    // -------------------------------------------------
    // 2. CONVERT ROASTED → GREEN FOR VALIDATION
    // -------------------------------------------------

    const monthlyGreenKg = roastedToGreen(monthlyVolumeKg, roastYield)

    // -------------------------------------------------
    // 3. VALIDATE CONTRACTABLE SUPPLY (GREEN)
    // -------------------------------------------------

    const supply = await getContractableSupply({
      greenLotId,
      excludeIntentId: input.demandIntentId,
      tx
    })

    if (monthlyGreenKg > supply.contractableKg) {
      throw new ContractServiceError(
        `Requested ${monthlyVolumeKg}kg roasted (${monthlyGreenKg.toFixed(1)}kg green) exceeds contractable supply of ${supply.contractableKg}kg green`,
        "INSUFFICIENT_SUPPLY"
      )
    }

    // -------------------------------------------------
    // 4. CONSUME DEMAND INTENT (if provided)
    // -------------------------------------------------

    if (input.demandIntentId) {
      const intent = await tx.demandIntent.findUnique({
        where: { id: input.demandIntentId },
        select: { status: true, expiresAt: true }
      })
      if (!intent) {
        throw new ContractServiceError("DemandIntent not found", "INTENT_NOT_FOUND")
      }
      if (intent.status !== "OPEN") {
        throw new ContractServiceError(
          `DemandIntent status is ${intent.status}, expected OPEN`,
          "INTENT_NOT_OPEN"
        )
      }
      if (intent.expiresAt && intent.expiresAt <= new Date()) {
        throw new ContractServiceError(
          "DemandIntent has expired",
          "INTENT_EXPIRED"
        )
      }
      await tx.demandIntent.update({
        where: { id: input.demandIntentId },
        data: { status: "CONSUMED", consumedAt: new Date() }
      })
    }

    // -------------------------------------------------
    // 5. DERIVE PRICING FROM LOCKED PRICE
    // -------------------------------------------------

    const bagSizeKg = DEFAULT_BAG_SIZE_KG
    const pricing = derivePricing(lockedPricePerKg, monthlyVolumeKg, bagSizeKg)

    // -------------------------------------------------
    // 6. CREATE CONTRACT
    // -------------------------------------------------

    return tx.contract.create({
      data: {
        companyId,
        greenLotId,
        lockedPricePerKg,
        roastYieldAtCreation: roastYield,

        monthlyVolumeKg,
        monthlyGreenKg,
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
  excludeIntentId?: string
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
      // Reprice from new lot's PricingSnapshot + new yield.
      // -------------------------------------------------

      const lot = await fetchGreenLotWithPricing(newGreenLotId!, tx)
      const newYield = resolveRoastYield(lot)
      const newLockedPrice = computeRoastedPrice(
        lot.pricingSnapshot!.clientPricePerKg,
        newYield
      )
      const newMonthlyGreenKg = roastedToGreen(monthlyVolumeKg, newYield)

      const supply = await getContractableSupply({
        greenLotId: newGreenLotId!,
        excludeIntentId: input.excludeIntentId,
        tx
      })

      if (newMonthlyGreenKg > supply.contractableKg) {
        throw new ContractServiceError(
          `Requested ${monthlyVolumeKg}kg roasted (${newMonthlyGreenKg.toFixed(1)}kg green) exceeds contractable supply of ${supply.contractableKg}kg green for target lot`,
          "INSUFFICIENT_SUPPLY"
        )
      }

      const pricing = derivePricing(newLockedPrice, monthlyVolumeKg, bagSizeKg)

      return tx.contract.update({
        where: { id: contractId },
        data: {
          greenLotId: newGreenLotId,
          lockedPricePerKg: newLockedPrice,
          roastYieldAtCreation: newYield,
          monthlyVolumeKg,
          monthlyGreenKg: newMonthlyGreenKg,
          pricePerBag: pricing.pricePerBag,
          bagsPerDelivery: pricing.bagsPerDelivery,
          monthlyPrice: pricing.monthlyPrice,
        }
      })

    } else {
      // -------------------------------------------------
      // CASE A/B: SAME COFFEE (increase or decrease)
      // Price + yield stay locked. Only volume changes.
      // -------------------------------------------------

      // Resolve yield: contract snapshot → linked lot → fixed default
      let yieldForCalc = contract.roastYieldAtCreation
      if (yieldForCalc == null && contract.greenLotId) {
        const linkedLot = await tx.greenLot.findUnique({
          where: { id: contract.greenLotId },
          select: { estimatedRoastYield: true, process: true }
        })
        if (linkedLot) {
          yieldForCalc = resolveRoastYield(linkedLot)
        }
      }
      yieldForCalc ??= 0.84
      const newMonthlyGreenKg = roastedToGreen(monthlyVolumeKg, yieldForCalc)
      const oldMonthlyGreenKg = contract.monthlyGreenKg ?? contract.monthlyVolumeKg

      const greenDelta = newMonthlyGreenKg - oldMonthlyGreenKg

      // CASE A: Increase — validate that the green delta is available
      if (greenDelta > 0) {
        const supply = await getContractableSupply({
          greenLotId: contract.greenLotId ?? undefined,
          excludeIntentId: input.excludeIntentId,
          tx
        })

        if (greenDelta > supply.contractableKg) {
          throw new ContractServiceError(
            `Volume increase of ${greenDelta.toFixed(1)}kg green exceeds contractable supply of ${supply.contractableKg}kg`,
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
          monthlyGreenKg: newMonthlyGreenKg,
          pricePerBag: pricing.pricePerBag,
          bagsPerDelivery: pricing.bagsPerDelivery,
          monthlyPrice: pricing.monthlyPrice,
        }
      })
    }
  })

  return updated
}
