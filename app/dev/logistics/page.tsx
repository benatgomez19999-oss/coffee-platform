"use client"

import { useEffect, useState } from "react"
import LogisticsTrackingPanel, {
  type TrackingSampleLot,
  type TrackingShipment,
} from "@/src/components/dev/logistics/LogisticsTrackingPanel"

type SampleShippingStatus =
  | "PICKUP_REQUESTED"
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "DELIVERED"

type LotDraftStatus =
  | "PENDING"
  | "SAMPLE_REQUESTED"
  | "IN_REVIEW"
  | "VERIFIED"
  | "REJECTED"

type GreenLotStatus = "DRAFT" | "PUBLISHED" | "RESERVED"

type DevLot = {
  id: string
  name: string | null
  variety: string | null
  process: string | null
  status: LotDraftStatus
  sampleShippingStatus: SampleShippingStatus | null
}

type DevPartnerLot = {
  id: string
  name: string | null
  variety: string | null
  process: string | null
  status: LotDraftStatus
  greenLot: {
    id: string
    status: GreenLotStatus
    name: string | null
    scaScore: number | null
  } | null
}

const SHIPPING_FLOW: SampleShippingStatus[] = [
  "PICKUP_REQUESTED",
  "PICKUP_SCHEDULED",
  "IN_TRANSIT",
  "DELIVERED",
]

//////////////////////////////////////////////////////
// 🚢 SHIPMENT TYPES (LOG-2 — dev simulator)
//////////////////////////////////////////////////////

type DevShipmentStatus =
  | "IN_TRANSIT"
  | "ARRIVED"
  | "RECEIVED"
  | "DISCREPANCY"

type DevShipmentLot = {
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
    producer: { name: string; country: string }
  }
}

type DevShipment = {
  id: string
  reference: string
  status: DevShipmentStatus
  carrier: string | null
  vesselOrFlight: string | null
  etaAt: string | null
  arrivedAt: string | null
  receivedAt: string | null
  createdAt: string
  greenLots: DevShipmentLot[]
}

const SHIPMENT_STATUSES: DevShipmentStatus[] = [
  "IN_TRANSIT",
  "ARRIVED",
  "RECEIVED",
  "DISCREPANCY",
]

function getShippingLabel(status?: string | null) {
  switch (status) {
    case "PICKUP_REQUESTED":  return "Recogida solicitada"
    case "PICKUP_SCHEDULED":  return "Recogida programada"
    case "IN_TRANSIT":        return "En tránsito"
    case "DELIVERED":         return "Entregada al partner"
    default:                  return "Sin estado logístico"
  }
}

