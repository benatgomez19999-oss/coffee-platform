"use client"

import React, { useMemo } from "react"
import {
  DESTINATION_STAGE_LABELS,
  type DestinationStage,
} from "@/src/lib/logistics/destinationTracking"

// ======================================================
// LOGISTICS TRACKING PANEL (LOG-3 / LOG-3B)
//
// Read-only visualization of the operational journey:
//
//   Sample logistics
//     → Export readiness  (verified GreenLots)
//     → International + Destination shipment
//     → Future destination operations (placeholder)
//
// LOG-3B extends LOG-3 with:
//   - separate "Export Readiness" card group
//   - full LOG-3A destination stage flow on Shipment
//     cards, with conditional customs steps
//   - "Awaiting customs" summary metric
//
// No writes. Pure presentation. Builders are pure
// functions feeding the render.
// ======================================================

// ------------------------------------------------------
// EXPORTED PROP TYPES
// (page.tsx uses these to type the fetch response)
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
  // LOG-3A — destination tracking
  currentStage: DestinationStage | null
  destinationCountry: string | null
  requiresDestinationCustoms: boolean
}

export type LogisticsTrackingPanelProps = {
  sampleLots: TrackingSampleLot[]
  shipments: TrackingShipment[]
  loading?: boolean
}

// ------------------------------------------------------
// INTERNAL VIEW MODEL
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

type TrackingCard = {
  id: string
  kind: TrackingCardKind
  title: string
  subtitle: string
  currentStage: string
  tone: TrackingTone
  metadata: { label: string; value: string }[]
  stages: TrackingStage[]
  nextStep: string
}

// ------------------------------------------------------
// STAGE DEFINITIONS — sample journey
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
// STAGE DEFINITIONS — export readiness (post-verification)
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
// STAGE DEFINITIONS — shipment journey
// (head + destination flow, customs is conditional)
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

const DESTINATION_FLOW_BASE: readonly DestinationStage[] = [
  "ARRIVED_AT_ROTTERDAM_PORT",
  "ROTTERDAM_CUSTOMS_CHECKING",
  "ROTTERDAM_CUSTOMS_CLEARED",
  "TO_PORT_WAREHOUSE",
  "AT_PORT_WAREHOUSE",
  "AWAITING_PORT_WAREHOUSE_PICKUP",
  "TO_CO_ROASTER",
  "AT_CO_ROASTER_WAREHOUSE",
  "ROASTING_IN_PROGRESS",
  "FINAL_PACKING_20KG",
  "AWAITING_CO_ROASTER_PICKUP",
  "TO_CLIENT",
]

const DESTINATION_CUSTOMS_STAGES: readonly DestinationStage[] = [
  "DESTINATION_CUSTOMS_CHECKING",
  "DESTINATION_CUSTOMS_CLEARED",
]

function getShipmentStageIds(
  requiresDestinationCustoms: boolean
): ShipmentStageId[] {
  return [
    "shipment-created",
    "in-transit-rotterdam",
    ...DESTINATION_FLOW_BASE,
    ...(requiresDestinationCustoms ? DESTINATION_CUSTOMS_STAGES : []),
    "RECEIVED_BY_CLIENT",
  ]
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
  // SAMPLE_REQUESTED variants
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
  // LOG-3B: Verified lots move to the Export Readiness group.
  // They no longer clutter the Sample Logistics group.
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
    }
  })
}

// ------------------------------------------------------
// EXPORT READINESS CARDS  (LOG-3B)
// Built from VERIFIED sample lots that have a GreenLot.
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
    // greenLot is non-null by filter; assert for TS happiness via local narrow
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
    }
  })
}

// ------------------------------------------------------
// SHIPMENT CARDS  (LOG-3B — full destination flow)
// ------------------------------------------------------

function isDestinationStageId(
  id: ShipmentStageId
): id is DestinationStage {
  return id !== "shipment-created" && id !== "in-transit-rotterdam"
}

function computeShipmentCurrentStageIndex(
  s: TrackingShipment,
  stageIds: ShipmentStageId[]
): number {
  // Discrepancy: paint the in-transit-rotterdam slot as the locus
  // of attention (or current stage if known)
  if (s.status === "DISCREPANCY") {
    if (s.currentStage) {
      const idx = stageIds.indexOf(s.currentStage)
      if (idx >= 0) return idx
    }
    return stageIds.indexOf("in-transit-rotterdam")
  }

  // currentStage drives the timeline once destination tracking starts
  if (s.currentStage) {
    const idx = stageIds.indexOf(s.currentStage)
    if (idx >= 0) return idx
  }

  // No currentStage yet — derive from macro status
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

  // Use current stage to propose the next operational step
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
      nextStep: buildShipmentNextStep(s),
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
    },
  ]
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
}: LogisticsTrackingPanelProps) {

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

  // ----------------------------------------------------
  // Summary metrics
  // ----------------------------------------------------

  const summary = useMemo(() => {
    // Active = entities still progressing (not olive-tone)
    const activeSamples  = sampleCards.filter((c) => c.tone !== "olive").length
    const activeExports  = exportCards.filter((c) => c.tone !== "olive").length
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
        Loading tracking data…
      </div>
    )
  }

  const hasContent =
    sampleCards.length > 0 ||
    exportCards.length > 0 ||
    shipmentCards.length > 0

  return (
    <div className="space-y-6">

      {/* ============================================== */}
      {/* SUMMARY ROW                                    */}
      {/* ============================================== */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Active journeys"      value={summary.active}    tone="amber" />
        <SummaryTile label="Shipments in transit" value={summary.inTransit} tone="amber" />
        <SummaryTile label="Awaiting customs"     value={summary.customs}   tone={summary.customs > 0 ? "bronze" : "neutral"} />
        <SummaryTile label="Attention items"      value={summary.attention} tone={summary.attention > 0 ? "red" : "neutral"} />
      </div>

      {/* ============================================== */}
      {/* EMPTY STATE                                    */}
      {/* ============================================== */}

      {!hasContent && (
        <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
          No logistics entities yet. Create a producer lot, send it to lab,
          publish a GreenLot, then seed a shipment.
        </div>
      )}

      {/* ============================================== */}
      {/* SAMPLE LOGISTICS                               */}
      {/* ============================================== */}

      {sampleCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle icon="📋" label="Sample logistics" count={sampleCards.length} />
          <div className="grid gap-4">
            {sampleCards.map((card) => (
              <TimelineCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* EXPORT READINESS                               */}
      {/* ============================================== */}

      {exportCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle icon="🌿" label="Export readiness" count={exportCards.length} />
          <div className="grid gap-4">
            {exportCards.map((card) => (
              <TimelineCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* INTERNATIONAL + DESTINATION SHIPMENT           */}
      {/* ============================================== */}

      {shipmentCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle
            icon="🚢"
            label="International + destination shipment"
            count={shipmentCards.length}
          />
          <div className="grid gap-4">
            {shipmentCards.map((card) => (
              <TimelineCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* FUTURE DESTINATION                             */}
      {/* ============================================== */}

      <div className="space-y-3">
        <SubsectionTitle icon="🏭" label="Future destination operations" />
        <div className="grid gap-4">
          {futureCards.map((card) => (
            <TimelineCard key={card.id} card={card} />
          ))}
        </div>
      </div>

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

function TimelineCard({ card }: { card: TrackingCard }) {
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

      {/* Timeline */}
      <Timeline stages={card.stages} />

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
