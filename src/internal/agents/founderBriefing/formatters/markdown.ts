// =====================================================
// FOUNDER BRIEFING — MARKDOWN FORMATTER
//
// Pure function: same FounderBriefing → byte-identical
// markdown. No randomness, no Date.now() — only fields
// from the briefing object.
// =====================================================

import type { ContractStatus } from "@prisma/client"
import type { FounderBriefing } from "../types.ts"

// Workflow order for contract-status counts. Tracks the
// real lifecycle a contract walks through.
const STATUS_ORDER: ContractStatus[] = [
  "PENDING",
  "AWAITING_SIGNATURE",
  "SIGNED",
  "PAYMENT_PENDING",
  "ACTIVE",
  "PAST_DUE",
  "COMPLETED",
  "CANCELLED",
]

export function formatFounderBriefingMarkdown(b: FounderBriefing): string {
  const lines: string[] = []
  const date = b.generatedAt.slice(0, 10)

  lines.push(`# Founder Briefing — ${date}`)
  lines.push(`Overall health: **${b.supplyHealth.axes.overall}**`)
  lines.push("")

  // -- Supply health --------------------------------
  lines.push("## Supply Health")
  const a = b.supplyHealth.axes
  lines.push(
    `- Axes: supply=${a.supply}, demand=${a.demand}, commitment=${a.commitment}, fulfilment=${a.fulfilment}`,
  )
  const km = b.supplyHealth.keyMetrics
  lines.push(`- Published green: ${formatKg(km.publishedSupplyGreenKg)}`)
  lines.push(`- Contractable green: ${formatKg(km.contractableGreenKg)}`)
  lines.push(`- Committed green: ${formatKg(km.committedGreenKg)}`)
  lines.push(`- Monthly draw: ${formatKg(km.monthlyDrawGreenKg)}`)
  lines.push(
    `- Months of cover: ${fmtMaybe(km.monthsOfCover, 1)} (committed-only ${fmtMaybe(km.monthsOfCoverCommittedOnly, 1)})`,
  )
  if (b.supplyHealth.activeDetectors.length === 0) {
    lines.push("- Active detectors: none")
  } else {
    lines.push("- Active detectors:")
    for (const d of b.supplyHealth.activeDetectors) {
      lines.push(`  - **[${d.severity}] ${d.name}** — ${d.headline}`)
    }
  }
  lines.push("")

  // -- Contracts ------------------------------------
  lines.push("## Contracts")
  const cs = b.contractPressure.countsByStatus
  lines.push(
    `- Counts by status: ${STATUS_ORDER.map(k => `${k}=${cs[k]}`).join(", ")}`,
  )
  lines.push(`- Awaiting-signature past SLA: ${b.contractPressure.awaitingSignatureOlderThanSlaCount}`)
  lines.push(`- Payment-pending past SLA: ${b.contractPressure.paymentPendingOlderThanSlaCount}`)
  lines.push(`- Upcoming renewals: ${b.contractPressure.upcomingRenewalsCount}`)
  lines.push("")

  // -- Intents --------------------------------------
  lines.push("## Intents")
  const ip = b.intentPressure
  lines.push(`- Open intents: ${ip.openIntentsCount} (green: ${formatKg(ip.openIntentsGreenKg)})`)
  lines.push(`- Intent pressure ratio: ${fmtMaybe(ip.intentPressureRatio, 3)}`)
  lines.push(
    `- Oldest open intent age: ${ip.oldestOpenIntentAgeDays === null ? "n/a" : `${ip.oldestOpenIntentAgeDays}d`}`,
  )
  const ic = ip.intentConversion
  lines.push(
    `- Conversion (current 7d / prior 7d / Δ): ${fmtPct(ic.current7d)} / ${fmtPct(ic.prior7d)} / ${fmtMaybe(ic.deltaPts, 1)} pts`,
  )
  lines.push("")

  // -- Operational warnings -------------------------
  lines.push("## Operational Warnings")
  if (b.operationalWarnings.length === 0) {
    lines.push("- None.")
  } else {
    for (const w of b.operationalWarnings) {
      lines.push(`- **[${w.severity}] ${w.code}** — ${w.headline}`)
    }
  }
  lines.push("")

  // -- Top actions ----------------------------------
  lines.push("## Top Actions")
  if (b.recommendedActions.length === 0) {
    lines.push("- All clear. No actions recommended.")
  } else {
    for (const ac of b.recommendedActions) {
      lines.push(`${ac.rank}. **${ac.title}**`)
      lines.push(`   - Rationale: ${ac.rationale}`)
      lines.push(`   - Next step: ${ac.suggestedNextStep}`)
      lines.push(`   - Source: ${ac.sourceCodes.join(", ")}`)
    }
  }
  lines.push("")

  // -- Footer ---------------------------------------
  lines.push(`_Advisory only. Internal-use briefing. Sources: ${b.notes.dataSources.join(", ")}._`)
  lines.push(`Fingerprint: ${b.inputFingerprint}`)

  return lines.join("\n")
}

function formatKg(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")} kg`
}

function fmtPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "n/a"
  return `${(v * 100).toFixed(1)}%`
}

function fmtMaybe(v: number | null, decimals: number): string {
  if (v === null || Number.isNaN(v)) return "n/a"
  return v.toFixed(decimals)
}
