//////////////////////////////////////////////////////
// 🧠 CLIENT B2B PRICING BREAKDOWN — PARSING HELPERS
//
// Pure helpers that pull structured fields out of the
// breakdown array returned by calculateMarketplaceB2BPricing.
// The engine emits items as { label: string, value: ... } and
// the inspector consumes them by label.
//
// All helpers are null-safe. Missing labels → null. Wrong
// runtime type → null. They never throw.
//////////////////////////////////////////////////////

export type BreakdownItem = {
  label: string
  value: string | number | boolean | null
}

// ------------------------------------------------------
// LOOKUP HELPERS
// ------------------------------------------------------

export function findBreakdownItem(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null,
  label: string
): BreakdownItem | null {
  if (!breakdown) return null
  for (const item of breakdown) {
    if (item && item.label === label) return item
  }
  return null
}

export function findBreakdownValue(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null,
  label: string
): BreakdownItem["value"] | null {
  const item = findBreakdownItem(breakdown, label)
  return item ? item.value : null
}

export function getNumberBreakdownValue(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null,
  label: string
): number | null {
  const v = findBreakdownValue(breakdown, label)
  if (typeof v === "number" && Number.isFinite(v)) return v
  return null
}

export function getBooleanBreakdownValue(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null,
  label: string
): boolean | null {
  const v = findBreakdownValue(breakdown, label)
  if (typeof v === "boolean") return v
  return null
}

export function getStringBreakdownValue(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null,
  label: string
): string | null {
  const v = findBreakdownValue(breakdown, label)
  if (typeof v === "string" && v.length > 0) return v
  return null
}

// ------------------------------------------------------
// STRUCTURED VIEWS
// ------------------------------------------------------

export type CommercialInspection = {
  costPlusFinal: number | null
  marketAnchoredPrice: number | null
  finalBeforeClamp: number | null
  clampMin: number | null
  clampMax: number | null
  clampApplied: boolean | null
  softScarcityModifier: number | null
  softMarketSignalModifier: number | null
  softPrestigeModifier: number | null
}

export function buildCommercialInspectionFromBreakdown(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null
): CommercialInspection {
  return {
    costPlusFinal:
      getNumberBreakdownValue(breakdown, "costPlusFinal") ??
      getNumberBreakdownValue(breakdown, "costPlusPostClamp"),
    marketAnchoredPrice: getNumberBreakdownValue(breakdown, "marketAnchoredPrice"),
    finalBeforeClamp: getNumberBreakdownValue(breakdown, "finalBeforeClamp"),
    clampMin: getNumberBreakdownValue(breakdown, "clampMin"),
    clampMax: getNumberBreakdownValue(breakdown, "clampMax"),
    clampApplied: getBooleanBreakdownValue(breakdown, "clampApplied"),
    softScarcityModifier: getNumberBreakdownValue(breakdown, "softScarcityModifier"),
    softMarketSignalModifier: getNumberBreakdownValue(breakdown, "softMarketSignalModifier"),
    softPrestigeModifier: getNumberBreakdownValue(breakdown, "softPrestigeModifier"),
  }
}

export type TargetInspection = {
  ok: boolean
  sourceVersion: string | null
  pricingClass: string | null
  low: number | null
  expected: number | null
  high: number | null
  scaBucket: string | null
  altitudeBucket: string | null
  countryGroup: string | null
  reasons: string[]
}

