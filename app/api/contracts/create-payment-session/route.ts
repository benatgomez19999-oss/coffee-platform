// /app/api/contracts/create-payment-session/route.ts

import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/database/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

export async function POST(req: NextRequest) {
  try {
    const { contractId } = await req.json()

    if (!contractId) {
      return NextResponse.json({ error: "Missing contractId" }, { status: 400 })
    }

    // 1. Fetch contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    })

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    // 2. Validate state
    if (!["SIGNED", "PAYMENT_PENDING"].includes(contract.status)) {
      return NextResponse.json(
        { error: "Contract not eligible for payment" },
        { status: 400 }
      )
    }

    // ==========================
    // 🚫 PREVENT DOUBLE PAYMENT
    // ==========================

if (contract.status === "ACTIVE") {
  return NextResponse.json(
    { error: "Contract already active" },
    { status: 400 }
  )
}

    // 3. Calculate price (ADAPT THIS)
    const amount = Math.round(
  (contract.monthlyVolumeKg / contract.bagSizeKg) *
  contract.pricePerBag *
  100
)
    // 4. Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      

      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Coffee Supply Contract (${contract.id})`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],

      metadata: {
  contractId: contract.id,
  companyId: contract.companyId,
   }, 

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform?payment=cancel`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
  console.error("❌ STRIPE ERROR:", err)

  return NextResponse.json(
    { error: err.message || "Internal error" },
    { status: 500 }
  )
}
}