import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/database/prisma";

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
    // GENERATE TOKEN
    // =====================================================

    const verificationToken = generateToken();

    // =====================================================
    // 🔥 TRANSACTION
    // =====================================================

    await prisma.$transaction(async (tx) => {

      // =====================================================
      // 🧹 CLEAN OLD TOKENS (UX + SECURITY)
      // =====================================================

await tx.verificationToken.deleteMany({
  where: { email: normalizedEmail }
})
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
          name: name || null,
          phone: phone || null,
          companyId: company.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h
        },
      });
    });

    

  // =====================================================
// 🌐 BASE URL (FIXED - PRODUCTION SAFE)
// =====================================================

const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

if (!baseUrl) {
  throw new Error("NEXT_PUBLIC_APP_URL not configured")
}

// =====================================================
// 🔗 VERIFY LINK
// =====================================================

const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;

    console.log("🔥 VERIFY LINK:", verifyUrl);

// =====================================================
// ✉️ EMAIL (PRO UX - CTA BUTTON)
// =====================================================

try {
  await sendEmail({
    to: normalizedEmail,
    subject: "Verify your account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        
        <h2 style="margin-bottom:16px;">
          Verify your account
        </h2>

        <p>
          Click the button below to activate your account:
        </p>

        <!-- CTA BUTTON -->
        <a href="${verifyUrl}" style="
          display:inline-block;
          margin-top:16px;
          padding:12px 20px;
          background:#000;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
          font-weight:500;
        ">
          Verify Account
        </a>

        <!-- FALLBACK LINK -->
        <p style="margin-top:20px; font-size:12px; color:#666;">
          If the button doesn’t work, copy and paste this link into your browser:
        </p>

        <p style="font-size:12px; word-break:break-all;">
          ${verifyUrl}
        </p>

        <!-- EXPIRATION -->
        <p style="margin-top:16px; font-size:12px; color:#999;">
          This link expires in 1 hour.
        </p>

      </div>
    `,
  });
} catch (err) {
  console.warn("⚠️ Email not sent (dev mode)");
}

    // =====================================================
    // RESPONSE
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