"use client";

import React, { useEffect, useRef, useState } from "react";
import ClientTradingPanel from "@/src/components/platform/client/ClientTradingPanel"
import ClientContractsPanel from "@/src/components/platform/client/ClientContractsPanel"
import ClientOverviewPanel from "@/src/components/platform/client/ClientOverviewPanel"
import PlatformHeader from "@/src/components/shared/general/PlatformHeader"
import CoffeeLoader from "@/src/components/shared/general/CoffeeLoader"
import { hideNavOverlay } from "@/src/lib/navigationOverlay"
import { useSearchParams } from "next/navigation"
import { initWebsocketClient }
from "@/src/websocket/websocketClient"
import { useRouter } from "next/navigation"


export default function Dashboard({ user }: { user: any }) {

const router = useRouter()
const [contracts, setContracts] = useState<any[]>([])
const [marketData, setMarketData] = useState<any>(null)
const [intents, setIntents] = useState<any[]>([])

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
// LOAD DEMAND INTENTS
// (Lifted from ClientOverviewPanel so the hero counter
// and the panel share a single read. Same endpoint, same
// status filter — no DemandIntent logic change.)
// ======================================================

useEffect(() => {
  const loadIntents = async () => {
    try {
      const res = await fetch("/api/demand-intent")
      if (!res.ok) return
      const data = await res.json()
      setIntents(data.intents ?? [])
    } catch (err) {
      console.error("Error loading intents", err)
    }
  }
  loadIntents()
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

// ======================================================
// 🧹 NAV OVERLAY CLEANUP
// La landing inyecta un overlay con la cherry en
// #nav-overlay-root antes de hacer router.push("/platform").
// El destino debe limpiarlo al montar — mismo patrón que
// usa ProducerView. Sin esto, la cherry se queda visible
// encima del dashboard cuando se entra desde la landing.
// ======================================================

useEffect(() => {
  hideNavOverlay()
}, [])

// ======================================================
// 🎬 LOADER ANIMATION
// Mismo patrón que ProducerView: CoffeeLoader corre la
// secuencia completa (cherry → green → roasted → fade)
// y al terminar hace fade-in del dashboard. Funciona
// igual desde landing, login y F5.
// ======================================================

const hasEnteredRef = useRef(false)
const [entered, setEntered] = useState(false)

const handleFinish = () => {
  if (hasEnteredRef.current) return
  hasEnteredRef.current = true
  setEntered(true)
}

// ======================================================
// HERO METRICS — REAL DATA ONLY
// ======================================================

const roastedAvailableKg = marketData?.totals?.roastedAvailableKg ?? 0
const activeContractsCount = contracts.filter(
  (c: any) => c?.status === "ACTIVE"
).length
const pendingIntentsCount = intents.filter(
  (i: any) =>
    i?.status === "OPEN" ||
    i?.status === "COUNTERED" ||
    i?.status === "WAITING"
).length


return (
  <>

{/* ====================================================== */}
{/* ☕ COFFEE LOADER (cherry → green → roasted → fade) */}
{/* ====================================================== */}
{!entered && <CoffeeLoader onFinish={handleFinish} />}

{/* ====================================================== */}
{/* 🎬 DASHBOARD (fade-in al terminar el loader) */}
{/* ====================================================== */}
<div
  className={`transition-opacity duration-700 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
>

{/* ====================================================== */}
{/* SHARED PLATFORM HEADER (role-aware — themes from user.role) */}
{/* ====================================================== */}
<PlatformHeader user={user} />

{/* ====================================================== */}
{/* MAIN DASHBOARD */}
{/* ====================================================== */}
<div
  style={{
    minHeight: "100vh",
    background: "#0b0f0f",
    color: "white",
    paddingTop: "100px"
  }}
>

  {/* =================================================== */}
  {/* HERO — PRIVATE COFFEE SUPPLY DESK                   */}
  {/* =================================================== */}
  <section
    style={{
      padding: "60px 80px 44px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background:
        "radial-gradient(ellipse at 80% 0%, rgba(212,175,55,0.05), transparent 55%)"
    }}
  >
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(212,175,55,0.75)",
        marginBottom: 18
      }}
    >
      Private Coffee Supply Desk
    </div>

    <h1
      style={{
        fontSize: "clamp(2.2rem, 3.6vw, 3rem)",
        fontWeight: 300,
        letterSpacing: "-0.02em",
        color: "#EDE8DF",
        margin: 0,
        lineHeight: 1.1
      }}
    >
      Your Coffee Supply Desk
    </h1>

    <p
      style={{
        marginTop: 18,
        maxWidth: 640,
        fontSize: "1rem",
        lineHeight: 1.7,
        color: "rgba(237,232,223,0.62)",
        fontWeight: 300
      }}
    >
      Direct, verified roasted coffee supply — coordinated end-to-end with your sourcing partners.
      Track availability, manage commitments, and request volume against published lots.
    </p>

    {/* HERO METRIC STRIP — REAL DATA ONLY */}
    <div
      style={{
        marginTop: 36,
        paddingTop: 28,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 24,
        maxWidth: 880
      }}
    >
      <HeroMetric
        label="Available Roasted Supply"
        value={`${formatKg(roastedAvailableKg)} kg`}
        accent
      />
      <HeroMetric
        label="Active Contracts"
        value={String(activeContractsCount)}
      />
      <HeroMetric
        label="Pending Intents"
        value={String(pendingIntentsCount)}
      />
    </div>
  </section>

  {/* =================================================== */}
  {/* SUCCESS MESSAGE                                      */}
  {/* =================================================== */}
  {showMessage && (
    <div
      style={{
        margin: "30px 80px 0",
        padding: "14px 22px",
        borderRadius: 12,
        background: "rgba(74,222,128,0.08)",
        border: "1px solid rgba(74,222,128,0.28)",
        color: "#9be8b3",
        fontSize: 13,
        letterSpacing: "0.02em"
      }}
    >
      Contract activated successfully.
    </div>
  )}

  {/* =================================================== */}
  {/* MAIN GRID                                            */}
  {/* =================================================== */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
      gap: 40,
      padding: "44px 80px 100px"
    }}
  >

    {/* LEFT — TRADING / SUPPLY DESK */}
    <ClientTradingPanel
      key={searchParams?.toString?.() || "default"}
      marketData={marketData}
    />

    {/* RIGHT — PORTFOLIO + CONTRACTS */}
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <ClientOverviewPanel
        marketData={marketData}
        contracts={contracts}
        intents={intents}
      />
      <ClientContractsPanel contracts={contracts} />
    </div>

  </div>

</div>

</div>

</>
)
}


// ======================================================
// HERO METRIC — small subcomponent for hero strip only
// ======================================================

function HeroMetric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(237,232,223,0.5)",
          marginBottom: 10
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(1.5rem, 2vw, 1.85rem)",
          fontWeight: 300,
          letterSpacing: "-0.01em",
          color: accent ? "#E8C770" : "#EDE8DF"
        }}
      >
        {value}
      </div>
    </div>
  )
}

function formatKg(v: number): string {
  return Math.round(v).toLocaleString("en-US")
}
