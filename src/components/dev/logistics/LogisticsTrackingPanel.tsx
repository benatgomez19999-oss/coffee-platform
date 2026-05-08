"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  DESTINATION_STAGE_LABELS,
  type DestinationStage,
} from "@/src/lib/logistics/destinationTracking"

// ======================================================
// LOGISTICS TRACKING PANEL (LOG-3 / LOG-3B / LOG-3C)
//
// Read-only operational journey visualization:
//   Sample logistics → Export readiness →
//   International + destination shipment → Future ops
//
// LOG-3C polish:
//   - manual Refresh + opt-in Auto-refresh (15s)
//   - filters: hide completed / attention only / shipments only
//   - compact mode for long shipment timelines
//   - shipment timeline grouped into 4 phases:
//     Shipment / Rotterdam / Co-roaster / Client
//   - improved empty states + "Showing X of Y"
//
// Pure presentation. No writes. Builders are pure
// functions feeding the render.
// ======================================================

// ------------------------------------------------------
// EXPORTED PROP TYPES
// ------------------------------------------------------

export type SampleLotStatus =
  | "PENDING"
  | "SAMPLE_REQUESTED"
  | "IN_REVIEW"
  | "VERIFIED"
  | "REJECTED"

export type SampleShippingStatus =
  | "PICKUP_REQUESTED"
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "DELIVERED"

export type GreenLotStatus = "DRAFT" | "PUBLISHED" | "RESERVED" | "SOLD"

export type TrackingShipmentStatus =
  | "IN_TRANSIT"
  | "ARRIVED"
  | "RECEIVED"
  | "DISCREPANCY"

export type TrackingFarm = {
  name: string
  region: string | null
  producer: { name: string; country: string }
}

export type TrackingSampleLot = {
  id: string
  lotNumber: string
  name: string | null
  variety: string
  process: string
  harvestYear: number
  status: SampleLotStatus
  sampleShippingStatus: SampleShippingStatus | null
  createdAt: string
  greenLot: {
    id: string
    status: GreenLotStatus
    scaScore: number | null
    totalKg: number
    availableKg: number
    shipmentId: string | null
    farm: TrackingFarm
    shipment: {
      id: string
      reference: string
      status: string
    } | null
  } | null
}

export type TrackingShipmentLot = {
  id: string
  lotNumber: string
  variety: string
  process: string
  harvestYear: number
  totalKg: number
  availableKg: number
  status: string
  farm: TrackingFarm
}

export type TrackingShipment = {
  id: string
  reference: string
  status: TrackingShipmentStatus
  carrier: string | null
  vesselOrFlight: string | null
  etaAt: string | null
  arrivedAt: string | null
  receivedAt: string | null
  createdAt: string
  greenLots: TrackingShipmentLot[]
  currentStage: DestinationStage | null
  destinationCountry: string | null
  requiresDestinationCustoms: boolean
}

export type LogisticsTrackingPanelProps = {
  sampleLots: TrackingSampleLot[]
  shipments: TrackingShipment[]
  loading?: boolean
  onRefresh?: () => void | Promise<void>
  lastRefreshedAt?: Date | null
}

// ------------------------------------------------------
// VIEW MODEL TYPES
// ------------------------------------------------------

type TrackingStageState =
  | "completed"
  | "current"
  | "pending"
  | "blocked"
  | "attention"

type TrackingStage = {
  id: string
  label: string
  state: TrackingStageState
  detail?: string
}

type TrackingTone = "neutral" | "amber" | "olive" | "red" | "bronze"

type TrackingCardKind = "sample" | "partner_review" | "shipment" | "future"

type ShipmentPhaseId = "shipment" | "rotterdam" | "co-roaster" | "client"

// Phases never use "blocked" — that state belongs to flat
// future-operations stages. Keep this strict so the
// PhaseStateBadge can pattern-match exhaustively.
type PhaseState = "completed" | "current" | "pending" | "attention"

type TrackingPhase = {
  id: ShipmentPhaseId
  label: string
  stages: TrackingStage[]
  state: PhaseState
}

type TrackingCard = {
  id: string
  kind: TrackingCardKind
  title: string
  subtitle: string
  currentStage: string
  tone: TrackingTone
  metadata: { label: string; value: string }[]
  stages: TrackingStage[]
  phases?: TrackingPhase[]
  nextStep: string
  isComplete: boolean
  hasAttention: boolean
}

type TrackingFilterState = {
  hideCompleted: boolean
  attentionOnly: boolean
  shipmentsOnly: boolean
  compactMode: boolean
}

const DEFAULT_FILTERS: TrackingFilterState = {
  hideCompleted: false,
  attentionOnly: false,
  shipmentsOnly: false,
  compactMode: false,
}

const AUTO_REFRESH_INTERVAL_MS = 15_000

// ------------------------------------------------------
// SAMPLE STAGE DEFINITIONS
// ------------------------------------------------------

const SAMPLE_STAGE_IDS = [
  "draft",
  "sample-requested",
  "pickup-scheduled",
  "in-transit",
  "lab-delivered",
  "lab-review",
  "verified",
] as const
type SampleStageId = (typeof SAMPLE_STAGE_IDS)[number]

const SAMPLE_STAGE_LABELS: Record<SampleStageId, string> = {
  "draft":            "Draft created",
  "sample-requested": "Sample requested",
  "pickup-scheduled": "Pickup scheduled",
  "in-transit":       "In transit to lab",
  "lab-delivered":    "Delivered to lab",
  "lab-review":       "Partner review",
  "verified":         "Verified",
}

