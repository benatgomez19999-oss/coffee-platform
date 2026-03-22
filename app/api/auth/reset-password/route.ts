import { NextResponse } from "next/server";
import { prisma } from "@/database/prisma";
import { hashPassword } from "@/lib/auth";

// =====================================================
// RESET PASSWORD
// =====================================================

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Missing data" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // =====================================================
    // FIND TOKEN
    // =====================================================

    const record = await prisma.passwordResetToken.findUnique({
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
    // FIND USER
    // =====================================================

    const user = await prisma.user.findUnique({
      where: { email: record.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 400 }
      );
    }

    // =====================================================
    // HASH NEW PASSWORD
    // =====================================================

    const passwordHash = await hashPassword(password);

    // =====================================================
    // UPDATE PASSWORD + DELETE TOKEN
    // =====================================================

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),

      prisma.passwordResetToken.delete({
        where: { token },
      }),
    ]);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}