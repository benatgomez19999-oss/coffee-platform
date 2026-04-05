import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/src/database/prisma";
import { sendEmail } from "@/src/lib/email";

// =====================================================
// RESEND VERIFICATION EMAIL
// =====================================================

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // =====================================================
    // ❌ CHECK IF USER ALREADY VERIFIED
    // =====================================================

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already verified" },
        { status: 400 }
      );
    }

    // =====================================================
    // 🔍 GET EXISTING TOKEN DATA (ANTES DE BORRAR)
    // =====================================================

    const old = await prisma.verificationToken.findFirst({
      where: { email: normalizedEmail },
    });

    if (!old) {
      return NextResponse.json(
        { error: "No pending verification found" },
        { status: 400 }
      );
    }

    // =====================================================
    // 🧹 DELETE OLD TOKENS
    // =====================================================

    await prisma.verificationToken.deleteMany({
      where: { email: normalizedEmail },
    });

    // =====================================================
    // 🔐 CREATE NEW TOKEN
    // =====================================================

    const token = crypto.randomBytes(32).toString("hex");

    await prisma.verificationToken.create({
      data: {
        token,
        email: old.email,
        password: old.password,
        name: old.name,
        phone: old.phone,
        companyId: old.companyId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h
      },
    });

    // =====================================================
    // 🌐 VERIFY URL
    // =====================================================

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

    // =====================================================
    // ✉️ SEND EMAIL
    // =====================================================

    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your account",
      html: `
        <h2>Verify your account</h2>
        <p>Click below to activate your account:</p>
        <a href="${verifyUrl}">Verify Account</a>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("❌ RESEND ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}