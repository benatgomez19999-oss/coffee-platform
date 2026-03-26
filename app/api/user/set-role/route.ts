import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { cookies } from "next/headers"

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
    // 🔐 GET USER FROM SESSION (COOKIE)
    // =====================================================

    const cookieStore = cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

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