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
// SEND OTP (STEP 1)
// =====================================================

export async function POST(req: Request) {
  try {

    const body = await req.json()
    const { contractId } = body

    if (!contractId) {
      return NextResponse.json(
        { error: "Missing contractId" },
        { status: 400 }
      )
    }

    // 🔐 generar código
    const otp = generateOTP()

    // ⏳ expiración (10 min)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // 💾 guardar en DB (reutilizamos tu tabla)
    await prisma.signatureToken.create({
      data: {
        token: otp,
        contractId,
        phone: "", // 🔥 luego lo metemos bien
        expiresAt,
        verified: false,
        signed: false
      }
    })

    // 🧪 debug temporal
    console.log("OTP GENERATED:", otp)

    return NextResponse.json({
      success: true
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}