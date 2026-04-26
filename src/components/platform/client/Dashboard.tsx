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


// ======================================================
// PALETTE — page-level tokens (kept inline; no theme file)
// ======================================================

const COLORS = {
  bg:         "#08100d",
  bgDeep:     "#070b09",
  textPrimary:"#f4efe3",
  textMuted:  "rgba(244,239,227,0.62)",
  textFaint:  "rgba(244,239,227,0.38)",
  gold:       "#d6b04f",
  goldSoft:   "rgba(214,176,79,0.22)",
  goldFaint:  "rgba(214,176,79,0.08)",
  cardBg:     "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)",
  cardBorder: "1px solid rgba(214,176,79,0.18)",
  divider:    "1px solid rgba(255,255,255,0.06)",
}


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
{/* MAIN DASHBOARD                                         */}
{/* ====================================================== */}
<div
  style={{
    minHeight: "100vh",
    background: `radial-gradient(ellipse at 0% 0%, rgba(214,176,79,0.04), transparent 55%), ${COLORS.bg}`,
    color: COLORS.textPrimary,
    paddingTop: "100px"
  }}
>

  {/* =================================================== */}
  {/* HERO                                                 */}
  {/* =================================================== */}
  <section
    style={{
      position: "relative",
      maxWidth: 1440,
      margin: "0 auto",
      padding: "0 80px",
    }}
  >
    <div
      style={{
        position: "relative",
        borderRadius: 24,
        overflow: "hidden",
        minHeight: 360,
        border: COLORS.cardBorder,
        background: `
          radial-gradient(ellipse at 80% 0%, rgba(214,176,79,0.06), transparent 50%),
          linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))
        `,
      }}
    >

      {/* RIGHT — IMAGE + GRADIENT BLEND */}
      <div
        style={{
          position: "absolute",
          right: 0, top: 0, bottom: 0,
          width: "55%",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <img
          src="/images/hero_prod_dashboard.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            // Fall back to atmospheric gradient if asset is missing
            ;(e.currentTarget as HTMLImageElement).style.display = "none"
          }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(90deg, " +
              COLORS.bg + " 0%, " +
              "rgba(8,16,13,0.85) 25%, " +
              "rgba(8,16,13,0.35) 55%, " +
              "rgba(8,16,13,0.05) 100%)",
          }}
        />
      </div>

      {/* LEFT — CONTENT */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 620,
          padding: "56px 56px 40px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: COLORS.gold,
            opacity: 0.85,
            marginBottom: 22,
          }}
        >
          Private Coffee Supply Desk
        </div>

        <h1
          style={{
            fontSize: "clamp(2.4rem, 3.8vw, 3.4rem)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: COLORS.textPrimary,
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          Your Coffee Supply Desk
        </h1>

        <p
          style={{
            marginTop: 18,
            maxWidth: 520,
            fontSize: "0.98rem",
            lineHeight: 1.7,
            color: COLORS.textMuted,
            fontWeight: 300,
          }}
        >
          Direct, verified roasted coffee supply — coordinated end-to-end with
          your sourcing partners. Track availability, manage commitments, and
          request volume against published lots.
        </p>

        {/* THIN GOLD RULE */}
        <div
          style={{
            marginTop: 30,
            width: "100%",
            height: 1,
            background:
              "linear-gradient(90deg, rgba(214,176,79,0.45) 0%, rgba(214,176,79,0.05) 100%)",
          }}
        />

        {/* HERO METRIC STRIP — REAL DATA */}
        <div
          style={{
            marginTop: 26,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            columnGap: 24,
            rowGap: 18,
          }}
        >
          <HeroMetric
            icon={<LeafIcon />}
            label="Available Roasted Supply"
            value={`${formatKg(roastedAvailableKg)} kg`}
            sub="Across all regions"
          />
          <HeroMetric
            icon={<DocIcon />}
            label="Active Contracts"
            value={String(activeContractsCount)}
            sub="Current agreements"
          />
          <HeroMetric
            icon={<ClockIcon />}
            label="Pending Intents"
            value={String(pendingIntentsCount)}
            sub="Open, countered or waiting"
          />
        </div>

      </div>
    </div>
  </section>

  {/* =================================================== */}
  {/* SUCCESS BANNER                                       */}
  {/* =================================================== */}
  {showMessage && (
    <div
      style={{
        maxWidth: 1440,
        margin: "20px auto 0",
        padding: "0 80px",
      }}
    >
      <div
        style={{
          padding: "14px 22px",
          borderRadius: 12,
          background: "rgba(74,222,128,0.07)",
          border: "1px solid rgba(74,222,128,0.25)",
          color: "#9be8b3",
          fontSize: 13,
          letterSpacing: "0.02em",
        }}
      >
        Contract activated successfully.
      </div>
    </div>
  )}

  {/* =================================================== */}
  {/* MAIN GRID                                            */}
  {/* =================================================== */}
  <div
    style={{
      maxWidth: 1440,
      margin: "0 auto",
      padding: "32px 80px 80px",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
      gap: 28,
    }}
  >

    {/* ========== LEFT COLUMN ========== */}
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {/* SUPPLY DESK (anchored for CTA scrolling) */}
      <ClientTradingPanel
        key={searchParams?.toString?.() || "default"}
        marketData={marketData}
      />

      {/* SOURCING RELATIONSHIP (static trust card — no fake activity) */}
      <SourcingRelationshipCard />
    </div>

    {/* ========== RIGHT COLUMN ========== */}
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <ClientOverviewPanel
        marketData={marketData}
        contracts={contracts}
        intents={intents}
      />
      <ClientContractsPanel contracts={contracts} />
      <NeedHelpCard />
    </div>

  </div>

</div>

</div>

</>
)
}


