"use client"

import React, { useEffect, useMemo, useState } from "react"
import PlatformHeader from "@/src/components/shared/general/PlatformHeader"
import RoastControlPanel from "@/src/components/platform/eu-partner/RoastControlPanel"

// ======================================================
// EUROPE PARTNER DASHBOARD — ALTURA COLLECTIVE
//
// Internal operational tooling for EU destination
// partners / co-roasters. Renders the operational
// command-center: incoming green, roast queue, roasted
// inventory, market intelligence, capacity, alerts.
//
// UI-only · mock operational data · no API calls.
// Header is the shared platform header (role-aware).
// ======================================================

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------

type DashboardUser = {
  name?: string | null
  email?: string | null
  role?: string | null
  onboardingCompleted?: boolean | null
} | null | undefined

type Tone = "ok" | "warn" | "alert" | "info"

type Metric = {
  id: string
  value: string | number
  label: string
  sublabel: string
  icon: React.ReactNode
  tone: Tone
}

type IncomingLine = {
  id: string
  count: number
  primary: string
  secondary: string
}

type FeaturedShipment = {
  origin: string
  lotLabel: string
  variety: string
  status: string
}

type ReadyHighlight = {
  name: string
  origin: string
  lotLabel: string
  process: string
  kg: number
  status: "Ready" | "Allocated" | "Reserved"
}

type SignalRow = {
  id: string
  label: string
  state: string
  tone: Tone
  icon: React.ReactNode
}

type CapacityHour = {
  label: string
  segments: { color: string; height: number }[]
  peakLabel?: string
}

type ActivityItem = {
  id: string
  text: string
  time: string
  tone: Tone
  icon: React.ReactNode
}

type AlertItem = {
  id: string
  title: string
  detail: string
  tone: "warn" | "alert" | "info"
  icon: React.ReactNode
}

// ------------------------------------------------------
// SHIPMENT TYPES (LOG-1 — wired to /api/eu-partner/shipments)
// ------------------------------------------------------

type ShipmentStatus = "IN_TRANSIT" | "ARRIVED" | "RECEIVED" | "DISCREPANCY"

type ShipmentGreenLot = {
  id: string
  lotNumber: string
  variety: string
  process: string
  harvestYear: number
  totalKg: number
  availableKg: number
  status: string
  farm: {
    name: string
    region: string | null
    producer: {
      name: string
      country: string
    }
  }
}

type EuropeShipment = {
  id: string
  reference: string
  status: ShipmentStatus
  carrier: string | null
  vesselOrFlight: string | null
  etaAt: string | null
  arrivedAt: string | null
  receivedAt: string | null
  createdAt: string
  greenLots: ShipmentGreenLot[]
  // LOG-3A — destination tracking (optional in payload)
  currentStage?: string | null
  destinationCountry?: string | null
  requiresDestinationCustoms?: boolean
}

// ------------------------------------------------------
// PALETTE — single source of truth for the dark theme
// ------------------------------------------------------

const T = {
  bgRoot:        "#0a0604",
  bgVignette1:   "rgba(214,176,79,0.045)",
  bgVignette2:   "rgba(192,133,82,0.025)",

  cardBg:        "linear-gradient(180deg, rgba(40,28,18,0.55) 0%, rgba(22,15,9,0.65) 100%)",
  cardBorder:    "rgba(212,175,55,0.14)",
  cardBorderHv:  "rgba(212,175,55,0.28)",
  cardInnerLine: "rgba(255,255,255,0.04)",
  cardShadow:    "0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
  cardShadowHv:  "0 18px 42px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 28px rgba(212,175,55,0.06)",

  text:        "#f0e8d8",
  textMuted:   "rgba(240,232,216,0.62)",
  textFaint:   "rgba(240,232,216,0.38)",
  textHair:    "rgba(240,232,216,0.22)",

  gold:        "#d4af37",
  goldStrong:  "#f3d27a",
  goldFaint:   "rgba(212,175,55,0.10)",
  bronze:      "#c08552",
  bronzeSoft:  "rgba(192,133,82,0.45)",

  olive:       "#9bb377",
  amber:       "#e0a85a",
  crimson:     "#c4715e",
  divider:     "rgba(255,255,255,0.05)",
}

// ------------------------------------------------------
// MOCK DATA — operationally believable
// ------------------------------------------------------

const METRICS: Metric[] = [
  { id: "incoming",   value: 3,  label: "Incoming Shipments",  sublabel: "In transit to warehouse", tone: "info",  icon: <IconTruck /> },
  { id: "queues",     value: 2,  label: "Roast Queues",        sublabel: "Scheduled today",         tone: "warn",  icon: <IconFlame /> },
  { id: "qc-hold",    value: 1,  label: "QC Hold",             sublabel: "Requires attention",      tone: "alert", icon: <IconShield /> },
  { id: "ready",      value: 12, label: "Ready for Dispatch",  sublabel: "Available lots",          tone: "ok",    icon: <IconCheck /> },
  { id: "allocations",value: 4,  label: "Client Allocations",  sublabel: "Active contracts",        tone: "info",  icon: <IconUsers /> },
  { id: "alerts",     value: 2,  label: "Fulfilment Alerts",   sublabel: "Action required",         tone: "warn",  icon: <IconAlert /> },
]

const INCOMING_LINES: IncomingLine[] = [
  { id: "in-1", count: 2, primary: "Containers in transit", secondary: "ETA 3–5 days" },
  { id: "in-2", count: 1, primary: "Arriving this week",    secondary: "Awaiting customs" },
  { id: "in-3", count: 3, primary: "Pending intake",        secondary: "At warehouse" },
]

