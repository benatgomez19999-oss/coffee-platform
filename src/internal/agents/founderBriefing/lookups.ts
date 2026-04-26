// =====================================================
// FOUNDER BRIEFING — LOOKUPS
//
// Hand-authored copy keyed by detector / warning code.
// One detector headline per monitor DetectorName.
// One action template per detector + operational
// warning code.
//
// No LLM. No randomness. Pure functions of inputs.
// =====================================================

import type { DetectorName } from "@/src/internal/monitors/supplyCommitmentHealth/types.ts"
import type { OperationalWarningCode } from "./types.ts"

type Code = DetectorName | OperationalWarningCode

// -----------------------------------------------------
// DETECTOR HEADLINES
// -----------------------------------------------------

const HEADLINES: Record<DetectorName, (observed: number | null, threshold: number) => string> = {
  COMMITMENT_LOAD_HIGH: (o, t) =>
    `Committed contracts use ${pct(o)} of available supply (threshold ${pct(t)}).`,
  MONTHS_OF_COVER_LOW: (o, t) =>
    `Months of cover at ${num(o, 1)} (threshold ${num(t, 1)}).`,
  MONTHS_OF_COVER_COMMITTED_LOW: (o, t) =>
    `Committed-only months of cover at ${num(o, 1)} (threshold ${num(t, 1)}).`,
  INTENT_PRESSURE_HIGH: (o, t) =>
    `Open intent pressure at ${pct(o)} of contractable supply (threshold ${pct(t)}).`,
  INTENT_CONVERSION_DROP: (o, t) =>
    `Intent conversion delta is ${num(o, 1)} pts (threshold ${num(t, 1)}).`,
  FULFILMENT_OVERDUE: (o) =>
    `${num(o, 0)} producer fulfilment(s) past the awaiting-confirmation SLA.`,
  FARM_CONCENTRATION_HIGH: (o, t) =>
    `Top-3 farms account for ${pct(o)} of supply (threshold ${pct(t)}).`,
  SUPPLY_DIVERSITY_LOW: (o, t) =>
    `Distinct supply sources at ${num(o, 0)} (threshold ${num(t, 0)}).`,
  PINNED_LOT_OVEREXPOSED: (o, t) =>
    `Worst pinned-lot exposure ratio is ${num(o, 2)} (threshold ${num(t, 2)}).`,
  UNBACKED_COMMITMENTS_HIGH: (o, t) =>
    `Unbacked monthly commitments at ${pct(o)} of total monthly draw (threshold ${pct(t)}).`,
}

export function detectorHeadline(
  name: DetectorName,
  observed: number | null,
  threshold: number,
): string {
  return HEADLINES[name](observed, threshold)
}

// -----------------------------------------------------
// ACTION TEMPLATES
// -----------------------------------------------------

type ActionTemplate = {
  title: string
  suggestedNextStep: string
  rationale: (
    observed: number | null,
    threshold: number | null,
    ctx: Record<string, number | string | null>,
  ) => string
}

const FALLBACK_TEMPLATE: ActionTemplate = {
  title: "Review unmapped finding",
  suggestedNextStep: "Check the monitor / briefing source code for the unmapped code.",
  rationale: (_o, _t, ctx) => `Triggered by code ${String(ctx.__code ?? "unknown")}.`,
}

