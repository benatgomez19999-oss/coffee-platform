"use client"

import { useEffect, useState } from "react"
import {
  buildProofCtaHref,
  formatProofBadge,
  formatProofMissingDetail,
} from "@/src/services/lot-media/proofReadinessLabels.pure"

//////////////////////////////////////////////////////
// 🧠 TYPES
//
// PRODUCER-PROOF-POLISH — row carries the advisory
// proofReady / proofMissing pair from
// /api/partner/export-ready so we can flag the rows
// the shipment-create guard will reject. The API
// returns machine codes; we map them through the
// pure helper before showing them to the operator.
//////////////////////////////////////////////////////

type GreenLot = {
  id: string
  lotNumber: string
  variety: string
  process: string
  harvestYear: number
  totalKg: number
  scaScore?: number
  farmId?: string | null
  producerDraft?: {
    id: string
  }
  proofReady?: boolean
  proofMissing?: string[]
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
        const res = await fetch("/api/partner/export-ready", {
          credentials: "include",
        })
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
            <ExportReadyRow
              key={lot.id}
              lot={lot}
              onPrint={() => {
                if (lot.producerDraft?.id) handlePrint(lot.producerDraft.id)
              }}
            />
          ))}

        </div>
      )}

    </div>
  )
}

// ------------------------------------------------------
// EXPORT READY ROW
// ------------------------------------------------------

function ExportReadyRow({
  lot,
  onPrint,
}: {
  lot: GreenLot
  onPrint: () => void
}) {
  const badge = formatProofBadge({
    proofReady: lot.proofReady,
    proofMissing: lot.proofMissing,
  })
  const isMissing = badge.tone === "warning"
  const ctaHref = buildProofCtaHref({
    lotId: lot.id,
    farmId: lot.farmId ?? undefined,
    focus: "private-proof",
  })

  return (
    <div className="bg-white border rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{lot.lotNumber}</p>
          <ProofBadge tone={badge.tone} label={badge.label} />
        </div>

        <p className="text-sm text-black/60">
          {lot.variety} • {lot.process} • {lot.harvestYear}
        </p>

        <p className="text-sm text-black/40">
          {lot.totalKg} kg • SCA {lot.scaScore ?? "-"}
        </p>

        {isMissing && (
          <p className="mt-2 text-xs text-[#a06b00]">
            {formatProofMissingDetail(lot.proofMissing)}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        {isMissing && (
          <a
            href={ctaHref}
            className="px-4 py-2 rounded-full border border-[#d6a72c] bg-[#fdf6e3] text-sm text-[#7a4f00] hover:bg-[#fbeec3]"
          >
            Add private proof
          </a>
        )}

        {lot.producerDraft?.id && (
          <button
            type="button"
            onClick={onPrint}
            className="px-4 py-2 rounded-full bg-black text-white text-sm"
          >
            Print
          </button>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// PROOF BADGE
// ------------------------------------------------------

function ProofBadge({
  tone,
  label,
}: {
  tone: "ok" | "warning"
  label: string
}) {
  const styles =
    tone === "ok"
      ? "bg-[#e6f4ea] text-[#1f7a3a] border-[#1f7a3a]/30"
      : "bg-[#fdf2d0] text-[#7a4f00] border-[#d6a72c]/40"
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] " +
        styles
      }
    >
      {label}
    </span>
  )
}
