//////////////////////////////////////////////////////
// 🧠 ALLOCATION DOMAIN TYPES
//
// Pure TypeScript. No Prisma. No @prisma/client.
// These types are the contract between:
//   - the snapshot builder (ALLOC-2) which reads
//     Prisma and produces LotAllocationSnapshot[]
//   - the pure engine (this sprint) which maps
//     snapshots to LotAllocationDecision[]
//   - downstream API + UI consumers (ALLOC-3+)
//////////////////////////////////////////////////////

import type { LotMediaItem } from "../../lot-media/lotMedia.types.ts"

export type LotStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "RESERVED"
  | "SOLD"

export type AllocationSurface =
  | "CONTRACT_CATALOG"
  | "OPEN_MARKETPLACE"
  | "EXCLUSIVE_MICROLOT"
  | "SPLIT"
  | "HOLD"

export type AllocationReasonSeverity =
  | "info"
  | "warning"
  | "blocking"

export type AllocationReasonCode =
  // structural holds
  | "LOT_NOT_PUBLISHED"
  | "LOT_ALREADY_SOLD"
  | "SHIPMENT_ALREADY_RESERVED"
  | "SAFETY_BUFFER_RESERVED"
  // existing claims
  | "CONTRACT_COMMITTED"
  | "DEMAND_INTENT_RESERVED"
  // contract eligibility
  | "CONTRACT_VOLUME_SUFFICIENT"
  | "CONTRACT_VOLUME_INSUFFICIENT"
  | "MONTHLY_CONTRACT_CAPACITY_AVAILABLE"
  | "RESIDUAL_TOO_SMALL_FOR_CONTRACT"
  | "RESIDUAL_MARKETPLACE_ELIGIBLE"
  // premium / exclusive
  | "PREMIUM_MICROLOT_MARKETPLACE"
  | "RARE_VARIETY_EXCLUSIVE"
  | "HIGH_SCA_EXCLUSIVE"
  | "LOW_VOLUME_LOT"
  // data / risk holds
  | "MISSING_ROAST_YIELD"
  | "MISSING_PRICING"
  | "QUALITY_HOLD"
  | "RISK_HOLD"
  | "PRICING_HOLD"

export type AllocationReason = {
  code: AllocationReasonCode
  severity: AllocationReasonSeverity
  message: string
}

//////////////////////////////////////////////////////
// 🧮 CALIBRATION — CUSTOMER CONSUMPTION PROFILE
//
// One configurable row representing the typical
// monthly green-equivalent demand of a customer
// segment. The engine multiplies this by
// residualContractCoverageMonths to decide how much
// of a lot to reserve for future contracts.
//
// All values are CALIBRATION ASSUMPTIONS, not
// validated business truth. See customerProfiles.ts.
//////////////////////////////////////////////////////

export type SwitchTolerance =
  | "very-low"
  | "low"
  | "medium"
  | "high"

export type PriceSensitivity =
  | "low"
  | "medium"
  | "high"

export type CustomerConsumptionProfile = {
  id: string
  label: string

  // ROASTED kg client commitments (pre-yield)
  monthlyRoastedKgMin: number
  monthlyRoastedKgTypical: number
  monthlyRoastedKgMax: number

  contractDurationMonthsTypical: number
  preferredBagSizeKg: number

  suitableForMicrolot: boolean
  requiresSupplyContinuity: boolean
  toleranceForSwitchingLots: SwitchTolerance

  // null = no minimum (accepts anything)
  minScaScore: number | null

  priceSensitivity: PriceSensitivity
}

//////////////////////////////////////////////////////
// 🧠 ALLOCATION POLICY
//////////////////////////////////////////////////////

export type AllocationPolicy = {
  policyVersion: string

  // structural reserve
  safetyBufferGreenKg: number

  // marketplace floor
  minMarketplaceKg: number

  // contract viability thresholds
  minContractGreenKg: number
  minimumContractMonths: number
  residualContractCoverageMonths: number

  // premium / exclusive
  premiumScaThreshold: number
  exclusiveScaThreshold: number
  microLotMaxGreenKg: number
  rareVarieties: string[]

  // calibration profiles
  contractProfiles: CustomerConsumptionProfile[]
}