// ------------------------------------------------------
// EXPORT STAGE DEFINITIONS
// ------------------------------------------------------

const EXPORT_STAGE_IDS = [
  "verified",
  "greenlot-draft",
  "published",
  "reserved",
  "sold",
] as const
type ExportStageId = (typeof EXPORT_STAGE_IDS)[number]

const EXPORT_STAGE_LABELS: Record<ExportStageId, string> = {
  "verified":       "Verified",
  "greenlot-draft": "GreenLot created",
  "published":      "Published to market",
  "reserved":       "Reserved for shipment",
  "sold":           "Sold",
}

// ------------------------------------------------------
// SHIPMENT STAGE DEFINITIONS + PHASE GROUPS
// ------------------------------------------------------

type ShipmentStageId =
  | "shipment-created"
  | "in-transit-rotterdam"
  | DestinationStage

const SHIPMENT_HEAD_LABELS: Record<
  "shipment-created" | "in-transit-rotterdam",
  string
> = {
  "shipment-created":     "Shipment created",
  "in-transit-rotterdam": "In transit to Rotterdam",
}

// Phase definitions are stable. Customs stages within
// the Client phase are filtered at runtime based on
// requiresDestinationCustoms.
const PHASE_DEFINITIONS: ReadonlyArray<{
  id: ShipmentPhaseId
  label: string
  stageIds: readonly ShipmentStageId[]
}> = [
  {
    id: "shipment",
    label: "Shipment",
    stageIds: ["shipment-created", "in-transit-rotterdam"],
  },
  {
    id: "rotterdam",
    label: "Rotterdam / Port",
    stageIds: [
      "ARRIVED_AT_ROTTERDAM_PORT",
      "ROTTERDAM_CUSTOMS_CHECKING",
      "ROTTERDAM_CUSTOMS_CLEARED",
      "TO_PORT_WAREHOUSE",
      "AT_PORT_WAREHOUSE",
      "AWAITING_PORT_WAREHOUSE_PICKUP",
    ],
  },
  {
    id: "co-roaster",
    label: "Co-roaster",
    stageIds: [
      "TO_CO_ROASTER",
      "AT_CO_ROASTER_WAREHOUSE",
      "ROASTING_IN_PROGRESS",
      "FINAL_PACKING_20KG",
      "AWAITING_CO_ROASTER_PICKUP",
    ],
  },
  {
    id: "client",
    label: "Client",
    stageIds: [
      "TO_CLIENT",
      "DESTINATION_CUSTOMS_CHECKING",
      "DESTINATION_CUSTOMS_CLEARED",
      "RECEIVED_BY_CLIENT",
    ],
  },
]

const DESTINATION_CUSTOMS_STAGES: readonly DestinationStage[] = [
  "DESTINATION_CUSTOMS_CHECKING",
  "DESTINATION_CUSTOMS_CLEARED",
]

function getShipmentStageIds(
  requiresDestinationCustoms: boolean
): ShipmentStageId[] {
  return PHASE_DEFINITIONS.flatMap((phase) => {
    if (phase.id !== "client") return phase.stageIds.slice()
    if (requiresDestinationCustoms) return phase.stageIds.slice()
    // Client phase without customs — drop the customs stages
    return phase.stageIds.filter(
      (id) => !(DESTINATION_CUSTOMS_STAGES as readonly string[]).includes(id)
    )
  })
}

function getShipmentStageLabel(id: ShipmentStageId): string {
  if (id === "shipment-created" || id === "in-transit-rotterdam") {
    return SHIPMENT_HEAD_LABELS[id]
  }
  return DESTINATION_STAGE_LABELS[id]
}

// ------------------------------------------------------
// SAMPLE CARDS
// ------------------------------------------------------

function computeSampleCurrentStage(lot: TrackingSampleLot): SampleStageId {
  if (lot.status === "REJECTED")  return "lab-review"
  if (lot.status === "VERIFIED")  return "verified"
  if (lot.status === "IN_REVIEW") return "lab-review"
  if (lot.status === "PENDING")   return "draft"

  switch (lot.sampleShippingStatus) {
    case "PICKUP_REQUESTED": return "sample-requested"
    case "PICKUP_SCHEDULED": return "pickup-scheduled"
    case "IN_TRANSIT":       return "in-transit"
    case "DELIVERED":        return "lab-delivered"
    default:                 return "sample-requested"
  }
}

function buildSampleStages(lot: TrackingSampleLot): TrackingStage[] {
  const currentId = computeSampleCurrentStage(lot)
  const currentIndex = SAMPLE_STAGE_IDS.indexOf(currentId)
  const isAttention = lot.status === "REJECTED"

  return SAMPLE_STAGE_IDS.map((stageId, idx) => {
    const state: TrackingStageState =
      isAttention && idx === currentIndex ? "attention" :
      idx <  currentIndex                 ? "completed" :
      idx === currentIndex                ? "current"   :
                                            "pending"
    return { id: stageId, label: SAMPLE_STAGE_LABELS[stageId], state }
  })
}

