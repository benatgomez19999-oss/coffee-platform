//////////////////////////////////////////////////////
// 💰 PRICING PREVIEW API
//////////////////////////////////////////////////////

import { NextResponse } from "next/server"
import { calculatePricing } from "@/engine/pricing/calculatePricing"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { scaScore, altitude, variety, process } = body

    const pricing = calculatePricing({
      scaScore,
      altitude,
      variety,
      process,
    })

    return NextResponse.json(pricing)
  } catch (error) {
    return NextResponse.json(
      { error: "Pricing calculation failed" },
      { status: 500 }
    )
  }
}