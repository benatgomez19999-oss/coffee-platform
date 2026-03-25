// /app/api/stripe/webhook/route.ts

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/database/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

export async function POST(req: NextRequest) {
  try {
    // ============================================
    // 1. GET RAW BODY (REQUIRED BY STRIPE)
    // ============================================
    const body = await req.text()

    const signature = req.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    // ============================================
    // 2. VERIFY EVENT (SECURITY)
    // ============================================
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // ============================================
    // 3. HANDLE EVENTS (SUBSCRIPTIONS)
    // ============================================

    // ============================================
    // ✅ 1. CHECKOUT COMPLETED → ACTIVATE CONTRACT
    // ============================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const contractId = session.metadata?.contractId

      if (!contractId) {
        console.error("❌ Missing contractId in metadata")
        return NextResponse.json({ error: "Missing contractId" }, { status: 400 })
      }

      console.log("💸 Subscription started for contract:", contractId)

      // 🔍 Fetch existing contract
      const existing = await prisma.contract.findUnique({
        where: { id: contractId },
      })

      if (!existing) {
        console.error("❌ Contract not found:", contractId)
        return NextResponse.json({ error: "Contract not found" }, { status: 404 })
      }

      // 🔒 Idempotency check
      if (existing.status === "ACTIVE") {
        console.log("⚠️ Contract already active (skip):", contractId)
        return NextResponse.json({ received: true })
      }

      try {
        await prisma.contract.update({
          where: { id: contractId },
          data: {
            status: "ACTIVE",
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
          },
        })

        console.log("✅ Contract activated:", contractId)
      } catch (dbError) {
        console.error("❌ DB update failed:", dbError)
        return NextResponse.json({ error: "DB update failed" }, { status: 500 })
      }
    }
// ============================================
// 💸 2. MONTHLY PAYMENT SUCCESS
// ============================================
if (event.type === "invoice.paid") {
  const invoice = event.data.object as Stripe.Invoice

  const subscriptionId = (invoice as any).subscription as string

  if (!subscriptionId) {
    return NextResponse.json({ received: true })
  }

  const contract = await prisma.contract.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
    },
  })

  if (!contract) {
    console.error("❌ Contract not found for subscription:", subscriptionId)
    return NextResponse.json({ received: true })
  }

  console.log("💸 Monthly payment received:", contract.id)

  // 👉 opcional: guardar logs / analytics
}

// ============================================
// ❌ 3. PAYMENT FAILED
// ============================================
if (event.type === "invoice.payment_failed") {
  const invoice = event.data.object as Stripe.Invoice

  const subscriptionId = (invoice as any).subscription as string

  if (!subscriptionId) {
    return NextResponse.json({ received: true })
  }

  const contract = await prisma.contract.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
    },
  })

  if (!contract) {
    console.error("❌ Contract not found for subscription:", subscriptionId)
    return NextResponse.json({ received: true })
  }

  console.log("❌ Payment failed:", contract.id)

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: "PAST_DUE",
    },
  })
}

return NextResponse.json({ received: true })

} catch (err) {
  console.error("❌ Webhook error:", err)
  return NextResponse.json({ error: "Webhook error" }, { status: 500 })
}
}
