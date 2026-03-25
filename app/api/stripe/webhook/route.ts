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
    // 3. HANDLE EVENT
    // ============================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const contractId = session.metadata?.contractId

      if (!contractId) {
        console.error("❌ Missing contractId in metadata")
        return NextResponse.json({ error: "Missing contractId" }, { status: 400 })
      }

      console.log("💸 Payment success for contract:", contractId)

// ============================================
// 4. UPDATE CONTRACT STATUS (IDEMPOTENT)
// ============================================

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
  // 🔥 Update contract → ACTIVE
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "ACTIVE",
    },
  })

  console.log("✅ Contract activated:", contractId)
} catch (dbError) {
  console.error("❌ DB update failed:", dbError)
  return NextResponse.json({ error: "DB update failed" }, { status: 500 })
}
} // ← cierra el if (event.type === ...)

return NextResponse.json({ received: true })

} catch (err) {
  console.error("❌ Webhook error:", err)
  return NextResponse.json({ error: "Webhook error" }, { status: 500 })
}
}