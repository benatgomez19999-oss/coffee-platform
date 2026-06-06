//////////////////////////////////////////////////////
// 📦 PARTITION HELPERS
//
// Pure deterministic helpers for slicing a lot into
// committed / reserved / safety-buffered / free pools
// and for evaluating which customer profiles a free
// pool can sustain.
//
// All inputs are guarded against NaN / Infinity /
// negative numbers. Helpers never throw on numeric
// input — they conservatively return zero or skip.
//////////////////////////////////////////////////////

import type {
  CustomerConsumptionProfile,
  ViableProfile,
} from "./types.ts"

// ------------------------------------------------------
// NUMERIC GUARDS
// ------------------------------------------------------

export function clampNonNegative(value: number): number {
  if (typeof value !== "number") return 0
  if (!Number.isFinite(value)) return 0
  return value > 0 ? value : 0
}

// ------------------------------------------------------
// FREE GREEN KG
//
// Mirrors the deduction order used in
// src/services/system/supply.service.ts: gross available
// minus committed minus open-intent reservations minus
// the structural safety buffer.
//
// Caller decides whether the buffer applies (the engine
// passes 0 on small / exclusive / microlot paths).
// ------------------------------------------------------

export function computeFreeGreenKg(input: {
  availableGreenKg: number
  committedContractGreenKg: number
  reservedIntentGreenKg: number
  safetyBufferGreenKg: number
}): number {
  const available = clampNonNegative(input.availableGreenKg)
  const committed = clampNonNegative(input.committedContractGreenKg)
  const reserved = clampNonNegative(input.reservedIntentGreenKg)
  const buffer = clampNonNegative(input.safetyBufferGreenKg)
  return clampNonNegative(available - committed - reserved - buffer)
}

// ------------------------------------------------------
// VARIETY NORMALISATION
//
// Same variety string can arrive as "Geisha", "GEISHA",
// "pink-bourbon", "Pink Bourbon" etc. We normalise to
// a single canonical form for comparison against the
// rare-variety registry.
// ------------------------------------------------------

export function normalizeVariety(value: string): string {
  if (typeof value !== "string") return ""
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "_")
}

export function isRareVariety(
  variety: string,
  rareVarieties: ReadonlyArray<string>
): boolean {
  const normalized = normalizeVariety(variety)
  if (!normalized) return false
  for (const rare of rareVarieties) {
    if (normalizeVariety(rare) === normalized) return true
  }
  return false
}

// ------------------------------------------------------
// PROFILE VIABILITY
//
// A profile is "viable" if:
//   1. The lot's SCA (when known) meets the profile's
//      minimum quality bar, AND
//   2. The free green kg pool sustains at least
//      `minimumContractMonths` of the profile's typical
//      monthly demand (in green kg).
//
// monthlyGreenKg is computed via the lot's actual roast
// yield: monthlyRoastedKgTypical / roastYield.
// ------------------------------------------------------

export function computeProfileViability(input: {
  freeGreenKg: number
  roastYield: number
  profiles: ReadonlyArray<CustomerConsumptionProfile>
  minimumContractMonths: number
  scaScore?: number | null
}): ViableProfile[] {
  const free = clampNonNegative(input.freeGreenKg)
  const yieldSafe =
    Number.isFinite(input.roastYield) && input.roastYield > 0
      ? input.roastYield
      : 0.83
  const minMonths = Math.max(
    1,
    Math.floor(
      Number.isFinite(input.minimumContractMonths)
        ? input.minimumContractMonths
        : 1
    )
  )

  const out: ViableProfile[] = []

  for (const profile of input.profiles) {
    // SCA filter — only applied when both sides are known.
    if (
      input.scaScore != null &&
      profile.minScaScore != null &&
      input.scaScore < profile.minScaScore
    ) {
      continue
    }

    const monthlyRoasted = profile.monthlyRoastedKgTypical
    if (!Number.isFinite(monthlyRoasted) || monthlyRoasted <= 0) continue

    const monthlyGreenKg = monthlyRoasted / yieldSafe
    if (!Number.isFinite(monthlyGreenKg) || monthlyGreenKg <= 0) continue

    const monthsCovered = Math.floor(free / monthlyGreenKg)
    if (monthsCovered >= minMonths) {
      out.push({
        profileId: profile.id,
        monthsCovered,
        monthlyGreenKg,
        coversTypicalConsumption: true,
      })
    }
  }

  return out
}