const INCOMING_FEATURED: FeaturedShipment = {
  origin:   "LA ESTRELLA Harvest 2026",
  lotLabel: "COLOMBIA · Lot 12A · Bourbon",
  variety:  "",
  status:   "In Transit",
}

const READY_HIGHLIGHT: ReadyHighlight = {
  name:     "Emerald Espresso",
  origin:   "Brazil",
  lotLabel: "Lot 5",
  process:  "Natural",
  kg:       5200,
  status:   "Ready",
}

const READY_TOTALS = {
  lotsReady:        12,
  totalAvailableKg: 42350,
  allocatedKg:      28700,
  unallocatedKg:    13650,
}

const MARKET_SIGNALS: SignalRow[] = [
  { id: "sup-pressure",   label: "Supply Pressure",                state: "Medium",   tone: "warn",  icon: <IconWave /> },
  { id: "freight",        label: "Atlantic Freight Stress",        state: "Elevated", tone: "warn",  icon: <IconShip /> },
  { id: "brazil-vol",     label: "Brazil Volatility",              state: "Stable",   tone: "ok",    icon: <IconLeaf /> },
  { id: "capacity",       label: "Roast Capacity Utilization",     state: "81%",      tone: "info",  icon: <IconRing /> },
  { id: "fulfilment",     label: "Contract Fulfilment Confidence", state: "High",     tone: "ok",    icon: <IconHandshake /> },
]

const OVERALL_SCORE = 73

const CAPACITY_HOURS: CapacityHour[] = [
  // Heights are % of total chart area (max ≈ 95). Stacked bottom-up.
  { label: "6 AM",  segments: [{ color: T.olive,   height: 28 }, { color: T.gold,    height: 14 }, { color: T.bronze, height: 8 }] },
  { label: "9 AM",  segments: [{ color: T.olive,   height: 30 }, { color: T.gold,    height: 22 }, { color: T.bronze, height: 23 }] },
  { label: "12 PM", segments: [{ color: T.olive,   height: 30 }, { color: T.gold,    height: 25 }, { color: T.bronze, height: 20 }, { color: T.crimson, height: 6 }], peakLabel: "81%" },
  { label: "3 PM",  segments: [{ color: T.olive,   height: 28 }, { color: T.gold,    height: 22 }, { color: T.bronze, height: 20 }] },
  { label: "6 PM",  segments: [{ color: T.olive,   height: 22 }, { color: T.gold,    height: 18 }, { color: T.bronze, height: 17 }] },
  { label: "9 PM",  segments: [{ color: T.olive,   height: 16 }, { color: T.gold,    height: 8  }, { color: T.bronze, height: 6 }] },
]

const ACTIVITY: ActivityItem[] = [
  { id: "act-1", text: "Container arrived at port",   time: "2h ago",  tone: "ok",    icon: <IconShip /> },
  { id: "act-2", text: "Lot 12A cleared customs",     time: "5h ago",  tone: "ok",    icon: <IconDoc /> },
  { id: "act-3", text: "Roast completed: Lot 8",      time: "7h ago",  tone: "info",  icon: <IconFlame /> },
  { id: "act-4", text: "Dispatch prepared: Lot 3",    time: "1d ago",  tone: "ok",    icon: <IconTruck /> },
]

const ALERTS: AlertItem[] = [
  { id: "alt-1", title: "QC Hold: Moisture deviation", detail: "Lot 9 · Colombia",          tone: "alert", icon: <IconShield /> },
  { id: "alt-2", title: "Low stock forecast",          detail: "Brazil Natural · 7 days",   tone: "warn",  icon: <IconWave /> },
  { id: "alt-3", title: "Shipment delay risk",         detail: "Container MSKU 1234567",    tone: "warn",  icon: <IconAlert /> },
]

const MINI_SPARKLINE = [62, 64, 60, 66, 65, 68, 70, 67, 72, 71, 74, 73]

// ------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------

