import { prisma } from "@/database/prisma";
import { calculateProducerPricing } from "@/engine/pricing/producer/calculatePricing";
import { eventBus } from "@/events/core/eventBus"
import { EVENTS } from "@/events/core/eventTypes"

// =====================================================
// LOT VERIFICATION SERVICE
//
// Orquesta:
// — validación input
// — obtención de draft + farm
// — conversión volumen
// — pricing real
// — creación de greenLot + snapshot
// — transición de estado
//
// ⚠️ SINGLE SOURCE OF TRUTH
// =====================================================

export async function verifyLotService(input: {

  lotId: string
  scaScore: number
  conversionRate: number

}) {

  //////////////////////////////////////////////////////
  // 🧠 INPUT VALIDATION
  //////////////////////////////////////////////////////

  if (isNaN(input.conversionRate) || isNaN(input.scaScore)) {
    throw new Error("Invalid numeric values");
  }

  if (input.conversionRate <= 0 || input.scaScore <= 0) {
    throw new Error("Values must be greater than 0");
  }

  //////////////////////////////////////////////////////
  // 1. GET DRAFT
  //////////////////////////////////////////////////////

  const draft = await prisma.producerLotDraft.findUnique({
    where: { id: input.lotId },
  });

  if (!draft) {
    throw new Error("Draft not found");
  }

  //////////////////////////////////////////////////////
  // 🛑 IDEMPOTENCY GUARD
  //////////////////////////////////////////////////////

  if (draft.status === "VERIFIED") {
    throw new Error("Lot already verified");
  }

  //////////////////////////////////////////////////////
  // 2. GET FARM (CRÍTICO PARA PRICING)
  //////////////////////////////////////////////////////

  const farm = await prisma.farm.findUnique({
    where: { id: draft.farmId },
  });

  if (!farm) {
    throw new Error("Farm not found");
  }

  if (!farm.altitude) {
    throw new Error("Farm altitude missing");
  }

  //////////////////////////////////////////////////////
  // 3. CALCULATIONS
  //////////////////////////////////////////////////////

  const greenKg =
    draft.parchmentKg * input.conversionRate;

  const pricing = calculateProducerPricing({

    scaScore: input.scaScore,
    altitude: farm.altitude,
    variety: draft.variety as any,
    process: draft.process as any,
    country: "COLOMBIA",

  });

  //////////////////////////////////////////////////////
  // 4. CREATE GREEN LOT
  //////////////////////////////////////////////////////

  const greenLot = await prisma.greenLot.create({
    data: {

      //////////////////////////////////////////////////////
      // 🔢 TRACEABILITY
      //////////////////////////////////////////////////////
      lotNumber: draft.lotNumber,

      //////////////////////////////////////////////////////
      // 🌱 PRODUCT INFO
      //////////////////////////////////////////////////////
      farmId: draft.farmId,
      name: draft.name,
      variety: draft.variety,
      process: draft.process,
      harvestYear: draft.harvestYear,

      //////////////////////////////////////////////////////
      // 📦 VOLUME
      //////////////////////////////////////////////////////
      totalKg: greenKg,
      availableKg: greenKg,

      //////////////////////////////////////////////////////
      // 📊 QUALITY
      //////////////////////////////////////////////////////
      scaScore: input.scaScore,

      //////////////////////////////////////////////////////
      // 💰 PRICING
      //////////////////////////////////////////////////////
      pricePerKg: pricing.finalPrice,

      //////////////////////////////////////////////////////
      // 📊 PRICING SNAPSHOT
      //////////////////////////////////////////////////////
      pricingSnapshot: {
        create: {
          producerPricePerKg: pricing.finalPrice,
          clientPricePerKg: pricing.finalPrice,
          marginPerKg: 0,
          pricingVersion: "v1",

          breakdown: pricing.breakdown,

          context: {
            scaScore: input.scaScore,
            altitude: farm.altitude,
            variety: draft.variety,
            process: draft.process,
          },
        },
      },
    },
  });

  //////////////////////////////////////////////////////
  // 5. UPDATE DRAFT
  //////////////////////////////////////////////////////

  await prisma.producerLotDraft.update({
    where: { id: input.lotId },
    data: {
      status: "VERIFIED",
      greenLotId: greenLot.id,
      conversionRate: input.conversionRate,
    },
  });

//////////////////////////////////////////////////////
// 📡 EVENT EMISSION
// Punto estructural del sistema
//////////////////////////////////////////////////////

eventBus.emit(EVENTS.LOT_VERIFIED, {

  greenLotId: greenLot.id,
  lotId: draft.id

})

  
  

  //////////////////////////////////////////////////////
  // OUTPUT
  //////////////////////////////////////////////////////

  return greenLot;
}