function buildSampleNextStep(lot: TrackingSampleLot): string {
  if (lot.status === "REJECTED")        return "Review rejection / create new draft"
  if (lot.status === "VERIFIED")        return "Verified — see export readiness card"
  if (lot.status === "IN_REVIEW")       return "Verify lot"
  if (lot.status === "PENDING")         return "Send sample to lab"
  switch (lot.sampleShippingStatus) {
    case "PICKUP_REQUESTED": return "Schedule pickup"
    case "PICKUP_SCHEDULED": return "Sample in transit"
    case "IN_TRANSIT":       return "Awaiting lab delivery"
    case "DELIVERED":        return "Begin lab review"
    default:                 return "Schedule pickup"
  }
}

function buildSampleMetadata(lot: TrackingSampleLot): { label: string; value: string }[] {
  const meta: { label: string; value: string }[] = [
    { label: "Lot #", value: lot.lotNumber },
    { label: "Status", value: lot.status },
  ]
  if (lot.sampleShippingStatus) {
    meta.push({ label: "Shipping", value: lot.sampleShippingStatus })
  }
  if (lot.greenLot) {
    if (lot.greenLot.farm.region) {
      meta.push({ label: "Region", value: lot.greenLot.farm.region })
    }
    meta.push({
      label: "Producer",
      value: `${lot.greenLot.farm.producer.name} · ${lot.greenLot.farm.producer.country}`,
    })
  }
  return meta
}

function buildSampleCards(lots: TrackingSampleLot[]): TrackingCard[] {
  // Verified lots move to Export Readiness group
  const samplePhase = lots.filter((l) => l.status !== "VERIFIED")

  return samplePhase.map((lot) => {
    const stages = buildSampleStages(lot)
    const isAttention = lot.status === "REJECTED"
    const currentStageId = computeSampleCurrentStage(lot)
    const currentLabel = isAttention
      ? "Rejected"
      : SAMPLE_STAGE_LABELS[currentStageId]

    const tone: TrackingTone = isAttention ? "red" : "amber"

    const subtitle = [lot.variety, lot.process, `Harvest ${lot.harvestYear}`]
      .filter(Boolean)
      .join(" · ")

    return {
      id: `sample-${lot.id}`,
      kind: "sample",
      title: lot.name || lot.lotNumber || "Unnamed lot",
      subtitle,
      currentStage: currentLabel,
      tone,
      metadata: buildSampleMetadata(lot),
      stages,
      nextStep: buildSampleNextStep(lot),
      // REJECTED is terminal but counts as attention, so do not
      // mark it complete (so "Hide completed" doesn't hide it).
      isComplete: false,
      hasAttention: isAttention,
    }
  })
}

// ------------------------------------------------------
// EXPORT READINESS CARDS
// ------------------------------------------------------

function computeExportCurrentStage(
  greenLotStatus: GreenLotStatus
): ExportStageId {
  switch (greenLotStatus) {
    case "DRAFT":     return "greenlot-draft"
    case "PUBLISHED": return "published"
    case "RESERVED":  return "reserved"
    case "SOLD":      return "sold"
  }
}

function buildExportStages(greenLotStatus: GreenLotStatus): TrackingStage[] {
  const currentId = computeExportCurrentStage(greenLotStatus)
  const currentIndex = EXPORT_STAGE_IDS.indexOf(currentId)

  return EXPORT_STAGE_IDS.map((stageId, idx) => {
    const state: TrackingStageState =
      idx <  currentIndex ? "completed" :
      idx === currentIndex ? "current"  :
                             "pending"
    return { id: stageId, label: EXPORT_STAGE_LABELS[stageId], state }
  })
}

function buildExportNextStep(greenLotStatus: GreenLotStatus): string {
  switch (greenLotStatus) {
    case "DRAFT":     return "Publish to market"
    case "PUBLISHED": return "Awaiting shipment assignment"
    case "RESERVED":  return "Tracked under shipment"
    case "SOLD":      return "Cycle complete"
  }
}

function buildExportMetadata(lot: TrackingSampleLot): { label: string; value: string }[] {
  const gl = lot.greenLot
  if (!gl) return []

  const meta: { label: string; value: string }[] = [
    { label: "Lot #", value: lot.lotNumber },
    { label: "GreenLot", value: gl.status },
  ]
  if (gl.scaScore !== null) {
    meta.push({ label: "SCA", value: String(gl.scaScore) })
  }
  meta.push({
    label: "Available",
    value: `${Math.round(gl.availableKg).toLocaleString()} kg`,
  })
  if (gl.farm.region) {
    meta.push({ label: "Region", value: gl.farm.region })
  }
  meta.push({
    label: "Producer",
    value: `${gl.farm.producer.name} · ${gl.farm.producer.country}`,
  })
  if (gl.shipment) {
    meta.push({ label: "Shipment", value: gl.shipment.reference })
  }
  return meta
}

function buildExportReadinessCards(lots: TrackingSampleLot[]): TrackingCard[] {
  const verified = lots.filter(
    (l) => l.status === "VERIFIED" && l.greenLot !== null
  )

  return verified.map((lot) => {
    const gl = lot.greenLot
    if (!gl) return null as never

    const stages = buildExportStages(gl.status)
    const currentLabel = EXPORT_STAGE_LABELS[computeExportCurrentStage(gl.status)]

    const tone: TrackingTone =
      gl.status === "SOLD"     ? "olive"  :
      gl.status === "RESERVED" ? "bronze" :
                                 "amber"

    const subtitle = [lot.variety, lot.process, `Harvest ${lot.harvestYear}`]
      .filter(Boolean)
      .join(" · ")

    return {
      id: `export-${gl.id}`,
      kind: "partner_review",
      title: lot.name || lot.lotNumber || "Unnamed lot",
      subtitle,
      currentStage: currentLabel,
      tone,
      metadata: buildExportMetadata(lot),
      stages,
      nextStep: buildExportNextStep(gl.status),
      isComplete: gl.status === "SOLD",
      hasAttention: false,
    }
  })
}

