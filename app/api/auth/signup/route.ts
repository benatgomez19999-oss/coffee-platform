import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hashPassword, signToken } from "@/lib/auth"; // ✅ path limpio

// ✅ NECESARIO para Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// SIGNUP API — CREATE USER + COMPANY + SESSION
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
    } = body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // =====================================================
    // NORMALIZE EMAIL
    // =====================================================

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
    // CREATE COMPANY
    // =====================================================

    const company = await prisma.company.create({
      data: {
        name: companyName,
        country: "UNKNOWN", // 🔥 puedes hacerlo dinámico luego
      },
    });

    // =====================================================
    // CREATE USER
    // =====================================================

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        companyId: company.id,
      },
    });

    // =====================================================
    // CREATE JWT
    // =====================================================

    const token = signToken({ userId: user.id });

    // =====================================================
    // SET COOKIE (SESSION)
    // =====================================================

    const cookieStore = await cookies();

    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ SIGNUP ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}