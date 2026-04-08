"use client"

import { useEffect, useState } from "react"

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
  const [lots, setLots] = useState<DevLot[]>([])
  const [loading, setLoading] = useState(true)
  const [busyLotId, setBusyLotId] = useState<string | null>(null)

  const [partnerLots, setPartnerLots] = useState<DevPartnerLot[]>([])
  const [partnerLoading, setPartnerLoading] = useState(true)
  const [busyPartnerId, setBusyPartnerId] = useState<string | null>(null)

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

  const loadAll = () => {
    loadLots()
    loadPartnerLots()
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
        {/* SECTION 3 — ORDER FLOW (placeholder) */}
        {/* ================================================ */}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[15px]">📦</span>
          <h2 className="text-[16px] font-semibold text-[#2f2418]">
            Order Flow
          </h2>
          <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
        </div>

        <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8">
          <p className="text-sm font-medium text-[#7a5230]">
            ⛔ No implementado todavía
          </p>
          <p className="mt-2 text-sm text-[#7b6851]">
            Las rutas <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono">/api/partner/orders/[id]/prepare</code> y{" "}
            <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 text-xs font-mono">/api/partner/orders/[id]/ready</code> están
            referenciadas en el dashboard pero no existen aún en el backend.
            Los buckets <strong>orders → preparing → ready</strong> del Partner Dashboard
            requieren estas rutas antes de poder simularlos aquí.
          </p>
        </div>

      </div>
    </div>
  )
}
