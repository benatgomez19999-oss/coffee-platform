import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import twilioClient from "@/lib/twilio"
import { sendEmail } from "@/lib/email"

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
// SEND OTP (SMS + EMAIL SUPPORT)
// =====================================================

export async function POST(req: Request) {
  try {

    const body = await req.json()

    const {
      mode,
      contractDraft,
      contractId,
      channel
    } = body

    const sendChannel = channel || "sms"

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!contractId && !contractDraft) {
      return NextResponse.json(
        { error: "Missing contractId or contractDraft" },
        { status: 400 }
      )
    }

    // =====================================================
    // GET PHONE
    // =====================================================

    let phone: string | null = null

    if (contractDraft?.client?.phone) {
      phone = contractDraft.client.phone
    }

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
        contractId: contractId || null,
        contractDraft: contractDraft || null,
        mode: mode || "create",
        phone: phone || "no-phone",
        expiresAt,
        verified: false,
        signed: false
      }
    })

    console.log("🔐 OTP GENERATED:", otp)

    // =====================================================
    // SEND OTP (CHANNEL BASED)
    // =====================================================

    try {

      // -----------------------------------------------------
      // 📱 SMS (TWILIO)
      // -----------------------------------------------------

      if (sendChannel === "sms") {

        if (!phone) {
          console.warn("⚠️ No phone available for SMS")
        } else {

          const phoneFormatted = formatPhone(phone)

          await twilioClient.messages.create({
            body: `Coffee Platform ☕️\nTu código de firma es: ${otp}\nNo lo compartas con nadie.`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: phoneFormatted,
          })

          console.log("📱 OTP SMS SENT to:", phoneFormatted)
        }
      }

      // -----------------------------------------------------
      // 📧 EMAIL (RESEND + RECOVERY FLOW)
      // -----------------------------------------------------

      if (sendChannel === "email") {

        let email: string | null = null

        // 🟡 PRIORIDAD 1 → draft inicial
        if (contractDraft?.client?.email) {
          email = contractDraft.client.email
        }

        // 🟢 PRIORIDAD 2 → recuperar de token anterior
        if (!email && contractId) {
          const lastToken = await prisma.signatureToken.findFirst({
            where: { contractId },
            orderBy: { createdAt: "desc" }
          })

          if (lastToken?.contractDraft) {
            const draft: any = lastToken.contractDraft
            email = draft?.client?.email || null
          }
        }

        if (!email) {
          console.warn("⚠️ No email available for OTP")
        } else {

          await sendEmail({
            to: email,
            subject: "Your verification code",
            html: `
              <div style="font-family: sans-serif">
                <h2>Verify your contract</h2>
                <p>Your verification code is:</p>
                <p style="font-size:28px; font-weight:bold; letter-spacing:4px;">
                  ${otp}
                </p>
                <p>This code expires in 10 minutes.</p>
              </div>
            `
          })

          console.log("📧 OTP EMAIL SENT to:", email)
        }
      }

    } catch (err) {
      console.error("❌ OTP SEND ERROR:", err)
    }

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