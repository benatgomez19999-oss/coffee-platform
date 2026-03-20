"use client"

import { useMemo } from "react"
import { computeStrategyLeaderboard }
  from "@/AI/analytics/StrategyLeaderboard"

import { getTradeMemory }
  from "@/AI/learning/TradeMemory"

export default function StrategyLeaderboardPanel({
  engineState
}: {
  engineState: any
}) {

  // -------------------------------------------------
  // DATA
  // -------------------------------------------------

  const leaderboard = useMemo(() => {
    return computeStrategyLeaderboard()
  }, [engineState?.engineTime])

  const totalPnL = useMemo(() => {
    return getTradeMemory()
      .reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  }, [engineState?.engineTime])

  // -------------------------------------------------
  // UI
  // -------------------------------------------------

  return (

    <div>

      <div style={{
        fontSize: 12,
        letterSpacing: 1,
        opacity: 0.6,
        marginBottom: 10
      }}>
        STRATEGY PERFORMANCE
      </div>

      <div style={{
        marginBottom: 12,
        fontSize: 13
      }}>
        TOTAL PnL: {totalPnL.toFixed(2)}
      </div>

      {leaderboard.map((s, i) => (

        <div
          key={s.strategyId}
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 10,
            marginBottom: 8,
            background:
              s.totalPnL > 0
                ? "rgba(0,255,150,0.05)"
                : "rgba(255,0,0,0.05)"
          }}
        >

          <div style={{ fontSize: 12 }}>
            #{i + 1} — {s.strategyId}
          </div>

          <div style={{ fontSize: 12 }}>
            PnL: {s.totalPnL.toFixed(2)}
          </div>

          <div style={{ fontSize: 11, opacity: 0.6 }}>
            trades: {s.trades}
          </div>

        </div>

      ))}

    </div>

  )

}