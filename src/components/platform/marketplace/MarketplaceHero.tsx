"use client"

import React from "react"
import {
  type MarketplaceMetric,
} from "@/src/components/platform/marketplace/mock-marketplace-data"

//////////////////////////////////////////////////////
// 🎨 HERO — eyebrow + title + Market at a glance
//
// Editorial layout with a soft botanical coffee-branch
// line-art behind the title and a metric snapshot card
// floating to the right.
//////////////////////////////////////////////////////

export default function MarketplaceHero({
  metrics,
}: {
  metrics: MarketplaceMetric[]
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#3a2618] px-8 py-10 lg:px-12 lg:py-14">

      {/* ============================================== */}
      {/* 📷 BACKGROUND PHOTO — Colombian Huila sunset    */}
      {/* ============================================== */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/marketplace_main_card.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      {/* Legibility scrim — darker on the left where the title sits,
          fading toward the right so the metrics card pops on a softer
          backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,8,3,0.78) 0%, rgba(15,8,3,0.55) 38%, rgba(15,8,3,0.28) 65%, rgba(15,8,3,0.18) 100%)",
        }}
      />

      <div className="relative flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">

        {/* LEFT — editorial title */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#f6d9a8]">
            Open Marketplace
          </p>
          <h1
            className="mt-3 text-[44px] font-semibold leading-[1.04] tracking-tight text-[#fdf6e8] sm:text-[58px] lg:text-[68px]"
            style={{
              letterSpacing: "-0.028em",
              textShadow: "0 2px 18px rgba(0,0,0,0.45)",
            }}
          >
            Open Marketplace
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-[#ecdcc1]">
            Discover exceptional lots from trusted producers around the world.
            <br className="hidden sm:block" />
            Fresh arrivals added weekly.
          </p>
        </div>

        {/* RIGHT — Market at a glance */}
        <div className="lg:w-[480px] lg:shrink-0">
          <div className="rounded-2xl border border-[#d8c5a8]/70 bg-[#fffbf5]/92 p-6 shadow-[0_18px_40px_rgba(15,8,3,0.35)] backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#2f2418]">
                Market at a glance
              </h3>
              <span className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-[#9a8b73]">
                Updated today
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {metrics.map((m) => (
                <MetricTile key={m.id} metric={m} />
              ))}
            </div>

            <div className="mt-5 border-t border-[#e2d6bd] pt-3">
              <button
                type="button"
                className="text-[12.5px] font-medium text-[#7a5230] transition-colors hover:text-[#5f3920]"
              >
                View market insights  →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// METRIC TILE
// ------------------------------------------------------

function MetricTile({ metric }: { metric: MarketplaceMetric }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f7efdf] text-[#7a5230]">
        <MetricIcon iconKey={metric.iconKey} />
      </div>
      <div
        className="text-[24px] font-semibold leading-none text-[#2f2418] tabular-nums"
        style={{ letterSpacing: "-0.02em" }}
      >
        {metric.value}
      </div>
      <div className="text-[11px] leading-tight text-[#7b6851]">
        {metric.label}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// METRIC ICONS — minimal inline SVG, no dependency
// ------------------------------------------------------

function MetricIcon({ iconKey }: { iconKey: MarketplaceMetric["iconKey"] }) {
  switch (iconKey) {
    case "lots":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 4v5" />
        </svg>
      )
    case "score":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 18c5-2 9-2 14 0" />
          <path d="M9 12c2-1 4-1 6 0" />
          <path d="M11 6h2" />
          <path d="M12 6v6" />
        </svg>
      )
    case "origins":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
        </svg>
      )
    case "fresh":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
  }
}
