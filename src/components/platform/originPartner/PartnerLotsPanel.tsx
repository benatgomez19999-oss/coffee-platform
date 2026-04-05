"use client"

import { useEffect, useState } from "react"
import ExportReadyPanel from "@/src/components/platform/originPartner/ExportReadyPanel"

//////////////////////////////////////////////////////
// 🧠 TYPES
//////////////////////////////////////////////////////

type LotDraft = {
  id: string
  name: string | null
  variety: string
  process: string
  harvestYear: number
  parchmentKg: number
  status: string
}

//////////////////////////////////////////////////////
// 🧠 COMPONENT
//////////////////////////////////////////////////////

export default function PartnerLotsPanel() {

  //////////////////////////////////////////////////////
  // STATE
  //////////////////////////////////////////////////////

  const [lots, setLots] = useState<LotDraft[]>([])
  const [loading, setLoading] = useState(true)

  //////////////////////////////////////////////////////
  // FETCH LOTS (UNCHANGED)
  //////////////////////////////////////////////////////

  useEffect(() => {
    const fetchLots = async () => {
      try {
        const res = await fetch("/api/partner/lots")
        const data = await res.json()
        setLots(data)
      } catch (err) {
        console.error(err)
      }
      setLoading(false)
    }

    fetchLots()
  }, [])

  //////////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////////

  return (
    <div className="space-y-6">

      {/* ===================================================== */}
      {/* 📥 INCOMING LOTS */}
      {/* ===================================================== */}

      <div className="space-y-4">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-semibold">
            Incoming Lots
          </h1>

          <p className="text-sm text-black/60">
            Lots sent by producers awaiting lab verification
          </p>
        </div>

        {/* STATES */}
        {loading ? (
          <p>Loading...</p>
        ) : lots.length === 0 ? (
          <p>No lots to verify</p>
        ) : (
          <div className="space-y-4">

            {lots.map((lot) => (
              <div
                key={lot.id}
                className="bg-white border rounded-xl p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">
                    {lot.name || "Unnamed Lot"}
                  </p>

                  <p className="text-sm text-black/60">
                    {lot.variety} • {lot.process} • {lot.harvestYear}
                  </p>

                  <p className="text-sm text-black/40">
                    {lot.parchmentKg} kg
                  </p>
                </div>

                {/* ACTION */}
                <a
                  href={`/platform/partner/lots/${lot.id}`}
                  className="px-4 py-2 rounded-full bg-black text-white text-sm"
                >
                  Review
                </a>
              </div>
            ))}

          </div>
        )}

      </div>

      {/* ===================================================== */}
      {/* 🚀 EXPORT QUEUE */}
      {/* ===================================================== */}

      <ExportReadyPanel />

    </div>
  )
}