import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { signToken } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {

  try {

    const { email, password } = await req.json()

    // ======================================================
    // VALIDACIÓN BÁSICA
    // ======================================================

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      )
    }

    // ======================================================
    // USER LOOKUP
    // ======================================================

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // ======================================================
    // PASSWORD CHECK (bcrypt)
    // ======================================================

    const isValid = await bcrypt.compare(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // ======================================================
    // TOKEN
    // ======================================================

    const token = signToken({ userId: user.id })

    // ======================================================
    // RESPONSE + COOKIE (SECURE)
    // ======================================================

    const res = NextResponse.json({ success: true })

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 🔥 clave
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 7 días
    })

    return res

  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )

  }
}