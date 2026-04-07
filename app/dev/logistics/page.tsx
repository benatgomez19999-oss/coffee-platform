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

type DevLot = {
  id: string
  name: string | null
  variety: string | null
  process: string | null
  status: LotDraftStatus
  sampleShippingStatus: SampleShippingStatus | null
}

const SHIPPING_FLOW: SampleShippingStatus[] = [
  "PICKUP_REQUESTED",
  "PICKUP_SCHEDULED",
  "IN_TRANSIT",
  "DELIVERED",
]

function getShippingLabel(status?: string | null) {
  switch (status) {
    case "PICKUP_REQUESTED":
      return "Recogida solicitada"
    case "PICKUP_SCHEDULED":
      return "Recogida programada"
    case "IN_TRANSIT":
      return "En tránsito"
    case "DELIVERED":
      return "Entregada al partner"
    default:
      return "Sin estado logístico"
  }
}

export default function DevLogisticsPage() {
  const [lots, setLots] = useState<DevLot[]>([])
  const [loading, setLoading] = useState(true)
  const [busyLotId, setBusyLotId] = useState<string | null>(null)

  //////////////////////////////////////////////////////
  // 🔥 LOAD LOTS
  //////////////////////////////////////////////////////

  const loadLots = async () => {
    try {
      const res = await fetch("/api/dev/logistics/lots", {
        credentials: "include",
        cache: "no-store",
      })

      if (!res.ok) {
        throw new Error("Failed to load logistics lots")
      }

      const data = await res.json()
      setLots(data)
    } catch (error) {
      console.error(error)
      alert("Error loading dev logistics lots")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLots()
  }, [])

  //////////////////////////////////////////////////////
  // 🔥 ADVANCE STATUS
  //////////////////////////////////////////////////////

  const advanceStatus = async (lotId: string) => {
    try {
      setBusyLotId(lotId)

      const res = await fetch("/api/dev/logistics/advance-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ lotId }),
      })

      if (!res.ok) {
        throw new Error("Failed to advance logistics status")
      }

      await loadLots()
    } catch (error) {
      console.error(error)
      alert("Error advancing logistics status")
    } finally {
      setBusyLotId(null)
    }
  }

  //////////////////////////////////////////////////////
  // 🔥 SET SPECIFIC STATUS
  //////////////////////////////////////////////////////

  const setStatus = async (lotId: string, nextStatus: SampleShippingStatus) => {
    try {
      setBusyLotId(lotId)

      const res = await fetch("/api/dev/logistics/advance-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          lotId,
          nextStatus,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to set logistics status")
      }

      await loadLots()
    } catch (error) {
      console.error(error)
      alert("Error setting logistics status")
    } finally {
      setBusyLotId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
        <p className="text-[#5f472f]">Loading dev logistics...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">
            Dev Tools
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">
            Logistics Simulator
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-[#6b5a45]">
            Simula cambios de estado logístico para comprobar cómo reaccionan
            las cards del producer dashboard sin ensuciar la UI principal.
          </p>
        </div>

        <div className="mb-6 flex gap-3">
          <a
            href="/platform/producer/dashboard"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open producer dashboard
          </a>

          <button
            onClick={loadLots}
            className="rounded-full border border-[#cfb48a] bg-white px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
          >
            Refresh lots
          </button>
        </div>

        <div className="grid gap-5">
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
                      Lot status: {lot.status}
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
                    {busyLotId === lot.id
                      ? "Updating..."
                      : "Advance to next shipping state"}
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
              No lots available for logistics simulation.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}