// ------------------------------------------------------
// SHIPMENT CARDS
// ------------------------------------------------------

function computeShipmentCurrentStageIndex(
  s: TrackingShipment,
  stageIds: ShipmentStageId[]
): number {
  if (s.status === "DISCREPANCY") {
    if (s.currentStage) {
      const idx = stageIds.indexOf(s.currentStage)
      if (idx >= 0) return idx
    }
    return stageIds.indexOf("in-transit-rotterdam")
  }

  if (s.currentStage) {
    const idx = stageIds.indexOf(s.currentStage)
    if (idx >= 0) return idx
  }

  if (s.status === "IN_TRANSIT")  return stageIds.indexOf("in-transit-rotterdam")
  if (s.status === "ARRIVED")     return stageIds.indexOf("ARRIVED_AT_ROTTERDAM_PORT")
  if (s.status === "RECEIVED")    return stageIds.indexOf("RECEIVED_BY_CLIENT")

  return 0
}

function buildShipmentStages(s: TrackingShipment): TrackingStage[] {
  const stageIds = getShipmentStageIds(s.requiresDestinationCustoms)
  const currentIndex = computeShipmentCurrentStageIndex(s, stageIds)
  const isDiscrepancy = s.status === "DISCREPANCY"

  return stageIds.map((stageId, idx) => {
    const baseState: TrackingStageState =
      idx <  currentIndex ? "completed" :
      idx === currentIndex ? "current"  :
                             "pending"

    const state: TrackingStageState =
      isDiscrepancy && idx === currentIndex ? "attention" : baseState

    let detail: string | undefined
    if (stageId === "shipment-created") {
      detail = formatDate(s.createdAt)
    } else if (stageId === "ARRIVED_AT_ROTTERDAM_PORT" && s.arrivedAt) {
      detail = formatDate(s.arrivedAt)
    } else if (stageId === "RECEIVED_BY_CLIENT" && s.receivedAt) {
      detail = formatDate(s.receivedAt)
    }

    return {
      id: stageId,
      label: getShipmentStageLabel(stageId),
      state,
      detail,
    }
  })
}

//////////////////////////////////////////////////////
// 🚢 TRACKING PHASES
//////////////////////////////////////////////////////

function groupStagesIntoPhases(
  stages: TrackingStage[],
  requiresDestinationCustoms: boolean
): TrackingPhase[] {
  return PHASE_DEFINITIONS.map((def) => {
    let phaseStageIds = def.stageIds as readonly string[]

    // Drop customs stages from the Client phase if not required
    if (def.id === "client" && !requiresDestinationCustoms) {
      phaseStageIds = phaseStageIds.filter(
        (id) => !(DESTINATION_CUSTOMS_STAGES as readonly string[]).includes(id)
      )
    }

    const phaseStages = stages.filter((s) =>
      phaseStageIds.includes(s.id)
    )

    if (phaseStages.length === 0) {
      // Defensive — should never happen for the 4 fixed phases
      return null as never
    }

    const allCompleted = phaseStages.every((s) => s.state === "completed")
    const hasCurrent = phaseStages.some((s) => s.state === "current")
    const hasAttention = phaseStages.some((s) => s.state === "attention")

    let state: PhaseState
    if (hasAttention)      state = "attention"
    else if (hasCurrent)   state = "current"
    else if (allCompleted) state = "completed"
    else                   state = "pending"

    return {
      id: def.id,
      label: def.label,
      stages: phaseStages,
      state,
    }
  }).filter((p): p is TrackingPhase => p !== null)
}

function buildShipmentCurrentLabel(s: TrackingShipment): string {
  if (s.status === "DISCREPANCY") return "Discrepancy"

  if (s.currentStage) {
    return DESTINATION_STAGE_LABELS[s.currentStage]
  }

  if (s.status === "IN_TRANSIT") return "In transit to Rotterdam"
  if (s.status === "ARRIVED")    return "Arrived — awaiting stage update"
  if (s.status === "RECEIVED")   return "Received"

  return "—"
}

function buildShipmentNextStep(s: TrackingShipment): string {
  if (s.status === "DISCREPANCY") {
    return "Resolve discrepancy before receiving"
  }

  if (s.currentStage) {
    if (s.currentStage === "RECEIVED_BY_CLIENT") return "Cycle complete"
    if (s.currentStage === "TO_CLIENT") {
      return s.requiresDestinationCustoms
        ? "Awaiting destination customs"
        : "Awaiting client receipt"
    }
    if (s.currentStage === "DESTINATION_CUSTOMS_CHECKING") return "Awaiting destination clearance"
    if (s.currentStage === "DESTINATION_CUSTOMS_CLEARED")  return "Final delivery to client"
    if (s.currentStage === "ROTTERDAM_CUSTOMS_CHECKING")   return "Awaiting Rotterdam clearance"
    if (s.currentStage === "ROASTING_IN_PROGRESS")         return "Final packing"
    return "Advance destination stage"
  }

  if (s.status === "IN_TRANSIT") return "Awaiting Rotterdam arrival"
  if (s.status === "ARRIVED")    return "Begin destination tracking"
  if (s.status === "RECEIVED")   return "Cycle complete"

  return "—"
}

