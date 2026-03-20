// =====================================================
// SIGNATURE REQUEST (PRISMA + TWILIO SMS)
// =====================================================

import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import twilio from "twilio"
import { requireAuth } from "@/lib/requireAuth"

// =====================================================
// TWILIO CLIENT
// =====================================================

const client = twilio(

  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

// =====================================================
// ENV DEBUG (TEMP)
// =====================================================

console.log("🧪 TWILIO SID:", process.env.TWILIO_ACCOUNT_SID ? "OK" : "MISSING")
console.log("🧪 TWILIO TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "OK" : "MISSING")
console.log("🧪 TWILIO FROM:", process.env.TWILIO_PHONE_NUMBER)

// =====================================================
// POST
// =====================================================

export async function POST(req: Request) {
console.log("🟢 SIGNATURE ENDPOINT HIT")
  try {

    const body = await req.json()
    console.log("📦 BODY RECEIVED:", body)

    const {
      contractId,
      phone
    } = body

// =====================================================
// AUTH (RECOMMENDED)
// =====================================================

const user = await requireAuth()

if (!user.companyId) {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 403 }
  )
}



// =====================================================
// VALIDATION
// =====================================================

if (!contractId || !phone) {
  return NextResponse.json(
    { error: "Missing fields" },
    { status: 400 }
  )
}

// =====================================================
// PHONE FORMAT VALIDATION (E.164 REQUIRED)
// =====================================================

if (!phone.startsWith("+")) {
  return NextResponse.json(
    { error: "Phone must be in format +346XXXXXXXX" },
    { status: 400 }
  )
}

console.log("📲 SIGNATURE REQUEST:", { contractId, phone })

    // =====================================================
    // GENERATE TOKEN
    // =====================================================

    const token = crypto.randomUUID()

    const expiresAt =
      new Date(Date.now() + 10 * 60 * 1000) // 10 min

    // =====================================================
    // SAVE TOKEN (DB)
    // =====================================================
    console.log("🟡 CREATING TOKEN...")
    await prisma.signatureToken.create({
      data: {
        token,
        contractId,
        phone,
        expiresAt
      }
    })

    console.log("🟡 TOKEN CREATED:", token)

    // =====================================================
    // UPDATE CONTRACT STATUS
    // =====================================================

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "AWAITING_SIGNATURE"
      }
    })

    // =====================================================
    // BUILD SIGN LINK
    // =====================================================

    const host =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"

    const signingLink =
      `${host}/sign/${token}`

    console.log("🔗 SIGN LINK:", signingLink)

    // =====================================================
// SEND SMS (TWILIO)
// =====================================================

try {

  console.log("📤 SENDING SMS TO:", phone)
  console.log("📤 ABOUT TO CALL TWILIO")
  const msg = await client.messages.create({
    body: `Sign your contract: ${signingLink}`,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: phone
  })

  console.log("✅ TWILIO SUCCESS SID:", msg.sid)

} catch (twilioError: any) {

  console.error("❌ TWILIO ERROR FULL:", twilioError)
  console.error("❌ TWILIO ERROR MESSAGE:", twilioError.message)
  console.error("❌ TWILIO ERROR CODE:", twilioError.code)

  return NextResponse.json(
    {
      error: "Twilio failed",
      message: twilioError.message
    },
    { status: 500 }
  )
}
    


    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      token,
      signingLink
    })

  } catch (err: any) {

  console.error("❌ SIGNATURE ERROR FULL:", err)
  console.error("❌ MESSAGE:", err?.message)
  console.error("❌ STACK:", err?.stack)

  return NextResponse.json(
    {
      error: "Internal error",
      message: err?.message || "Unknown error"
    },
    { status: 500 }
  )
}
}