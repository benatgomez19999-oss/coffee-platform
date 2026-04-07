import { prisma } from "@/src/database/prisma"
import { eventBus } from "@/src/events/core/eventBus"
import { EVENTS } from "@/src/events/core/eventTypes"

// =====================================================
// CONTRACT SERVICE
//
// Fuente única de verdad para:
// — creación de contratos
// — (futuro) modificaciones
//
// Filosofía:
// — determinista
// — sin lógica de transporte (no HTTP)
// — emite eventos
// =====================================================

// =====================================================
// CREATE CONTRACT
// =====================================================

export async function createContractService(input: {

  companyId: string
  monthlyVolumeKg: number
  durationMonths: number

}) {

  //////////////////////////////////////////////////////
  // 🧠 CALCULATIONS
  //////////////////////////////////////////////////////

  const pricePerBag = 10
  const bagSizeKg = 20

  const bagsPerDelivery =
    Math.round(input.monthlyVolumeKg / bagSizeKg)

  const monthlyPrice =
    bagsPerDelivery * pricePerBag

  //////////////////////////////////////////////////////
  // 💾 CREATE CONTRACT
  //////////////////////////////////////////////////////

  const contract = await prisma.contract.create({
    data: {

      companyId: input.companyId,

      monthlyVolumeKg: input.monthlyVolumeKg,
      durationMonths: input.durationMonths,
      remainingMonths: input.durationMonths,

      pricePerBag,
      bagSizeKg,
      bagsPerDelivery,
      monthlyPrice,

      startDate: new Date(),

      status: "AWAITING_SIGNATURE",

    }
  })

  //////////////////////////////////////////////////////
  // 📡 EVENT EMISSION
  //////////////////////////////////////////////////////

  eventBus.emit(EVENTS.CONTRACT_CREATED, {

    contractId: contract.id,
    companyId: input.companyId,

  })

  //////////////////////////////////////////////////////
  // OUTPUT
  //////////////////////////////////////////////////////

  return contract
}