"use client"

import { useEffect, useState } from "react"
import { useEngineRuntime } from "@/src/hooks/useEngineRuntime"

import LeftPanel from "@/src/components/lab/LeftPanel"
import RightLabPanel from "@/src/components/lab/RightLabPanel"
import EngineResearchPanel from "@/src/components/lab/EngineResearchPanel"
import AIControlPanel from "@/src/components/lab/AIControlPanel"
import CommodityMarketPanel
from "@/src/components/lab/CommodityMarketPanel"
import StrategyLeaderboardPanel
from "@/src/components/lab/StrategyLeaderboardPanel"

export default function EngineLabPage() {

  // =====================================================
  // ENGINE RUNTIME
  // =====================================================

  const { state, updateContext } = useEngineRuntime()
  const safeEngineState = state

  // =====================================================
  // LOCAL LAB STATE
  // =====================================================

  const [latency] = useState(12)
  const [signalHealth] = useState(1)
  const [commitmentPressure] = useState(0)
  const [shockLevel] = useState(0)

  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [autonomousMode, setAutonomousMode] = useState(false)

  const [resilienceMemory] = useState(0.5)

  // =====================================================
  // CONTEXT INJECTION
  // =====================================================

  useEffect(() => {

    updateContext({
      simulationSpeed
    })

  }, [simulationSpeed, updateContext])

  useEffect(() => {
    console.log("UI simulationSpeed changed →", simulationSpeed)
  }, [simulationSpeed])

  useEffect(() => {

  updateContext({
    autonomousMode
  })

}, [autonomousMode, updateContext])


  // =====================================================
  // UI
  // =====================================================

  return (

    <div
  style={{
    minHeight: "100vh",
    width: "100vw",
    background: "radial-gradient(circle at top, #0b1118, #05070a 60%)",
    color: "#e5e7eb",
    display: "flex",
    flexDirection: "column",
    fontFamily: "monospace"
  }}
>

      {/* HEADER */}

      <div
        style={{
          padding: "18px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          letterSpacing: "2px",
          fontSize: "13px",
          opacity: 0.8
        }}
      >
        ENGINE LAB — DEVELOPMENT ENVIRONMENT
      </div>


      {/* GRID */}

     <div
  style={{
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr auto",
    overflow: "auto"
  }}
>

        {/* LEFT PANEL */}

        <div
          style={{
            borderRight: "1px solid rgba(255,255,255,0.05)",
            padding: "24px"
          }}
        >
          <LeftPanel
            engineState={safeEngineState}
            updateContext={updateContext}
          />
        </div>


        {/* RIGHT PANEL */}

        <div
          style={{
            padding: "24px"
          }}
        >

          <RightLabPanel
            safeEngineState={safeEngineState}
            updateContext={updateContext}
          />

        </div>


        {/* BOTTOM RESEARCH PANEL */}

        <div
          style={{
            gridColumn: "1 / span 2",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "24px",
            background: "rgba(255,255,255,0.02)"
          }}
        >

          <EngineResearchPanel
  safeEngineState={safeEngineState}
  simulationSpeed={simulationSpeed}
  setSimulationSpeed={setSimulationSpeed}
  resilienceMemory={resilienceMemory}
/>

<AIControlPanel
  autonomousMode={autonomousMode}
  setAutonomousMode={setAutonomousMode}
/>

<div
  style={{
    gridColumn: "1 / span 2",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    padding: "24px",
    background: "rgba(255,255,255,0.02)",
  }}
>

  <CommodityMarketPanel
    engineState={safeEngineState}
  />

</div>

</div>

    </div>
    <div
  style={{
    borderTop: "1px solid rgba(255,255,255,0.05)",
    padding: "24px",
    background: "rgba(255,255,255,0.02)",
  }}
>

  <StrategyLeaderboardPanel
    engineState={safeEngineState}
  />

</div>
    </div>

  )

  

}