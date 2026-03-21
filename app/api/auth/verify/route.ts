import { NextResponse } from "next/server";

// =====================================================
// VERIFY EMAIL TOKEN
// =====================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  console.log("✅ VERIFY ENDPOINT HIT");

  try {
    const { prisma } = await import("@/database/prisma");

    // =====================================================
    // GET TOKEN
    // =====================================================

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // =====================================================
    // FIND TOKEN
    // =====================================================

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // =====================================================
    // CHECK EXPIRATION
    // =====================================================

    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // =====================================================
    // 🔥 CREATE USER (NUEVO FLOW)
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

    // =====================================================
    // DELETE TOKEN
    // =====================================================

    await prisma.verificationToken.delete({
      where: { token },
    });

    // =====================================================
    // REDIRECT
    // =====================================================

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?verified=true`
    );

  } catch (error) {
    console.error("❌ VERIFY ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}