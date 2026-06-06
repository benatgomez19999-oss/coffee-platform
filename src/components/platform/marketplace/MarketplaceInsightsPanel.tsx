"use client"

import React from "react"
import { type MarketplaceInsight } from "@/src/components/platform/marketplace/mock-marketplace-data"

//////////////////////////////////////////////////////
// 📊 INSIGHTS PANEL — right rail
//
// Visual-only mini analytics: trend sparkline, top
// origins by volume, fresh arrivals breakdown.
// All data comes from props (mock).
//////////////////////////////////////////////////////

export default function MarketplaceInsightsPanel({
  insights,
}: {
  insights: MarketplaceInsight
}) {
  return (
    <aside className="flex flex-col gap-4">

      {/* PRICE TREND */}
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#2f2418]">
            Market insights
          </h3>
        </div>

        <div className="mt-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#9a8b73]">
            Avg roasted price (EUR/kg)
          </div>
          <div className="text-[11px] text-[#9a8b73]">{insights.trendLabel}</div>

          <div className="relative mt-3 h-[78px] w-full">
            <Sparkline
              data={insights.trend30dPoints}
              width={260}
              height={78}
            />
            <div className="absolute right-0 top-0 rounded-md bg-[#fef3d7] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#7a5230]">
              €{insights.trendCurrentEur.toFixed(2)}
            </div>
          </div>

          <div className="mt-1 flex justify-between text-[10px] text-[#9a8b73]">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </Card>

      {/* TOP ORIGINS */}
      <Card>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#9a8b73]">
          Top origins by volume
        </div>
        <div className="mt-1 text-[11px] text-[#9a8b73]">Available kg</div>

        <ul className="mt-3 space-y-2.5">
          {insights.topOrigins.map((row) => (
            <li key={row.country} className="flex items-center gap-2.5">
              <span className="text-[14px]">{row.flag}</span>
              <span className="w-[68px] text-[12.5px] text-[#2f2418]">
                {row.country}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0e6d4]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#9bb377,#7a5230)]"
                  style={{ width: `${Math.min(100, row.pct)}%` }}
                />
              </div>
              <span className="w-[34px] text-right text-[11.5px] font-medium tabular-nums text-[#5f472f]">
                {row.pct}%
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="mt-4 text-[12px] font-medium text-[#7a5230] hover:text-[#5f3920]"
        >
          View full report  →
        </button>
      </Card>

      {/* FRESH ARRIVALS */}
      <Card>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#9a8b73]">
          Fresh arrivals
        </div>
        <div className="mt-1 text-[11px] text-[#9a8b73]">This week</div>

        <ul className="mt-3 space-y-2">
          {insights.freshArrivals.map((row) => (
            <li
              key={row.country}
              className="flex items-center justify-between text-[12.5px]"
            >
              <span className="flex items-center gap-2 text-[#2f2418]">
                <span className="text-[14px]">{row.flag}</span>
                {row.country}
              </span>
              <span className="font-medium tabular-nums text-[#5f472f]">
                {row.lots} lot{row.lots === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="mt-4 text-[12px] font-medium text-[#7a5230] hover:text-[#5f3920]"
        >
          See all new lots  →
        </button>
      </Card>

      {/* TRACEABILITY CTA */}
      <Card variant="accent">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f7efdf] text-[#7a5230]">
            <ShieldIcon />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13.5px] font-semibold text-[#2f2418]">
              High traceability
            </h4>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#7b6851]">
              Look for the badge on lots with full traceability records.
            </p>
          </div>
        </div>
      </Card>
    </aside>
  )
}

// ------------------------------------------------------
// SPARKLINE
// ------------------------------------------------------

function Sparkline({
  data,
  width,
  height,
}: {
  data: number[]
  width: number
  height: number
}) {
  if (data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pts = data
    .map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * (height - 8) - 4
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mkt-spark-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#7a5230" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#7a5230" stopOpacity={0} />
        </linearGradient>
      </defs>

      <polyline
        points={`${pts} ${width},${height} 0,${height}`}
        fill="url(#mkt-spark-fill)"
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke="#7a5230"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ------------------------------------------------------
// CARD WRAPPER
// ------------------------------------------------------

function Card({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "accent"
}) {
  const cls =
    variant === "accent"
      ? "border-[#cfb48a] bg-[#fcf8f0]"
      : "border-[#e2d6bd] bg-[#fffbf5]"

  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      {children}
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l8 3v6c0 5.2-3.4 8.6-8 10-4.6-1.4-8-4.8-8-10v-6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}
