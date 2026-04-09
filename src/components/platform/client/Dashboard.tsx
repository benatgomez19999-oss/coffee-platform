"use client";

import React, { useEffect, useState } from "react";
import ClientTradingPanel from "@/src/components/platform/client/ClientTradingPanel"
import ClientContractsPanel from "@/src/components/platform/client/ClientContractsPanel"
import ClientOverviewPanel from "@/src/components/platform/client/ClientOverviewPanel"
import { useSearchParams } from "next/navigation"
import { initWebsocketClient }
from "@/src/websocket/websocketClient"
import { useRouter } from "next/navigation"


export default function Dashboard({ user }: { user: any }) {

const router = useRouter()
const [contracts, setContracts] = useState<any[]>([])
const [marketData, setMarketData] = useState<any>(null)

// ======================================================
// SUCCESSFUL CONTRACT
// ======================================================

const searchParams = useSearchParams()!

const contractSuccess =
  searchParams.get("contract") === "success"

const [showMessage, setShowMessage] = useState(contractSuccess)

useEffect(() => {

  if (contractSuccess) {

    const timer = setTimeout(() => {
      setShowMessage(false)
    }, 4000)

    return () => clearTimeout(timer)

  }

}, [contractSuccess])

// ======================================================
// LOAD CONTRACTS
// ======================================================

useEffect(() => {

  const loadContracts = async () => {
    try {
      const res = await fetch("/api/contracts", {
        credentials: "include"
      })

      if (!res.ok) return

      const data = await res.json()
      setContracts(data)

    } catch (err) {
      console.error("Error loading contracts", err)
    }
  }

  loadContracts()

}, [])

// ======================================================
// LOAD MARKET DATA
// ======================================================

useEffect(() => {
  const loadMarket = async () => {
    try {
      const res = await fetch("/api/market")
      if (!res.ok) return
      const data = await res.json()
      setMarketData(data)
    } catch (err) {
      console.error("Error loading market", err)
    }
  }
  loadMarket()
}, [])

// ======================================================
// RELOAD CONTRACTS ON SUCCESS
// ======================================================

useEffect(() => {

  if (contractSuccess) {

    const loadContracts = async () => {
      const res = await fetch("/api/contracts", {
        credentials: "include"
      })

      if (res.ok) {
        const data = await res.json()
        setContracts(data)
      }
    }

    loadContracts()

  }

}, [contractSuccess])

// ======================================================
// WEBSOCKET — REALTIME CONTRACT UPDATES
// ======================================================

useEffect(() => {
  initWebsocketClient()
}, [])


return (
  <>

{/* ====================================================== */}
{/* MAIN DASHBOARD */}
{/* ====================================================== */}
<div
  style={{
    minHeight: "100vh",
    background: "#0b0f0f",
    color: "white",
    paddingTop: "120px"
  }}
>

  {/* TITLE */}
  <div style={{ padding: "0 80px" }}>
    <h2 style={{
      fontWeight: 300,
      marginBottom: "40px"
    }}>
      Client Dashboard
    </h2>
  </div>

  {/* SUCCESS MESSAGE */}
  {showMessage && (
    <div
      style={{
        margin: "0 80px 30px 80px",
        padding: "16px 22px",
        borderRadius: 12,
        background: "rgba(74,222,128,0.1)",
        border: "1px solid rgba(74,222,128,0.3)",
        color: "#4ade80"
      }}
    >
      Contract activated successfully.
    </div>
  )}

  {/* GRID */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: "60px",
      padding: "0 80px"
    }}
  >

    {/* LEFT */}
    <ClientTradingPanel
      key={searchParams?.toString?.() || "default"}
      marketData={marketData}
    />

    {/* RIGHT */}
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      <ClientOverviewPanel marketData={marketData} />
      <ClientContractsPanel contracts={contracts} />
    </div>

  </div>

</div>

</>
)
}
