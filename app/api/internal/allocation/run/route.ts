export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { buildAllocationSnapshots } from "@/src/services/allocation/snapshot/lotAllocationSnapshot.service"
import { decideLotAllocation } from "@/src/services/allocation/engine/lotAllocationEngine"
import { DEFAULT_ALLOCATION_POLICY } from "@/src/services/allocation/policy/allocationPolicy"
import type {
  AllocationSurface,
  LotAllocationDecision,
} from "@/src/services/allocation/domain/types"

//////////////////////////////////////////////////////
// 🔬 GET /api/internal/allocation/run
//
// Internal-only dry run of the inventory allocation
// engine. Read-only — no writes, no events.
//
// Auth: requireDevRoute({ requireUser: true }). Hard-killed
// on Vercel Production by the guard.
//
// Response shape:
//   {
//     snapshotsTakenAt: ISO,
//     policyVersion: string,
//     count: number,
//     decisions: Array<{ snapshot, decision }>
//   }
//
// Order: by recommendedSurface (deterministic ranking),
// then by lotNumber asc.
//////////////////////////////////////////////////////

const SURFACE_ORDER: Record<AllocationSurface, number> = {
  CONTRACT_CATALOG: 0,
  SPLIT: 1,
  EXCLUSIVE_MICROLOT: 2,
  OPEN_MARKETPLACE: 3,
  HOLD: 4,
}

function compareDecisions(
  a: LotAllocationDecision,
  b: LotAllocationDecision
): number {
  const sa = SURFACE_ORDER[a.recommendedSurface] ?? 99
  const sb = SURFACE_ORDER[b.recommendedSurface] ?? 99
  if (sa !== sb) return sa - sb
  return a.lotNumber.localeCompare(b.lotNumber)
}

export async function GET() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const snapshotsTakenAt = new Date().toISOString()
    const snapshots = await buildAllocationSnapshots()

    const pairs = snapshots
      .map((snapshot) => ({
        snapshot,
        decision: decideLotAllocation(snapshot),
      }))
      .sort((a, b) => compareDecisions(a.decision, b.decision))

    return NextResponse.json({
      snapshotsTakenAt,
      policyVersion: DEFAULT_ALLOCATION_POLICY.policyVersion,
      count: pairs.length,
      decisions: pairs,
    })
  } catch (error) {
    console.error("[ALLOCATION_RUN] error:", error)
    return NextResponse.json(
      { error: "Internal allocation run failed" },
      { status: 500 }
    )
  }
}
