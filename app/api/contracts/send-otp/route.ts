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
// SEND OTP (STORE DRAFT)
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
    // VALIDATION
    // =====================================================

    if (!contractDraft) {
      return NextResponse.json(
        { error: "Missing contractDraft" },
        { status: 400 }
      )
    }

    const phone = contractDraft?.client?.phone

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
    // SAVE TOKEN + DRAFT
    // =====================================================

    await prisma.signatureToken.create({
      data: {
        token: otp,

        // 🔥 NUEVO MODELO
        contractId: contractId || null,
        contractDraft: contractDraft,
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

      // ⚠️ NO rompemos flujo por fallo de SMS
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