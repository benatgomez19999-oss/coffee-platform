"use client"

import { useEffect, useState } from "react"
import type { EngineState } from "@/engine/core/runtime"

type Region = {
  name: string
  availableKg: number
}

type Hemisphere = {
  name: string
  totalKg: number
  regions: Region[]
}

type Country = {
  name: string
  totalKg: number
  hemispheres: Hemisphere[]
}

type SupplyResponse = {
  commodity: string
  totalKg: number
  countries: Country[]
}

type Props = {
  engineState: EngineState
}

export default function RegionsSupplyChart({ engineState }: Props) {

  const [data, setData] = useState<SupplyResponse | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // =====================================================
  // FETCH REAL SUPPLY
  // =====================================================

  useEffect(() => {

    const load = async () => {

      const res = await fetch("/api/supply")

      if (!res.ok) return

      const json = await res.json()

      setData(json)
    }

    load()

  }, [])

  if (!data) {
  return (
    <div style={{ opacity: 0.5 }}>
      Loading supply...
    </div>
  )
}

// =====================================================
// DEV FALLBACK (STRUCTURE ONLY)
// Para visualizar gráfico aunque no haya datos
// =====================================================

const countries = data.countries.length > 0
  ? data.countries
  : [
      {
        name: "COLOMBIA",
        totalKg: 0,
        hemispheres: [
          {
            name: "NORTH",
            totalKg: 0,
            regions: [
              { name: "Antioquia", availableKg: 0 }
            ]
          },
          {
            name: "SOUTH",
            totalKg: 0,
            regions: [
              { name: "Huila", availableKg: 0 },
              { name: "Tolima", availableKg: 0 },
              { name: "Nariño", availableKg: 0 }
            ]
          }
        ]
      }
    ]

  // =====================================================
  // ENGINE COLOR (GLOBAL SIGNAL)
  // =====================================================

  const semaphore = engineState.liveDecision?.semaphore ?? "green"

  const getColor = () => {

    if (semaphore === "green") return "#4ade80"
    if (semaphore === "yellow") return "#facc15"
    return "#f87171"
  }

  const color = getColor()

  // =====================================================
  // GLOBAL SCALE
  // =====================================================

  const maxCountry =
  Math.max(...countries.map(c => c.totalKg), 1)

  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div style={{ marginTop: 40 }}>

     {/* TITLE */}

<div style={{
  fontSize: 12,
  opacity: 0.6,
  marginBottom: 20
}}>
  Global Supply Distribution
</div>

{/* EMPTY STATE (REAL DATA ONLY) */}

{data.countries.length === 0 && (
  <div style={{
    padding: 20,
    borderRadius: 12,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
    opacity: 0.7,
    marginBottom: 20
  }}>
    No supply data yet
  </div>
)}

{/* COUNTRIES */}

{countries.map((country) => {

  const countryRatio = country.totalKg / maxCountry

  return (

    <div key={country.name} style={{ marginBottom: 28 }}>

      {/* COUNTRY HEADER */}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 6
      }}>
        <span>{country.name}</span>
        <span style={{ color }}>
          {Math.round(country.totalKg)} kg
        </span>
      </div>

      {/* COUNTRY BAR */}

      <div style={{
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        marginBottom: 10
      }}>
        <div style={{
          width: `${countryRatio * 100}%`,
          height: "100%",
          background: color,
          transition: "width 0.3s ease"
        }}/>
      </div>

      {/* HEMISPHERES */}

      {country.hemispheres.map((h) => {

        const key = `${country.name}-${h.name}`
        const isOpen = expanded[key]

        const maxHemi =
          Math.max(...country.hemispheres.map(x => x.totalKg), 1)

        const hemiRatio = h.totalKg / maxHemi

        return (

          <div key={key} style={{ marginLeft: 12, marginBottom: 10 }}>

                  {/* HEMI HEADER */}

                  <div
                    onClick={() =>
                      setExpanded(prev => ({
                        ...prev,
                        [key]: !prev[key]
                      }))
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      cursor: "pointer"
                    }}
                  >
                    <span>{h.name}</span>
                    <span style={{ color }}>
                      {Math.round(h.totalKg)} kg
                    </span>
                  </div>

                  {/* HEMI BAR */}

                  <div style={{
                    height: 6,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    marginTop: 4
                  }}>
                    <div style={{
                      width: `${hemiRatio * 100}%`,
                      height: "100%",
                      background: color,
                      transition: "width 0.3s ease"
                    }}/>
                  </div>

                  {/* REGIONS */}

                  {isOpen && (

                    <div style={{ marginTop: 8, marginLeft: 12 }}>

                      {h.regions.map((r) => {

                        const maxRegion =
                          Math.max(...h.regions.map(x => x.availableKg), 1)

                        const ratio = r.availableKg / maxRegion

                        return (

                          <div key={r.name} style={{ marginBottom: 8 }}>

                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12
                            }}>
                              <span>{r.name}</span>
                              <span style={{ color }}>
                                {Math.round(r.availableKg)} kg
                              </span>
                            </div>

                            <div style={{
                              height: 5,
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.05)"
                            }}>
                              <div style={{
                                width: `${ratio * 100}%`,
                                height: "100%",
                                background: color
                              }}/>
                            </div>

                          </div>
                        )

                      })}

                    </div>

                  )}

                </div>

              )

            })}

          </div>

        )

      })}

    </div>
  )
}