const ACTION_TEMPLATES: Record<Code, ActionTemplate> = {
  // -- Monitor detectors -----------------------------
  COMMITMENT_LOAD_HIGH: {
    title: "Slow new commitment intake",
    suggestedNextStep:
      "Review pending intents before approving new contracts; prioritise renewals over net-new volume.",
    rationale: (o, t) => `Committed load is ${pct(o)} of supply (threshold ${pct(t)}).`,
  },
  MONTHS_OF_COVER_LOW: {
    title: "Refill green inventory",
    suggestedNextStep:
      "Engage producers about additional verified lots; check incoming drafts in IN_REVIEW / VERIFIED.",
    rationale: (o, t) => `Cover at ${num(o, 1)} months (threshold ${num(t, 1)}).`,
  },
  MONTHS_OF_COVER_COMMITTED_LOW: {
    title: "Reassess committed-coverage runway",
    suggestedNextStep:
      "Identify which committed contracts will draw soonest and confirm matching lots are on track.",
    rationale: (o, t) => `Committed cover at ${num(o, 1)} months (threshold ${num(t, 1)}).`,
  },
  INTENT_PRESSURE_HIGH: {
    title: "Triage open demand intents",
    suggestedNextStep:
      "Walk the OPEN-intent queue oldest-first; convert or counter to relieve supply reservation.",
    rationale: (o, t) => `Open intents reserve ${pct(o)} of contractable supply (threshold ${pct(t)}).`,
  },
  INTENT_CONVERSION_DROP: {
    title: "Investigate conversion drop",
    suggestedNextStep:
      "Sample recent COUNTERED / EXPIRED intents to find the friction point in the intent flow.",
    rationale: (o, t) => `Conversion delta is ${num(o, 1)} pts (threshold ${num(t, 1)}).`,
  },
  FULFILMENT_OVERDUE: {
    title: "Chase overdue producer fulfilments",
    suggestedNextStep:
      "Contact producers whose ProducerFulfilment is still AWAITING_CONFIRMATION past SLA.",
    rationale: (o) => `${num(o, 0)} fulfilment(s) past SLA.`,
  },
  FARM_CONCENTRATION_HIGH: {
    title: "Diversify farm sourcing",
    suggestedNextStep:
      "Pipeline new producers in under-represented regions; avoid signing fresh contracts against the top farms until concentration drops.",
    rationale: (o, t) => `Top-3 farms = ${pct(o)} of supply (threshold ${pct(t)}).`,
  },
  SUPPLY_DIVERSITY_LOW: {
    title: "Increase distinct supply sources",
    suggestedNextStep:
      "Push more producer drafts toward VERIFIED to widen the active lot count.",
    rationale: (o, t) => `Distinct sources at ${num(o, 0)} (threshold ${num(t, 0)}).`,
  },
  PINNED_LOT_OVEREXPOSED: {
    title: "Reduce single-lot exposure",
    suggestedNextStep:
      "Migrate pinned commitments off the most exposed lot, or accelerate replacement supply.",
    rationale: (o, t) => `Worst pinned exposure ratio ${num(o, 2)} (threshold ${num(t, 2)}).`,
  },
  UNBACKED_COMMITMENTS_HIGH: {
    title: "Back up commitments with explicit supply",
    suggestedNextStep:
      "Pin floating contracts to specific GreenLots so monthlyGreenKg has supply attribution.",
    rationale: (o, t) => `Unbacked share at ${pct(o)} (threshold ${pct(t)}).`,
  },

  // -- Operational warnings --------------------------
  AWAITING_SIGNATURE_SLA_BREACH: {
    title: "Unstick contracts in signature limbo",
    suggestedNextStep:
      "Reach out to clients whose contracts are stuck pre-signature; re-issue OTP if expired.",
    rationale: (o) => `${num(o, 0)} contract(s) past awaiting-signature SLA.`,
  },
  PAYMENT_PENDING_SLA_BREACH: {
    title: "Resolve payment-pending contracts",
    suggestedNextStep:
      "Coordinate with finance to follow up on overdue first-payments.",
    rationale: (o) => `${num(o, 0)} contract(s) past payment-pending SLA.`,
  },
  INTENT_BACKLOG_HIGH: {
    title: "Clear stale demand intents",
    suggestedNextStep:
      "Walk the oldest open intents and decide: counter, fulfil, or expire deliberately.",
    rationale: (o) => `${num(o, 0)} intent(s) past the open-intent SLA.`,
  },
}

export function actionTemplate(code: string): ActionTemplate {
  return ACTION_TEMPLATES[code as Code] ?? FALLBACK_TEMPLATE
}

// -----------------------------------------------------
// FORMAT HELPERS
// -----------------------------------------------------

function pct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "n/a"
  return `${(v * 100).toFixed(1)}%`
}

function num(v: number | null, decimals: number): string {
  if (v === null || Number.isNaN(v)) return "n/a"
  return v.toFixed(decimals)
}
