export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { signToken } from "@/src/lib/auth"
import { prisma } from "@/src/database/prisma"

const ROLE_EMAIL_MAP = {
  producer: process.env.DEV_PRODUCER_EMAIL,
  partner: process.env.DEV_PARTNER_EMAIL,
  client: process.env.DEV_CLIENT_EMAIL,
} as const

export async function POST(req: Request) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV GUARD
    //////////////////////////////////////////////////////

    const bypassEnabled = process.env.DEV_AUTH_BYPASS_ENABLED === "true"
    const secret = process.env.DEV_AUTH_BYPASS_SECRET

    if (!bypassEnabled) {
      return NextResponse.json(
        { error: "Dev auth bypass is disabled" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { role, secret: providedSecret } = body

    if (!role || !["producer", "partner", "client"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      )
    }

    if (!secret || providedSecret !== secret) {
      return NextResponse.json(
        { error: "Invalid dev secret" },
        { status: 403 }
      )
    }

    const email = ROLE_EMAIL_MAP[role as keyof typeof ROLE_EMAIL_MAP]

    if (!email) {
      return NextResponse.json(
        { error: "Missing dev email for role" },
        { status: 500 }
      )
    }

    //////////////////////////////////////////////////////
    // 👤 LOAD USER
    //////////////////////////////////////////////////////

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: `Dev user not found for role: ${role}` },
        { status: 404 }
      )
    }

    //////////////////////////////////////////////////////
    // 🍪 REAL SESSION COOKIE
    //////////////////////////////////////////////////////

    const token = signToken({ userId: user.id })

    const res = NextResponse.json({
      success: true,
      role,
      email: user.email,
    })

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

    return res
  } catch (error) {
    console.error("❌ DEV LOGIN-AS ERROR:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}