// ======================================================
// CONFIG (CRÍTICO PARA VERCEL)
// ======================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ======================================================
// HANDLER
// ======================================================

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { prisma } from "@/database/prisma";

export async function POST(req: Request) {
  try {

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ======================================================
    // 🔥 PARTNER BYPASS (SOLO ESTE USER)
    // ======================================================

    const isPartner =
      email === "alturacollectivepartners@gmail.com";

    let isValid = false;

    if (isPartner) {
      // 👉 bypass password si quieres (opcional)
      isValid = true;

      // 👉 o si quieres mantener password real:
      // isValid = await bcrypt.compare(password, user.passwordHash);

    } else {
      isValid = await bcrypt.compare(password, user.passwordHash);
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ======================================================
    // 🔥 TOKEN
    // ======================================================

    const token = signToken({ userId: user.id });

    const res = NextResponse.json({ success: true });

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}