// ======================================================
// HERO METRIC — icon circle + label/value/sub
// ======================================================

function HeroMetric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: COLORS.goldFaint,
          border: `1px solid ${COLORS.goldSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.gold,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: COLORS.textFaint,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            color: COLORS.gold,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}


// ======================================================
// SOURCING RELATIONSHIP — static trust card
// (No fake activity rows. Static copy only.)
// ======================================================

function SourcingRelationshipCard() {
  return (
    <div
      style={{
        padding: 30,
        borderRadius: 22,
        background: COLORS.cardBg,
        border: COLORS.cardBorder,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: COLORS.gold,
          opacity: 0.85,
          marginBottom: 8,
        }}
      >
        Sourcing Relationship
      </div>
      <div
        style={{
          fontSize: 18,
          color: COLORS.textPrimary,
          fontWeight: 400,
          letterSpacing: "-0.005em",
          marginBottom: 14,
        }}
      >
        Direct relationships. Verified quality.
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.75,
          color: COLORS.textMuted,
          fontWeight: 300,
          maxWidth: 540,
        }}
      >
        We work exclusively with trusted origin partners to bring consistent,
        traceable, premium Colombian coffee — coordinated through long-term
        sourcing agreements rather than open-market speculation.
      </p>
    </div>
  )
}


// ======================================================
// NEED HELP — informational card
// (Static copy. No invented routing.)
// ======================================================

function NeedHelpCard() {

  function handleSupportClick() {
    // No automated support flow exists yet. Surface honestly
    // rather than route to a fake destination.
    alert("Please reach out to your account manager directly.")
  }

  return (
    <div
      style={{
        padding: 26,
        borderRadius: 22,
        background: COLORS.cardBg,
        border: COLORS.cardBorder,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            color: COLORS.textPrimary,
            fontWeight: 400,
            letterSpacing: "-0.005em",
            marginBottom: 6,
          }}
        >
          Need help?
        </div>
        <div
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            lineHeight: 1.6,
          }}
        >
          Your account manager is here to support your sourcing needs.
        </div>
      </div>

      <button
        type="button"
        onClick={handleSupportClick}
        style={{
          flexShrink: 0,
          padding: "10px 18px",
          borderRadius: 999,
          border: `1px solid ${COLORS.goldSoft}`,
          background: "transparent",
          color: COLORS.gold,
          fontSize: 13,
          letterSpacing: "0.04em",
          cursor: "pointer",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = COLORS.goldFaint
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = "transparent"
        }}
      >
        Contact Support
      </button>
    </div>
  )
}


// ======================================================
// ICONS — inline SVG line icons (no external deps)
// ======================================================

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17C3 9 9 3 17 3C17 11 11 17 3 17Z" />
      <path d="M3 17C6 14 10 11 14 9" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5H12L17 7.5V17.5H5V2.5Z" />
      <path d="M12 2.5V7.5H17" />
      <path d="M7.5 11H14.5" />
      <path d="M7.5 14H12.5" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6V10L13 12" />
    </svg>
  )
}


// ======================================================
// HELPERS
// ======================================================

function formatKg(v: number): string {
  return Math.round(v).toLocaleString("en-US")
}
