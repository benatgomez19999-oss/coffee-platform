"use client"

import React from "react"

// ======================================================
// ROAST CONTROL PANEL
//
// Visual operational foundation for the EU Partner /
// co-roaster dashboard. Renders a capacity ring + the
// upcoming roast queue + a calm "active roaster" strip.
//
// UI-only — no API calls. Accepts optional props so the
// parent dashboard can drive it with real data later.
// ======================================================

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------

export type RoastSeverity = "high" | "medium" | "ok"

export type RoastBatch = {
  id: string
  name: string
  lotLabel: string         // e.g. "Lot 12A · Bourbon"
  startTime: string        // e.g. "8:00 AM"
  etaLabel: string         // e.g. "In 2h"
  severity: RoastSeverity
}

export type ActiveRoaster = {
  name: string             // e.g. "Drum Roaster · Probat P25"
  profile: string          // e.g. "Volcanic · 12 min curve"
  temperatureC: number     // e.g. 218
  airflow: "Low" | "Medium" | "High"
  drum: "Loading" | "Charging" | "First crack" | "Development" | "Cooling"
}

export type RoastControlPanelProps = {
  utilization?: number                 // 0..1 — defaults to 0.81
  utilizationLabel?: string            // defaults to "Today · All roasters"
  batches?: RoastBatch[]
  activeRoaster?: ActiveRoaster
  onViewSchedule?: () => void
  compact?: boolean                    // narrows internal spacing if embedded
}

// ------------------------------------------------------
// PALETTE — local, self-contained
// Aligned with EuropePartnerDashboard tokens.
// ------------------------------------------------------

const T = {
  text:        "#f0e8d8",
  textMuted:   "rgba(240,232,216,0.62)",
  textFaint:   "rgba(240,232,216,0.38)",
  gold:        "#d4af37",
  goldStrong:  "#f3d27a",
  goldFaint:   "rgba(212,175,55,0.10)",
  goldRing:    "rgba(212,175,55,0.22)",
  bronze:      "#c08552",
  olive:       "#9bb377",
  amber:       "#e0a85a",
  crimson:     "#c4715e",
  cardBg:      "linear-gradient(180deg, rgba(40,28,18,0.55) 0%, rgba(22,15,9,0.65) 100%)",
  innerLine:   "rgba(255,255,255,0.04)",
  divider:     "rgba(255,255,255,0.05)",
}

// ------------------------------------------------------
// DEFAULT DATA — operationally believable
// ------------------------------------------------------

const DEFAULT_BATCHES: RoastBatch[] = [
  {
    id: "rb-1",
    name: "Volcanic Dark Roast",
    lotLabel: "Lot 12A · Bourbon",
    startTime: "8:00 AM",
    etaLabel: "In 2h",
    severity: "high",
  },
  {
    id: "rb-2",
    name: "Verdant Mountain Roast",
    lotLabel: "Lot 3 · Caturra",
    startTime: "10:00 AM",
    etaLabel: "In 4h",
    severity: "medium",
  },
  {
    id: "rb-3",
    name: "Sunrise Espresso Blend",
    lotLabel: "Lot 7 · Catuaí",
    startTime: "1:00 PM",
    etaLabel: "In 7h",
    severity: "high",
  },
]

const DEFAULT_ROASTER: ActiveRoaster = {
  name: "Drum Roaster · Probat P25",
  profile: "Volcanic · 12 min curve",
  temperatureC: 218,
  airflow: "Medium",
  drum: "Development",
}

// ------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------

