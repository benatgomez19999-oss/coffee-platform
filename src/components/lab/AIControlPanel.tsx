"use client"

type Props = {

  autonomousMode: boolean
  setAutonomousMode: (v: boolean) => void

}

export default function AIControlPanel({

  autonomousMode,
  setAutonomousMode

}: Props) {

  return (

    <div
      style={{
        marginTop: 16,
        padding: "20px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(255,255,255,0.015)"
      }}
    >

      {/* TITLE */}

      <div
        style={{
          fontSize: "11px",
          letterSpacing: "2px",
          opacity: 0.6,
          marginBottom: 12
        }}
      >
        AI CONTROL
      </div>


      {/* AUTONOMOUS AGENT */}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          cursor: "pointer"
        }}
      >

        <input
          type="checkbox"
          checked={autonomousMode}
          onChange={(e) =>
            setAutonomousMode(e.target.checked)
          }
        />

        Autonomous Strategy Agent

      </label>

    </div>

  )

}