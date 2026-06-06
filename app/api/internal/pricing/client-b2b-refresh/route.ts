export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  applyClientB2BRefresh,
  previewClientB2BRefresh,
  type ClientB2BRefreshLotStatus,
  type ClientB2BRefreshScope,
} from "@/src/services/pricing/clientB2BPriceRefresh.service"

//////////////////////////////////////////////////////
// 🔄 INTERNAL — /api/internal/pricing/client-b2b-refresh
//
//   GET   → dry-run preview of B2B refresh
//   POST  → dry-run by default; { apply: true, confirm: "REFRESH_CLIENT_B2B_PRICES" }
//           triggers the persistence path.
//
// Auth: requireDevRoute({ requireUser: true }). Hard-killed
// on Vercel Production by the guard.
//
// Read-only by default. Apply mode updates ONLY the
// PricingSnapshot.clientB2B* fields. Existing Contract
// and DemandIntent rows are NEVER modified.
//////////////////////////////////////////////////////

const APPLY_CONFIRM_TOKEN = "REFRESH_CLIENT_B2B_PRICES"
const VALID_STATUSES: ReadonlyArray<ClientB2BRefreshLotStatus> = [
  "PUBLISHED",
  "RESERVED",
  "SOLD",
  "DRAFT",
]

function parseStatuses(raw: unknown): ClientB2BRefreshLotStatus[] | undefined {
  if (raw == null) return undefined
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is ClientB2BRefreshLotStatus =>
        VALID_STATUSES.includes(s as ClientB2BRefreshLotStatus)
      )
  }
  if (Array.isArray(raw)) {
    return raw
      .map((s) => (typeof s === "string" ? s.trim().toUpperCase() : ""))
      .filter((s): s is ClientB2BRefreshLotStatus =>
        VALID_STATUSES.includes(s as ClientB2BRefreshLotStatus)
      )
  }
  return undefined
}

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function parseGreenLotId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// ------------------------------------------------------
// GET — dry-run preview
// ------------------------------------------------------

export async function GET(req: Request) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const url = new URL(req.url)
    const scope: ClientB2BRefreshScope = {
      greenLotId: parseGreenLotId(url.searchParams.get("greenLotId")),
      limit: parseLimit(url.searchParams.get("limit")),
      includeStatuses: parseStatuses(url.searchParams.get("includeStatuses")),
    }

    const summary = await previewClientB2BRefresh(scope)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("[CLIENT_B2B_REFRESH_GET] error:", error)
    return NextResponse.json(
      { error: "Refresh preview failed" },
      { status: 500 }
    )
  }
}

// ------------------------------------------------------
// POST — dry-run by default, apply when explicitly confirmed
// ------------------------------------------------------

export async function POST(req: Request) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  let body: Record<string, unknown> = {}
  try {
    const raw = await req.json()
    body = (typeof raw === "object" && raw !== null) ? (raw as Record<string, unknown>) : {}
  } catch {
    body = {}
  }

  const scope: ClientB2BRefreshScope = {
    greenLotId: parseGreenLotId(body.greenLotId),
    limit: parseLimit(body.limit),
    includeStatuses: parseStatuses(body.includeStatuses),
  }

  const wantsApply = body.apply === true
  if (wantsApply && body.confirm !== APPLY_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: `apply=true requires confirm="${APPLY_CONFIRM_TOKEN}"`,
      },
      { status: 400 }
    )
  }

  try {
    const summary = wantsApply
      ? await applyClientB2BRefresh(scope)
      : await previewClientB2BRefresh(scope)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("[CLIENT_B2B_REFRESH_POST] error:", error)
    return NextResponse.json(
      { error: "Refresh failed" },
      { status: 500 }
    )
  }
}