export default function RoastControlPanel({
  utilization = 0.81,
  utilizationLabel = "Today · All roasters",
  batches = DEFAULT_BATCHES,
  activeRoaster = DEFAULT_ROASTER,
  onViewSchedule,
  compact = false,
}: RoastControlPanelProps) {

  const clampedUtil = Math.max(0, Math.min(1, utilization))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? "18px" : "22px" }}>

      {/* ============================================ */}
      {/* CAPACITY RING + LABEL                         */}
      {/* ============================================ */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          padding: "16px 18px",
          borderRadius: "14px",
          border: `1px solid ${T.goldRing}`,
          background: "linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(0,0,0,0) 100%)",
        }}
      >
        <CapacityRing utilization={clampedUtil} />
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: T.text,
              letterSpacing: "0.2px",
            }}
          >
            Roasting capacity utilization
          </div>
          <div style={{ fontSize: "11px", color: T.textMuted, letterSpacing: "0.4px" }}>
            {utilizationLabel}
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* BATCH QUEUE                                  */}
      {/* ============================================ */}

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {batches.map((batch, i) => (
          <BatchRow key={batch.id} batch={batch} divider={i < batches.length - 1} />
        ))}
      </div>

      {/* ============================================ */}
      {/* ACTIVE ROASTER STRIP                         */}
      {/* ============================================ */}

      <ActiveRoasterStrip roaster={activeRoaster} />

      {/* ============================================ */}
      {/* CTA                                          */}
      {/* ============================================ */}

      <button
        onClick={onViewSchedule}
        style={{
          marginTop: "2px",
          padding: "10px 0",
          width: "100%",
          background: "transparent",
          border: `1px solid ${T.goldRing}`,
          borderRadius: "10px",
          color: T.gold,
          fontSize: "12px",
          letterSpacing: "0.5px",
          cursor: "pointer",
          transition: "all 0.25s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.goldFaint
          e.currentTarget.style.color = T.goldStrong
          e.currentTarget.style.borderColor = "rgba(212,175,55,0.45)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = T.gold
          e.currentTarget.style.borderColor = T.goldRing
        }}
      >
        View roast schedule  →
      </button>

    </div>
  )
}

// ======================================================
// SUBCOMPONENT — CAPACITY RING (SVG donut)
// ======================================================

function CapacityRing({ utilization }: { utilization: number }) {
  const size = 86
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - utilization)
  const pct = Math.round(utilization * 100)

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#roastRingGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <defs>
          <linearGradient id="roastRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0a85a" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>
        </defs>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1px",
        }}
      >
        <span
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "#f0e8d8",
            letterSpacing: "-0.5px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pct}%
        </span>
      </div>
    </div>
  )
}

// ======================================================
// SUBCOMPONENT — BATCH ROW
// ======================================================

function BatchRow({ batch, divider }: { batch: RoastBatch; divider: boolean }) {
  const dotColor =
    batch.severity === "high"   ? T.crimson :
    batch.severity === "medium" ? T.amber :
                                  T.olive

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 4px",
        borderBottom: divider ? `1px solid ${T.divider}` : "none",
      }}
    >
      {/* LEFT — name + lot */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}55`,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "13.5px",
              color: T.text,
              fontWeight: 500,
              letterSpacing: "0.1px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {batch.name}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: T.textMuted,
              marginTop: "2px",
              letterSpacing: "0.3px",
            }}
          >
            {batch.lotLabel}
          </div>
        </div>
      </div>

      {/* RIGHT — start time + ETA pill */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
        <span
          style={{
            fontSize: "11.5px",
            color: T.textMuted,
            letterSpacing: "0.3px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {batch.startTime}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "10.5px",
            fontWeight: 500,
            letterSpacing: "0.3px",
            color: dotColor,
            border: `1px solid ${dotColor}40`,
            background: `${dotColor}10`,
          }}
        >
          {batch.etaLabel}
        </span>
      </div>
    </div>
  )
}

// ======================================================
// SUBCOMPONENT — ACTIVE ROASTER STRIP
// ======================================================

function ActiveRoasterStrip({ roaster }: { roaster: ActiveRoaster }) {
  return (
    <div
      style={{
        marginTop: "4px",
        padding: "14px 16px",
        borderRadius: "12px",
        border: `1px solid ${T.divider}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.15) 100%)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontSize: "10.5px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.textFaint,
          }}
        >
          Active roaster
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "10.5px",
            color: T.olive,
            letterSpacing: "0.3px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.olive,
              boxShadow: `0 0 6px ${T.olive}88`,
            }}
          />
          Live
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "13px", color: T.text, fontWeight: 500 }}>
          {roaster.name}
        </span>
        <span style={{ fontSize: "11.5px", color: T.textMuted, letterSpacing: "0.2px" }}>
          {roaster.profile}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px",
          marginTop: "4px",
        }}
      >
        <RoasterStat label="Drum" value={roaster.drum} />
        <RoasterStat label="Temp" value={`${roaster.temperatureC}°C`} mono />
        <RoasterStat label="Airflow" value={roaster.airflow} />
      </div>
    </div>
  )
}

function RoasterStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        padding: "8px 10px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: T.textFaint,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "12.5px",
          color: T.text,
          fontWeight: 500,
          fontVariantNumeric: mono ? "tabular-nums" : "normal",
        }}
      >
        {value}
      </span>
    </div>
  )
}
