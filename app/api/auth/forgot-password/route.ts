import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import crypto from "crypto"
import { sendEmail } from "@/lib/email"
import { alturaEmailTemplate } from "@/lib/emailTemplates"

// =====================================================
// FORGOT PASSWORD
// =====================================================

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      )
    }

    // =====================================================
    // FIND USER
    // =====================================================

    const user = await prisma.user.findUnique({
      where: { email }
    })

    // 👉 IMPORTANTE: no revelar si existe o no
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // =====================================================
    // GENERATE TOKEN
    // =====================================================

    const token = crypto.randomBytes(32).toString("hex")

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1h

    await prisma.passwordResetToken.create({
      data: {
        token,
        email,
        expiresAt
      }
    })

    // =====================================================
    // CREATE URL
    // =====================================================

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    console.log("🔗 RESET LINK:", resetUrl)

// =====================================================
// ✉️ EMAIL (ALTURA COLLECTIVE TEMPLATE)
// =====================================================

try {
  await sendEmail({
    to: email,
    subject: "Reset your password",
    html: alturaEmailTemplate({
      title: "Reset your password",
      subtitle: "You requested a password reset for your Altura Collective account. This link expires in 1 hour.",
      buttonText: "Reset Password",
      url: resetUrl,
    }),
  })
} catch (err) {
  console.warn("⚠️ Reset email not sent")
}

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("❌ FORGOT PASSWORD ERROR:", error)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}