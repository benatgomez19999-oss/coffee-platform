"use client"

import { useEffect, useState } from "react"

export default function PartnerDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  //////////////////////////////////////////////////////
  // LOAD DATA
  //////////////////////////////////////////////////////

  useEffect(() => {
    fetch("/api/partner/dashboard", {
      credentials: "include"
    })
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-10 text-white">Loading...</div>
  }

  if (!data) {
    return <div className="p-10 text-red-400">Error loading</div>
  }

  return (
    <div className="p-8 text-white space-y-10">

      <h1 className="text-2xl">Partner Operations ⚙️</h1>

      {/* ================= LAB ================= */}
      <section>
        <h2 className="text-lg mb-4">🧪 Lab</h2>

        <div className="grid grid-cols-3 gap-6">

          <Column title="Incoming" count={data.incoming.length}>
            {data.incoming.map((lot: any) => (
              <LotCard
                key={lot.id}
                lot={lot}
                actionLabel="Analyze"
                onAction={() => openAnalyze(lot.id)}
              />
            ))}
          </Column>

          <Column title="Ready to Verify" count={data.readyToVerify.length}>
            {data.readyToVerify.map((lot: any) => (
              <LotCard
                key={lot.id}
                lot={lot}
                actionLabel="Create Lot"
                onAction={() => verifyLot(lot.id)}
              />
            ))}
          </Column>

          <Column title="Verified" count={data.verified?.length || 0}>
            {data.verified?.map((lot: any) => (
              <LotCard
                key={lot.id}
                lot={lot}
                status="Listed"
              />
            ))}
          </Column>

        </div>
      </section>

      {/* ================= EXPORT ================= */}
      <section>
        <h2 className="text-lg mb-4">📦 Export Preparation</h2>

        <div className="grid grid-cols-3 gap-6">

          <Column title="Orders" count={data.orders.length}>
            {data.orders.map((order: any) => (
              <LotCard
                key={order.id}
                lot={order}
                actionLabel="Prepare"
                onAction={() => prepareOrder(order.id)}
              />
            ))}
          </Column>

          <Column title="Preparing" count={data.preparing.length}>
            {data.preparing.map((order: any) => (
              <LotCard
                key={order.id}
                lot={order}
                actionLabel="Mark Ready"
                onAction={() => markReady(order.id)}
              />
            ))}
          </Column>

          <Column title="Ready" count={data.ready.length}>
            {data.ready.map((order: any) => (
              <LotCard
                key={order.id}
                lot={order}
                status="Waiting pickup"
              />
            ))}
          </Column>

        </div>
      </section>

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
        <h3 className="font-semibold">{title}</h3>
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
// CARD
//////////////////////////////////////////////////////

function LotCard({ lot, actionLabel, onAction, status }: any) {
  return (
    <div className="bg-black/40 p-4 rounded-lg border border-white/10">

      <p className="font-medium">
        {lot.name || lot.lot?.name}
      </p>

      <p className="text-xs text-white/40">
        {lot.variety || ""}
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
// ACTIONS
//////////////////////////////////////////////////////

function openAnalyze(id: string) {
  window.location.href = `/platform/partner/lots/${id}`
}

async function verifyLot(id: string) {
  await fetch(`/api/partner/lots/${id}/verify`, {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}

async function prepareOrder(id: string) {
  await fetch(`/api/partner/orders/${id}/prepare`, {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}

async function markReady(id: string) {
  await fetch(`/api/partner/orders/${id}/ready`, {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}