"use client"

import type { EngineState } from "@/engine/runtime"

export default function CommodityMarketPanel({
  engineState
}: {
  engineState: EngineState
}) {

  const prices = engineState.spatialMarket?.prices ?? {}
const entries = Object.entries(prices)

console.log("entries", entries)

if (entries.length === 0) {
  return (
    <div style={{ opacity: 0.5 }}>
      Waiting for commodity prices...
    </div>
  )
}

  function formatPrice(value: number) {

    if (value > 1e12)
      return (value / 1e12).toFixed(2) + "T"

    if (value > 1e9)
      return (value / 1e9).toFixed(2) + "B"

    if (value > 1e6)
      return (value / 1e6).toFixed(2) + "M"

    if (value > 1e3)
      return (value / 1e3).toFixed(2) + "K"

    return value.toFixed(2)
  }

  

  return (

    <div>

      <div
        style={{
          fontSize: 12,
          letterSpacing: 1,
          opacity: 0.7,
          marginBottom: 12
        }}
      >
        GLOBAL COMMODITY MARKET
      </div>

      {entries.map(([commodity, price]) => (

        <div
          key={commodity}
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
            fontSize: 13
          }}
        >

          <span style={{ opacity: 0.7 }}>
            {commodity}
          </span>

          <span style={{ fontWeight: 600 }}>
            {formatPrice(Number(price))}
          </span>

        </div>

      ))}

    </div>

  )
}