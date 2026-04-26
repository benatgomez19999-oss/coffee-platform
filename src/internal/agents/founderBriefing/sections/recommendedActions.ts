// =====================================================
// FOUNDER BRIEFING — RECOMMENDED ACTIONS
//
// Deterministic ranking. No LLM, no randomness.
//
// Candidates: union of fired monitor detectors and
// briefing-side operational warnings.
// Score: SEVERITY_WEIGHTS[severity].
// Tie-break: code ascending (lexicographic) — keeps
// output byte-identical across runs given identical
// inputs.
// Output: top 3 (or fewer; never padded).
//
// Suppression: when both members of a known
// correlated-detector pair fire, only the WINNER is
// eligible for an action slot. Both still appear in
// supplyHealth.activeDetectors — only the action slot
// is suppressed, so two near-identical recommendations
// don't crowd out unrelated findings.
// =====================================================

import type {
  ActiveDetector,
  OperationalWarning,
  RecommendedAction,
} from "../types.ts"
import { actionTemplate } from "../lookups.ts"
import { SEVERITY_WEIGHTS } from "../config.ts"

type Candidate = {
  code: string
  severity: "WATCH" | "STRESSED" | "CRITICAL"
  observed: number | null
  threshold: number | null
  context: Record<string, number | string | null>
}

function scoreOf(c: Candidate): number {
  return SEVERITY_WEIGHTS[c.severity] ?? 0
}

const RANKS: Array<1 | 2 | 3> = [1, 2, 3]

// -----------------------------------------------------
// SUPPRESSION PAIRS
//
// When BOTH winner and loser are present in the
// candidate set, the loser is dropped from the action
// list. The loser still appears in
// supplyHealth.activeDetectors.
// -----------------------------------------------------
const SUPPRESSION_PAIRS: Array<{ winner: string; loser: string }> = [
  // Two cover detectors fire on the same root cause; the
  // broader one carries the more useful headline.
  { winner: "MONTHS_OF_COVER_LOW",     loser: "MONTHS_OF_COVER_COMMITTED_LOW" },
  // Concentration is the more specific, actionable signal
  // of the two correlated supply-fragility detectors.
  { winner: "FARM_CONCENTRATION_HIGH", loser: "SUPPLY_DIVERSITY_LOW" },
]

export function buildRecommendedActions(
  activeDetectors: ActiveDetector[],
  warnings: OperationalWarning[],
): RecommendedAction[] {

  const candidates: Candidate[] = [
    ...activeDetectors.map<Candidate>(d => ({
      code: d.name,
      severity: d.severity,
      observed: d.observed,
      threshold: d.threshold,
      context: d.rationale,
    })),
    ...warnings.map<Candidate>(w => ({
      code: w.code,
      severity: w.severity,
      observed: w.count,
      threshold: null,
      context: { count: w.count, headline: w.headline },
    })),
  ]

  // Apply suppression: drop the loser of any pair whose
  // winner is also a candidate.
  const presentCodes = new Set(candidates.map(c => c.code))
  const suppressed = new Set<string>()
  for (const pair of SUPPRESSION_PAIRS) {
    if (presentCodes.has(pair.winner) && presentCodes.has(pair.loser)) {
      suppressed.add(pair.loser)
    }
  }
  const eligible = candidates.filter(c => !suppressed.has(c.code))

  eligible.sort((a, b) => {
    const ds = scoreOf(b) - scoreOf(a)
    if (ds !== 0) return ds
    return a.code.localeCompare(b.code)
  })

  const top = eligible.slice(0, 3)

  return top.map((c, i) => {
    const tpl = actionTemplate(c.code)
    return {
      rank: RANKS[i]!,
      title: tpl.title,
      rationale: tpl.rationale(c.observed, c.threshold, { ...c.context, __code: c.code }),
      suggestedNextStep: tpl.suggestedNextStep,
      sourceCodes: [c.code],
    }
  })
}
