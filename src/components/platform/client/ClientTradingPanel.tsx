"use client"

import { useState, useEffect } from "react"

import {
  evaluateContractSuggestion
} from "@/src/clientLayer/layer/contractIntelligence"

import { selectContract, getSelectedContract }
from "@/src/clientLayer/layer/contractController"


type Props = {
  marketData?: any
}

export default function LeftPanel({ marketData }: Props) {

  // =====================================================
  // TOTAL AVAILABLE (FROM MARKET API — ROASTED KG)
  // =====================================================

  const totalAvailable = marketData?.totals?.roastedAvailableKg ?? 0
  const scaleMax = totalAvailable

  // =====================================================
  // VOLUME STATE
  // =====================================================

  const [volume, setVolume] = useState(0)
  const [suggestion, setSuggestion] = useState<any>(null)
  const [intentResult, setIntentResult] = useState<any>(null)
  const [intentLoading, setIntentLoading] = useState(false)

  // =====================================================
  // MARKET LOTS (for greenLotId selection)
  // =====================================================

  const allLots = marketData
    ? Object.values(marketData.regions as Record<string, any>).flatMap(
        (r: any) => r.lots
      )
    : []

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedLotId && allLots.length > 0) {
      setSelectedLotId(allLots[0].id)
    }
  }, [allLots.length])

  useEffect(() => {

    setVolume(v => {

      if (!Number.isFinite(v)) return 0

      return Math.max(0, Math.min(v, scaleMax))

    })

  }, [scaleMax])

  // =====================================================
  // CONTRACT INTELLIGENCE
  // =====================================================

  useEffect(() => {

    const selected = getSelectedContract()
    const s = evaluateContractSuggestion(volume, selected)
    setSuggestion(s)

  }, [volume])

  // =====================================================
  // SELECTED LOT INFO
  // =====================================================

  const selectedLot = allLots.find((l: any) => l.id === selectedLotId)

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div style={{ padding: 40 }}>

      <div style={{ opacity: 0.7, marginBottom: 20 }}>
        Contract Request
      </div>

      {/* SELECTED LOT SUMMARY */}

      {selectedLot && (
        <div style={{
          padding: 18,
          borderRadius: 12,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 30
        }}>
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            SELECTED LOT
          </div>
          <div style={{ marginTop: 6, fontSize: 14 }}>
            {selectedLot.name ?? selectedLot.coffee?.variety ?? "Lot"} — {selectedLot.origin?.farmName}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5 }}>
            {selectedLot.volume?.roastedAvailableKg} kg available
            {selectedLot.pricing?.roastedPricePerKg != null && (
              <> · ${selectedLot.pricing.roastedPricePerKg}/kg</>
            )}
          </div>
        </div>
      )}

      {/* REQUEST BOX */}

      <div style={{
        padding: 28,
        borderRadius: 16,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 24
      }}>

        <div style={{
          display: "flex",
          justifyContent: "space-between"
        }}>

          <div style={{ fontSize: 20 }}>
            {Math.round(volume)} kg / month
          </div>

        </div>

        <div style={{ marginTop: 8, opacity: 0.5, fontSize: 12 }}>
          Available: {Math.round(totalAvailable)} kg roasted
        </div>

      </div>

    {/* =====================================================
   VOLUME BAR — simple fill against totalAvailable
===================================================== */}

{scaleMax > 0 && (
<>
<div style={{ position: "relative", marginBottom: 22 }}>

  {/* REQUEST MARKER */}

  <div style={{
    position: "absolute",
    left: `${(volume / scaleMax) * 100}%`,
    top: -12,
    transform: "translateX(-50%)",
    fontSize: 12,
    color: "#ffffff",
    pointerEvents: "none"
  }}>
    ▲
  </div>

  {/* FILL BAR */}

  <div style={{
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "0 0 6px rgba(0,0,0,0.4)"
  }}>
    <div style={{
      width: `${(volume / scaleMax) * 100}%`,
      height: "100%",
      background: volume / scaleMax < 0.65 ? "#4ade80"
        : volume / scaleMax < 0.9 ? "#facc15"
        : "#f87171",
      transition: "width 0.15s ease"
    }}/>
  </div>

</div>

      {/* SCALE LABELS */}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
        opacity: 0.5,
        marginBottom: 20
      }}>
        <span>0</span>
        <span>{Math.round(scaleMax)} kg</span>
      </div>

      {/* SLIDER */}

        <input
          type="range"
          min={0}
          max={scaleMax}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVolume(v)
          }}
          style={{
            width: "100%",
            marginBottom: 30
          }}
        />
</>
)}

      {/* CONTRACT INTELLIGENCE */}

