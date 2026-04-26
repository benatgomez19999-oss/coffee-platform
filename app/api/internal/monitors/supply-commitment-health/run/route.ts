// =====================================================
// INTERNAL ROUTE — Supply & Commitment Health Monitor
//
// On-demand invocation of the monitor.
// POST only (it persists an audit row).
//
// AUTH GATE — v1 OPEN QUESTION:
//
// The monitor is intended for internal operators only.
// The platform currently has no INTERNAL / OPERATOR /
// ADMIN role; the only roles in use are PARTNER and
// PRODUCER. Per the implementation plan, inventing a
// new auth pattern here was a non-goal.
//
// As a temporary v1 measure this route uses the same
// gate as the existing app/api/dev/reset-contracts
// route: NODE_ENV === "development". This makes the
// route inert in production until a real internal role
// (or signed admin token, or middleware-level guard)
// is decided. See the open-questions section of the
// delivery report.
//
// Side effects:
//   - Reads from the business DB (read-only).
//   - Writes ONE row to CommitmentHealthSnapshot.
//   - Never writes to any business table.
// =====================================================

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { runSupplyCommitmentHealthMonitor } from "@/src/internal/monitors/supplyCommitmentHealth"
import { persistReport } from "@/src/internal/monitors/supplyCommitmentHealth/persistence"

export async function POST(req: NextRequest) {

  // -------------------------------------------------
  // 🔒 V1 TEMPORARY GATE
  //
  // Until a real internal role exists, this route only
  // works in development. This is the same pattern used
  // by app/api/dev/reset-contracts/route.ts.
  //
  // TODO(internal-role): replace with a proper internal
  // role check or middleware-level admin guard once the
  // platform has one.
  // -------------------------------------------------

  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not allowed" },
      { status: 403 }
    )
  }

  // We still attempt to capture the operator identity
  // for the audit row, but we do not require auth — the
  // dev gate above is the v1 enforcement boundary.
  let triggeredBy: string | null = null
  try {
    const user = await getUserFromRequest(req)
    triggeredBy = user?.id ?? null
  } catch {
    triggeredBy = null
  }

  // -------------------------------------------------
  // RUN THE MONITOR
  // -------------------------------------------------

  let report
  try {
    report = await runSupplyCommitmentHealthMonitor()
  } catch (err) {
    console.error("[supplyCommitmentHealth] monitor failed:", err)
    return NextResponse.json(
      { error: "Monitor execution failed" },
      { status: 500 }
    )
  }

  // -------------------------------------------------
  // PERSIST — failures do not block the response
  // -------------------------------------------------

  let persistenceFailed = false
  try {
    await persistReport(report, triggeredBy)
  } catch (err) {
    console.error("[supplyCommitmentHealth] persistence failed:", err)
    persistenceFailed = true
  }

  return NextResponse.json({
    report,
    persistenceFailed,
  })
}
