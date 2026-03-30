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
}

//////////////////////////////////////////////////////
// 🧠 MAIN DASHBOARD
//////////////////////////////////////////////////////

export default function OriginPartnerDashboard() {

  //////////////////////////////////////////////////////
  // STATE
  //////////////////////////////////////////////////////

  const [lots, setLots] = useState<GreenLot[]>([])

  //////////////////////////////////////////////////////
  // LOAD LOTS (TEMP → luego service/API)
  //////////////////////////////////////////////////////

  useEffect(() => {
    fetch("/api/partner/export-ready")
      .then(res => res.json())
      .then(setLots)
  }, [])

  //////////////////////////////////////////////////////
  // PRINT
  //////////////////////////////////////////////////////

  function handlePrint(lotId: string) {
    // 👉 abre label en nueva pestaña
    window.open(`/platform/partner/lots/${lotId}/label`, "_blank")
  }

  //////////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////////

  return (
    <div className="p-6 space-y-6">

      {/* ===================================================== */}
      {/* 🟢 TITLE */}
      {/* ===================================================== */}

      <h1 className="text-2xl font-bold">
        Origin Partner Dashboard
      </h1>

      {/* ===================================================== */}
      {/* 📦 EXPORT QUEUE */}
      {/* ===================================================== */}

      <div className="space-y-4">

        <h2 className="text-xl font-semibold">
          Ready for Export
        </h2>

        {lots.length === 0 && (
          <div className="text-gray-500">
            No lots ready
          </div>
        )}

        {lots.map((lot) => (
          <div
            key={lot.id}
            className="border p-4 flex justify-between items-center"
          >
            <div>
              <div className="font-bold">
                {lot.lotNumber}
              </div>

              <div className="text-sm text-gray-600">
                {lot.variety} • {lot.process} • {lot.harvestYear}
              </div>

              <div className="text-sm">
                {lot.totalKg} kg • SCA {lot.scaScore ?? "-"}
              </div>
            </div>

            <button
              onClick={() => handlePrint(lot.id)}
              className="px-4 py-2 bg-black text-white"
            >
              Print Label
            </button>
          </div>
        ))}

      </div>

    </div>
  )
}