{suggestion && (

  <div style={{
    marginTop: 20,
    padding: 18,
    borderRadius: 12,
    background: "rgba(74,222,128,0.08)",
    border: "1px solid rgba(74,222,128,0.4)"
  }}>

    <div style={{ fontSize: 13, opacity: 0.7 }}>
      Contract Intelligence Suggestion
    </div>

    <div style={{ marginTop: 6 }}>
      Suggested upgrade: +{suggestion.delta} kg/month
    </div>

    <button
     onClick={async () => {

  if (!selectedLotId || intentLoading) return

  const contract = getSelectedContract()
  const v = Math.round(volume)

  setIntentLoading(true)
  try {
    const res = await fetch("/api/demand-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        greenLotId: selectedLotId,
        requestedKg: v,
        type: contract ? "AMEND" : "CREATE",
        contractId: contract?.id ?? undefined,
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Intent error:", data)
      setIntentResult({ error: data.error })
      return
    }

    setIntentResult(data)

    // GREEN → go to contract wizard
    if (data.semaphore?.status === "green") {
      window.location.href =
        `/contract/create?mode=${contract ? "amend" : "create"}&contractId=${contract?.id ?? ""}&volume=${v}&intentId=${data.intent.id}`
    }

  } catch (err) {
    console.error("Intent request failed:", err)
  } finally {
    setIntentLoading(false)
  }

}}
      disabled={intentLoading}
      style={{
        marginTop: 12,
        padding: "8px 18px",
        borderRadius: 999,
        border: "none",
        background: intentLoading ? "#888" : "#4ade80",
        color: "#111",
        cursor: intentLoading ? "not-allowed" : "pointer"
      }}
    >
      {intentLoading ? "Processing..." : "Request Contract"}
    </button>

  </div>

)}

      {/* INTENT RESULT FEEDBACK */}

      {intentResult?.semaphore?.status === "yellow" && intentResult.intent && (
        <div style={{
          marginTop: 20,
          padding: 18,
          borderRadius: 12,
          background: "rgba(250,204,21,0.08)",
          border: "1px solid rgba(250,204,21,0.4)"
        }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Counteroffer</div>
          <div style={{ marginTop: 6 }}>
            Requested: {intentResult.intent.requestedKg} kg/month
          </div>
          <div>
            Offered: {intentResult.intent.offeredKg} kg/month
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/demand-intent/${intentResult.intent.id}/accept`, { method: "POST" })
                  if (res.ok) {
                    const contract = getSelectedContract()
                    window.location.href =
                      `/contract/create?mode=${contract ? "amend" : "create"}&contractId=${contract?.id ?? ""}&volume=${intentResult.intent.offeredKg}&intentId=${intentResult.intent.id}`
                  }
                } catch (err) {
                  console.error("Accept failed:", err)
                }
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                background: "#facc15",
                color: "#111",
                cursor: "pointer"
              }}
            >
              Accept Offer
            </button>
            <button
              onClick={async () => {
                try {
                  await fetch(`/api/demand-intent/${intentResult.intent.id}/cancel`, { method: "POST" })
                  setIntentResult(null)
                } catch (err) {
                  console.error("Cancel failed:", err)
                }
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "white",
                cursor: "pointer"
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {intentResult?.semaphore?.status === "red" && intentResult.intent && (
        <div style={{
          marginTop: 20,
          padding: 18,
          borderRadius: 12,
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.4)"
        }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Insufficient Supply</div>
          <div style={{ marginTop: 6 }}>
            Requested volume exceeds available capacity.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <button
              onClick={async () => {
                try {
                  await fetch(`/api/demand-intent/${intentResult.intent.id}/wait`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ autoExecute: false })
                  })
                  setIntentResult((prev: any) => ({
                    ...prev,
                    intent: { ...prev.intent, status: "WAITING" }
                  }))
                } catch (err) {
                  console.error("Wait failed:", err)
                }
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                background: "#f87171",
                color: "#111",
                cursor: "pointer"
              }}
            >
              Wait for Supply
            </button>
            <button
              onClick={async () => {
                try {
                  await fetch(`/api/demand-intent/${intentResult.intent.id}/cancel`, { method: "POST" })
                  setIntentResult(null)
                } catch (err) {
                  console.error("Cancel failed:", err)
                }
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "white",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {intentResult?.intent?.status === "WAITING" && (
        <div style={{
          marginTop: 20,
          padding: 18,
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.12)"
        }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Waiting for Supply</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            You will be notified when supply becomes available.
          </div>
        </div>
      )}

      {intentResult?.error && (
        <div style={{
          marginTop: 20,
          padding: 14,
          borderRadius: 12,
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.3)",
          color: "#f87171",
          fontSize: 13
        }}>
          {intentResult.error}
        </div>
      )}

      {/* LOT SELECTOR */}

      {allLots.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
            Select Coffee Lot
          </div>
          <select
            value={selectedLotId ?? ""}
            onChange={(e) => setSelectedLotId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              fontSize: 14
            }}
          >
            {allLots.map((lot: any) => (
              <option key={lot.id} value={lot.id} style={{ background: "#1a1a1a" }}>
                {lot.name ?? lot.coffee?.variety ?? "Lot"} — {lot.origin?.farmName} ({lot.volume?.roastedAvailableKg} kg)
              </option>
            ))}
          </select>
        </div>
      )}

    </div>
  )
}
