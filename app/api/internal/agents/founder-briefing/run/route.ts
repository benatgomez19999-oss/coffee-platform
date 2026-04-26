// =====================================================
// INTERNAL ROUTE — Founder Daily Intelligence Briefing
//
// On-demand invocation. POST only.
//
// AUTH GATE — same v1 pattern as
// app/api/internal/monitors/supply-commitment-health/run.
// NODE_ENV === "development" until a real internal role
// (or signed admin token / middleware-level guard) exists.
//
// TODO(internal-role): replace with a shared internal
// guard once the platform has an INTERNAL/OPERATOR role.
//
// Side effects: NONE.
//   - Reads from the business DB (read-only).
//   - Does NOT write to any business table.
//   - Does NOT persist briefing results in v1.
// =====================================================

export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import {
  buildFounderBriefing,
  formatFounderBriefingMarkdown,
} from "@/src/internal/agents/founderBriefing"

export async function POST() {

  // -------------------------------------------------
  // V1 TEMPORARY GATE
  // -------------------------------------------------

  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not allowed" },
      { status: 403 }
    )
  }

  // -------------------------------------------------
  // BUILD
  // -------------------------------------------------

  try {
    const briefing = await buildFounderBriefing()
    const markdown = formatFounderBriefingMarkdown(briefing)
    return NextResponse.json({ briefing, markdown })
  } catch (err) {
    console.error("[founderBriefing] failed:", err)
    return NextResponse.json(
      { error: "Briefing build failed" },
      { status: 500 }
    )
  }
}
