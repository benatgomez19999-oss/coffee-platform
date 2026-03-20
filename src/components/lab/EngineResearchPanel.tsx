"use client"

import React from "react"

type Props = {
  safeEngineState: any
  simulationSpeed: number
  setSimulationSpeed: (v: number) => void
  resilienceMemory?: number
}

// ======================================================
// ENGINE RESEARCH MODE — ULTRA (LAB VERSION)
// Visualiza snapshot.
// No ejecuta física.
// ======================================================

export default function EngineResearchPanel({
  safeEngineState,
  simulationSpeed,
  setSimulationSpeed,
  resilienceMemory = 0
}: Props) {

  const historyRef = React.useRef<Record<string, number>>({})

  const getTrend = (key: string, value: number) => {
    const prev = historyRef.current[key] ?? value
    historyRef.current[key] = value
    return value - prev
  }

  const Bar = ({ value, min, max, color }: any) => {
    const range = max - min
    const normalized =
      range === 0
        ? 0
        : Math.max(0, Math.min(1, (value - min) / range))

    return (
      <div
        style={{
          height: "3px",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "2px",
          overflow: "hidden",
          marginTop: "3px"
        }}
      >
        <div
          style={{
            width: `${normalized * 100}%`,
            height: "100%",
            background: color,
            transition: "width 0.1s linear"
          }}
        />
      </div>
    )
  }

  const Metric = ({ label, value, min, max, invertRisk = false }: any) => {

    const trend = getTrend(label, value)
    const range = max - min

    const nearUpperEdge = value > max - range * 0.1
    const accelerating = Math.abs(trend) > range * 0.02

    let color = "#4ade80"

    if (!Number.isFinite(value)) {
      color = "#ef4444"
    } else {
      if (invertRisk) {
        if (value < min + range * 0.2) color = "#ef4444"
        else if (value < min + range * 0.35) color = "#f97316"
        else if (accelerating) color = "#facc15"
      } else {
        if (nearUpperEdge && accelerating) color = "#ef4444"
        else if (nearUpperEdge) color = "#f97316"
        else if (accelerating) color = "#facc15"
      }
    }

    const trendSymbol =
      trend > 0.0001 ? "▲"
      : trend < -0.0001 ? "▼"
      : "▬"

    return (
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            fontFamily: "monospace",
            color
          }}
        >
          <span>{label}</span>
          <span>
            {Number.isFinite(value) ? value.toFixed(4) : "NaN"} {trendSymbol}
          </span>
        </div>
        <Bar value={value} min={min} max={max} color={color} />
      </div>
    )
  }

  const Section = ({ title, children }: any) => (
    <div
      style={{
        marginBottom: "18px",
        paddingBottom: "10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)"
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontFamily: "monospace",
          letterSpacing: "1px",
          opacity: 0.6,
          marginBottom: "8px"
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )

  const entropy =
    Math.abs(safeEngineState.pressureMomentum) * 0.3 +
    safeEngineState.systemFatigue * 0.3 +
    safeEngineState.shockLevel * 0.2 +
    Math.abs(safeEngineState.regimeDriftSignal) * 0.2

  const bifurcationProximity =
    safeEngineState.collapseProximity * 0.4 +
    safeEngineState.ewsScore * 0.3 +
    safeEngineState.criticalSlowing * 0.3

  const coherence = 1 - entropy

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px",
        background: "rgba(0,0,0,0.25)",
        borderRadius: "12px",
        backdropFilter: "blur(6px)"
      }}
    >

      <Section title="SIMULATION CONTROL">

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            fontFamily: "monospace",
            marginBottom: "10px"
          }}
        >
          <span>simulationSpeed</span>
          <span>{simulationSpeed.toFixed(2)}x</span>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[0.5, 1, 2, 4, 8, 16].map((s) => {

            const active = simulationSpeed === s

            return (
       <button
  key={s}
  onMouseDown={(e) => {
    e.preventDefault()
    console.log("SET SPEED VIA MOUSEDOWN", s)
    setSimulationSpeed(s)
  }}
  style={{
    padding: "4px 10px",
    fontSize: "11px",
    fontFamily: "monospace",
    borderRadius: "6px",
    border: simulationSpeed === s
      ? "1px solid #4ade80"
      : "1px solid rgba(255,255,255,0.1)",
    background: simulationSpeed === s
      ? "rgba(74,222,128,0.15)"
      : "rgba(255,255,255,0.03)",
    color: simulationSpeed === s
      ? "#4ade80"
      : "rgba(255,255,255,0.7)",
    cursor: "pointer",
    userSelect: "none"
  }}
>
  {s}x
</button>
            )
          })}
        </div>

      </Section>

      <Section title="DYNAMIC STABILITY">
        <Metric label="energy" value={safeEngineState.systemEnergy} min={0} max={1} />
        <Metric label="fatigue" value={safeEngineState.systemFatigue / 0.3} min={0} max={1} />
        <Metric label="lyapunov" value={safeEngineState.lyapunovIndicator} min={0} max={1} />
        <Metric label="guardThrottle" value={safeEngineState.guardThrottle} min={0} max={1} invertRisk />
      </Section>

      <Section title="MOMENTUM FIELD">
        <Metric label="momentum" value={safeEngineState.pressureMomentum} min={-0.2} max={0.2} />
        <Metric label="stochastic" value={safeEngineState.stochasticPressure} min={-0.5} max={0.5} />
        <Metric label="shockLevel" value={safeEngineState.shockLevel} min={0} max={1} />
        <Metric label="shockActivity" value={safeEngineState.shockActivity} min={0} max={1} />
      </Section>

      <Section title="MEMORY STRUCTURE">
        <Metric label="pathMemory" value={safeEngineState.pathMemory} min={0} max={1} />
        <Metric label="patternMemory" value={safeEngineState.patternMemory} min={0} max={1} />
        <Metric label="stressScar" value={safeEngineState.stressScar} min={0} max={0.5} />
        <Metric label="thresholdMemory" value={safeEngineState.thresholdMemory} min={0} max={1} />
        <Metric label="resilienceMemory" value={resilienceMemory} min={0} max={1} />
      </Section>

      <Section title="REGIME DYNAMICS">
        <Metric label="regimeDrift" value={safeEngineState.regimeDriftSignal} min={0} max={1} />
        <Metric label="regimePersistence" value={safeEngineState.regimePersistence} min={0} max={1} />
        <Metric label="switchPressure" value={safeEngineState.regimeSwitchPressure} min={0} max={1} />
        <Metric label="criticalSlowing" value={safeEngineState.criticalSlowing} min={0} max={1} />
      </Section>

      <Section title="STRUCTURAL RISK">
        <Metric label="collapseProximity" value={safeEngineState.collapseProximity} min={0} max={1} />
        <Metric label="collapseProbability" value={safeEngineState.collapseProbability} min={0} max={1} />
        <Metric label="ewsScore" value={safeEngineState.ewsScore} min={0} max={1} />
        <Metric label="resilienceBudget" value={safeEngineState.resilienceBudget} min={0} max={1} invertRisk />
      </Section>

      <Section title="META STRUCTURE">
        <Metric label="entropy" value={entropy} min={0} max={1} />
        <Metric label="bifurcationRisk" value={bifurcationProximity} min={0} max={1} />
        <Metric label="coherence" value={coherence} min={0} max={1} invertRisk />
      </Section>

    </div>
  )
}