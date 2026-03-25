"use client"

import type { EngineState } from "@/engine/runtime"



import { computeSupplySecurityIndex }
from "@/decision/computeSupplySecurityIndex"

import { useEffect, useState } from "react"

type Props = {
  engineState: EngineState
}

import { getEngineContext } from "@/engine/runtime"

export default function ClientOverviewPanel({
  engineState
}: Props) {

  const { liveDecision, regions } = engineState

  // ======================================================
  // ACTIVE CONTRACTS SOURCE OF TRUTH
  // ======================================================

 const [contracts, setContracts] = useState<any[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {

  async function loadContracts() {

    try {

      const res = await fetch("/api/contracts")
      const data = await res.json()

      setContracts(data)

    } catch (err) {

      console.error("LOAD CONTRACTS ERROR", err)

    } finally {

      setLoading(false)

      

    }

  }

  loadContracts()

}, [])

 // ======================================================
// CONTRACT METRICS (SAFE)
// ======================================================

const safeContracts = Array.isArray(contracts)
  ? contracts
  : []

// ======================================================
// CONTRACT STATES (REAL LOGIC)
// ======================================================

const activeContracts = safeContracts.filter(
  c => c.status === "ACTIVE"
).length

const pendingSignature = safeContracts.filter(
  c => c.status === "AWAITING_SIGNATURE"
).length

const pendingPayment = safeContracts.filter(
  c =>
    c.status === "SIGNED" ||
    c.status === "PAYMENT_PENDING"
).length

const pendingSignatureContract = safeContracts.find(
  c => c.status === "AWAITING_SIGNATURE"
)

const pendingPaymentContract = safeContracts.find(
  c =>
    c.status === "SIGNED" ||
    c.status === "PAYMENT_PENDING"
)

// 👇 solo volumen activo REAL
const monthlyVolume =
  safeContracts
    .filter(c => c.status === "ACTIVE")
    .reduce(
      (sum, c) => sum + (c?.monthlyVolumeKg || 0),
      0
    )

  // ======================================================
  // AVAILABLE SUPPLY
  // ======================================================

  const totalAvailable =
    regions?.reduce(
      (sum, r) => sum + r.availableKg,
      0
    ) ?? 0

// ======================================================
// SYSTEM STATUS
// Neutral boot state when no request is active
// ======================================================

const context = getEngineContext()

const requestedVolume =
  context?.requestedVolume ?? 0

const semaphore =
  requestedVolume === 0
    ? "green"
    : liveDecision?.semaphore ?? "green"

const statusColor =
  semaphore === "green"
    ? "#4ade80"
    : semaphore === "yellow"
    ? "#facc15"
    : "#f87171"

  // ======================================================
  // RISK + HEALTH
  // ======================================================

  const riskScore =
    liveDecision?.riskScore ?? 0

  const coverageRatio =
    liveDecision?.coverageRatio ?? 1

  const contractHealth =
    coverageRatio > 1
      ? "Strong"
      : coverageRatio > 0.8
      ? "Stable"
      : "At Risk"

  // ======================================================
  // NEXT SHIPMENT
  // ======================================================

  const nextShipment =
  activeContracts > 0
    ? "Scheduled"
    : "Pending"

  // ======================================================
  // RESET CONTRACT (DEV TOOL)
  // ======================================================

 async function resetContracts() {

  const confirmReset = confirm(
    "⚠️ This will delete ALL contracts. Continue?"
  )

  if (!confirmReset) return

  try {

    const res = await fetch(
      "/api/dev/reset-contracts",
      { method: "POST" }
    )

    const json = await res.json()

    if (!res.ok) {
      alert(json.error || "Reset failed")
      return
    }

    console.log("🔥 DB RESET DONE")

    // recargar datos reales
    location.reload()

  } catch (err) {

    console.error("RESET ERROR", err)
    alert("Reset failed")

  }

}

  // ======================================================
  // SECURITY INDEX
  // ======================================================

  const supplySecurityIndex =
    computeSupplySecurityIndex(
      coverageRatio,
      riskScore,
      totalAvailable,
      monthlyVolume
    )

  const ssiColor =
    supplySecurityIndex > 80
      ? "#4ade80"
      : supplySecurityIndex > 60
      ? "#facc15"
      : "#f87171"

  // ======================================================
  // RENDER
  // ======================================================

  return (

    <div style={{

      padding: 30,
      borderRadius: 16,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)"

    }}>

      {/* RESET BUTTON */}

      <button
        onClick={resetContracts}
        style={{
          marginBottom: 20,
          padding: "6px 14px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,80,80,0.1)",
          cursor: "pointer"
        }}
      >
        Reset Contract
      </button>

      <div style={{
        fontSize: 16,
        marginBottom: 26
      }}>
        Client Overview
      </div>
{/* ======================================================
   CLIENT METRICS GRID
   Convierte métricas en panel analítico (2 columnas)
====================================================== */}

<div style={{

  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  columnGap: 30,
  rowGap: 26

}}>

  {/* ACTIVE CONTRACTS */}

 <Metric label="Active Contracts" value={activeContracts} />

<Metric label="Pending Signature" value={pendingSignature} />

{pendingSignature > 0 && pendingSignatureContract && (
  <button
    onClick={() => {
      window.location.href = `/contract/verify-otp?contractId=${pendingSignatureContract.id}`
    }}
    style={{
      marginTop: 10,
      padding: "10px 16px",
      borderRadius: 8,
      background: "#facc15",
      color: "#000",
      fontWeight: "bold",
      cursor: "pointer"
    }}
  >
    Complete Signature
  </button>
)}

<Metric label="Pending Payment" value={pendingPayment} />

{pendingPayment > 0 && pendingPaymentContract && (
  <button
    onClick={() => {
      window.location.href = `/contract/payment?contractId=${pendingPaymentContract.id}`
    }}
    style={{
      marginTop: 10,
      padding: "10px 16px",
      borderRadius: 8,
      background: "#4ade80",
      color: "#000",
      fontWeight: "bold",
      cursor: "pointer"
    }}
  >
    Complete Payment
  </button>
)}

  {/* MONTHLY VOLUME */}

  <Metric
    label="Monthly Volume"
    value={`${Math.round(monthlyVolume)} kg`}
  />

  {/* AVAILABLE UPSIDE */}

  <Metric
    label="Available Upside"
    value={`+${Math.round(totalAvailable)} kg`}
  />

  {/* SUPPLY STATUS */}

  <Metric
    label="Supply Status"
    value={semaphore.toUpperCase()}
    color={statusColor}
  />

  {/* NEXT SHIPMENT */}

  <Metric
    label="Next Shipment"
    value={nextShipment}
  />

  {/* CONTRACT HEALTH */}

  <Metric
    label="Contract Health"
    value={contractHealth}
  />

  {/* NETWORK RISK */}

  <Metric
    label="Network Risk"
    value={riskScore.toFixed(2)}
  />

  {/* ======================================================
   SUPPLY SECURITY INDEX
   Señal visual de seguridad de suministro
====================================================== */}

<div>

  <div style={{
    opacity: 0.6,
    fontSize: 13
  }}>
    Supply Security Index
  </div>

  <div style={{
    fontSize: 22,
    marginTop: 4,
    color: ssiColor
  }}>
    {supplySecurityIndex}/100
  </div>

  {/* BAR VISUAL */}

  <div style={{
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  }}>

    <div style={{
      width: `${supplySecurityIndex}%`,
      height: "100%",
      background: ssiColor,
      transition: "width 0.25s ease"
    }}/>

  </div>

</div>

 

</div>
</div>
  )

}


// ======================================================
// SMALL METRIC COMPONENT
// ======================================================

function Metric({
  label,
  value,
  color
}: {
  label: string
  value: string | number
  color?: string
}) {

  return (

    <div style={{ marginBottom: 22 }}>

      <div style={{
        opacity: 0.6,
        fontSize: 13
      }}>
        {label}
      </div>

      <div style={{
        fontSize: 22,
        marginTop: 4,
        color: color ?? "white"
      }}>
        {value}
      </div>

    </div>

  )

}