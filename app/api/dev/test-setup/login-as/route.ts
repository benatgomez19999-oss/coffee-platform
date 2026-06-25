export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

import { signToken } from "@/src/lib/auth"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

//////////////////////////////////////////////////////
// 🔐 POST /api/dev/test-setup/login-as
// DEV-TEST-SETUP-1
//
// Sole dev login route. Authorisation is entirely server-
// side: requireDevRoute() + DEV_AUTH_BYPASS_ENABLED.
// The caller does NOT send (and the server does NOT
// read) a shared secret — eliminating the bundle-leak
// vector that the removed /api/dev/login-as route had
// via NEXT_PUBLIC_DEV_AUTH_BYPASS_SECRET.
//
// Gating:
//   - requireDevRoute() (VERCEL_ENV != production +
//     INTERNAL_DEV_TOOLS_ENABLED)
//   - DEV_AUTH_BYPASS_ENABLED must equal "true"
//
// Body: { role: "producer" | "partner" | "client" | "eu-partner" }
// Response: { success: true, role, email }
// Side effect: Set-Cookie: auth_token=<JWT>; HttpOnly;
//              SameSite=Lax; Path=/; Max-Age=604800
//////////////////////////////////////////////////////

const ROLE_EMAIL_MAP = {
  producer: () => process.env.DEV_PRODUCER_EMAIL,
  partner: () => process.env.DEV_PARTNER_EMAIL,
  client: () => process.env.DEV_CLIENT_EMAIL,
  "eu-partner": () => process.env.DEV_EU_PARTNER_EMAIL,
} as const

type DevRole = keyof typeof ROLE_EMAIL_MAP

function isDevRole(value: unknown): value is DevRole {
  return (
    typeof value === "string" &&
    (value === "producer" ||
      value === "partner" ||
      value === "client" ||
      value === "eu-partner")
  )
}

export async function POST(req: NextRequest) {
  const guard = await requireDevRoute({ requireUser: false })
  if (!guard.ok) return guard.response

  // The bypass flag stays as a second switch — the page is
  // already dev-only via requireDevRoute, but the platform
  // can still disable the auto-login path separately.
  if (process.env.DEV_AUTH_BYPASS_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Dev auth bypass is disabled" },
      { status: 403 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as { role?: unknown }
  if (!isDevRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }
  const role = body.role

  const email = ROLE_EMAIL_MAP[role]()
  if (!email) {
    return NextResponse.json(
      { error: `Missing dev email for role: ${role}` },
      { status: 500 },
    )
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json(
      { error: `Dev user not found for role: ${role}` },
      { status: 404 },
    )
  }

  // Sign session token + set HttpOnly cookie — same JWT +
  // cookie shape the platform reads everywhere
  // (verifyToken / getUserFromRequest).
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
}
