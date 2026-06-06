export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { buildAllocationSnapshots } from "@/src/services/allocation/snapshot/lotAllocationSnapshot.service"
import { decideLotAllocation } from "@/src/services/allocation/engine/lotAllocationEngine"
import { DEFAULT_ALLOCATION_POLICY } from "@/src/services/allocation/policy/allocationPolicy"

//////////////////////////////////////////////////////
// 🔬 GET /api/internal/allocation/lot/[id]
//
// Per-lot allocation introspection. Read-only.
//
// Auth: requireDevRoute({ requireUser: true }).
//
// 404 when no snapshot is produced for the given id —
// includes lots in any of DRAFT / PUBLISHED / RESERVED
// / SOLD, so a 404 here means "id does not match any
// known GreenLot".
//
// Response:
//   {
//     snapshot,
//     decision,
//     policyVersion,
//     snapshotsTakenAt
//   }
//////////////////////////////////////////////////////

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  const { id } = params

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing lot id" }, { status: 400 })
  }

  try {
    const snapshotsTakenAt = new Date().toISOString()
    const snapshots = await buildAllocationSnapshots({ greenLotId: id })

    const snapshot = snapshots[0]
    if (!snapshot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 })
    }

    const decision = decideLotAllocation(snapshot)

    return NextResponse.json({
      snapshot,
      decision,
      policyVersion: DEFAULT_ALLOCATION_POLICY.policyVersion,
      snapshotsTakenAt,
    })
  } catch (error) {
    console.error("[ALLOCATION_LOT] error:", error)
    return NextResponse.json(
      { error: "Internal allocation lookup failed" },
      { status: 500 }
    )
  }
}
