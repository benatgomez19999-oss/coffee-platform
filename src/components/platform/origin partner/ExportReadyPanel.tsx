"use client"

import { useEffect, useState } from "react"

//////////////////////////////////////////////////////
// 🧠 TYPES
//////////////////////////////////////////////////////

type GreenLot = {
  id: string
  lotNumber: string
  variety: string
  process: string
  harvestYear: number
  totalKg: number
  scaScore?: number
  producerDraft?: {
    id: string
  }
}

//////////////////////////////////////////////////////
// 🧠 COMPONENT
//////////////////////////////////////////////////////

export default function ExportReadyPanel() {

  //////////////////////////////////////////////////////
  // STATE
  //////////////////////////////////////////////////////

  const [lots, setLots] = useState<GreenLot[]>([])
  const [loading, setLoading] = useState(true)

  //////////////////////////////////////////////////////
  // FETCH (REAL GREEN LOTS)
  //////////////////////////////////////////////////////

  useEffect(() => {
    const fetchLots = async () => {
      try {
        const res = await fetch("/api/partner/export-ready")
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
  // PRINT
  //////////////////////////////////////////////////////

  function handlePrint(draftId: string) {
  window.open(`/platform/partner/lots/${draftId}/label`, "_blank")
}

  //////////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////////

  return (
    <div className="space-y-4 mt-10">

      {/* ===================================================== */}
      {/* 🟢 HEADER */}
      {/* ===================================================== */}

      <div>
        <h2 className="text-2xl font-semibold">
          Ready for Export
        </h2>

        <p className="text-sm text-black/60">
          Verified lots available for shipment preparation
        </p>
      </div>

      {/* ===================================================== */}
      {/* STATES */}
      {/* ===================================================== */}

      {loading ? (
        <p>Loading...</p>
      ) : lots.length === 0 ? (
        <p>No lots ready for export</p>
      ) : (
        <div className="space-y-4">

          {lots.map((lot) => (
            <div
              key={lot.id}
              className="bg-white border rounded-xl p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-bold">
                  {lot.lotNumber}
                </p>

                <p className="text-sm text-black/60">
                  {lot.variety} • {lot.process} • {lot.harvestYear}
                </p>

                <p className="text-sm text-black/40">
                  {lot.totalKg} kg • SCA {lot.scaScore ?? "-"}
                </p>
              </div>

              {lot.producerDraft?.id && (
              <button
              onClick={() => handlePrint(lot.producerDraft!.id)}
              className="px-4 py-2 rounded-full bg-black text-white text-sm"
              >
               Print
              </button>
               )}
               
            </div>
          ))}

        </div>
      )}

    </div>
  )
}