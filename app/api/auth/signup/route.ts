import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// 🔐 UTILS
// =====================================================

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// =====================================================
// SIGNUP API — PRO FLOW (NO USER CREATION)
// =====================================================

export async function POST(req: Request) {
  try {
    const { prisma } = await import("@/database/prisma");

    const body = await req.json();

    const {
      name,
      email,
      password,
      companyName,
      phone,
    } = body;

    // =====================================================
    // VALIDATION
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
    // CHECK USER EXISTS (REAL USER)
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
    // GENERATE TOKEN
    // =====================================================

    const verificationToken = generateToken();

    // =====================================================
    // 🔥 TRANSACTION (SIN USER)
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
      // CREATE VERIFICATION TOKEN
      // =============================

      await tx.verificationToken.create({
  data: {
    token: verificationToken,
    email: normalizedEmail,
    password: passwordHash,
    name,
    phone,              // 🔥 NUEVO
    companyId: company.id, // 🔥 NUEVO
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  },
});

      return { company };
    });

    // =====================================================
    // ✉️ VERIFY LINK (FIXED)
    // =====================================================

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify?token=${verificationToken}`;

    console.log("🔥 VERIFY LINK:", verifyUrl);

    // (opcional, ahora mismo no te hace falta)
    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your account",
      html: `
        <h2>Verify your account</h2>
        <p>Click the link below:</p>
        <a href="${verifyUrl}">${verifyUrl}</a>
      `,
    });

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