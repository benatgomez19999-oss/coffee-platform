import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";

// ✅ NECESARIO para Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// 🔐 UTILS
// =====================================================

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// =====================================================
// SIGNUP API — CREATE USER + COMPANY + EMAIL VERIFICATION
// =====================================================

export async function POST(req: Request) {
  try {
    // =====================================================
    // ⚠️ IMPORT DINÁMICO DE PRISMA (CLAVE)
    // =====================================================
    const { prisma } = await import("@/database/prisma");

    const body = await req.json();

    const {
      name,
      email,
      password,
      companyName,
      phone, // 🔥 NUEVO
    } = body;

    // =====================================================
    // VALIDATION (MEJORADA)
    // =====================================================

    if (!email || !password || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // =====================================================
    // CHECK USER EXISTS
    // =====================================================

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // =====================================================
    // HASH PASSWORD
    // =====================================================

    const passwordHash = await hashPassword(password);

    // =====================================================
    // GENERATE VERIFICATION TOKEN
    // =====================================================

    const verificationToken = generateToken();

    // =====================================================
    // 🔥 TRANSACTION (CRÍTICO)
    // =====================================================

    const result = await prisma.$transaction(async (tx) => {
      // =============================
      // CREATE COMPANY
      // =============================

      const company = await tx.company.create({
        data: {
          name: companyName,
          country: "UNKNOWN",
        },
      });

      // =============================
      // CREATE USER
      // =============================

      const user = await tx.user.create({
  data: {
    name, // ✅ FALTABA
    email: normalizedEmail,
    passwordHash,
    phone,
    companyId: company.id,
    isVerified: false,
  },
});

      // =============================
      // CREATE VERIFICATION TOKEN
      // =============================

      await tx.verificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h
        },
      });

      return { user };
    });

    // =====================================================
    // ✉️ SEND VERIFICATION EMAIL
    // =====================================================

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${verificationToken}`;

    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your account",
      html: `
        <h2>Verify your account</h2>
        <p>Click the link below:</p>
        <a href="${verifyUrl}">${verifyUrl}</a>
      `,
    });

    // =====================================================
    // ❗ NO SESSION HERE (CAMBIO CLAVE)
    // =====================================================

    return NextResponse.json({
      success: true,
      message: "Check your email to verify your account",
    });

  } catch (error: any) {
    console.error("❌ SIGNUP ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}