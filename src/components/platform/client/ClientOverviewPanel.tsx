"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Props = {
  marketData?: any
}

export default function ClientOverviewPanel({
  marketData
}: Props) {

  // ======================================================
  // ACTIVE CONTRACTS SOURCE OF TRUTH
  // ======================================================

 const [contracts, setContracts] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const searchParams = useSearchParams()
 const router = useRouter()

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
// PENDING INTENTS
// ======================================================

const [intents, setIntents] = useState<any[]>([])

useEffect(() => {
  async function loadIntents() {
    try {
      const res = await fetch("/api/demand-intent")
      if (!res.ok) return
      const data = await res.json()
      setIntents(data.intents ?? [])
    } catch (err) {
      console.error("LOAD INTENTS ERROR", err)
    }
  }
  loadIntents()
}, [])

const pendingIntents = intents.filter(
  i => i.status === "OPEN" || i.status === "COUNTERED" || i.status === "WAITING"
)

 // ======================================================
// SUCCESS PAYMENT MESSAGE
// ======================================================
useEffect(() => {
  const isSuccess = searchParams.get("payment") === "success"

  if (!isSuccess) return

 alert("Payment successful")

  router.replace("/platform")
  router.refresh()

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

const monthlyVolume =
  safeContracts
    .filter(c => c.status === "ACTIVE")
    .reduce(
      (sum, c) => sum + (c?.monthlyVolumeKg || 0),
      0
    )

  // ======================================================
  // AVAILABLE SUPPLY (FROM MARKET API — ROASTED)
  // ======================================================

  const totalAvailable = marketData?.totals?.roastedAvailableKg ?? 0
  const lotCount = marketData?.totals?.lotCount ?? 0

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
    "This will delete ALL contracts. Continue?"
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

    console.log("DB RESET DONE")

    location.reload()

  } catch (err) {

    console.error("RESET ERROR", err)
    alert("Reset failed")

  }

}

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
   CLIENT METRICS GRID (REAL DATA ONLY)
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

  {/* AVAILABLE SUPPLY */}

  <Metric
    label="Available Supply"
    value={`${Math.round(totalAvailable)} kg`}
  />

  {/* PUBLISHED LOTS */}

  <Metric
    label="Published Lots"
    value={lotCount}
  />

  {/* NEXT SHIPMENT */}

  <Metric
    label="Next Shipment"
    value={nextShipment}
  />

  {/* PENDING INTENTS */}

  <Metric
    label="Pending Intents"
    value={pendingIntents.length}
  />

</div>

{/* INTENT LIST */}

{pendingIntents.length > 0 && (
  <div style={{ marginTop: 24 }}>
    <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>
      Active Demand Intents
    </div>
    {pendingIntents.map((intent: any) => (
      <div key={intent.id} style={{
        padding: "12px 16px",
        marginBottom: 8,
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${
          intent.status === "OPEN" ? "rgba(74,222,128,0.3)"
          : intent.status === "COUNTERED" ? "rgba(250,204,21,0.3)"
          : "rgba(255,255,255,0.1)"
        }`
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span>{intent.requestedKg} kg/mo</span>
          <span style={{
            color: intent.status === "OPEN" ? "#4ade80"
              : intent.status === "COUNTERED" ? "#facc15"
              : "#aaa"
          }}>
            {intent.status}
          </span>
        </div>
        {intent.greenLot?.farm?.name && (
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
            {intent.greenLot.farm.name}
          </div>
        )}
      </div>
    ))}
  </div>
)}

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
