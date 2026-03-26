import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

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
    // 🔐 GET TOKEN (REAL AUTH)
    // =====================================================

    const token = cookies().get("auth_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized (no token)" },
        { status: 401 }
      )
    }

    // =====================================================
    // 🔓 DECODE TOKEN
    // =====================================================

    let decoded: any

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!)
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    // 👇 IMPORTANTE: ajusta según tu token
    const userId = decoded.userId || decoded.id || null
    const email = decoded.email || null

    if (!userId && !email) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401 }
      )
    }

    // =====================================================
    // 🧠 UPDATE USER
    // =====================================================

    await prisma.user.update({
      where: userId ? { id: userId } : { email: email! },
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