export default function DevLogisticsPage() {

  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [lots, setLots] = useState<DevLot[]>([])
  const [loading, setLoading] = useState(true)
  const [busyLotId, setBusyLotId] = useState<string | null>(null)

  const [partnerLots, setPartnerLots] = useState<DevPartnerLot[]>([])
  const [partnerLoading, setPartnerLoading] = useState(true)
  const [busyPartnerId, setBusyPartnerId] = useState<string | null>(null)

  //////////////////////////////////////////////////////
  // 🚢 SHIPMENTS — STATE
  //////////////////////////////////////////////////////

  const [shipments, setShipments] = useState<DevShipment[]>([])
  const [shipmentsLoading, setShipmentsLoading] = useState(true)
  const [busyShipmentId, setBusyShipmentId] = useState<string | null>(null)
  const [seedingShipment, setSeedingShipment] = useState(false)

  //////////////////////////////////////////////////////
  // 📦 ORDER — STATE (LOG-2: simple seed only)
  //////////////////////////////////////////////////////

  const [seedingOrder, setSeedingOrder] = useState(false)

  //////////////////////////////////////////////////////
  // 📍 TRACKING — STATE (LOG-3: read-only panel)
  //////////////////////////////////////////////////////

  const [trackingSampleLots, setTrackingSampleLots] = useState<TrackingSampleLot[]>([])
  const [trackingShipments, setTrackingShipments] = useState<TrackingShipment[]>([])
  const [trackingLoading, setTrackingLoading] = useState(true)

  //////////////////////////////////////////////////////
  // LOAD — Shipping lots
  //////////////////////////////////////////////////////

  const loadLots = async () => {
    try {
      const res = await fetch("/api/dev/logistics/lots", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to load logistics lots")
      setLots(await res.json())
    } catch (error) {
      console.error(error)
      alert("Error loading dev logistics lots")
    } finally {
      setLoading(false)
    }
  }

  //////////////////////////////////////////////////////
  // LOAD — Partner lab lots
  //////////////////////////////////////////////////////

  const loadPartnerLots = async () => {
    try {
      const res = await fetch("/api/dev/partner/lots", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to load partner lots")
      setPartnerLots(await res.json())
    } catch (error) {
      console.error(error)
      alert("Error loading partner lots")
    } finally {
      setPartnerLoading(false)
    }
  }

  //////////////////////////////////////////////////////
  // LOAD — Shipments (LOG-2)
  //////////////////////////////////////////////////////

  const loadShipments = async () => {
    try {
      const res = await fetch("/api/dev/logistics/shipments", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to load shipments")
      const data = (await res.json()) as { shipments?: DevShipment[] }
      setShipments(Array.isArray(data.shipments) ? data.shipments : [])
    } catch (error) {
      console.error(error)
      alert("Error loading dev shipments")
    } finally {
      setShipmentsLoading(false)
    }
  }

  //////////////////////////////////////////////////////
  // LOAD — Tracking (LOG-3, read-only)
  //////////////////////////////////////////////////////

  const loadTracking = async () => {
    try {
      const res = await fetch("/api/dev/logistics/tracking", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to load tracking")
      const data = (await res.json()) as {
        sampleLots?: TrackingSampleLot[]
        shipments?: TrackingShipment[]
      }
      setTrackingSampleLots(Array.isArray(data.sampleLots) ? data.sampleLots : [])
      setTrackingShipments(Array.isArray(data.shipments) ? data.shipments : [])
    } catch (error) {
      console.error(error)
      // Calm fallback — no alert. Panel will show empty state.
      setTrackingSampleLots([])
      setTrackingShipments([])
    } finally {
      setTrackingLoading(false)
    }
  }

  const loadAll = () => {
    loadLots()
    loadPartnerLots()
    loadShipments()
    loadTracking()
  }

  useEffect(() => {
    loadAll()
  }, [])

  //////////////////////////////////////////////////////
  // ACTIONS — Shipping
  //////////////////////////////////////////////////////

  const advanceStatus = async (lotId: string) => {
    try {
      setBusyLotId(lotId)
      const res = await fetch("/api/dev/logistics/advance-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lotId }),
      })
      if (!res.ok) throw new Error("Failed to advance logistics status")
      await loadAll()
    } catch (error) {
      console.error(error)
      alert("Error advancing logistics status")
    } finally {
      setBusyLotId(null)
    }
  }

  const setStatus = async (lotId: string, nextStatus: SampleShippingStatus) => {
    try {
      setBusyLotId(lotId)
      const res = await fetch("/api/dev/logistics/advance-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lotId, nextStatus }),
      })
      if (!res.ok) throw new Error("Failed to set logistics status")
      await loadAll()
    } catch (error) {
      console.error(error)
      alert("Error setting logistics status")
    } finally {
      setBusyLotId(null)
    }
  }

  //////////////////////////////////////////////////////
  // ACTIONS — Partner lab
  //////////////////////////////////////////////////////

  // DEV BRIDGE: Force lot into IN_REVIEW without shipping simulation
  const forceInReview = async (lotId: string) => {
    try {
      setBusyPartnerId(lotId)
      const res = await fetch("/api/dev/partner/set-lot-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lotId, status: "IN_REVIEW" }),
      })
      if (!res.ok) throw new Error("Failed to set lot status")
      await loadAll()
    } catch (error) {
      console.error(error)
      alert("Error forcing IN_REVIEW")
    } finally {
      setBusyPartnerId(null)
    }
  }

  // REAL ROUTE: calls verifyLotService with default lab values
  // Requires farm.altitude to be set — will surface error if missing
  const quickVerify = async (lotId: string) => {
    try {
      setBusyPartnerId(lotId)
      const res = await fetch(`/api/partner/lots/${lotId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scaScore: 85, conversionRate: 0.80 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Verify failed")
      await loadAll()
    } catch (error: any) {
      console.error(error)
      alert(`Quick verify failed: ${error.message}`)
    } finally {
      setBusyPartnerId(null)
    }
  }

  // DEV BRIDGE: GreenLot DRAFT → PUBLISHED (no real route exists yet)
  const publishGreenLot = async (greenLotId: string) => {
    try {
      setBusyPartnerId(greenLotId)
      const res = await fetch("/api/dev/partner/publish-green-lot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ greenLotId }),
      })
      if (!res.ok) throw new Error("Failed to publish green lot")
      await loadAll()
    } catch (error) {
      console.error(error)
      alert("Error publishing green lot")
    } finally {
      setBusyPartnerId(null)
    }
  }

  //////////////////////////////////////////////////////
  // 🎛️ ACTIONS — Shipments (LOG-2)
  //////////////////////////////////////////////////////

  const seedShipment = async () => {
    try {
      setSeedingShipment(true)
      const res = await fetch("/api/dev/logistics/shipments/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data?.error || "Failed to seed shipment")
      await loadShipments()
    } catch (error: unknown) {
      console.error(error)
      const msg = error instanceof Error ? error.message : "Unknown error"
      alert(`Error seeding shipment: ${msg}`)
    } finally {
      setSeedingShipment(false)
    }
  }

  const advanceShipment = async (shipmentId: string) => {
    try {
      setBusyShipmentId(shipmentId)
      const res = await fetch(
        `/api/dev/logistics/shipments/${shipmentId}/advance-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        }
      )
      if (!res.ok) throw new Error("Failed to advance shipment")
      await loadShipments()
    } catch (error) {
      console.error(error)
      alert("Error advancing shipment status")
    } finally {
      setBusyShipmentId(null)
    }
  }

  const forceShipmentStatus = async (
    shipmentId: string,
    status: DevShipmentStatus
  ) => {
    try {
      setBusyShipmentId(shipmentId)
      const res = await fetch(
        `/api/dev/logistics/shipments/${shipmentId}/advance-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        }
      )
      if (!res.ok) throw new Error("Failed to force shipment status")
      await loadShipments()
    } catch (error) {
      console.error(error)
      alert(`Error forcing status ${status}`)
    } finally {
      setBusyShipmentId(null)
    }
  }

  //////////////////////////////////////////////////////
  // 🎛️ ACTIONS — Orders (LOG-2: minimal seed)
  //////////////////////////////////////////////////////

  const seedOrder = async () => {
    try {
      setSeedingOrder(true)
      const res = await fetch("/api/dev/orders/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data?.error || "Failed to seed order")
      alert("Order seeded.")
    } catch (error: unknown) {
      console.error(error)
      const msg = error instanceof Error ? error.message : "Unknown error"
      alert(`Error seeding order: ${msg}`)
    } finally {
      setSeedingOrder(false)
    }
  }

  if (loading && partnerLoading) {
    return (
      <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
        <p className="text-[#5f472f]">Loading dev logistics...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
      <div className="mx-auto max-w-6xl">

        {/* ================================================ */}
        {/* HEADER */}
        {/* ================================================ */}

        <div className="mb-8">
          <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">
            Dev Tools
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">
            Operations Simulator
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[#6b5a45]">
            Simula estados logísticos y del flujo partner para testear el
            Partner Dashboard sin tocar la UI principal.
          </p>
        </div>

        <div className="mb-10 flex gap-3">
          <a
            href="/platform/partner/dashboard"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open partner dashboard
          </a>
          <a
            href="/platform/producer/dashboard"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open producer dashboard
          </a>
          <button
            onClick={loadAll}
            className="rounded-full border border-[#cfb48a] bg-white px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
          >
            Refresh all
          </button>
        </div>


        {/* ================================================ */}
        {/* SECTION 1 — SHIPPING SIMULATOR */}
        {/* ================================================ */}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[15px]">🚚</span>
          <h2 className="text-[16px] font-semibold text-[#2f2418]">
            Sample Shipping Simulator
          </h2>
          <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
        </div>
        <p className="mb-6 text-sm text-[#6b5a45]">
          Avanza el estado de transporte de la muestra. Al llegar a{" "}
          <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono text-[#7a5230]">DELIVERED</code>
          {" "}se dispara el evento real que mueve el lote a{" "}
          <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono text-[#7a5230]">IN_REVIEW</code>.
        </p>

        <div className="mb-16 grid gap-5">
          {lots.map((lot) => (
            <div
              key={lot.id}
              className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#2f2418]">
                    {lot.name || "Unnamed Lot"}
                  </h2>
                  <p className="mt-1 text-sm text-[#6b5a45]">
                    {lot.variety || "Unknown variety"} ·{" "}
                    {lot.process || "Unknown process"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#efe7da] px-3 py-1 text-xs font-medium text-[#7a5c2e]">
                      Lot: {lot.status}
                    </span>
                    <span className="rounded-full bg-[#e9efe4] px-3 py-1 text-xs font-medium text-[#587048]">
                      Shipping: {getShippingLabel(lot.sampleShippingStatus)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[420px]">
                  <button
                    onClick={() => advanceStatus(lot.id)}
                    disabled={busyLotId === lot.id}
                    className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyLotId === lot.id ? "Updating..." : "Advance to next shipping state"}
                  </button>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {SHIPPING_FLOW.map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatus(lot.id, status)}
                        disabled={busyLotId === lot.id}
                        className="rounded-xl border border-[#cfb48a] bg-[#f7efdf] px-3 py-2 text-xs font-medium text-[#5f472f] transition hover:bg-[#efe3ce] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {lots.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
              No lots available for shipping simulation.
            </div>
          )}
        </div>


        {/* ================================================ */}
        {/* SECTION 2 — PARTNER LAB FLOW */}
        {/* ================================================ */}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[15px]">🔬</span>
          <h2 className="text-[16px] font-semibold text-[#2f2418]">
            Partner Lab Flow
          </h2>
          <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
        </div>
        <p className="mb-2 text-sm text-[#6b5a45]">
          Simula las transiciones internas del partner posterior a la entrega de muestra.
        </p>
        <div className="mb-6 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-[#c4b28e] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#7a5230]">
            ✅ Real — Force IN_REVIEW (dev bridge)
          </span>
          <span className="rounded-full border border-[#c4b28e] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#7a5230]">
            ✅ Real — Quick Verify (llama a verifyLotService real)
          </span>
          <span className="rounded-full border border-[#c9b89a] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#9a6030]">
            ⚠️ Dev bridge — Publish Green Lot (sin ruta real todavía)
          </span>
          <span className="rounded-full border border-[#c9b89a] bg-[#f0ecdf] px-2.5 py-1 font-medium text-[#9a6030]">
            ⛔ No implementado — Order prepare / ready (rutas no existen aún)
          </span>
        </div>

        <div className="mb-16 grid gap-5">
          {partnerLots.map((lot) => {
            const isBusy = busyPartnerId === lot.id || busyPartnerId === lot.greenLot?.id
            const isInReview = lot.status === "IN_REVIEW"
            const isVerified = lot.status === "VERIFIED"
            const greenLotDraft = isVerified && lot.greenLot?.status === "DRAFT"
            const greenLotPublished = isVerified && lot.greenLot?.status === "PUBLISHED"

            return (
              <div
                key={lot.id}
                className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#2f2418]">
                      {lot.name || "Unnamed Lot"}
                    </h2>
                    <p className="mt-1 text-sm text-[#6b5a45]">
                      {lot.variety || "Unknown variety"} ·{" "}
                      {lot.process || "Unknown process"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        isInReview
                          ? "bg-[#fef3d7] text-[#7a5c0a]"
                          : "bg-[#e9efe4] text-[#587048]"
                      }`}>
                        Lot: {lot.status}
                      </span>
                      {lot.greenLot && (
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          greenLotPublished
                            ? "bg-[#e8f0e6] text-[#3a6b35]"
                            : "bg-[#efe7da] text-[#7a5c2e]"
                        }`}>
                          GreenLot: {lot.greenLot.status}
                          {lot.greenLot.scaScore ? ` · SCA ${lot.greenLot.scaScore}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-[360px]">
                    {isInReview && (
                      <>
                        <button
                          onClick={() => quickVerify(lot.id)}
                          disabled={isBusy}
                          className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Updating..." : "Quick Verify (SCA 85 · conv 0.80) — Real service"}
                        </button>
                        <p className="text-[11px] text-[#8a7a65]">
                          Llama a verifyLotService real. Requiere farm.altitude.
                        </p>
                      </>
                    )}

                    {greenLotDraft && lot.greenLot && (
                      <>
                        <button
                          onClick={() => publishGreenLot(lot.greenLot!.id)}
                          disabled={isBusy}
                          className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Publishing..." : "Publish Green Lot → PUBLISHED — Dev bridge"}
                        </button>
                        <p className="text-[11px] text-[#8a7a65]">
                          Dev bridge: no existe ruta real de publicación todavía.
                        </p>
                      </>
                    )}

                    {greenLotPublished && (
                      <div className="rounded-xl border border-[#b7cbb0] bg-[#e8f0e6] px-4 py-3 text-sm font-medium text-[#3a6b35]">
                        Live on marketplace — visible en Partner Dashboard &gt; verified
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {!partnerLoading && partnerLots.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
              No lots in IN_REVIEW or VERIFIED state. Advance a lot to DELIVERED in the shipping
              simulator above — the event handler will move it to IN_REVIEW automatically.
            </div>
          )}
        </div>


        {/* ================================================ */}
        {/* SECTION 3 — ORDER FLOW */}
        {/* ================================================ */}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[15px]">📦</span>
          <h2 className="text-[16px] font-semibold text-[#2f2418]">
            Order Flow
          </h2>
          <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
        </div>

        <div className="mb-16 rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-[#c4b28e] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#7a5230]">
              ✅ Real — /api/partner/orders/[id]/prepare
            </span>
            <span className="rounded-full border border-[#c4b28e] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#7a5230]">
              ✅ Real — /api/partner/orders/[id]/ready
            </span>
            <span className="rounded-full border border-[#c9b89a] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#9a6030]">
              ⚠️ Dev only — /api/dev/orders/seed
            </span>
          </div>
          <p className="text-sm text-[#7b6851]">
            Order creation is still dev-only. Auto-generation from Contract is
            not yet implemented — that flow will land in a later sprint. Use the
            seed button below to drop a fake Order in <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono">PENDING</code>{" "}
            (requires an existing RoastedBatch and Company).
          </p>

          <button
            type="button"
            onClick={seedOrder}
            disabled={seedingOrder}
            className="mt-5 rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {seedingOrder ? "Seeding..." : "+ Seed test order (dev)"}
          </button>
        </div>


        {/* ================================================ */}
        {/* SECTION 4 — SHIPMENT SIMULATOR (LOG-2) */}
        {/* ================================================ */}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[15px]">🚢</span>
          <h2 className="text-[16px] font-semibold text-[#2f2418]">
            Shipment Simulator
          </h2>
          <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
        </div>
        <p className="mb-2 text-sm text-[#6b5a45]">
          Simulate the origin-to-EU shipment bridge introduced in LOG-1.
          Creating a shipment flips the linked GreenLots from{" "}
          <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono text-[#7a5230]">PUBLISHED</code>
          {" "}to{" "}
          <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono text-[#7a5230]">RESERVED</code>.
        </p>
        <div className="mb-6 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-[#c4b28e] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#7a5230]">
            Auto-advance: IN_TRANSIT → ARRIVED → RECEIVED
          </span>
          <span className="rounded-full border border-[#c9b89a] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#9a6030]">
            DISCREPANCY blocks the production receive endpoint
          </span>
        </div>

        <div className="mb-6">
          <button
            type="button"
            onClick={seedShipment}
            disabled={seedingShipment}
            className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {seedingShipment ? "Seeding..." : "+ Seed test shipment"}
          </button>
        </div>

        <div className="mb-16 grid gap-5">
          {shipments.map((s) => (
            <ShipmentCard
              key={s.id}
              shipment={s}
              busy={busyShipmentId === s.id}
              onAdvance={() => advanceShipment(s.id)}
              onForce={(status) => forceShipmentStatus(s.id, status)}
            />
          ))}

          {!shipmentsLoading && shipments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
              No shipments yet. Use <strong>+ Seed test shipment</strong> to
              create one from the first PUBLISHED, unshipped GreenLot.
            </div>
          )}
        </div>


        {/* ================================================ */}
        {/* SECTION 5 — UNIFIED LOGISTICS TRACKING (LOG-3)   */}
        {/* ================================================ */}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[15px]">📍</span>
          <h2 className="text-[16px] font-semibold text-[#2f2418]">
            Unified Logistics Tracking
          </h2>
          <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
        </div>
        <p className="mb-6 text-sm text-[#6b5a45]">
          Read-only view of the current operational journey from origin sample
          movement to EU receipt. Shows sample lots, international shipments and
          the future destination roadmap as a chronological timeline.
        </p>

        <LogisticsTrackingPanel
          sampleLots={trackingSampleLots}
          shipments={trackingShipments}
          loading={trackingLoading}
        />

      </div>
    </div>
  )
}

//////////////////////////////////////////////////////
// 🚢 SHIPMENT CARD (dev tool)
//////////////////////////////////////////////////////

function ShipmentCard({
  shipment,
  busy,
  onAdvance,
  onForce,
}: {
  shipment: DevShipment
  busy: boolean
  onAdvance: () => void
  onForce: (status: DevShipmentStatus) => void
}) {
  const totalKg = shipment.greenLots.reduce(
    (sum, l) => sum + (l.totalKg ?? 0),
    0
  )

  const lotNumbers = shipment.greenLots
    .map((l) => l.lotNumber)
    .filter(Boolean)

  const statusClass =
    shipment.status === "IN_TRANSIT"  ? "bg-[#efe7da] text-[#7a5c2e]" :
    shipment.status === "ARRIVED"     ? "bg-[#fef3d7] text-[#7a5c0a]" :
    shipment.status === "RECEIVED"    ? "bg-[#e8f0e6] text-[#3a6b35]" :
                                        "bg-[#fbe2da] text-[#8a3a25]"

  return (
    <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

        {/* LEFT — identity + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#2f2418] tabular-nums">
              {shipment.reference}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
            >
              {shipment.status}
            </span>
          </div>

          <p className="mt-1 text-sm text-[#6b5a45]">
            {shipment.carrier ?? "Carrier TBD"}
            {shipment.vesselOrFlight ? ` · ${shipment.vesselOrFlight}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#6b5a45] sm:grid-cols-3 lg:max-w-2xl">
            <Meta label="ETA"        value={fmtDate(shipment.etaAt)} />
            <Meta label="Arrived at" value={fmtDate(shipment.arrivedAt)} />
            <Meta label="Received at" value={fmtDate(shipment.receivedAt)} />
            <Meta label="Lots"        value={`${shipment.greenLots.length}`} />
            <Meta label="Total"       value={`${Math.round(totalKg).toLocaleString()} kg`} mono />
            <Meta label="Lot #s"      value={lotNumbers.length > 0 ? lotNumbers.join(", ") : "—"} />
          </div>
        </div>

        {/* RIGHT — controls */}
        <div className="flex flex-col gap-3 lg:min-w-[420px]">
          <button
            type="button"
            onClick={onAdvance}
            disabled={busy}
            className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Updating..." : "Advance to next status"}
          </button>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {SHIPMENT_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onForce(status)}
                disabled={busy}
                className="rounded-xl border border-[#cfb48a] bg-[#f7efdf] px-3 py-2 text-xs font-medium text-[#5f472f] transition hover:bg-[#efe3ce] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#9a8b73]">
        {label}
      </div>
      <div
        className={`truncate text-[13px] text-[#2f2418] ${mono ? "tabular-nums" : ""}`}
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
