"use client"

import { useState, useEffect, useRef } from "react"
import type { EngineState } from "@/engine/core/runtime"
import {
  submitOperationalRequest,
  injectSupply,
  acceptSuggestedVolume
} from "@/engine/core/runtime"

type Props = {
  engineState: EngineState
  updateContext: (partial: any) => void
}

export default function LeftPanel({ engineState, updateContext }: Props) {

  const { liveDecision, regions } = engineState

  

  // =====================================================
  // TOTAL AVAILABLE
  // =====================================================

  const totalAvailable =
    regions?.reduce((sum, r) => sum + r.availableKg, 0) ?? 0

  // =====================================================
  // DECISION ZONES
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
    zones?.maxLimit ?? totalAvailable

  const g = Math.max(0, Math.min(greenLimit, scaleMax))
  const y = Math.max(g, Math.min(yellowLimit, scaleMax))

  

  // =====================================================
  // UI STATE (SLIDER ONLY)
  // =====================================================

const [volume, setVolume] = useState(0)
const [injectionVolume, setInjectionVolume] = useState(5000)

const initialized = useRef(false)

useEffect(() => {

  if (initialized.current || scaleMax === 0) return

  initialized.current = true
  setVolume(scaleMax * 0.3)

}, [scaleMax])



  

  // =====================================================
  // UI COLORS
  // =====================================================

  const semaphoreColor =
    liveDecision?.semaphore === "green"
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

            <div>
  DEBUG VOLUME: {volume}
</div>
            {Math.round(volume)} kg / month
          </div>

          <button
            onClick={() => {

              updateContext({ requestedVolume: volume })

              submitOperationalRequest(volume)

            }}
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

      {/* CAPACITY FRONTIER */}

      <div style={{
        height: 6,
        borderRadius: 999,
        overflow: "hidden",
        display: "flex",
        marginBottom: 10
      }}>

        <div style={{
          width: `${(g / scaleMax) * 100}%`,
          background: "#4ade80"
        }}/>

        <div style={{
          width: `${((y - g) / scaleMax) * 100}%`,
          background: "#facc15"
        }}/>

        <div style={{
          width: `${((scaleMax - y) / scaleMax) * 100}%`,
          background: "#f87171"
        }}/>

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

      <input
  type="range"
  min={0}
  max={scaleMax || 1}
  value={Math.min(volume, scaleMax)}
  onChange={(e) =>
    setVolume(Number(e.target.value))
  }
  style={{
    width: "100%",
    marginBottom: 30
  }}
/>
      {/* ACTIVE OFFER */}

      {activeRequest?.offerOpen &&
       activeRequest?.suggestedVolume && (

        <div style={{
          marginTop: 24,
          padding: 22,
          borderRadius: 14,
          background: "rgba(250,204,21,0.05)",
          border: "1px solid rgba(250,204,21,0.4)"
        }}>

          <div style={{
            fontSize: 12,
            opacity: 0.6,
            marginBottom: 8
          }}>
            PARTIAL ALLOCATION AVAILABLE
          </div>

          <div style={{
            fontSize: 18,
            color: "#facc15",
            marginBottom: 12
          }}>
            {Math.round(activeRequest.suggestedVolume)} kg available now
          </div>

          {remainingTime !== null && (
            <div style={{
              fontSize: 12,
              opacity: 0.6,
              marginBottom: 14
            }}>
              Offer expires in {remainingTime}s
            </div>
          )}

          <button
            onClick={() =>
              acceptSuggestedVolume(activeRequest.id)
            }
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              background: "#facc15",
              color: "#111",
              cursor: "pointer"
            }}
          >
            Accept
          </button>

        </div>

      )}

      {/* SUPPLY INJECTION */}

      <div style={{ marginTop: 40 }}>

        <input
          type="range"
          min={1000}
          max={20000}
          step={500}
          value={injectionVolume}
          onChange={(e) =>
            setInjectionVolume(Number(e.target.value))
          }
          style={{ width: "100%" }}
        />

        <button
          onClick={() => injectSupply(injectionVolume)}
          style={{
            marginTop: 12,
            padding: "8px 18px",
            borderRadius: 999,
            border: "1px solid rgba(74,222,128,0.5)",
            background: "rgba(74,222,128,0.1)",
            color: "#4ade80"
          }}
        >
          Inject Supply
        </button>

      </div>

    </div>
  )
}