function buildShipmentMetadata(s: TrackingShipment): { label: string; value: string }[] {
  const totalKg = s.greenLots.reduce((sum, l) => sum + (l.totalKg ?? 0), 0)

  const regions = Array.from(
    new Set(
      s.greenLots
        .map((l) => l.farm.region?.trim())
        .filter((r): r is string => Boolean(r))
    )
  )

  const lotNumbers = s.greenLots
    .map((l) => l.lotNumber)
    .filter(Boolean)
    .slice(0, 4)

  const meta: { label: string; value: string }[] = [
    { label: "Carrier",     value: s.carrier ?? "—" },
    { label: "Vessel",      value: s.vesselOrFlight ?? "—" },
    { label: "Destination", value: s.destinationCountry ?? "—" },
    { label: "Customs",     value: s.requiresDestinationCustoms ? "Required" : "Not required" },
    { label: "ETA",         value: formatDate(s.etaAt) },
    { label: "Lots",        value: String(s.greenLots.length) },
    { label: "Total",       value: `${Math.round(totalKg).toLocaleString()} kg` },
  ]

  if (regions.length > 0) {
    meta.push({ label: "Origin", value: regions.slice(0, 3).join(", ") })
  }

  if (s.arrivedAt)  meta.push({ label: "Arrived",  value: formatDate(s.arrivedAt) })
  if (s.receivedAt) meta.push({ label: "Received", value: formatDate(s.receivedAt) })

  if (lotNumbers.length > 0) {
    meta.push({
      label: "Lot #s",
      value:
        lotNumbers.join(", ") +
        (s.greenLots.length > lotNumbers.length
          ? ` +${s.greenLots.length - lotNumbers.length}`
          : ""),
    })
  }

  return meta
}

function buildShipmentTrackingCards(shipments: TrackingShipment[]): TrackingCard[] {
  return shipments.map((s) => {
    const stages = buildShipmentStages(s)
    const phases = groupStagesIntoPhases(stages, s.requiresDestinationCustoms)
    const isDiscrepancy = s.status === "DISCREPANCY"
    const isComplete =
      s.status === "RECEIVED" || s.currentStage === "RECEIVED_BY_CLIENT"

    const tone: TrackingTone =
      isDiscrepancy ? "red"   :
      isComplete    ? "olive" :
                      "amber"

    return {
      id: `shipment-${s.id}`,
      kind: "shipment",
      title: s.reference,
      subtitle: `${s.greenLots.length} lot${s.greenLots.length === 1 ? "" : "s"}`,
      currentStage: buildShipmentCurrentLabel(s),
      tone,
      metadata: buildShipmentMetadata(s),
      stages,
      phases,
      nextStep: buildShipmentNextStep(s),
      isComplete,
      hasAttention: isDiscrepancy,
    }
  })
}

// ------------------------------------------------------
// FUTURE OPERATIONS CARD
// ------------------------------------------------------

function buildFutureCards(): TrackingCard[] {
  const stages: TrackingStage[] = [
    { id: "roast-batch",     label: "RoastBatch creation",   state: "blocked" },
    { id: "roasted-inv",     label: "Roasted inventory",     state: "blocked" },
    { id: "client-dispatch", label: "Client dispatch proof", state: "blocked" },
    { id: "delivery-audit",  label: "Delivery audit",        state: "blocked" },
  ]

  return [
    {
      id: "future-destination",
      kind: "future",
      title: "Future operations",
      subtitle: "Roadmap — not implemented yet",
      currentStage: "Pending implementation",
      tone: "neutral",
      metadata: [
        { label: "RoastBatch",   value: "—" },
        { label: "Roasted inv.", value: "—" },
        { label: "Dispatch",     value: "—" },
        { label: "Audit",        value: "—" },
      ],
      stages,
      nextStep: "—",
      isComplete: false,
      hasAttention: false,
    },
  ]
}

// ------------------------------------------------------
// FILTERS
// ------------------------------------------------------

function passesFilters(
  card: TrackingCard,
  filters: TrackingFilterState
): boolean {
  if (filters.attentionOnly && !card.hasAttention) return false
  if (filters.shipmentsOnly && card.kind !== "shipment") return false
  if (filters.hideCompleted && card.isComplete && !card.hasAttention) return false
  return true
}

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

const CUSTOMS_STAGES: readonly DestinationStage[] = [
  "ROTTERDAM_CUSTOMS_CHECKING",
  "DESTINATION_CUSTOMS_CHECKING",
]

const TRANSIT_STAGES: readonly DestinationStage[] = [
  "TO_PORT_WAREHOUSE",
  "TO_CO_ROASTER",
  "TO_CLIENT",
]

// ======================================================
// RENDER
// ======================================================