//////////////////////////////////////////////////////
// 📦 LOT SNAPSHOT  (engine input)
//
// Pure data. Built by ALLOC-2 from Prisma. The engine
// never reads the DB — it only reads this shape.
//////////////////////////////////////////////////////

export type LotAllocationSnapshot = {
  // identity
  greenLotId: string
  lotNumber: string

  // lot data
  status: LotStatus
  totalGreenKg: number
  availableGreenKg: number
  scaScore: number | null
  variety: string
  process: string
  harvestYear: number | null

  // yield
  estimatedRoastYield: number       // resolved (always populated)
  usedDefaultRoastYield: boolean    // true ⇒ fell back to process default

  // pricing
  greenPricePerKg: number | null

  // PRICING-B2B-3 — persisted client B2B roasted price + audit
  // metadata. Optional/nullable for backwards compatibility with
  // pre-B2B rows (engine + marketplace fall back to legacy
  // green/yield via resolveClientB2BPriceForLot).
  clientB2BPricePerKg?: number | null
  clientB2BPricingVersion?: string | null
  clientB2BPricingMode?: string | null

  // farm / producer context
  farmId: string
  farmRegion: string | null
  farmAltitude: number | null
  producerCountry: string | null

  // existing claims (already deducted? NO — kept separately
  // so the engine can label every kilogram explicitly)
  //
  // committedContractGreenKg is the volume the engine treats as
  // locked. ALLOC-1 callers may set it to monthly committed.
  // ALLOC-2 snapshot builder sets it to the FULL horizon
  // obligation (sum of monthlyGreenKg × max(remainingMonths,1))
  // so marketplace residual logic doesn't accidentally release
  // volume already promised to a 12-month contract.
  committedContractGreenKg: number
  committedContractMonthsRemaining: number  // longest remaining horizon across those contracts
  // Optional metadata produced by the ALLOC-2 snapshot builder.
  // Engine ignores these — they exist for downstream display
  // and audit (e.g. "this month's draw vs full obligation").
  committedContractMonthlyGreenKg?: number
  committedContractHorizonGreenKg?: number
  reservedIntentGreenKg: number             // sum of deltaKg of OPEN demand intents

  // logistics
  shipmentId: string | null

  // optional risk
  marketDemandIndex: number | null

  // ALLOC-3 — display metadata (engine ignores these).
  // Carried on the snapshot so the marketplace mapper can
  // build cards without a second DB round-trip.
  name?: string | null
  producerName?: string | null
  farmName?: string | null
  createdAt?: string | null    // ISO-8601 of GreenLot.createdAt
  currency?: string | null

  // LOT-MEDIA-1 — semantic ordered media (FARM / PROCESS /
  // PRODUCER / …). Optional + defaults to []. Engine ignores
  // this field; it exists purely for the marketplace + contract
  // catalog DTO mappers to surface primary image + trust signals
  // without a second DB round-trip. May be undefined for lots
  // pre-dating the media table.
  media?: LotMediaItem[]
}

//////////////////////////////////////////////////////
// ⚖️ DECISION  (engine output)
//////////////////////////////////////////////////////

export type ViableProfile = {
  profileId: string
  monthsCovered: number
  monthlyGreenKg: number
  coversTypicalConsumption: boolean
}

export type LotAllocationDecision = {
  // identity
  greenLotId: string
  lotNumber: string

  // raw inputs (echoed for downstream display / audit)
  totalGreenKg: number
  availableGreenKg: number
  committedContractGreenKg: number
  reservedIntentGreenKg: number
  safetyBufferGreenKg: number

  // partition (sum ≤ availableGreenKg)
  contractReservedGreenKg: number     // already locked by signed/active contracts
  contractAssignableGreenKg: number   // free to be picked up by a NEW contract
  marketplaceEligibleGreenKg: number  // free for one-off purchases
  exclusiveMicrolotGreenKg: number    // marketplace-shown, premium tier
  blockedGreenKg: number              // structural buffer + holds

  // primary recommendation
  recommendedSurface: AllocationSurface

  // audit trail
  viableProfiles: ViableProfile[]
  reasons: AllocationReason[]
  confidence: number        // 0.35..1
  policyVersion: string
  evaluatedAt: string       // ISO-8601
}