export default function EuropePartnerDashboard({ user }: { user?: DashboardUser } = {}) {

  const safeUser = user ?? {
    role: "EU_PARTNER",
    onboardingCompleted: true,
    name: "aura-roast-partners",
  }

  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [shipments, setShipments] = useState<EuropeShipment[]>([])
  const [isLoadingShipments, setIsLoadingShipments] = useState<boolean>(true)
  const [shipmentsError, setShipmentsError] = useState<string | null>(null)
  const [receivingId, setReceivingId] = useState<string | null>(null)

  //////////////////////////////////////////////////////
  // 🚢 SHIPMENT DATA
  //////////////////////////////////////////////////////

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoadingShipments(true)
        setShipmentsError(null)

        const res = await fetch("/api/eu-partner/shipments", {
          credentials: "include",
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`)
        }

        const data = (await res.json()) as { shipments?: EuropeShipment[] }

        if (cancelled) return

        setShipments(Array.isArray(data.shipments) ? data.shipments : [])
      } catch (err) {
        if (cancelled) return
        console.error("[EU_PARTNER_SHIPMENTS_FETCH]", err)
        setShipmentsError("Could not load incoming shipments")
        setShipments([])
      } finally {
        if (!cancelled) setIsLoadingShipments(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  //////////////////////////////////////////////////////
  // 🎛️ ACTIONS
  //////////////////////////////////////////////////////

  const handleReceiveShipment = async (shipmentId: string) => {
    if (receivingId) return

    setReceivingId(shipmentId)

    try {
      const res = await fetch(
        `/api/eu-partner/shipments/${shipmentId}/receive`,
        { method: "POST", credentials: "include" }
      )

      if (!res.ok) {
        throw new Error(`Receive failed (${res.status})`)
      }

      const data = (await res.json()) as {
        shipment: { id: string; status: ShipmentStatus; receivedAt: string | null }
      }

      setShipments((prev) =>
        prev.map((s) =>
          s.id === data.shipment.id
            ? { ...s, status: data.shipment.status, receivedAt: data.shipment.receivedAt }
            : s
        )
      )
    } catch (err) {
      console.error("[EU_PARTNER_SHIPMENT_RECEIVE]", err)
      setShipmentsError("Could not mark shipment as received")
    } finally {
      setReceivingId(null)
    }
  }

  //////////////////////////////////////////////////////
  // 📊 LIVE METRICS — only the "Incoming Shipments"
  // metric is computed from real data. The rest stays
  // visual/mock for this sprint.
  //////////////////////////////////////////////////////

  const liveMetrics = useMemo(() => {
    const incomingCount = shipments.filter(
      (s) => s.status === "IN_TRANSIT" || s.status === "ARRIVED"
    ).length

    return METRICS.map((m) =>
      m.id === "incoming" ? { ...m, value: incomingCount } : m
    )
  }, [shipments])

  return (
    <>
      {/* ====================================================== */}
      {/* SHARED PLATFORM HEADER                                 */}
      {/* ====================================================== */}

      <PlatformHeader user={safeUser} assistantContext="partner-dashboard" />

      {/* ====================================================== */}
      {/* DASHBOARD SHELL                                        */}
      {/* ====================================================== */}

      <div
        style={{
          minHeight: "100vh",
          paddingTop: "94px",
          paddingBottom: "64px",
          background: `
            radial-gradient(ellipse 1100px 600px at 12% 0%, ${T.bgVignette1}, transparent 60%),
            radial-gradient(ellipse 900px 500px at 100% 30%, ${T.bgVignette2}, transparent 65%),
            ${T.bgRoot}
          `,
          color: T.text,
        }}
      >
        <div
          style={{
            maxWidth: "1480px",
            margin: "0 auto",
            padding: "0 28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >

          {/* ============================================ */}
          {/* HERO METRICS STRIP                            */}
          {/* ============================================ */}

          <MetricsStrip metrics={liveMetrics} />

          {/* ============================================ */}
          {/* PRIMARY GRID — 4 OPERATIONAL SECTIONS         */}
          {/* ============================================ */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            <IncomingGreenSection
              shipments={shipments}
              isLoading={isLoadingShipments}
              error={shipmentsError}
              onReceive={handleReceiveShipment}
              receivingId={receivingId}
            />
            <RoastQueueSection />
            <ReadyForClientsSection />
            <MarketIntelligenceSection />
          </div>

          {/* ============================================ */}
          {/* SECONDARY GRID — 4 SUPPORT PANELS             */}
          {/* ============================================ */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            <RoastingCapacityCard />
            <InventoryOverviewCard />
            <RecentActivityCard />
            <AlertsCard />
          </div>

        </div>
      </div>
    </>
  )
}

// ======================================================
// METRICS STRIP
// ======================================================

function MetricsStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "14px",
      }}
    >
      {metrics.map((m) => (
        <MetricCard key={m.id} metric={m} />
      ))}
    </div>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  const accent = toneColor(metric.tone)
  return (
    <div
      style={{
        position: "relative",
        padding: "16px 18px",
        borderRadius: "14px",
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        boxShadow: T.cardShadow,
        display: "flex",
        alignItems: "center",
        gap: "14px",
        overflow: "hidden",
        transition: "all 0.3s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.cardBorderHv
        e.currentTarget.style.boxShadow = T.cardShadowHv
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.cardBorder
        e.currentTarget.style.boxShadow = T.cardShadow
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      {/* atmospheric glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 0% 0%, ${accent}10, transparent 55%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "10px",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(180deg, ${accent}22, ${accent}10)`,
          border: `1px solid ${accent}38`,
          color: accent,
        }}
      >
        {metric.icon}
      </div>

      <div style={{ minWidth: 0, position: "relative" }}>
        <div
          style={{
            fontSize: "26px",
            fontWeight: 600,
            color: T.text,
            lineHeight: 1,
            letterSpacing: "-0.5px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {metric.value}
        </div>
        <div
          style={{
            fontSize: "12.5px",
            color: T.text,
            marginTop: "6px",
            fontWeight: 500,
            letterSpacing: "0.1px",
          }}
        >
          {metric.label}
        </div>
        <div
          style={{
            fontSize: "10.5px",
            color: T.textFaint,
            marginTop: "2px",
            letterSpacing: "0.2px",
          }}
        >
          {metric.sublabel}
        </div>
      </div>
    </div>
  )
}

// ======================================================
// SECTION CARD WRAPPER (shared shell for 8 main cards)
// ======================================================

function SectionCard({
  title,
  subtitle,
  icon,
  cta,
  children,
  rightSlot,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  cta?: { label: string; onClick?: () => void }
  rightSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: "relative",
        padding: "22px",
        borderRadius: "18px",
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        boxShadow: T.cardShadow,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        transition: "all 0.3s ease",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.cardBorderHv
        e.currentTarget.style.boxShadow = T.cardShadowHv
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.cardBorder
        e.currentTarget.style.boxShadow = T.cardShadow
      }}
    >
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
          <span style={{ color: T.gold, marginTop: 2, flexShrink: 0 }}>{icon}</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: T.text,
                letterSpacing: "0.1px",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: "11.5px",
                color: T.textFaint,
                marginTop: "2px",
                letterSpacing: "0.3px",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
        {rightSlot}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
        {children}
      </div>

      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            marginTop: "2px",
            padding: "10px 0",
            width: "100%",
            background: "transparent",
            border: `1px solid ${T.cardInnerLine}`,
            borderTop: `1px solid ${T.divider}`,
            borderLeft: 0,
            borderRight: 0,
            borderBottom: 0,
            color: T.gold,
            fontSize: "12px",
            letterSpacing: "0.4px",
            cursor: "pointer",
            transition: "color 0.25s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.goldStrong }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.gold }}
        >
          {cta.label}  →
        </button>
      )}
    </div>
  )
}

