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

    // ============================================
    // 1. GET CONTRACT
    // ============================================
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    })

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    // 🔥 IMPORTANTE → ajusta esto a tu modelo
    const monthlyPrice = contract.monthlyPrice // 👈 asegúrate de tenerlo

    if (!monthlyPrice) {
      return NextResponse.json({ error: "Missing price" }, { status: 400 })
    }

    // ============================================
    // 2. CREATE CHECKOUT SESSION (SUBSCRIPTION)
    // ============================================
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Coffee Contract ${contractId}`,
            },
            unit_amount: Math.round(monthlyPrice * 100), // € → cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],

      payment_method_types: ["card", "sepa_debit"],

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform?payment=cancel`,

      metadata: {
        contractId,
      },

      subscription_data: {
        metadata: {
          contractId,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("❌ CREATE SUBSCRIPTION ERROR:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}