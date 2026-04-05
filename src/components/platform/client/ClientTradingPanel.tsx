"use client"

import { useState, useEffect } from "react"
import type { EngineState } from "@/src/engine/core/runtime"
import { submitOperationalRequest } from "@/src/engine/core/runtime"
import { acceptSuggestedVolume } from "@/src/engine/core/runtime"
import RegionsSupplyChart from "@/src/components/shared/RegionsSupplyChart"

import {
  evaluateContractSuggestion
} from "@/src/clientLayer/layer/contractIntelligence"

import { selectContract, getSelectedContract }
from "@/src/clientLayer/layer/contractController"


type Props = {
  engineState: EngineState
  updateContext: (partial: any) => void
}

export default function LeftPanel({ engineState, updateContext }: Props) {

  const { liveDecision } = engineState

  // =====================================================
  // REAL SUPPLY (BACKEND SOURCE OF TRUTH)
  // =====================================================

  const [realSupply, setRealSupply] = useState(0)

  useEffect(() => {

    const loadSupply = async () => {
      try {
        const res = await fetch("/api/supply")

        if (!res.ok) return

        const data = await res.json()

        setRealSupply(data.totalKg ?? 0)

      } catch (err) {
        console.error("Supply error", err)
      }
    }

    loadSupply()

  }, [])

  // =====================================================
  // TOTAL AVAILABLE (REAL, NO SIMULATION)
  // =====================================================

  const totalAvailable = realSupply

  // =====================================================
  // DECISION ZONES (ENGINE DRIVEN BUT REAL SCALE)
  // =====================================================

  const zones = liveDecision?.decisionZones

  const greenLimit =
    zones?.greenLimit && zones.greenLimit > 0
      ? zones.greenLimit
      : totalAvailable * 0.65

  const yellowLimit =
    zones?.yellowLimit && zones.yellowLimit > 0
      ? zones.yellowLimit
      : totalAvailable * 0.9

  const scaleMax =
    zones?.maxLimit && zones.maxLimit > 0
      ? zones.maxLimit
      : totalAvailable

  // =====================================================
  // CLAMPED ZONES (SAFETY BOUNDS)
  // =====================================================

  const g = Math.max(0, Math.min(greenLimit, scaleMax))
  const y = Math.max(g, Math.min(yellowLimit, scaleMax))

  // =====================================================
  // VOLUME STATE
  // =====================================================

  const [volume, setVolume] = useState(0)
  const [suggestion, setSuggestion] = useState<any>(null)

  useEffect(() => {

    setVolume(v => {

      if (!Number.isFinite(v)) return 0

      return Math.max(0, Math.min(v, scaleMax))

    })

  }, [scaleMax])

  // =====================================================
  // ENGINE SIGNAL (REQUESTED VOLUME → ENGINE)
  // =====================================================

  useEffect(() => {

    updateContext({ requestedVolume: volume })

  }, [volume])

  // =====================================================
  // CONTRACT INTELLIGENCE
  // =====================================================

  useEffect(() => {

    const selected = getSelectedContract()
    const s = evaluateContractSuggestion(volume, selected)
    setSuggestion(s)

  }, [volume])

  // =====================================================
  // UI COLORS
  // =====================================================

  const isBoot = volume === 0

  const semaphoreColor = isBoot
    ? "#ffffff"
    : liveDecision?.semaphore === "green"
    ? "#4ade80"
    : liveDecision?.semaphore === "yellow"
    ? "#facc15"
    : "#f87171"

  // =====================================================
  // ACTIVE REQUEST
  // =====================================================

  const activeRequest =
    engineState.pending.requests[0] ?? null

  const now = engineState.engineTime

  const remainingTime =
    activeRequest?.offerExpiry
      ? Math.max(0, Math.floor((activeRequest.offerExpiry - now) / 1000))
      : null

  // =====================================================
  // CONFIRM HANDLER (NEW ARCHITECTURE)
  // =====================================================

  function handleConfirm() {

    // =====================================================
    // OPERATIONAL REQUEST
    // El sistema decide GREEN / YELLOW / RED
    // =====================================================

    submitOperationalRequest(
      Math.round(volume),
      "manual"
    )

  }

    

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div style={{ padding: 40 }}>

      <div style={{ opacity: 0.7, marginBottom: 20 }}>
        Capacity Signal Simulation
      </div>

      {/* STATUS */}

      <div style={{
        padding: 18,
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 30
      }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>
          SYSTEM STATUS
        </div>

        <div style={{
          marginTop: 6,
          fontSize: 14,
          color: semaphoreColor
        }}>
          {liveDecision?.semaphore?.toUpperCase()}
        </div>
      </div>

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

          <div style={{
            fontSize: 20,
            color: semaphoreColor
          }}>
            {Math.round(volume)} kg / month
          </div>

          <button
            onClick={handleConfirm}
            style={{
              padding: "10px 24px",
              borderRadius: 999,
              background: "linear-gradient(90deg,#d4af37,#f3d27a)",
              border: "none",
              cursor: "pointer"
            }}
          >
            Confirm
          </button>

        </div>

        <div style={{ marginTop: 8, opacity: 0.7 }}>
          {liveDecision?.explanation?.[0]}
        </div>

      </div>

    {/* =====================================================
   CAPACITY FRONTIER
   Visual envelope de capacidad del sistema
   Verde → zona segura
   Amarillo → zona de presión
   Rojo → zona de riesgo
===================================================== */}

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

  {/* FRONTIER BAR */}

  <div style={{

    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",

    boxShadow: "0 0 6px rgba(0,0,0,0.4)"

  }}>

    {/* SAFE ZONE */}

    <div style={{
      width: `${(g / scaleMax) * 100}%`,
      background: "#4ade80",
      transition: "width 0.25s ease"
    }}/>

    {/* PRESSURE ZONE */}

    <div style={{
      width: `${((y - g) / scaleMax) * 100}%`,
      background: "#facc15",
      transition: "width 0.25s ease"
    }}/>

    {/* RISK ZONE */}

    <div style={{
      width: `${((scaleMax - y) / scaleMax) * 100}%`,
      background: "#f87171",
      transition: "width 0.25s ease"
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
        <span>{Math.round(g)}</span>
        <span>{Math.round(y)}</span>
        <span>{Math.round(scaleMax)}</span>
      </div>

      {/* SLIDER */}

      {scaleMax > 0 && (
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
     onClick={() => {

  const contract = getSelectedContract()
  const v = Math.round(volume)

  // =====================================================
  // SAVE WIZARD INTENT (no abre todavía)
  // =====================================================

  sessionStorage.setItem(
    "contractIntent",
    JSON.stringify({
      mode: contract ? "amend" : "create",
      contractId: contract?.id ?? null,
      volume: v
    })
  )

  // =====================================================
  // SEND OPERATIONAL REQUEST
  // =====================================================

  submitOperationalRequest(v, "manual")

}}
      style={{
        marginTop: 12,
        padding: "8px 18px",
        borderRadius: 999,
        border: "none",
        background: "#4ade80",
        color: "#111",
        cursor: "pointer"
      }}
    >
      Accept Upgrade
    </button>

  </div>

)}

{/* =====================================================
   OPERATIONAL COUNTER OFFER
===================================================== */}

{activeRequest?.offerOpen && (

  <div style={{
    marginTop: 20,
    padding: 18,
    borderRadius: 12,
    background: "rgba(250,204,21,0.08)",
    border: "1px solid rgba(250,204,21,0.4)"
  }}>

    <div style={{ fontSize: 13, opacity: 0.7 }}>
      Partial Capacity Available
    </div>

    <div style={{ marginTop: 6 }}>
      Requested: {activeRequest.remainingVolume} kg
    </div>

    <div>
      Available now: {activeRequest.suggestedVolume} kg
    </div>

    <div style={{
  display: "flex",
  gap: 12,
  marginTop: 14
}}>

{/* ACCEPT PARTIAL */}

<button
  onClick={() => {

    if (!activeRequest) return

    // =====================================================
    // VOLUME ACCEPTED BY SYSTEM
    // =====================================================

    const executedVolume =
      activeRequest.suggestedVolume

    // =====================================================
    // EXECUTE PARTIAL ALLOCATION
    // =====================================================

    acceptSuggestedVolume(activeRequest.id)

    // =====================================================
    // RETRIEVE CONTRACT INTENT
    // =====================================================

    const intent =
      sessionStorage.getItem("contractIntent")

    if (!intent) return

    const data = JSON.parse(intent)

    // =====================================================
    // OPEN CONTRACT WIZARD
    // Contract reflects real executed volume
    // =====================================================

    window.location.href =
      `/contract/create?mode=${data.mode}&contractId=${data.contractId ?? ""}&volume=${executedVolume}`

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
  Accept Available
</button>

  {/* AUTO EXECUTE */}

  <button
    style={{
      padding: "8px 18px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.2)",
      background: "transparent",
      color: "white",
      cursor: "pointer"
    }}
  >
    Auto Execute
  </button>

</div>

    {remainingTime && (
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Offer expires in {remainingTime}s
      </div>
    )}

  </div>

)}

      {/* REGIONS */}

      <div style={{ marginTop: 40 }}>

        <div style={{
          fontSize: 12,
          opacity: 0.6,
          marginBottom: 20
        }}>
          Network Capacity Overview
        </div>
    <RegionsSupplyChart engineState={engineState} />
      </div>

    </div>
  )
}