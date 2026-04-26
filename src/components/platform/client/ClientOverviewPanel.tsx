"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect } from "react"

type Props = {
  marketData?: any
  contracts?: any[]
  intents?: any[]
}

export default function ClientOverviewPanel({
  marketData,
  contracts = [],
  intents = [],
}: Props) {

  // ======================================================
  // CONTRACTS / INTENTS ARRIVE AS PROPS FROM Dashboard.tsx
  // (lifted up to avoid duplicate fetches and to feed the
  // hero metric strip from the same source)
  // ======================================================

  const searchParams = useSearchParams()
  const router = useRouter()

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
  // CONTRACT METRICS (REAL DATA ONLY)
  // ======================================================

  const safeContracts = Array.isArray(contracts) ? contracts : []

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
  // PENDING INTENTS (REAL DATA, FROM PROP)
  // ======================================================

  const pendingIntents = intents.filter(
    i =>
      i.status === "OPEN" ||
      i.status === "COUNTERED" ||
      i.status === "WAITING"
  )

  // ======================================================
  // AVAILABLE SUPPLY (FROM MARKET API — ROASTED)
  // ======================================================

  const totalAvailable = marketData?.totals?.roastedAvailableKg ?? 0
  const lotCount = marketData?.totals?.lotCount ?? 0

  // ======================================================
  // NEXT SHIPMENT (DERIVED FROM REAL CONTRACT STATE)
  // ======================================================

  const nextShipment =
    activeContracts > 0
      ? "Scheduled"
      : "Pending"

  // ======================================================
  // RESET CONTRACTS (DEV TOOL)
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
    <div
      style={{
        padding: 30,
        borderRadius: 18,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.07)"
      }}
    >

      {/* PANEL HEADER */}
      <div style={{ marginBottom: 26 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(212,175,55,0.75)",
            marginBottom: 8
          }}
        >
          Contract Portfolio
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#EDE8DF",
            fontWeight: 300,
            letterSpacing: "-0.005em"
          }}
        >
          Active commitments &amp; supply
        </div>
      </div>

      {/* =====================================================
         CLIENT METRICS GRID (REAL DATA ONLY)
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 26,
          rowGap: 24
        }}
      >

        <Metric label="Active Contracts" value={activeContracts} />

        <Metric label="Pending Signature" value={pendingSignature} />

        <Metric label="Pending Payment" value={pendingPayment} />

        <Metric
          label="Monthly Volume"
          value={`${Math.round(monthlyVolume).toLocaleString("en-US")} kg`}
        />

        <Metric
          label="Available Supply"
          value={`${Math.round(totalAvailable).toLocaleString("en-US")} kg`}
        />

        <Metric label="Published Lots" value={lotCount} />

        <Metric label="Next Shipment" value={nextShipment} />

        <Metric label="Pending Intents" value={pendingIntents.length} />

      </div>

      {/* =====================================================
         INLINE ACTIONS — only when there is something to do
      ===================================================== */}

      {(pendingSignature > 0 || pendingPayment > 0) && (
        <div
          style={{
            marginTop: 22,
            paddingTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap"
          }}
        >

          {pendingSignature > 0 && pendingSignatureContract && (
            <button
              onClick={() => {
                window.location.href = `/contract/verify-otp?contractId=${pendingSignatureContract.id}`
              }}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "#facc15",
                color: "#111",
                fontWeight: 500,
                fontSize: 13,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.02em"
              }}
            >
              Complete Signature
            </button>
          )}

          {pendingPayment > 0 && pendingPaymentContract && (
            <button
              onClick={() => {
                window.location.href = `/contract/payment?contractId=${pendingPaymentContract.id}`
              }}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "#4ade80",
                color: "#111",
                fontWeight: 500,
                fontSize: 13,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.02em"
              }}
            >
              Complete Payment
            </button>
          )}

        </div>
      )}

      {/* =====================================================
         INTENT LIST — real DemandIntent rows
      ===================================================== */}

      {pendingIntents.length > 0 && (
        <div
          style={{
            marginTop: 24,
            paddingTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.06)"
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(237,232,223,0.5)",
              marginBottom: 12
            }}
          >
            Active Demand Intents
          </div>

          {pendingIntents.map((intent: any) => (
            <div
              key={intent.id}
              style={{
                padding: "12px 16px",
                marginBottom: 8,
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${
                  intent.status === "OPEN"
                    ? "rgba(74,222,128,0.3)"
                    : intent.status === "COUNTERED"
                    ? "rgba(250,204,21,0.3)"
                    : "rgba(255,255,255,0.1)"
                }`
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13
                }}
              >
                <span>{intent.requestedKg} kg/mo</span>
                <span
                  style={{
                    color:
                      intent.status === "OPEN"
                        ? "#4ade80"
                        : intent.status === "COUNTERED"
                        ? "#facc15"
                        : "#aaa",
                    letterSpacing: "0.06em",
                    fontSize: 11
                  }}
                >
                  {intent.status}
                </span>
              </div>
              {intent.greenLot?.farm?.name && (
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.5,
                    marginTop: 4
                  }}
                >
                  {intent.greenLot.farm.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* =====================================================
         DEV TOOLS — demoted to footer, less prominent
      ===================================================== */}

      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          justifyContent: "flex-end"
        }}
      >
        <button
          onClick={resetContracts}
          style={{
            padding: "5px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "transparent",
            color: "rgba(255,255,255,0.35)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer"
          }}
          title="Developer-only: deletes all contracts"
        >
          dev · reset
        </button>
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
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(237,232,223,0.5)",
          marginBottom: 6
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 20,
          fontWeight: 300,
          letterSpacing: "-0.01em",
          color: color ?? "#EDE8DF"
        }}
      >
        {value}
      </div>
    </div>
  )

}
