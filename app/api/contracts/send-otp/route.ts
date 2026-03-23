import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"

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

        phone,

        expiresAt,
        verified: false,
        signed: false
      }
    })

    console.log("OTP GENERATED:", otp)

    return NextResponse.json({
      success: true
    })

  } catch (err) {

    console.error("SEND OTP ERROR:", err)

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}