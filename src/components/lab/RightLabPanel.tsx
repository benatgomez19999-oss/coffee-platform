"use client"

import React from "react"
import type { EngineState, EngineContext } from "@/engine/runtime"
import EngineCalibrationPanel from "@/components/lab/EngineCalibrationPanel"

type Props = {
  safeEngineState: EngineState
  updateContext: (ctx: Partial<EngineContext>) => void
}

export default function RightLabPanel({
  safeEngineState,
  updateContext
}: Props) {

  const {
    pressureIndex,
    stabilityDrift,
    entropyGradient,
    transitionForce,
    interventionIndex
  } = safeEngineState.strategicVector

  const [scenario, setScenario] = React.useState<
    "Normal" | "Peak demand" | "Supply stress" | "Expansion phase"
  >("Normal")

  return (

    <div
      style={{
        height:"100%",
        display:"flex",
        flexDirection:"column",
        fontSize:"13px",
        letterSpacing:"0.8px",
        position:"relative"   // 👈 clave para posicionar calibración
      }}
    >

      {/* SIMULATION MODE */}

      <div>

        <div style={{opacity:0.5,marginBottom:"6px"}}>
          SIMULATION MODE
        </div>

        <select
          value={scenario}
          onChange={(e)=>{

            const mode = e.target.value as
              | "Normal"
              | "Peak demand"
              | "Supply stress"
              | "Expansion phase"

            setScenario(mode)

            updateContext({
              simulationMode:mode
            })

          }}
          style={{
            width:"100%",
            padding:"8px",
            background:"#0e141b",
            border:"1px solid rgba(255,255,255,0.08)",
            color:"#e5e7eb",
            fontFamily:"monospace"
          }}
        >

          <option>Normal</option>
          <option>Peak demand</option>
          <option>Supply stress</option>
          <option>Expansion phase</option>

        </select>

      </div>


      {/* STRATEGIC FIELD */}

      <div style={{marginTop:"32px"}}>

        <div style={{opacity:0.4,marginBottom:"10px"}}>
          STRATEGIC FIELD MONITOR
        </div>

        <FieldRow label="PRESSURE_BIAS" value={pressureIndex}/>
        <FieldRow label="STABILITY_DRIFT" value={stabilityDrift}/>
        <FieldRow label="ENTROPY_GRADIENT" value={entropyGradient}/>
        <FieldRow label="TRANSITION_FORCE" value={transitionForce}/>
        <FieldRow label="INTERVENTION_INDEX" value={interventionIndex} invert/>

      </div>


      <div
        style={{
          opacity:0.35,
          fontSize:"11px",
          marginTop:"16px"
        }}
      >
        runtime snapshot → strategic vector layer
      </div>


      {/* ENGINE CALIBRATION PANEL */}

      <div
        style={{
          position:"absolute",
          right:"40px",
          top:"410px"
        }}
      >
        <EngineCalibrationPanel/>
      </div>

    </div>

  )
}



function FieldRow({
  label,
  value,
  invert=false
}:{
  label:string
  value:number
  invert?:boolean
}){

  const level =
    value < 0.33
      ? "LOW"
      : value < 0.66
      ? "MODERATE"
      : "HIGH"

  const numeric = value.toFixed(2)

  let color="#6b7280"

  if(!invert){

    if(level==="LOW") color="#4ade80"
    if(level==="MODERATE") color="#facc15"
    if(level==="HIGH") color="#f87171"

  }else{

    if(level==="LOW") color="#f87171"
    if(level==="MODERATE") color="#facc15"
    if(level==="HIGH") color="#4ade80"

  }

  return(

    <div
      style={{
        display:"flex",
        justifyContent:"space-between",
        marginBottom:"10px"
      }}
    >

      <div style={{opacity:0.7}}>
        {label}
      </div>

      <div style={{color}}>
        {numeric} → {level}
      </div>

    </div>

  )

}