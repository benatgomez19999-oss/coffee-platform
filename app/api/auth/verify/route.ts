import { NextResponse } from "next/server";
import { prisma } from "@/database/prisma";

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
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
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
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    // =====================================================
    // CHECK EXPIRATION
    // =====================================================

    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 400 }
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

      const origin = req.headers.get("origin")

return NextResponse.redirect(
  `${origin}/login?verified=true`
)
    }

    // =====================================================
    // 🔥 CREATE USER
    // =====================================================

    await prisma.user.create({
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
    // DELETE TOKEN
    // =====================================================

    await prisma.verificationToken.delete({
      where: { token },
    });

    console.log("🗑️ TOKEN DELETED");

    // =====================================================
    // REDIRECT
    // =====================================================

    const origin = req.headers.get("origin")

return NextResponse.redirect(
  `${origin}/login?verified=true`
)

  } catch (error) {
    console.error("❌ VERIFY ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}