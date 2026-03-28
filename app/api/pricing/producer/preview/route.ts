import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"

import { calculateProducerPricing } from "@/engine/pricing/producer/calculatePricing"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    //////////////////////////////////////////////////////
    // 📥 INPUT
    //////////////////////////////////////////////////////

    const {
      scaScore,
      altitude,
      variety,
      process,
      country,
      lotId,
      marketData,
    } = body

    //////////////////////////////////////////////////////
    // 💰 CALCULATE PRICING
    //////////////////////////////////////////////////////

    const pricing = calculateProducerPricing({
      scaScore,
      altitude,
      variety,
      process,
      country,
      marketData,
    })

    //////////////////////////////////////////////////////
    // 💾 SAVE SNAPSHOT (ONLY IF LOT EXISTS)
    //////////////////////////////////////////////////////

    if (lotId) {
      await prisma.pricingSnapshot.upsert({
        where: {
          lotId,
        },
        update: {
          producerPricePerKg: pricing.finalPrice,
          clientPricePerKg: pricing.finalPrice * 1.3, // ajustaremos luego
          marginPerKg: pricing.finalPrice * 0.3,
          pricingVersion: "v2_modular",

          //////////////////////////////////////////////////////
          // 🧠 BREAKDOWN
          //////////////////////////////////////////////////////

          breakdown: pricing.breakdown,

          //////////////////////////////////////////////////////
          // 📊 CONTEXT
          //////////////////////////////////////////////////////

          context: {
            scaScore,
            altitude,
            variety,
            process,
            country,
          },
        },
        create: {
          lotId,
          producerPricePerKg: pricing.finalPrice,
          clientPricePerKg: pricing.finalPrice * 1.3,
          marginPerKg: pricing.finalPrice * 0.3,
          pricingVersion: "v2_modular",

          breakdown: pricing.breakdown,

          context: {
            scaScore,
            altitude,
            variety,
            process,
            country,
          },
        },
      })
    }

    //////////////////////////////////////////////////////
    // 📤 RESPONSE
    //////////////////////////////////////////////////////

    return NextResponse.json(pricing)
  } catch (error) {
    return NextResponse.json(
      { error: "Producer pricing failed" },
      { status: 500 }
    )
  }
}