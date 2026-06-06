export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

//////////////////////////////////////////////////////
// 🧪 GET /api/dev/test-setup/status
// DEV-TEST-SETUP-1
//
// Status snapshot for the test-setup page indicator.
// Designed to be read literally by an automated UI
// agent — no decorations, just facts.
//
// Auth: requireDevRoute({ requireUser: false }) so a
// logged-out browser still gets a useful "no user"
// status. The user field is populated when an
// auth_token cookie resolves to a real user.
//
// Response:
//   {
//     user: { email: string, role: string | null } | null,
//     activeIntentCount: number
//   }
//
// activeIntentCount is the count of DemandIntent rows
// with status in (OPEN, COUNTERED, WAITING) AND
// expiresAt > now — same predicate as
// getIntentsByCompany but unscoped to a company so the
// preflight indicator reads "0" when the database is
// clean regardless of which role the operator switched
// to most recently.
//////////////////////////////////////////////////////

export async function GET(req: NextRequest) {
  const guard = await requireDevRoute({ requireUser: false })
  if (!guard.ok) return guard.response

  const user = await getUserFromRequest(req)

  const activeIntentCount = await prisma.demandIntent.count({
    where: {
      status: { in: ["OPEN", "COUNTERED", "WAITING"] },
      expiresAt: { gt: new Date() },
    },
  })

  return NextResponse.json({
    user: user
      ? {
          email: user.email,
          role: user.role ?? null,
        }
      : null,
    activeIntentCount,
  })
}