export default function LogisticsTrackingPanel({
  sampleLots,
  shipments,
  loading,
  onRefresh,
  lastRefreshedAt,
}: LogisticsTrackingPanelProps) {

  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [filters, setFilters] = useState<TrackingFilterState>(DEFAULT_FILTERS)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false)

  //////////////////////////////////////////////////////
  // 🔁 REFRESH (auto)
  //////////////////////////////////////////////////////

  useEffect(() => {
    if (!autoRefresh || !onRefresh) return
    const id = setInterval(() => {
      void onRefresh()
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [autoRefresh, onRefresh])

  //////////////////////////////////////////////////////
  // CARDS — built from props (memoized)
  //////////////////////////////////////////////////////

  const sampleCards = useMemo(
    () => buildSampleCards(sampleLots),
    [sampleLots]
  )

  const exportCards = useMemo(
    () => buildExportReadinessCards(sampleLots),
    [sampleLots]
  )

  const shipmentCards = useMemo(
    () => buildShipmentTrackingCards(shipments),
    [shipments]
  )

  const futureCards = useMemo(() => buildFutureCards(), [])

  //////////////////////////////////////////////////////
  // 🎚️ FILTERS — applied at render time
  //////////////////////////////////////////////////////

  const filteredSampleCards = useMemo(
    () => sampleCards.filter((c) => passesFilters(c, filters)),
    [sampleCards, filters]
  )
  const filteredExportCards = useMemo(
    () => exportCards.filter((c) => passesFilters(c, filters)),
    [exportCards, filters]
  )
  const filteredShipmentCards = useMemo(
    () => shipmentCards.filter((c) => passesFilters(c, filters)),
    [shipmentCards, filters]
  )
  const filteredFutureCards = useMemo(
    () => futureCards.filter((c) => passesFilters(c, filters)),
    [futureCards, filters]
  )

  //////////////////////////////////////////////////////
  // SUMMARY (always reflects all cards, ignoring filters)
  //////////////////////////////////////////////////////

  const summary = useMemo(() => {
    const activeSamples   = sampleCards.filter((c) => c.tone !== "olive").length
    const activeExports   = exportCards.filter((c) => c.tone !== "olive").length
    const activeShipments = shipmentCards.filter((c) => c.tone !== "olive").length
    const active = activeSamples + activeExports + activeShipments

    const inTransit = shipments.filter(
      (s) =>
        s.status === "IN_TRANSIT" ||
        (s.currentStage !== null &&
          (TRANSIT_STAGES as readonly string[]).includes(s.currentStage))
    ).length

    const customs = shipments.filter(
      (s) =>
        s.currentStage !== null &&
        (CUSTOMS_STAGES as readonly string[]).includes(s.currentStage)
    ).length

    const attention =
      sampleLots.filter((l) => l.status === "REJECTED").length +
      shipments.filter((s) => s.status === "DISCREPANCY").length

    return { active, inTransit, customs, attention }
  }, [sampleCards, exportCards, shipmentCards, shipments, sampleLots])

  //////////////////////////////////////////////////////
  // COUNTS — for "Showing X of Y" + empty-state logic
  //////////////////////////////////////////////////////

  const totalRealCards =
    sampleCards.length + exportCards.length + shipmentCards.length
  const totalAllCards =
    totalRealCards + futureCards.length

  const visibleAllCards =
    filteredSampleCards.length +
    filteredExportCards.length +
    filteredShipmentCards.length +
    filteredFutureCards.length

  const hasAnyRealData = totalRealCards > 0
  const filteredHasAnyRealVisible =
    filteredSampleCards.length +
      filteredExportCards.length +
      filteredShipmentCards.length >
    0

  //////////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////////

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
        Loading tracking data…
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ============================================== */}
      {/* CONTROLS ROW (refresh + filters)               */}
      {/* ============================================== */}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] p-4">

        {/* Refresh row */}
        {onRefresh && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { void onRefresh() }}
              className="rounded-full border border-[#cfb48a] bg-white px-4 py-1.5 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
            >
              🔁 Refresh all
            </button>

            <label className="inline-flex items-center gap-2 text-[12px] text-[#5f472f] cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-[#7a5230]"
              />
              <span>Auto-refresh (15s)</span>
            </label>

            <span className="text-[11px] text-[#9a8b73]">
              {lastRefreshedAt
                ? `Last refreshed: ${formatTime(lastRefreshedAt)}`
                : "Not refreshed yet"}
            </span>
          </div>
        )}

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label="Hide completed"
            active={filters.hideCompleted}
            onClick={() =>
              setFilters((f) => ({ ...f, hideCompleted: !f.hideCompleted }))
            }
          />
          <FilterPill
            label="Attention only"
            active={filters.attentionOnly}
            tone="red"
            onClick={() =>
              setFilters((f) => ({ ...f, attentionOnly: !f.attentionOnly }))
            }
          />
          <FilterPill
            label="Shipments only"
            active={filters.shipmentsOnly}
            onClick={() =>
              setFilters((f) => ({ ...f, shipmentsOnly: !f.shipmentsOnly }))
            }
          />
          <FilterPill
            label="Compact mode"
            active={filters.compactMode}
            onClick={() =>
              setFilters((f) => ({ ...f, compactMode: !f.compactMode }))
            }
          />

          <span className="ml-auto text-[11px] text-[#9a8b73] tabular-nums">
            Showing {visibleAllCards} of {totalAllCards} tracking cards
          </span>
        </div>
      </div>

      {/* ============================================== */}
      {/* SUMMARY ROW                                    */}
      {/* ============================================== */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Active journeys"      value={summary.active}    tone="amber" />
        <SummaryTile label="Shipments in transit" value={summary.inTransit} tone="amber" />
        <SummaryTile
          label="Awaiting customs"
          value={summary.customs}
          tone={summary.customs > 0 ? "bronze" : "neutral"}
        />
        <SummaryTile
          label="Attention items"
          value={summary.attention}
          tone={summary.attention > 0 ? "red" : "neutral"}
        />
      </div>

      {/* ============================================== */}
      {/* EMPTY STATES                                   */}
      {/* ============================================== */}

      {!hasAnyRealData && (
        <EmptyState
          message="No logistics entities yet. Create a producer lot, send it to lab, publish a GreenLot, then seed a shipment."
        />
      )}

      {hasAnyRealData &&
        filters.shipmentsOnly &&
        shipmentCards.length === 0 && (
          <EmptyState
            message="No shipments yet. Use SECTION 4 to seed a test shipment once a GreenLot is published."
          />
        )}

      {hasAnyRealData &&
        !filters.shipmentsOnly &&
        !filteredHasAnyRealVisible && (
          <EmptyState message="No tracking cards match the current filters." />
        )}

      {/* ============================================== */}
      {/* SAMPLE LOGISTICS                               */}
      {/* ============================================== */}

      {filteredSampleCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle
            icon="📋"
            label="Sample logistics"
            count={filteredSampleCards.length}
          />
          <div className="grid gap-4">
            {filteredSampleCards.map((card) => (
              <TimelineCard key={card.id} card={card} compact={false} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* EXPORT READINESS                               */}
      {/* ============================================== */}

      {filteredExportCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle
            icon="🌿"
            label="Export readiness"
            count={filteredExportCards.length}
          />
          <div className="grid gap-4">
            {filteredExportCards.map((card) => (
              <TimelineCard key={card.id} card={card} compact={false} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* INTERNATIONAL + DESTINATION SHIPMENT           */}
      {/* ============================================== */}

      {filteredShipmentCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle
            icon="🚢"
            label="International + destination shipment"
            count={filteredShipmentCards.length}
          />
          <div className="grid gap-4">
            {filteredShipmentCards.map((card) => (
              <TimelineCard
                key={card.id}
                card={card}
                compact={filters.compactMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* FUTURE DESTINATION                             */}
      {/* ============================================== */}

      {filteredFutureCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle icon="🏭" label="Future destination operations" />
          <div className="grid gap-4">
            {filteredFutureCards.map((card) => (
              <TimelineCard key={card.id} card={card} compact={false} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ======================================================
// SUBCOMPONENTS
// ======================================================

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: TrackingTone
}) {
  const cls =
    tone === "olive"  ? "bg-[#f4f8f2] border-[#d3e0cc]" :
    tone === "red"    ? "bg-[#fbf0eb] border-[#e8cdc1]" :
    tone === "amber"  ? "bg-[#fbf7f0] border-[#e6d4a8]" :
    tone === "bronze" ? "bg-[#f7efdf] border-[#cfb48a]" :
                        "bg-[#f7f3ed] border-[#d8cebb]"

  const valueColor =
    tone === "olive"  ? "text-[#3a6b35]" :
    tone === "red"    ? "text-[#8a3a25]" :
    tone === "amber"  ? "text-[#7a5230]" :
    tone === "bronze" ? "text-[#5f472f]" :
                        "text-[#2f2418]"

  return (
    <div className={`rounded-xl border-2 px-4 py-3 ${cls}`}>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-[#9a8b73]">
        {label}
      </div>
      <div className={`mt-0.5 text-[22px] font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  )
}

function SubsectionTitle({
  icon,
  label,
  count,
}: {
  icon: string
  label: string
  count?: number
}) {
  return (
    <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#5f472f]">
      <span className="text-[14px]">{icon}</span>
      {label}
      {typeof count === "number" && (
        <span className="text-[11px] font-normal text-[#9a8b73]">({count})</span>
      )}
      <div className="ml-2 flex-1 h-px bg-[#bfae92]/30" />
    </h3>
  )
}

function FilterPill({
  label,
  active,
  tone,
  onClick,
}: {
  label: string
  active: boolean
  tone?: "red"
  onClick: () => void
}) {
  const activeCls =
    tone === "red"
      ? "bg-[#fbe2da] text-[#8a3a25] border-[#d8a89a]"
      : "bg-[#f7efdf] text-[#5f472f] border-[#cfb48a]"

  const cls = active
    ? activeCls
    : "bg-white text-[#9a8b73] border-[#e2d6bd] hover:text-[#5f472f]"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${cls}`}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
      {message}
    </div>
  )
}

function TimelineCard({
  card,
  compact,
}: {
  card: TrackingCard
  compact: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-5 shadow-[0_4px_14px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-semibold text-[#2f2418]">
            {card.title}
          </h4>
          <p className="mt-0.5 text-[12px] text-[#6b5a45]">{card.subtitle}</p>
        </div>
        <StatusBadge tone={card.tone} label={card.currentStage} />
      </div>

      {/* Timeline — phases for shipments, flat for everything else */}
      {card.phases && card.phases.length > 0 ? (
        <PhaseTimeline phases={card.phases} compact={compact} />
      ) : (
        <Timeline stages={card.stages} />
      )}

      {/* Next step */}
      {card.nextStep && card.nextStep !== "—" && (
        <div className="mt-3 text-[11px] text-[#7a5c2e]">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a8b73] mr-2">
            Next
          </span>
          {card.nextStep}
        </div>
      )}

      {/* Metadata */}
      {card.metadata.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-[#e2d6bd] pt-3 sm:grid-cols-3">
          {card.metadata.map((m, i) => (
            <div key={`${m.label}-${i}`} className="min-w-0">
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-[#9a8b73]">
                {m.label}
              </div>
              <div
                className="truncate text-[12px] text-[#2f2418]"
                title={m.value}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ tone, label }: { tone: TrackingTone; label: string }) {
  const cls =
    tone === "olive"  ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    tone === "amber"  ? "bg-[#f3e9d7] text-[#7a5230] border-[#c4b28e]" :
    tone === "red"    ? "bg-[#fbe2da] text-[#8a3a25] border-[#d8a89a]" :
    tone === "bronze" ? "bg-[#f7efdf] text-[#5f472f] border-[#cfb48a]" :
                        "bg-[#ede4d4] text-[#7a5c2e] border-[#c9b89a]"

  const dotCls =
    tone === "olive"  ? "bg-[#3a6b35]" :
    tone === "amber"  ? "bg-[#c07840]" :
    tone === "red"    ? "bg-[#8a3a25]" :
    tone === "bronze" ? "bg-[#7a5230]" :
                        "bg-[#7a5c2e]"

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  )
}

function Timeline({ stages }: { stages: TrackingStage[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {stages.map((stage, idx) => (
        <li key={stage.id} className="flex items-center gap-1.5">
          <StageChip state={stage.state} label={stage.label} detail={stage.detail} />
          {idx < stages.length - 1 && (
            <span
              className={`h-px w-3 ${
                stage.state === "completed" ? "bg-[#9bb377]" : "bg-[#d8c5a8]"
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

function PhaseTimeline({
  phases,
  compact,
}: {
  phases: TrackingPhase[]
  compact: boolean
}) {
  return (
    <div className="space-y-2">
      {phases.map((phase) => (
        <PhaseBlock key={phase.id} phase={phase} compact={compact} />
      ))}
    </div>
  )
}

function PhaseBlock({
  phase,
  compact,
}: {
  phase: TrackingPhase
  compact: boolean
}) {
  const isCurrentOrAttention =
    phase.state === "current" || phase.state === "attention"

  const completedCount = phase.stages.filter((s) => s.state === "completed").length
  const total = phase.stages.length

  // In compact mode, only the current/attention phase shows full chips.
  // Completed and pending phases collapse to a one-line summary.
  const showFull = !compact || isCurrentOrAttention

  const containerCls =
    phase.state === "attention" ? "border-[#d8a89a] bg-[#fdf3ee]" :
    phase.state === "current"   ? "border-[#cfb48a] bg-[#f7efdf]" :
    phase.state === "completed" ? "border-[#d3e0cc] bg-[#f4f8f2]" :
                                  "border-[#e2d6bd] bg-[#fbf7f0]"

  return (
    <div className={`rounded-lg border ${containerCls} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#7a5c2e] font-semibold">
          {phase.label}
        </span>
        <PhaseStateBadge state={phase.state} completed={completedCount} total={total} />
      </div>

      {showFull ? (
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {phase.stages.map((stage, idx) => (
            <li key={stage.id} className="flex items-center gap-1.5">
              <StageChip
                state={stage.state}
                label={stage.label}
                detail={stage.detail}
              />
              {idx < phase.stages.length - 1 && (
                <span
                  className={`h-px w-3 ${
                    stage.state === "completed"
                      ? "bg-[#9bb377]"
                      : "bg-[#d8c5a8]"
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-[11px] text-[#7b6851]">
          {phase.state === "completed"
            ? `All ${total} stage${total === 1 ? "" : "s"} completed`
            : `${total} stage${total === 1 ? "" : "s"} pending`}
        </div>
      )}
    </div>
  )
}

function PhaseStateBadge({
  state,
  completed,
  total,
}: {
  state: PhaseState
  completed: number
  total: number
}) {
  if (state === "attention") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fbe2da] text-[#8a3a25] border border-[#d8a89a] px-2 py-0.5 text-[10px] font-medium">
        ⚠ Attention
      </span>
    )
  }

  if (state === "current") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white text-[#7a5230] border border-[#cfb48a] px-2 py-0.5 text-[10px] font-medium tabular-nums">
        ● Current · {completed}/{total}
      </span>
    )
  }

  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f0e6] text-[#3a6b35] border border-[#b7cbb0] px-2 py-0.5 text-[10px] font-medium">
        ✓ Completed
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f0e6] text-[#a89574] border border-[#e2d6bd] px-2 py-0.5 text-[10px] font-medium">
      ○ Pending
    </span>
  )
}

function StageChip({
  state,
  label,
  detail,
}: {
  state: TrackingStageState
  label: string
  detail?: string
}) {
  const cls =
    state === "completed" ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    state === "current"   ? "bg-[#f7efdf] text-[#7a5230] border-[#cfb48a] shadow-[0_2px_8px_rgba(122,82,48,0.15)]" :
    state === "attention" ? "bg-[#fbe2da] text-[#8a3a25] border-[#d8a89a]" :
    state === "blocked"   ? "bg-[#f0ecdf] text-[#9a8b73] border-[#d8c5a8]" :
                            "bg-[#f5f0e6] text-[#a89574] border-[#e2d6bd]"

  const icon =
    state === "completed" ? "✓" :
    state === "current"   ? "●" :
    state === "attention" ? "⚠" :
    state === "blocked"   ? "🔒" :
                            "○"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}
      title={detail}
    >
      <span className="font-mono">{icon}</span>
      {label}
      {detail && (
        <span className="text-[9.5px] text-[#9a8b73] ml-0.5 tabular-nums">
          {detail}
        </span>
      )}
    </span>
  )
}
