import { NextResponse } from "next/server";
import { prisma } from "@/database/prisma";
import { signToken } from "@/lib/auth";

// =====================================================
// CONFIG
// =====================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// =====================================================
// DEBUG FLAG (activar/desactivar rápido)
// =====================================================

const DEBUG_MODE = false;

// =====================================================
// VERIFY EMAIL TOKEN
// =====================================================

console.log("🔥 VERIFY FILE LOADED");

export async function GET(req: Request) {
  console.log("✅ VERIFY ENDPOINT HIT");

  try {
    // =====================================================
    // 🌐 BASE URL (FIXED)
    // =====================================================

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL not configured");
    }

    // =====================================================
    // 🧪 DEBUG EARLY RETURN
    // =====================================================

    if (DEBUG_MODE) {
      console.log("🧪 DEBUG MODE ACTIVE");
      return NextResponse.json({ ok: true, route: "verify alive" });
    }

    // =====================================================
    // GET TOKEN
    // =====================================================

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        `${baseUrl}/verify-page?status=invalid`
      );
    }

    console.log("🔑 TOKEN:", token);

    // =====================================================
    // FIND TOKEN
    // =====================================================

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.redirect(
        `${baseUrl}/verify-page?status=invalid`
      );
    }

    // =====================================================
    // CHECK EXPIRATION
    // =====================================================

    if (record.expiresAt < new Date()) {
      return NextResponse.redirect(
        `${baseUrl}/verify-page?status=expired`
      );
    }

    // =====================================================
    // 🛡️ CHECK IF USER ALREADY EXISTS (IDEMPOTENCIA)
    // =====================================================

    const existingUser = await prisma.user.findUnique({
      where: { email: record.email },
    });

    if (existingUser) {
      console.log("⚠️ USER ALREADY EXISTS");

      return NextResponse.redirect(
        `${baseUrl}/verify-page?status=success`
      );
    }

// =====================================================
// 🔥 CREATE USER
// =====================================================

const user = await prisma.user.create({
  data: {
    email: record.email,
    passwordHash: record.password,
    name: record.name,
    phone: record.phone,
    companyId: record.companyId,
  },
});

console.log("✅ USER CREATED");

// =====================================================
// 🔐 AUTO LOGIN (🔥 CLAVE)
// =====================================================


const authToken = signToken({ userId: user.id });

const response = NextResponse.redirect(
  `${baseUrl}/onboarding/role`
);

response.cookies.set("auth_token", authToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});

// =====================================================
// DELETE TOKEN
// =====================================================

await prisma.verificationToken.delete({
  where: { token },
});

console.log("🗑️ TOKEN DELETED");

return response;

  } catch (error) {
    console.error("❌ VERIFY ERROR:", error);

    // =====================================================
    // ❌ FALLBACK ERROR (NO JSON → UX SAFE)
    // =====================================================

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

    return NextResponse.redirect(
      `${baseUrl}/verify-page?status=error`
    );
  }
}