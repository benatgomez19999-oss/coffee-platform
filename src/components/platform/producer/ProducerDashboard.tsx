"use client"

import { useEffect, useState } from "react"

export default function ProducerDashboard({ user }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  //////////////////////////////////////////////////////
  // LOAD DATA
  //////////////////////////////////////////////////////

  useEffect(() => {
    fetch("/api/producer/dashboard", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-10 text-white">Loading...</div>
  }

  if (!data) {
    return <div className="p-10 text-red-400">Error loading data</div>
  }

  //////////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////////

  return (
    <div className="p-8 text-white">

      <h1 className="text-2xl mb-8">Your Coffee Pipeline ☕</h1>

      <div className="grid grid-cols-4 gap-6">

        {/* ================= DRAFTS ================= */}
        <Column title="Drafts" count={data.drafts.length}>
          {data.drafts.map((lot: any) => (
            <LotCard
              key={lot.id}
              lot={lot}
              actionLabel="Send Sample"
              onAction={() => sendSample(lot.id)}
            />
          ))}
        </Column>

        {/* ================= IN LAB ================= */}
        <Column title="In Lab" count={data.inLab.length}>
          {data.inLab.map((lot: any) => (
            <LotCard
              key={lot.id}
              lot={lot}
              status="Waiting analysis"
            />
          ))}
        </Column>

        {/* ================= VERIFIED ================= */}
        <Column title="Verified" count={data.verified.length}>
          {data.verified.map((lot: any) => (
            <LotCard
              key={lot.id}
              lot={lot}
              status={`${lot.availableKg} kg available`}
            />
          ))}
        </Column>

        {/* ================= SOLD ================= */}
        <Column title="Sold" count={data.sold.length}>
          {data.sold.map((lot: any) => (
            <LotCard
              key={lot.id}
              lot={lot}
              status="Sold"
            />
          ))}
        </Column>

      </div>
    </div>
  )
}

//////////////////////////////////////////////////////
// COLUMN
//////////////////////////////////////////////////////

function Column({ title, count, children }: any) {
  return (
    <div className="bg-neutral-900 p-4 rounded-xl border border-white/10">

      <div className="flex justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-white/40">{count}</span>
      </div>

      <div className="flex flex-col gap-3">
        {children.length > 0 ? children : (
          <p className="text-white/30 text-sm">No items</p>
        )}
      </div>

    </div>
  )
}

//////////////////////////////////////////////////////
// LOT CARD
//////////////////////////////////////////////////////

function LotCard({ lot, actionLabel, onAction, status }: any) {
  return (
    <div className="bg-black/40 p-4 rounded-lg border border-white/10">

      <p className="font-medium">{lot.name}</p>

      <p className="text-sm text-white/40">
        {lot.variety} · {lot.process}
      </p>

      {status && (
        <p className="text-xs text-white/50 mt-2">
          {status}
        </p>
      )}

      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-3 w-full bg-white text-black py-2 rounded-md text-sm hover:bg-neutral-200"
        >
          {actionLabel}
        </button>
      )}

    </div>
  )
}

//////////////////////////////////////////////////////
// ACTION
//////////////////////////////////////////////////////

async function sendSample(lotId: string) {
  try {
    await fetch(`/api/producer/lot/${lotId}/send-to-lab`, {
      method: "POST",
      credentials: "include"
    })

    window.location.reload()

  } catch (err) {
    alert("Error sending sample")
  }
}