import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

// ✅ NECESARIO para evitar problemas en build (Vercel)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// GET CURRENT USER (SESSION)
// =====================================================

export async function GET() {
  try {
    // =====================================================
    // ⚠️ IMPORT DINÁMICO DE PRISMA (CLAVE)
    // =====================================================
    const { prisma } = await import("@/database/prisma");

    // =====================================================
    // GET TOKEN FROM COOKIE
    // =====================================================
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // =====================================================
    // VERIFY TOKEN
    // =====================================================
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // =====================================================
    // GET USER FROM DB
    // =====================================================
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        company: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // =====================================================
    // RETURN SAFE USER (⚠️ nunca devuelvas datos sensibles)
    // =====================================================
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company,
      },
    });

  } catch (error) {
    console.error("❌ AUTH ME ERROR:", error);

    return NextResponse.json({ user: null }, { status: 500 });
  }
}