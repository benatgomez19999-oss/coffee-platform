//////////////////////////////////////////////////////
// 🧠 ALLOCATION POLICY
//
// Default knobs for the inventory allocation engine.
// Treat as v0 calibration — every threshold below
// must be revisited with the founder before being
// trusted in production decisions.
//
// Pure constants. No Prisma. No env reads.
// Override by passing a derived AllocationPolicy to
// decideLotAllocation(snapshot, policy).
//////////////////////////////////////////////////////

import type { AllocationPolicy } from "../domain/types.ts"
import { CUSTOMER_CONSUMPTION_PROFILES_V0 } from "./customerProfiles.ts"

export const DEFAULT_ALLOCATION_POLICY: AllocationPolicy = {
  policyVersion: "allocation-policy-v0",

  // Mirrors SAFETY_BUFFER_KG in src/services/system/supply.service.ts.
  // The engine applies it ONLY on the contract-candidate path —
  // small / exclusive / premium-microlot lots are not buffered,
  // because the buffer protects against contract over-commit, and
  // those surfaces don't drive recurring contracts.
  safetyBufferGreenKg: 400,

  // Green kg below which a residual is not worth listing in
  // marketplace. Anything below this rolls back into blocked.
  minMarketplaceKg: 5,

  // Total lot volume below which we never offer the lot for
  // recurring contracts (route to marketplace instead).
  minContractGreenKg: 1500,

  // A profile is "viable" only if free kg covers its typical
  // monthly demand for at least this many months.
  minimumContractMonths: 3,

  // When a lot is contract-eligible, the engine reserves
  // (largest viable monthly green kg) × this many months
  // as contractAssignableGreenKg. Anything left over
  // becomes marketplace residual (SPLIT) if it clears
  // minMarketplaceKg.
  residualContractCoverageMonths: 6,

  // SCA thresholds.
  // - premium tag → marketplace as PREMIUM_MICROLOT_MARKETPLACE
  // - exclusive tag → EXCLUSIVE_MICROLOT, but only when paired
  //   with rare variety OR small-volume condition.
  // High SCA alone is NOT enough to remove a 5-tonne lot from
  // contract supply — that would be cannibalisation.
  premiumScaThreshold: 86,
  exclusiveScaThreshold: 90,

  // Ceiling for "this lot fits microlot economics" classification.
  microLotMaxGreenKg: 500,

  // Variety names that always route to EXCLUSIVE_MICROLOT.
  // Compared case-insensitive after normalising whitespace
  // and dashes to underscores (see partition.normalizeVariety).
  rareVarieties: [
    "GEISHA",
    "PINK_BOURBON",
    "SUDAN_RUME",
    "WUSH_WUSH",
  ],

  // Calibration profiles — see customerProfiles.ts.
  // Spread to a fresh array so callers cannot mutate the source.
  contractProfiles: [...CUSTOMER_CONSUMPTION_PROFILES_V0],
}
