import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { role } = body

    if (!role) {
      return NextResponse.json(
        { error: "Role required" },
        { status: 400 }
      )
    }

    // =====================================================
    // 🔐 GET TOKEN
    // =====================================================

    const token = cookies().get("auth_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized (no token)" },
        { status: 401 }
      )
    }

    // =====================================================
    // 🔓 VERIFY TOKEN (TU SISTEMA)
    // =====================================================

    const payload = verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    const userId = payload.userId

    // =====================================================
    // 🧠 UPDATE USER
    // =====================================================

    await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        onboardingCompleted: true,
      },
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error("SET ROLE ERROR:", err)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}