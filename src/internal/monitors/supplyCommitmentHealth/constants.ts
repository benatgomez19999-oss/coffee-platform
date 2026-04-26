// =====================================================
// SUPPLY & COMMITMENT HEALTH MONITOR — CONSTANTS
//
// All status sets, version stamps, and load-bearing
// semantic constants live here. Anything that ANY other
// file in this module branches on must be defined here
// in exactly one place.
//
// Editing any constant in this file is a behavioural
// change. Bump `MONITOR_VERSION` whenever a constant
// here is modified.
// =====================================================

import type { ContractStatus, LotDraftStatus } from "@prisma/client"

// =====================================================
// MONITOR VERSION
//
// Bump on any change to:
//   - constants in this file
//   - metric definitions
//   - detector definitions or thresholds
//   - report shape
//
// Stamped into every persisted CommitmentHealthSnapshot.
//
// CHANGELOG:
//   1.0.0 — initial implementation. Six detectors, four
//           axes, Option A monthlyDrawGreen.
//   1.0.1 — Phase 1 hardening pass. ONE metric semantic
//           change: fulfilment.overdueRatio denominator
//           is now restricted to AWAITING_CONFIRMATION
//           rows (the only rows eligible to become
//           overdue), so the ratio reflects stress
//           within the active fulfilment set, not
//           historical volume. Behaviour of every other
//           metric and every detector is preserved.
//           No threshold changes, no schema changes,
//           no new detectors.
//   1.1.0 — Phase 2 supply-axis fragility detectors.
//           ADDITIVE only — no Phase 1 metric, threshold,
//           detector, or report shape was changed. Four
//           new metrics aggregated from existing snapshot
//           rows (no new Prisma reads):
//             - farmConcentration   (top-3 farm share)
//             - supplyDiversity     (distinct farms/lots)
//             - pinnedLotExposure   (pinned monthly draw
//                                    vs lot.availableKg)
//             - unbackedCommitment  (committed contracts
//                                    with no greenLot)
//           Four new detectors on supplyHealth:
//             - FARM_CONCENTRATION_HIGH
//             - SUPPLY_DIVERSITY_LOW
//             - PINNED_LOT_OVEREXPOSED
//             - UNBACKED_COMMITMENTS_HIGH
//           supplyHealth is no longer always OK.
// =====================================================

export const MONITOR_VERSION = "1.1.0"

// =====================================================
// COMMITTED CONTRACT STATUSES
//
// The set of Contract.status values that count as a
// REAL, LEGALLY-BOUND commitment for the purpose of
// `committedGreen` and `monthlyDrawGreen`.
//
// HARD RULE — DO NOT EDIT WITHOUT REVIEW:
// AWAITING_SIGNATURE is EXCLUDED on purpose. The OTP /
// signature step is the formal confirmation boundary
// in this domain. Anything before that signature is
// intent or paperwork, not commitment.
//
// PENDING is excluded for the same reason (pre-OTP).
// COMPLETED and CANCELLED are excluded because they
// no longer draw against current supply.
//
// Note: getContractableSupply() in src/services/system
// uses a DIFFERENT, more conservative committed filter
// (it includes AWAITING_SIGNATURE) because it answers a
// different question — "what is safe to offer" rather
// than "what is legally locked." That divergence is
// intentional. Do not reconcile the two filters.
// =====================================================

export const COMMITTED_CONTRACT_STATUSES: ContractStatus[] = [
  "SIGNED",
  "PAYMENT_PENDING",
  "ACTIVE",
  "PAST_DUE",
]

// =====================================================
// PUBLISHED GREEN LOT FILTER
//
// Mirrors the existing predicate used by
// getContractableSupply() in supply.service.ts:
//   status = PUBLISHED AND availableKg > 0
//
// Reused — not reinvented.
// =====================================================

export const PUBLISHED_LOT_STATUS = "PUBLISHED" as const

// =====================================================
// PRODUCER LOT DRAFT STATUSES — DEFERRED TO v1.1
//
// `incomingSupplyGreen` is intentionally NOT included
// in v1. The reliability of `estimatedGreenKg` per
// status has not yet been audited; including it would
// reintroduce the synthetic-data credibility problem
// the rest of the monitor is designed to avoid.
//
// Listed here only as a v1.1 marker — not consumed.
// =====================================================

export const _DEFERRED_INCOMING_DRAFT_STATUSES: LotDraftStatus[] = [
  "VERIFIED",
  "IN_REVIEW",
  "SAMPLE_REQUESTED",
]

// =====================================================
// monthlyDrawGreen DEFINITION — Option A (CONFIRMED)
//
// monthlyDrawGreen = Σ Contract.monthlyGreenKg
//                    over status IN COMMITTED_CONTRACT_STATUSES
//
// Meaning: "the contractual rate at which green is
// owed per month."
//
// CONFIRMED IN WRITING by the business owner.
// Reasoning recorded in the design docs:
//
//   For v1, this monitor is a Supply & Commitment
//   Health Monitor, not a fulfilment-performance
//   monitor. The load-bearing concept is committed
//   contractual draw, not realized historical outflow.
//   Using contract terms keeps the metric deterministic,
//   auditable, easy to explain, and aligned with the
//   commitmentHealth axis.
//
//   Actual delivery behaviour belongs in fulfilmentHealth,
//   not in monthlyDrawGreen. Under-fulfilment surfaces via
//   fulfilment metrics/detectors, not by changing the
//   meaning of contractual draw.
//
// DO NOT change this definition without explicit
// business-owner sign-off and a MONITOR_VERSION bump.
// =====================================================

export const MONTHLY_DRAW_DEFINITION = "OPTION_A_CONTRACT_TERMS" as const

// =====================================================
// INTENT WINDOW
//
// 7 days, used by INTENT_CONVERSION_DROP detector.
// =====================================================

export const INTENT_WINDOW_DAYS = 7

// =====================================================
// FULFILMENT OVERDUE
//
// ProducerFulfilment has no `expectedAt` field in v1.
// "Overdue" is therefore defined as: still in
// AWAITING_CONFIRMATION more than this many days after
// `createdAt`. Configurable here only.
// =====================================================

export const FULFILMENT_AWAITING_SLA_DAYS = 3

// =====================================================
// ATTRIBUTION CAP
// =====================================================

export const ATTRIBUTION_TOP_N = 10
