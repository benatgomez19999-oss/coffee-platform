// =====================================================
// FOUNDER DAILY INTELLIGENCE BRIEFING — TYPES
//
// Pure type declarations only. No runtime code.
//
// The briefing is an internal, read-only, advisory
// composition over:
//   - Prisma (GreenLot, Contract, DemandIntent,
//     ProducerFulfilment)
//   - getContractableSupply()
//   - runSupplyCommitmentHealthMonitor()
//
// It must not import from src/AI, src/engine,
// src/spatialMarket, src/decision, src/brain, or
// src/signals.
// =====================================================

import type { ContractStatus } from "@prisma/client"
import type {
  DetectorName,
  HealthSeverity,
} from "@/src/internal/monitors/supplyCommitmentHealth/types.ts"

// =====================================================
// UNIT BRAND
//
// Every *GreenKg field in the briefing carries this
// brand so a roasted-primary value (Contract.monthlyVolumeKg)
// cannot be silently assigned in.
// =====================================================

export type GreenKg = number & { readonly __brand: "GreenKg" }

export const asGreenKg = (n: number): GreenKg => n as GreenKg

// =====================================================
// AXES
//
// Forwarded from CommitmentHealthReport.healthAxes.
// We drop the `Health` suffix on the briefing's surface
// for readability; the mapping is mechanical.
// =====================================================

export type FounderBriefingAxes = {
  supply:     HealthSeverity
  demand:     HealthSeverity
  commitment: HealthSeverity
  fulfilment: HealthSeverity
  overall:    HealthSeverity
}

// =====================================================
// SUPPLY HEALTH SECTION
// =====================================================

export type ActiveDetector = {
  name: DetectorName
  severity: Exclude<HealthSeverity, "OK">
  axis: string
  observed: number | null
  threshold: number
  headline: string
  rationale: Record<string, number | string | null>
}

export type SupplyHealthSection = {
  axes: FounderBriefingAxes
  keyMetrics: {
    publishedSupplyGreenKg:     GreenKg
    contractableGreenKg:        GreenKg
    committedGreenKg:           GreenKg
    monthlyDrawGreenKg:         GreenKg
    monthsOfCover:              number | null
    monthsOfCoverCommittedOnly: number | null
  }
  activeDetectors: ActiveDetector[]
}

// =====================================================
// CONTRACT PRESSURE SECTION
// =====================================================

export type ContractPressureSection = {
  countsByStatus: Record<ContractStatus, number>
  awaitingSignatureOlderThanSlaCount: number
  paymentPendingOlderThanSlaCount:    number
  upcomingRenewalsCount:              number
}

// =====================================================
// INTENT PRESSURE SECTION
// =====================================================

export type IntentPressureSection = {
  openIntentsCount:        number
  openIntentsGreenKg:      GreenKg
  intentPressureRatio:     number | null  // forwarded from monitor
  oldestOpenIntentAgeDays: number | null
  intentConversion: {
    current7d: number | null
    prior7d:   number | null
    deltaPts:  number | null
  }
}

// =====================================================
// OPERATIONAL WARNINGS
//
// Briefing-side detectors that the monitor does NOT
// already cover. Anything the monitor catches stays on
// the monitor — no double-detection.
// =====================================================

export type OperationalWarningCode =
  | "AWAITING_SIGNATURE_SLA_BREACH"
  | "PAYMENT_PENDING_SLA_BREACH"
  | "INTENT_BACKLOG_HIGH"

export type OperationalWarning = {
  code:      OperationalWarningCode
  severity:  Exclude<HealthSeverity, "OK">
  headline:  string
  count:     number
  sampleIds: string[]
}

// =====================================================
// RECOMMENDED ACTIONS
//
// Hand-authored copy keyed by detector / warning code.
// No LLM. Top 3 only, ranked deterministically.
// =====================================================

export type RecommendedAction = {
  rank: 1 | 2 | 3
  title: string
  rationale: string
  suggestedNextStep: string
  sourceCodes: string[]
}

// =====================================================
// FULL BRIEFING
// =====================================================

export type FounderBriefing = {
  briefingVersion: string
  monitorVersion:  string
  generatedAt:     string  // ISO
  inputFingerprint: string
  inputCounts: {
    greenLots:    number
    contracts:    number
    intents:      number
    fulfilments:  number
  }
  supplyHealth:        SupplyHealthSection
  contractPressure:    ContractPressureSection
  intentPressure:      IntentPressureSection
  operationalWarnings: OperationalWarning[]
  recommendedActions:  RecommendedAction[]
  notes: {
    advisoryOnly:    true
    dataSources:     readonly string[]
    excludedSources: readonly string[]
  }
}
