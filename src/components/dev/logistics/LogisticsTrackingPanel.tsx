"use client"

import React, { useMemo } from "react"

// ======================================================
// LOGISTICS TRACKING PANEL (LOG-3)
//
// Read-only visualization of the operational journey
// from origin sample movement to EU receipt, plus a
// locked placeholder for future destination operations.
//
// No writes. No mutations. No carrier integrations.
// Pure presentation — fed by the props.
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
  timestamp?: string | null
}

type TrackingTone = "neutral" | "amber" | "olive" | "red"

type TrackingCard = {
  id: string
  title: string
  subtitle: string
  kind: "sample" | "shipment" | "future"
  currentStage: string
  statusTone: TrackingTone
  metadata: { label: string; value: string }[]
  stages: TrackingStage[]
}

// ------------------------------------------------------
// STAGE DEFINITIONS
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
  "draft":            "Draft",
  "sample-requested": "Sample requested",
  "pickup-scheduled": "Pickup scheduled",
  "in-transit":       "In transit",
  "lab-delivered":    "Lab delivered",
  "lab-review":       "Lab review",
  "verified":         "Verified",
}

const SHIPMENT_STAGE_IDS = ["created", "arrived", "received"] as const
type ShipmentStageId = (typeof SHIPMENT_STAGE_IDS)[number]

const SHIPMENT_STAGE_LABELS: Record<ShipmentStageId, string> = {
  "created":  "Ocean / air transit",
  "arrived":  "European port arrival",
  "received": "EU warehouse received",
}

// ------------------------------------------------------
// CARD BUILDERS — pure functions
// ------------------------------------------------------

function computeSampleCurrentStage(lot: TrackingSampleLot): SampleStageId {
  // REJECTED is treated as attention on the lab-review stage
  if (lot.status === "REJECTED")  return "lab-review"
  if (lot.status === "VERIFIED")  return "verified"
  if (lot.status === "IN_REVIEW") return "lab-review"
  if (lot.status === "PENDING")   return "draft"

  // SAMPLE_REQUESTED → look at sampleShippingStatus
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

function buildSampleMetadata(lot: TrackingSampleLot): { label: string; value: string }[] {
  const meta: { label: string; value: string }[] = [
    { label: "Lot #", value: lot.lotNumber },
    { label: "Status", value: lot.status },
  ]

  if (lot.sampleShippingStatus) {
    meta.push({ label: "Shipping", value: lot.sampleShippingStatus })
  }

  if (lot.greenLot) {
    meta.push({ label: "GreenLot", value: lot.greenLot.status })
    if (lot.greenLot.scaScore !== null) {
      meta.push({ label: "SCA", value: String(lot.greenLot.scaScore) })
    }
    if (lot.greenLot.farm.region) {
      meta.push({ label: "Region", value: lot.greenLot.farm.region })
    }
    meta.push({
      label: "Producer",
      value: `${lot.greenLot.farm.producer.name} · ${lot.greenLot.farm.producer.country}`,
    })
    if (lot.greenLot.shipment) {
      meta.push({ label: "Shipment", value: lot.greenLot.shipment.reference })
    }
  }

  return meta
}

function buildSampleTrackingCards(lots: TrackingSampleLot[]): TrackingCard[] {
  return lots.map((lot) => {
    const stages = buildSampleStages(lot)
    const isAttention = lot.status === "REJECTED"
    const isVerified = lot.status === "VERIFIED"

    const currentStageId = computeSampleCurrentStage(lot)
    const currentLabel = isAttention
      ? "Rejected"
      : SAMPLE_STAGE_LABELS[currentStageId]

    const statusTone: TrackingTone = isAttention
      ? "red"
      : isVerified
        ? "olive"
        : "amber"

    const subtitleParts = [lot.variety, lot.process, `Harvest ${lot.harvestYear}`]
      .filter(Boolean)
      .join(" · ")

    return {
      id: `sample-${lot.id}`,
      title: lot.name || lot.lotNumber || "Unnamed lot",
      subtitle: subtitleParts,
      kind: "sample",
      currentStage: currentLabel,
      statusTone,
      metadata: buildSampleMetadata(lot),
      stages,
    }
  })
}

function buildShipmentStages(s: TrackingShipment): TrackingStage[] {
  const isDiscrepancy = s.status === "DISCREPANCY"
  const currentIndex =
    s.status === "RECEIVED" ? 2 :
    s.status === "ARRIVED"  ? 1 :
                              0

  return SHIPMENT_STAGE_IDS.map((stageId, idx) => {
    const baseState: TrackingStageState =
      idx <  currentIndex ? "completed" :
      idx === currentIndex ? "current"  :
                             "pending"

    const state: TrackingStageState =
      isDiscrepancy && idx === currentIndex ? "attention" : baseState

    let timestamp: string | null = null
    if (stageId === "created")  timestamp = s.createdAt
    if (stageId === "arrived")  timestamp = s.arrivedAt
    if (stageId === "received") timestamp = s.receivedAt

    return { id: stageId, label: SHIPMENT_STAGE_LABELS[stageId], state, timestamp }
  })
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
    { label: "Carrier", value: s.carrier ?? "—" },
    { label: "Vessel",  value: s.vesselOrFlight ?? "—" },
    { label: "ETA",     value: formatDate(s.etaAt) },
    { label: "Lots",    value: String(s.greenLots.length) },
    { label: "Total",   value: `${Math.round(totalKg).toLocaleString()} kg` },
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
        (s.greenLots.length > lotNumbers.length ? ` +${s.greenLots.length - lotNumbers.length}` : ""),
    })
  }

  return meta
}

