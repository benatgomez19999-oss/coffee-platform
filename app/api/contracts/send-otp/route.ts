import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import twilioClient from "@/lib/twilio"

// ✅ necesario para Vercel
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// =====================================================
// GENERATE OTP
// =====================================================

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// =====================================================
// FORMAT PHONE (E.164)
// =====================================================

function formatPhone(phone: string) {
  let cleaned = phone.replace(/\s+/g, "")

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2)
  }

  if (!cleaned.startsWith("+")) {
    cleaned = "+34" + cleaned
  }

  return cleaned
}

// =====================================================
// SEND OTP (FIXED: SUPPORT CREATE + AMEND)
// =====================================================

export async function POST(req: Request) {
  try {

    const body = await req.json()

    const {
      mode,
      contractDraft,
      contractId
    } = body


    // =====================================================
    // VALIDATION (FIXED)
    // =====================================================

    // 👉 caso CREATE (nuevo flow)
    // → necesitamos contractId
    // → draft ya NO es obligatorio

    if (!contractId && !contractDraft) {
      return NextResponse.json(
        { error: "Missing contractId or contractDraft" },
        { status: 400 }
      )
    }


    // =====================================================
    // GET PHONE (FLEXIBLE)
    // =====================================================

    let phone: string | null = null

    // 🟡 PRIORIDAD 1 → contractDraft (amend o legacy)
    if (contractDraft?.client?.phone) {
      phone = contractDraft.client.phone
    }

    // 🟢 PRIORIDAD 2 → buscar en DB (nuevo flow)
    if (!phone && contractId) {

      const contract = await prisma.contract.findUnique({
  where: { id: contractId },
  include: {
    company: {
      select: {
        phone: true
      }
    }
  }
})

phone = contract?.company?.phone || null
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Missing phone number" },
        { status: 400 }
      )
    }

    const phoneFormatted = formatPhone(phone)


    // =====================================================
    // GENERATE OTP
    // =====================================================

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)


    // =====================================================
    // SAVE TOKEN
    // =====================================================

    await prisma.signatureToken.create({
      data: {
        token: otp,

        // 👉 ahora SIEMPRE ligado a contractId si existe
        contractId: contractId || null,

        // 👉 solo guardamos draft si viene (amend / fallback)
        contractDraft: contractDraft || null,

        mode: mode || "create",

        phone: phoneFormatted,

        expiresAt,
        verified: false,
        signed: false
      }
    })


    // =====================================================
    // SEND SMS OTP
    // =====================================================

    try {

      await twilioClient.messages.create({
        body: `Coffee Platform ☕️\nTu código de firma es: ${otp}\nNo lo compartas con nadie.`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phoneFormatted,
      })

      console.log("📱 OTP SMS SENT to:", phoneFormatted)

    } catch (err) {

      console.error("❌ TWILIO ERROR:", err)

      // ⚠️ no rompemos flujo por fallo de SMS
    }

    console.log("🔐 OTP GENERATED:", otp)


    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true
    })

  } catch (err) {

    console.error("❌ SEND OTP ERROR:", err)

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}