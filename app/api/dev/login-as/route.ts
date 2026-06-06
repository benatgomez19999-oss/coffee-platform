export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { signToken } from "@/src/lib/auth"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

const ROLE_EMAIL_MAP = {
  producer: process.env.DEV_PRODUCER_EMAIL,
  partner: process.env.DEV_PARTNER_EMAIL,
  client: process.env.DEV_CLIENT_EMAIL,
  "eu-partner": process.env.DEV_EU_PARTNER_EMAIL,
} as const

export async function POST(req: Request) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV-ONLY GUARD — login-as opts out of the user
    // requirement because it IS the route that creates
    // the session. The route then runs its own secret check.
    //////////////////////////////////////////////////////

    const guard = await requireDevRoute({ requireUser: false })
    if (!guard.ok) return guard.response

    //////////////////////////////////////////////////////
    // 🔐 DEV GUARD (secret-based, route-specific)
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

    if (!role || !["producer", "partner", "client", "eu-partner"].includes(role)) {
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
    // 🌱 ENSURE PRODUCER PROFILE (DEV ONLY)
    //
    // Real users go through /api/onboarding/producer which
    // creates Producer + Farm and flips onboardingCompleted.
    // Dev users skip onboarding (login-as drops the cookie
    // directly), which would leave the wizard at
    // /platform/producer/lots/new with no farms in the
    // assistant context.
    //
    // This block mirrors the onboarding side-effects with
    // sensible defaults, only when entering as "producer"
    // and only if the User row actually has role=PRODUCER.
    // Idempotent: re-running is a no-op once provisioned.
    //
    // Wrapped in try/catch so a seed failure doesn't block
    // the dev login itself — the user can still fix via
    // Prisma Studio.
    //////////////////////////////////////////////////////

    if (role === "producer" && user.role === "PRODUCER") {
      try {
        await ensureDevProducerProfile(user.id, user.name, user.onboardingCompleted)
      } catch (seedErr) {
        console.warn(
          "[DEV_LOGIN_AS] producer profile seed failed (continuing with login):",
          seedErr
        )
      }
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

//////////////////////////////////////////////////////
// HELPER — Ensure dev producer has Producer + Farm
//////////////////////////////////////////////////////

async function ensureDevProducerProfile(
  userId: string,
  userName: string | null,
  onboardingCompleted: boolean
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Producer
    let producer = await tx.producer.findUnique({
      where: { userId },
      include: { farms: { select: { id: true }, take: 1 } },
    })

    if (!producer) {
      producer = await tx.producer.create({
        data: {
          userId,
          name: userName || "Dev Producer",
          country: "COLOMBIA",
        },
        include: { farms: { select: { id: true }, take: 1 } },
      })
    }

    // Farm — at least one
    if (producer.farms.length === 0) {
      await tx.farm.create({
        data: {
          name: "El Paraíso (Dev Farm)",
          altitude: 1700,
          region: "Huila",
          producerId: producer.id,
        },
      })
    }

    // Onboarding flag — so /platform/producer doesn't bounce to /onboarding/role
    if (!onboardingCompleted) {
      await tx.user.update({
        where: { id: userId },
        data: { onboardingCompleted: true },
      })
    }
  })
}