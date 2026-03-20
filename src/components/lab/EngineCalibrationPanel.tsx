"use client"

import { useState } from "react"
import { updateEngineCalibration } from "@/engine/runtime"

export default function EngineCalibrationPanel() {

  const [values,setValues] = useState({
    shockGain:1,
    fatigueGain:1,
    regimeSensitivity:1,
    noiseGain:1,
    collapseGain:1
  })

  function update(key:string,value:number){

    const next = {
      ...values,
      [key]:value
    }

    setValues(next)

    updateEngineCalibration({
      [key]:value
    })

  }

  return (

    <div
      style={{
        width:520,                     // 👈 más ancho
        padding:"20px",
        background:"rgba(10,15,22,0.92)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:"8px",
        backdropFilter:"blur(6px)",
        fontFamily:"monospace",
        fontSize:12
      }}
    >

      <div
        style={{
          opacity:.6,
          marginBottom:16,
          letterSpacing:"1px"
        }}
      >
        ENGINE CALIBRATION
      </div>

      {Object.entries(values).map(([k,v])=>(

        <div key={k} style={{marginBottom:16}}>

          <div
            style={{
              display:"flex",
              justifyContent:"space-between",
              marginBottom:6
            }}
          >
            <span style={{opacity:.7}}>
              {k}
            </span>

            <span style={{opacity:.9}}>
              {v.toFixed(2)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={v}
            onChange={(e)=>update(k,Number(e.target.value))}
            style={{
              width:"100%",
              cursor:"pointer"
            }}
          />

        </div>

      ))}

    </div>

  )

}