function buildShipmentTrackingCards(shipments: TrackingShipment[]): TrackingCard[] {
  return shipments.map((s) => {
    const stages = buildShipmentStages(s)
    const isDiscrepancy = s.status === "DISCREPANCY"
    const isReceived = s.status === "RECEIVED"

    const currentLabel =
      isDiscrepancy                ? "Discrepancy / attention" :
      s.status === "RECEIVED"      ? SHIPMENT_STAGE_LABELS["received"] :
      s.status === "ARRIVED"       ? SHIPMENT_STAGE_LABELS["arrived"] :
                                     SHIPMENT_STAGE_LABELS["created"]

    const statusTone: TrackingTone =
      isDiscrepancy ? "red"   :
      isReceived    ? "olive" :
                      "amber"

    return {
      id: `shipment-${s.id}`,
      title: s.reference,
      subtitle: `${s.greenLots.length} lot${s.greenLots.length === 1 ? "" : "s"}`,
      kind: "shipment",
      currentStage: currentLabel,
      statusTone,
      metadata: buildShipmentMetadata(s),
      stages,
    }
  })
}

function buildFutureTrackingCards(): TrackingCard[] {
  const stages: TrackingStage[] = [
    { id: "warehouse",       label: "Warehouse intake",   state: "blocked" },
    { id: "roast-queue",     label: "Roast queue",        state: "blocked" },
    { id: "roasted-inv",     label: "Roasted inventory",  state: "blocked" },
    { id: "client-dispatch", label: "Client dispatch",    state: "blocked" },
  ]

  return [
    {
      id: "future-destination",
      title: "Destination operations",
      subtitle: "Roadmap — not implemented yet",
      kind: "future",
      currentStage: "Pending implementation",
      statusTone: "neutral",
      metadata: [
        { label: "Warehouse",    value: "—" },
        { label: "Roast queue",  value: "—" },
        { label: "Inventory",    value: "—" },
        { label: "Dispatch",     value: "—" },
      ],
      stages,
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

// ======================================================
// RENDER
// ======================================================

export default function LogisticsTrackingPanel({
  sampleLots,
  shipments,
  loading,
}: LogisticsTrackingPanelProps) {

  const sampleCards = useMemo(
    () => buildSampleTrackingCards(sampleLots),
    [sampleLots]
  )
  const shipmentCards = useMemo(
    () => buildShipmentTrackingCards(shipments),
    [shipments]
  )
  const futureCards = useMemo(() => buildFutureTrackingCards(), [])

  const summary = useMemo(() => {
    const sampleJourneys = sampleLots.length
    const inTransit = shipments.filter((s) => s.status === "IN_TRANSIT").length
    const received  = shipments.filter((s) => s.status === "RECEIVED").length
    const attention =
      sampleLots.filter((l) => l.status === "REJECTED").length +
      shipments.filter((s) => s.status === "DISCREPANCY").length
    return { sampleJourneys, inTransit, received, attention }
  }, [sampleLots, shipments])

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
        Loading tracking data…
      </div>
    )
  }

  const hasContent = sampleCards.length > 0 || shipmentCards.length > 0

  return (
    <div className="space-y-6">

      {/* ============================================== */}
      {/* SUMMARY ROW                                    */}
      {/* ============================================== */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Sample journeys"        value={summary.sampleJourneys} tone="amber"   />
        <SummaryTile label="Shipments in transit"   value={summary.inTransit}      tone="amber"   />
        <SummaryTile label="Shipments received"     value={summary.received}       tone="olive"   />
        <SummaryTile label="Attention items"        value={summary.attention}      tone={summary.attention > 0 ? "red" : "neutral"} />
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
      {/* INTERNATIONAL SHIPMENT                         */}
      {/* ============================================== */}

      {shipmentCards.length > 0 && (
        <div className="space-y-3">
          <SubsectionTitle icon="🚢" label="International shipments" count={shipmentCards.length} />
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
    tone === "olive" ? "bg-[#f4f8f2] border-[#d3e0cc]" :
    tone === "red"   ? "bg-[#fbf0eb] border-[#e8cdc1]" :
    tone === "amber" ? "bg-[#fbf7f0] border-[#e6d4a8]" :
                       "bg-[#f7f3ed] border-[#d8cebb]"

  const valueColor =
    tone === "olive" ? "text-[#3a6b35]" :
    tone === "red"   ? "text-[#8a3a25]" :
    tone === "amber" ? "text-[#7a5230]" :
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
        <StatusBadge tone={card.statusTone} label={card.currentStage} />
      </div>

      {/* Timeline */}
      <Timeline stages={card.stages} />

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
    tone === "olive" ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    tone === "amber" ? "bg-[#f3e9d7] text-[#7a5230] border-[#c4b28e]" :
    tone === "red"   ? "bg-[#fbe2da] text-[#8a3a25] border-[#d8a89a]" :
                       "bg-[#ede4d4] text-[#7a5c2e] border-[#c9b89a]"

  const dotCls =
    tone === "olive" ? "bg-[#3a6b35]" :
    tone === "amber" ? "bg-[#c07840]" :
    tone === "red"   ? "bg-[#8a3a25]" :
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
          <StageChip state={stage.state} label={stage.label} />
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
}: {
  state: TrackingStageState
  label: string
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
    >
      <span className="font-mono">{icon}</span>
      {label}
    </span>
  )
}