// ======================================================
// PRIMARY SECTION 1 — INCOMING GREEN  (LIVE DATA)
//
// Wired to GET /api/eu-partner/shipments and POST
// /api/eu-partner/shipments/:id/receive. Falls back to
// elegant loading / empty / error states. Visual style
// (warm bronze cards) is preserved from the mock.
// ======================================================

function IncomingGreenSection({
  shipments,
  isLoading,
  error,
  onReceive,
  receivingId,
}: {
  shipments: EuropeShipment[]
  isLoading: boolean
  error: string | null
  onReceive: (id: string) => void
  receivingId: string | null
}) {
  const counts = useMemo(() => ({
    inTransit: shipments.filter((s) => s.status === "IN_TRANSIT").length,
    arrived:   shipments.filter((s) => s.status === "ARRIVED").length,
    received:  shipments.filter((s) => s.status === "RECEIVED").length,
  }), [shipments])

  const sortedActive = useMemo(() => {
    const order: Record<ShipmentStatus, number> = {
      IN_TRANSIT: 0, ARRIVED: 1, DISCREPANCY: 2, RECEIVED: 3,
    }
    return [...shipments].sort((a, b) => {
      const o = order[a.status] - order[b.status]
      if (o !== 0) return o
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [shipments])

  return (
    <SectionCard
      title="Incoming Green"
      subtitle="Arrivals & intake"
      icon={<IconLeaf />}
      cta={{ label: "View inbound shipments" }}
    >

      {/* SUMMARY ROW — three numeric chips */}
      <div style={{ display: "flex", gap: "10px" }}>
        <SummaryChip count={counts.inTransit} label="In transit" tone="info" />
        <SummaryChip count={counts.arrived}   label="Arrived"    tone="warn" />
        <SummaryChip count={counts.received}  label="Received"   tone="ok"   />
      </div>

      {/* CONTENT */}
      {isLoading && <IncomingLoading />}

      {!isLoading && error && <IncomingError message={error} />}

      {!isLoading && !error && shipments.length === 0 && <IncomingEmpty />}

      {!isLoading && !error && shipments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {sortedActive.slice(0, 3).map((s) => (
            <ShipmentCard
              key={s.id}
              shipment={s}
              onReceive={onReceive}
              isReceiving={receivingId === s.id}
              isAnyReceiving={receivingId !== null}
            />
          ))}

          {shipments.length > 3 && (
            <div
              style={{
                fontSize: "11px",
                color: T.textFaint,
                letterSpacing: "0.3px",
                textAlign: "center",
                padding: "4px 0",
              }}
            >
              + {shipments.length - 3} more shipment{shipments.length - 3 === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ------------------------------------------------------
// SUMMARY CHIP (compact "3 In transit" element)
// ------------------------------------------------------

function SummaryChip({ count, label, tone }: { count: number; label: string; tone: Tone }) {
  const accent = toneColor(tone)
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: "12px",
        background: `linear-gradient(180deg, ${accent}10, rgba(0,0,0,0))`,
        border: `1px solid ${accent}28`,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: T.text,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.5px",
          minWidth: 22,
          textAlign: "center",
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: "10.5px",
          color: T.textMuted,
          letterSpacing: "0.3px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// SHIPMENT CARD (single shipment row)
// ------------------------------------------------------

function ShipmentCard({
  shipment,
  onReceive,
  isReceiving,
  isAnyReceiving,
}: {
  shipment: EuropeShipment
  onReceive: (id: string) => void
  isReceiving: boolean
  isAnyReceiving: boolean
}) {
  const tone: Tone =
    shipment.status === "IN_TRANSIT"  ? "info" :
    shipment.status === "ARRIVED"     ? "warn" :
    shipment.status === "RECEIVED"    ? "ok"   :
                                        "alert"

  const accent = toneColor(tone)

  const totalKg = shipment.greenLots.reduce((sum, l) => sum + (l.totalKg ?? 0), 0)

  // Build a compact origin string from regions/farms/producers
  const originParts = useMemo(() => {
    const set = new Set<string>()
    shipment.greenLots.forEach((l) => {
      const region = l.farm.region?.trim()
      const country = l.farm.producer.country?.trim()
      if (region) set.add(region)
      else if (country) set.add(country)
    })
    return Array.from(set).slice(0, 3)
  }, [shipment.greenLots])

  const canReceive =
    shipment.status === "IN_TRANSIT" || shipment.status === "ARRIVED"

  return (
    <div
      style={{
        padding: "14px 14px 12px",
        borderRadius: "14px",
        background: "linear-gradient(180deg, rgba(212,175,55,0.05), rgba(0,0,0,0))",
        border: `1px solid ${T.cardBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.cardBorderHv
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.cardBorder
      }}
    >
      {/* TOP — reference + status */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              color: T.text,
              fontWeight: 600,
              letterSpacing: "0.2px",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {shipment.reference}
          </div>
          <div
            style={{
              fontSize: "10.5px",
              color: T.textMuted,
              marginTop: "2px",
              letterSpacing: "0.3px",
            }}
          >
            {shipment.carrier ?? "Carrier TBD"}
            {shipment.vesselOrFlight ? ` · ${shipment.vesselOrFlight}` : ""}
            {shipment.destinationCountry
              ? ` · ${shipment.destinationCountry}`
              : ""}
          </div>
          {shipment.currentStage && (
            <div
              style={{
                fontSize: "10.5px",
                color: T.gold,
                marginTop: "4px",
                letterSpacing: "0.3px",
                opacity: 0.85,
              }}
            >
              📍 {humanizeStage(shipment.currentStage)}
            </div>
          )}
        </div>
        <Pill tone={tone} label={statusLabel(shipment.status)} />
      </div>

      {/* META — lots, kg, eta, origin */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 14px",
          paddingTop: "8px",
          borderTop: `1px solid ${T.divider}`,
        }}
      >
        <ShipmentMeta label="Lots"   value={`${shipment.greenLots.length}`} />
        <ShipmentMeta label="Total"  value={`${Math.round(totalKg).toLocaleString()} kg`} mono />
        <ShipmentMeta label="ETA"    value={formatEta(shipment.etaAt)} />
        <ShipmentMeta
          label="Origin"
          value={originParts.length > 0 ? originParts.join(", ") : "—"}
        />
      </div>

      {/* ACTION */}
      {canReceive && (
        <button
          onClick={() => onReceive(shipment.id)}
          disabled={isAnyReceiving}
          style={{
            marginTop: "2px",
            padding: "8px 0",
            width: "100%",
            background: isReceiving ? `${accent}18` : "transparent",
            border: `1px solid ${accent}40`,
            borderRadius: "10px",
            color: accent,
            fontSize: "12px",
            letterSpacing: "0.4px",
            cursor: isAnyReceiving ? "not-allowed" : "pointer",
            opacity: isAnyReceiving && !isReceiving ? 0.55 : 1,
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => {
            if (isAnyReceiving) return
            e.currentTarget.style.background = `${accent}14`
            e.currentTarget.style.borderColor = `${accent}66`
          }}
          onMouseLeave={(e) => {
            if (isReceiving) return
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.borderColor = `${accent}40`
          }}
        >
          {isReceiving ? "Receiving…" : "Mark as received  →"}
        </button>
      )}

      {shipment.status === "RECEIVED" && shipment.receivedAt && (
        <div
          style={{
            fontSize: "10.5px",
            color: T.textFaint,
            letterSpacing: "0.3px",
            textAlign: "right",
            paddingTop: "2px",
          }}
        >
          Received {formatRelative(shipment.receivedAt)}
        </div>
      )}
    </div>
  )
}

function ShipmentMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: T.textFaint,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "12px",
          color: T.text,
          letterSpacing: "0.1px",
          fontVariantNumeric: mono ? "tabular-nums" : "normal",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ------------------------------------------------------
// LOADING / EMPTY / ERROR — calm placeholder states
// ------------------------------------------------------

function IncomingLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            height: 78,
            borderRadius: "14px",
            border: `1px solid ${T.cardInnerLine}`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.05))",
            opacity: 0.55,
          }}
        />
      ))}
      <div
        style={{
          fontSize: "10.5px",
          color: T.textFaint,
          letterSpacing: "0.3px",
          textAlign: "center",
          paddingTop: "2px",
        }}
      >
        Loading shipments…
      </div>
    </div>
  )
}

function IncomingEmpty() {
  return (
    <div
      style={{
        padding: "20px 16px",
        borderRadius: "14px",
        border: `1px dashed ${T.cardBorder}`,
        background: "linear-gradient(180deg, rgba(212,175,55,0.03), rgba(0,0,0,0))",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "13px", color: T.text, fontWeight: 500, marginBottom: "6px" }}>
        No shipments yet
      </div>
      <div style={{ fontSize: "11px", color: T.textMuted, letterSpacing: "0.2px", lineHeight: 1.5 }}>
        Inbound containers will appear here as Origin Partners create them.
      </div>
    </div>
  )
}

function IncomingError({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "14px 14px",
        borderRadius: "12px",
        border: `1px solid ${T.amber}30`,
        background: `linear-gradient(180deg, ${T.amber}10, rgba(0,0,0,0))`,
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span style={{ color: T.amber }}>
        <IconAlert />
      </span>
      <div style={{ fontSize: "12px", color: T.text, letterSpacing: "0.1px" }}>
        {message}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------

function statusLabel(s: ShipmentStatus): string {
  switch (s) {
    case "IN_TRANSIT":  return "In transit"
    case "ARRIVED":     return "Arrived"
    case "RECEIVED":    return "Received"
    case "DISCREPANCY": return "Discrepancy"
  }
}

// LOG-3A — destination stage humanizer (kept inline to
// keep the EU dashboard self-contained; the canonical
// label map lives in src/lib/logistics/destinationTracking).
function humanizeStage(stage: string): string {
  return stage
    .toLowerCase()
    .split("_")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
}

function formatEta(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  const diffH = Math.round(diffMs / (1000 * 60 * 60))
  if (diffH < 1) return "just now"
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.round(diffH / 24)
  return `${diffD}d ago`
}

// ======================================================
// PRIMARY SECTION 2 — ROAST QUEUE
// ======================================================

function RoastQueueSection() {
  return (
    <SectionCard
      title="Roast Queue"
      subtitle="Roasting schedule & capacity"
      icon={<IconFlame />}
    >
      <RoastControlPanel />
    </SectionCard>
  )
}

// ======================================================
// PRIMARY SECTION 3 — READY FOR CLIENTS
// ======================================================

function ReadyForClientsSection() {
  const allocatedPct = (READY_TOTALS.allocatedKg / READY_TOTALS.totalAvailableKg) * 100
  const unallocatedPct = 100 - allocatedPct

  return (
    <SectionCard
      title="Ready for Clients"
      subtitle="Roasted inventory & allocations"
      icon={<IconBox />}
      cta={{ label: "View inventory" }}
    >
      {/* Top stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 16px",
          borderRadius: "12px",
          background: "linear-gradient(180deg, rgba(212,175,55,0.05), rgba(0,0,0,0))",
          border: `1px solid ${T.cardBorder}`,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            background: `linear-gradient(180deg, ${T.gold}25, ${T.gold}10)`,
            border: `1px solid ${T.gold}40`,
            color: T.goldStrong,
            fontSize: "22px",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {READY_TOTALS.lotsReady}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "12px", color: T.textMuted, letterSpacing: "0.3px" }}>
            Lots ready for dispatch
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18px", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {READY_TOTALS.totalAvailableKg.toLocaleString()} <span style={{ fontSize: "12px", color: T.textMuted }}>kg</span>
          </div>
          <div style={{ fontSize: "10.5px", color: T.textFaint, marginTop: 2, letterSpacing: "0.3px" }}>
            Total available
          </div>
        </div>
      </div>

      {/* Allocation split */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "2px" }}>
        <SplitBar
          label="Allocated to contracts"
          value={`${READY_TOTALS.allocatedKg.toLocaleString()} kg`}
          pct={allocatedPct}
          color={T.olive}
        />
        <SplitBar
          label="Unallocated inventory"
          value={`${READY_TOTALS.unallocatedKg.toLocaleString()} kg`}
          pct={unallocatedPct}
          color={T.bronze}
        />
      </div>

      {/* Featured ready lot */}
      <div
        style={{
          marginTop: "4px",
          padding: "12px 14px",
          borderRadius: "12px",
          background: "linear-gradient(180deg, rgba(155,179,119,0.05), rgba(0,0,0,0))",
          border: `1px solid ${T.cardInnerLine}`,
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "10px",
            background: "linear-gradient(180deg, rgba(192,133,82,0.25), rgba(40,28,18,0.5))",
            display: "grid",
            placeItems: "center",
            color: T.bronze,
            flexShrink: 0,
          }}
        >
          <IconBean />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", color: T.text, fontWeight: 500 }}>
            {READY_HIGHLIGHT.name}
          </div>
          <div style={{ fontSize: "10.5px", color: T.textMuted, marginTop: "2px", letterSpacing: "0.3px" }}>
            {READY_HIGHLIGHT.origin} · {READY_HIGHLIGHT.lotLabel} · {READY_HIGHLIGHT.process}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "13px", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {READY_HIGHLIGHT.kg.toLocaleString()} <span style={{ fontSize: "10.5px", color: T.textMuted }}>kg</span>
          </div>
          <div style={{ fontSize: "10.5px", color: T.olive, marginTop: 2, letterSpacing: "0.3px" }}>
            {READY_HIGHLIGHT.status}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

function SplitBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  const safePct = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11.5px", color: T.textMuted, letterSpacing: "0.2px" }}>{label}</span>
        <span style={{ fontSize: "12px", color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{value}</span>
      </div>
      <div
        style={{
          position: "relative",
          height: 5,
          width: "100%",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${safePct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: "999px",
            boxShadow: `0 0 12px ${color}55`,
          }}
        />
      </div>
    </div>
  )
}

// ======================================================
// PRIMARY SECTION 4 — MARKET INTELLIGENCE
// ======================================================

function MarketIntelligenceSection() {
  return (
    <SectionCard
      title="Market Intelligence"
      subtitle="Operational & market insights"
      icon={<IconWave />}
      cta={{ label: "View full intelligence" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {MARKET_SIGNALS.map((s, i) => (
          <SignalRowView key={s.id} row={s} divider={i < MARKET_SIGNALS.length - 1} />
        ))}
      </div>

      {/* Mini chart + score */}
      <div
        style={{
          marginTop: "8px",
          padding: "14px 14px",
          borderRadius: "12px",
          background: "linear-gradient(180deg, rgba(212,175,55,0.04), rgba(0,0,0,0))",
          border: `1px solid ${T.cardInnerLine}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <Sparkline data={MINI_SPARKLINE} color={T.gold} />
        <ScoreGauge value={OVERALL_SCORE} />
      </div>
    </SectionCard>
  )
}

function SignalRowView({ row, divider }: { row: SignalRow; divider: boolean }) {
  const accent = toneColor(row.tone)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "11px 4px",
        borderBottom: divider ? `1px solid ${T.divider}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <span style={{ color: T.bronze, opacity: 0.85 }}>{row.icon}</span>
        <span style={{ fontSize: "13px", color: T.text, letterSpacing: "0.1px" }}>
          {row.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 8px ${accent}66`,
          }}
        />
        <span style={{ fontSize: "12px", color: accent, fontWeight: 500, letterSpacing: "0.2px" }}>
          {row.state}
        </span>
      </div>
    </div>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 130
  const h = 42
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = w / (data.length - 1)
  const points = data
    .map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`)
    .join(" ")

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={`${points} ${w},${h} 0,${h}`}
        fill="url(#sparkFill)"
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ScoreGauge({ value }: { value: number }) {
  const size = 64
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = Math.PI * radius // half circle
  const pct = Math.max(0, Math.min(100, value)) / 100
  const offset = circumference * (1 - pct)

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <div style={{ position: "relative", width: size, height: size / 2 + 4 }}>
        <svg width={size} height={size / 2 + 4} style={{ overflow: "visible" }}>
          <path
            d={`M ${stroke / 2} ${size / 2} a ${radius} ${radius} 0 0 1 ${size - stroke} 0`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${stroke / 2} ${size / 2} a ${radius} ${radius} 0 0 1 ${size - stroke} 0`}
            fill="none"
            stroke={T.gold}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 0,
          }}
        >
          <span style={{ fontSize: "16px", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </span>
        </div>
      </div>
      <span style={{ fontSize: "9.5px", color: T.textFaint, letterSpacing: "0.18em", textTransform: "uppercase" }}>
        Overall Score
      </span>
    </div>
  )
}

// ======================================================
// SECONDARY SECTION 1 — ROASTING CAPACITY (BAR CHART)
// ======================================================

function RoastingCapacityCard() {
  const chartHeight = 130
  return (
    <SectionCard
      title="Roasting Capacity"
      subtitle="Daily overview"
      icon={<IconBars />}
      rightSlot={
        <button
          style={{
            fontSize: "11px",
            color: T.textMuted,
            letterSpacing: "0.3px",
            background: "transparent",
            border: `1px solid ${T.cardInnerLine}`,
            padding: "5px 12px",
            borderRadius: "999px",
            cursor: "pointer",
          }}
        >
          Today  ▾
        </button>
      }
    >
      <div style={{ position: "relative", paddingTop: "18px" }}>
        {/* Y-axis labels */}
        <div
          style={{
            position: "absolute",
            top: 6,
            bottom: 22,
            left: 0,
            width: 32,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: T.textFaint,
            fontSize: "10px",
            letterSpacing: "0.3px",
          }}
        >
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        {/* Chart area */}
        <div
          style={{
            marginLeft: 36,
            height: chartHeight,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "10px",
            position: "relative",
          }}
        >
          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <div
              key={g}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${(1 - g) * chartHeight}px`,
                height: 1,
                background: "rgba(255,255,255,0.04)",
                pointerEvents: "none",
              }}
            />
          ))}

          {CAPACITY_HOURS.map((hour) => (
            <CapacityBar key={hour.label} hour={hour} chartHeight={chartHeight} />
          ))}
        </div>

        {/* X-axis labels */}
        <div
          style={{
            marginLeft: 36,
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            marginTop: "10px",
          }}
        >
          {CAPACITY_HOURS.map((h) => (
            <div
              key={h.label}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: "10.5px",
                color: T.textMuted,
                letterSpacing: "0.3px",
              }}
            >
              {h.label}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}

function CapacityBar({ hour, chartHeight }: { hour: CapacityHour; chartHeight: number }) {
  const total = hour.segments.reduce((s, seg) => s + seg.height, 0)
  const totalHeight = (total / 100) * chartHeight
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, position: "relative", height: chartHeight }}>
      {hour.peakLabel && (
        <span
          style={{
            position: "absolute",
            bottom: totalHeight + 6,
            fontSize: "10.5px",
            color: T.text,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.3px",
          }}
        >
          {hour.peakLabel}
        </span>
      )}
      <div
        style={{
          width: "60%",
          maxWidth: 26,
          height: totalHeight,
          display: "flex",
          flexDirection: "column-reverse",
          borderRadius: "5px 5px 2px 2px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
        }}
      >
        {hour.segments.map((seg, i) => (
          <div
            key={i}
            style={{
              flex: `${seg.height} 0 0`,
              background: `linear-gradient(180deg, ${seg.color}cc, ${seg.color})`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ======================================================
// SECONDARY SECTION 2 — INVENTORY OVERVIEW (DONUT)
// ======================================================

function InventoryOverviewCard() {
  const greenKg = 58200
  const roastedKg = 34280
  const total = greenKg + roastedKg
  const greenPct = greenKg / total
  const roastedPct = 1 - greenPct

  return (
    <SectionCard
      title="Inventory Overview"
      subtitle="Green vs Roasted"
      icon={<IconLayers />}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px", paddingTop: "4px" }}>
        <InventoryDonut greenPct={greenPct} roastedPct={roastedPct} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          <InventoryStat
            color={T.olive}
            label="Green Coffee"
            value={greenKg}
            pct={Math.round(greenPct * 100)}
          />
          <InventoryStat
            color={T.bronze}
            label="Roasted Coffee"
            value={roastedKg}
            pct={Math.round(roastedPct * 100)}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: "8px",
          padding: "10px 12px",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${T.cardInnerLine}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "11px", color: T.textMuted, letterSpacing: "0.3px" }}>
          Total Inventory
        </span>
        <span style={{ fontSize: "13px", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {total.toLocaleString()} <span style={{ fontSize: "11px", color: T.textMuted }}>kg</span>
        </span>
      </div>
    </SectionCard>
  )
}

function InventoryDonut({ greenPct, roastedPct }: { greenPct: number; roastedPct: number }) {
  const size = 110
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const greenLen = circumference * greenPct
  const roastedLen = circumference * roastedPct
  const gap = 2

  return (
    <svg width={size} height={size} style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
      {/* Green segment */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={T.olive}
        strokeWidth={stroke}
        strokeDasharray={`${greenLen - gap} ${circumference}`}
        strokeDashoffset={0}
        strokeLinecap="butt"
      />
      {/* Roasted segment */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={T.bronze}
        strokeWidth={stroke}
        strokeDasharray={`${roastedLen - gap} ${circumference}`}
        strokeDashoffset={-(greenLen)}
        strokeLinecap="butt"
      />
    </svg>
  )
}

function InventoryStat({ color, label, value, pct }: { color: string; label: string; value: number; pct: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}55`,
          }}
        />
        <span style={{ fontSize: "11.5px", color: T.textMuted, letterSpacing: "0.3px" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "16px", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {value.toLocaleString()} <span style={{ fontSize: "11px", color: T.textMuted, fontWeight: 400 }}>kg</span>
        </span>
        <span style={{ fontSize: "11px", color: T.textFaint, letterSpacing: "0.3px" }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

// ======================================================
// SECONDARY SECTION 3 — RECENT ACTIVITY
// ======================================================

function RecentActivityCard() {
  return (
    <SectionCard
      title="Recent Activity"
      subtitle="Latest operations"
      icon={<IconClock />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
        {ACTIVITY.map((item, i) => (
          <ActivityRow key={item.id} item={item} divider={i < ACTIVITY.length - 1} />
        ))}
      </div>
    </SectionCard>
  )
}

function ActivityRow({ item, divider }: { item: ActivityItem; divider: boolean }) {
  const accent = toneColor(item.tone)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 4px",
        borderBottom: divider ? `1px solid ${T.divider}` : "none",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          background: `${accent}14`,
          border: `1px solid ${accent}30`,
          color: accent,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>
      <div style={{ flex: 1, fontSize: "12.5px", color: T.text, letterSpacing: "0.1px" }}>
        {item.text}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: "11px", color: T.textFaint, letterSpacing: "0.3px" }}>
          {item.time}
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 6px ${accent}66`,
          }}
        />
      </div>
    </div>
  )
}

// ======================================================
// SECONDARY SECTION 4 — ALERTS & ATTENTION
// ======================================================

function AlertsCard() {
  return (
    <SectionCard
      title="Alerts & Attention"
      subtitle="Items requiring action"
      icon={<IconAlert />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {ALERTS.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </div>
    </SectionCard>
  )
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const accent = toneColor(alert.tone)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        borderRadius: "12px",
        background: `linear-gradient(180deg, ${accent}0a, rgba(0,0,0,0))`,
        border: `1px solid ${accent}22`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "10px",
          display: "grid",
          placeItems: "center",
          background: `${accent}1a`,
          border: `1px solid ${accent}38`,
          color: accent,
          flexShrink: 0,
        }}
      >
        {alert.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", color: T.text, fontWeight: 500, letterSpacing: "0.1px" }}>
          {alert.title}
        </div>
        <div style={{ fontSize: "10.5px", color: T.textMuted, marginTop: "2px", letterSpacing: "0.3px" }}>
          {alert.detail}
        </div>
      </div>
      <button
        style={{
          fontSize: "11px",
          color: T.gold,
          background: "transparent",
          border: `1px solid ${T.cardBorder}`,
          padding: "6px 14px",
          borderRadius: "999px",
          cursor: "pointer",
          letterSpacing: "0.3px",
          transition: "all 0.25s ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.goldFaint
          e.currentTarget.style.color = T.goldStrong
          e.currentTarget.style.borderColor = "rgba(212,175,55,0.45)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = T.gold
          e.currentTarget.style.borderColor = T.cardBorder
        }}
      >
        Review
      </button>
    </div>
  )
}

// ======================================================
// PILL (small status chip)
// ======================================================

function Pill({ tone, label }: { tone: Tone; label: string }) {
  const accent = toneColor(tone)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "10.5px",
        fontWeight: 500,
        letterSpacing: "0.3px",
        color: accent,
        border: `1px solid ${accent}40`,
        background: `${accent}10`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 5px ${accent}88`,
        }}
      />
      {label}
    </span>
  )
}

// ------------------------------------------------------
// TONE → COLOR
// ------------------------------------------------------

function toneColor(tone: Tone): string {
  switch (tone) {
    case "ok":    return T.olive
    case "warn":  return T.amber
    case "alert": return T.crimson
    case "info":  return T.gold
  }
}

// ======================================================
// SVG ICONS — minimal, consistent stroke style
// ======================================================

function IconTruck()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7"  cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/></svg> }
function IconFlame()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5c1.6 3 3.6 4.6 4.5 6.7a6 6 0 1 1-10.6 4.6c0-2.6 1.7-4.4 3-6.4.7-1 1.3-2.4 1.3-4.9z"/><path d="M11 14c.6 1.5 2 1.8 3 1.2"/></svg> }
function IconShield()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l8 3v6c0 5.2-3.4 8.6-8 10-4.6-1.4-8-4.8-8-10v-6z"/><path d="M9 12l2 2 4-4"/></svg> }
function IconCheck()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg> }
function IconUsers()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3.2"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="10" r="2.6"/><path d="M15 19c0-2.6 2.2-4 4-4s2 .6 2 1.5"/></svg> }
function IconAlert()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.6 3.6L2.5 18a1.6 1.6 0 0 0 1.4 2.4h16.2A1.6 1.6 0 0 0 21.5 18L13.4 3.6a1.6 1.6 0 0 0-2.8 0z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg> }
function IconLeaf()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19c0-7 5-13 14-14-1 9-7 14-14 14z"/><path d="M5 19c4-4 7-7 11-9"/></svg> }
function IconBox()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/></svg> }
function IconWave()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l4-7 4 4 4-2 4 5 2-1"/><path d="M3 18l4-3 4 1 4-1 4 2 2-1"/></svg> }
function IconShip()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M5 13l7-7 7 7"/><path d="M8 11V7h8v4"/></svg> }
function IconRing()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 6.5 12.7"/></svg> }
function IconHandshake(){ return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l3-3 3 3 2-2 4 4-3 3-9-5z"/><path d="M14 9l3-3 4 4-3 3"/></svg> }
function IconBars()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4"  y="11" width="3" height="9"/><rect x="10" y="6"  width="3" height="14"/><rect x="16" y="9"  width="3" height="11"/></svg> }
function IconLayers()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 18l9 5 9-5"/></svg> }
function IconClock()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> }
function IconDoc()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16h6M9 10h3"/></svg> }
function IconBean()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12c0-5 4-9 9-9 3 0 5 1.5 5 4 0 5-4 14-9 14-3 0-5-3-5-9z"/><path d="M9 7c-1 3-2 7 0 11"/></svg> }