export function buildTargetInspectionFromBreakdown(
  breakdown: ReadonlyArray<BreakdownItem> | undefined | null
): TargetInspection {

  const sourceVersion = getStringBreakdownValue(breakdown, "marketTargetSourceVersion")
  const pricingClass = getStringBreakdownValue(breakdown, "marketTargetPricingClass")
  const expected = getNumberBreakdownValue(breakdown, "marketTargetExpected")
  const low = getNumberBreakdownValue(breakdown, "marketTargetLow")
  const high = getNumberBreakdownValue(breakdown, "marketTargetHigh")
  const scaBucket = getStringBreakdownValue(breakdown, "targetScaBucket")
  const altitudeBucket = getStringBreakdownValue(breakdown, "targetAltitudeBucket")
  const countryGroup = getStringBreakdownValue(breakdown, "targetCountryGroup")

  const reasons: string[] = []
  // The engine pushes a few diagnostic strings when the target
  // lookup falls back. Surface them so the inspector explains
  // why a target row wasn't applied.
  for (const candidate of [
    "marketTargetMissing",
    "marketTargetFallbackReason",
    "marketTargetSkipReason",
  ]) {
    const v = findBreakdownValue(breakdown, candidate)
    if (typeof v === "string" && v.length > 0) reasons.push(`${candidate}: ${v}`)
  }

  const ok = expected != null && low != null && high != null

  return {
    ok,
    sourceVersion,
    pricingClass,
    low,
    expected,
    high,
    scaBucket,
    altitudeBucket,
    countryGroup,
    reasons,
  }
}

// ------------------------------------------------------
// DELTA CLASSIFICATION
// ------------------------------------------------------

export type DeltaStatus =
  | "MATCH"
  | "DRIFT_LOW"
  | "DRIFT_HIGH"
  | "NO_PERSISTED"
  | "NO_RECOMPUTE"

export const MATCH_DELTA_PERCENT_THRESHOLD = 0.5

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function classifyDeltaStatus(input: {
  persisted: number | null
  recomputed: number | null
  thresholdPercent?: number
}): DeltaStatus {

  if (!isUsableNumber(input.persisted)) return "NO_PERSISTED"
  if (!isUsableNumber(input.recomputed)) return "NO_RECOMPUTE"

  const threshold = input.thresholdPercent ?? MATCH_DELTA_PERCENT_THRESHOLD
  const pct = ((input.recomputed - input.persisted) / input.persisted) * 100
  if (Math.abs(pct) < threshold) return "MATCH"
  return pct > 0 ? "DRIFT_HIGH" : "DRIFT_LOW"
}

// ------------------------------------------------------
// VISIBILITY (allocation surface → marketplace / catalog)
// ------------------------------------------------------

export type AllocationSurfaceLike =
  | "CONTRACT_CATALOG"
  | "OPEN_MARKETPLACE"
  | "EXCLUSIVE_MICROLOT"
  | "SPLIT"
  | "HOLD"
  | string
  | null

export function deriveVisibility(input: {
  recommendedSurface: AllocationSurfaceLike
  marketplaceEligibleGreenKg: number | null
  exclusiveMicrolotGreenKg: number | null
  contractAssignableGreenKg: number | null
}): {
  appearsInMarketplace: boolean
  appearsInContractCatalog: boolean
} {
  const surface = input.recommendedSurface
  const marketKg =
    (typeof input.marketplaceEligibleGreenKg === "number" && Number.isFinite(input.marketplaceEligibleGreenKg)
      ? input.marketplaceEligibleGreenKg
      : 0) +
    (typeof input.exclusiveMicrolotGreenKg === "number" && Number.isFinite(input.exclusiveMicrolotGreenKg)
      ? input.exclusiveMicrolotGreenKg
      : 0)
  const contractKg =
    typeof input.contractAssignableGreenKg === "number" && Number.isFinite(input.contractAssignableGreenKg)
      ? input.contractAssignableGreenKg
      : 0

  const appearsInMarketplace =
    (surface === "OPEN_MARKETPLACE" ||
      surface === "EXCLUSIVE_MICROLOT" ||
      surface === "SPLIT") &&
    marketKg > 0

  const appearsInContractCatalog =
    (surface === "CONTRACT_CATALOG" || surface === "SPLIT") &&
    contractKg > 0

  return { appearsInMarketplace, appearsInContractCatalog }
}
