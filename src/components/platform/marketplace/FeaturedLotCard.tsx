"use client"

import React from "react"
import {
  type MarketplaceLot,
  BADGE_LABELS,
} from "@/src/components/platform/marketplace/mock-marketplace-data"
import LotMediaCarousel from "@/src/components/platform/media/LotMediaCarousel"

//////////////////////////////////////////////////////
// 🪪 FEATURED LOT CARD
//
// Editorial hero card for the most prominent lot.
// Image area is a full-bleed LotImageWell (sunrise sky
// + 3 mountain layers + coffee branch accent). Phase 2
// will set `lot.imageUrl` and the well swaps the
// placeholder for a real <img> automatically.
//////////////////////////////////////////////////////

export default function FeaturedLotCard({ lot }: { lot: MarketplaceLot }) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-[#3d2818]/30 shadow-[0_24px_60px_rgba(60,38,20,0.22)]">

      {/* ============================================== */}
      {/* 🎞️ FEATURED MEDIA CAROUSEL                      */}
      {/* ============================================== */}

      <LotMediaCarousel
        media={lot.media}
        primaryMedia={lot.primaryMedia}
        mediaSummary={lot.mediaSummary}
        fallbackKey={lot.id}
        title={lot.name}
        aspect="featured"
        className="absolute inset-0 group"
        showTrustBadge
      />

      {/* Side gradient — strengthens text legibility on the
          left while keeping the vista visible on the right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[58%]"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,8,3,0.78) 0%, rgba(15,8,3,0.55) 55%, rgba(15,8,3,0) 100%)",
        }}
      />

      <div className="relative grid grid-cols-1 gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:gap-14 lg:p-14">

        {/* LEFT — editorial content */}
        <div className="text-[#f4ead6] min-h-[280px] sm:min-h-[320px] flex flex-col justify-end">

          <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#d4af37] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1a0f08] shadow-sm">
            Featured lot
          </span>

          <h2
            className="mt-5 text-[36px] font-semibold leading-[1.02] tracking-tight sm:text-[46px] lg:text-[52px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {lot.name}
          </h2>

          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[14px] text-[#dcc9a4]">
            <span>{lot.farm}</span>
            <span className="opacity-40">•</span>
            <span>Producer: {lot.producer}</span>
            <span className="opacity-40">•</span>
            <span>{lot.origin.region}, {lot.origin.country}</span>
          </p>

          {/* Stats row */}
          <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="Process"   value={lot.process} />
            <Stat label="Variety"   value={lot.variety} />
            <Stat
              label="Altitude"
              value={lot.altitude != null ? `${lot.altitude.toLocaleString()} m` : "—"}
            />
            <Stat label="Harvest"   value={lot.harvestYear != null ? String(lot.harvestYear) : "—"} />
            <Stat label="SCA Score" value={lot.scaScore != null ? lot.scaScore.toFixed(2) : "—"} />
            <Stat
              label="Available"
              value={`${lot.availableKg.toLocaleString()} kg ${lot.availableUnit ?? "roasted"}`}
            />
          </div>

          {/* Badges */}
          {lot.badges.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-2">
              {lot.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-[#d4af37]/40 bg-[#1a0f08]/60 px-3 py-1 text-[11px] font-medium text-[#f3d27a] backdrop-blur-sm"
                >
                  {BADGE_LABELS[b]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — indicative price card */}
        <div className="lg:flex lg:items-start lg:pt-8">
          <div className="rounded-2xl border border-[#d4af37]/25 bg-[#fffbf5]/95 p-6 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-md lg:min-w-[230px]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#9a8b73]">
              Indicative price
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span
                className="text-[40px] font-semibold tabular-nums text-[#7a5230] leading-none"
                style={{ letterSpacing: "-0.025em" }}
              >
                {lot.pricePerKgRoasted != null
                  ? formatPrice(lot.pricePerKgRoasted, lot.currency ?? "EUR")
                  : "—"}
              </span>
              <span className="text-[13px] text-[#9a8b73]">
                /kg {lot.availableUnit ?? "roasted"}
              </span>
            </div>
            {lot.pricingMode != null && lot.pricingMode !== "ADAPTIVE_B2B_ENGINE" && (
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9a8b73]">
                Fallback price
              </div>
            )}
            <button
              type="button"
              className="mt-5 inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-[#5f3920]"
            >
              View lot
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ------------------------------------------------------
// STAT CELL
// ------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#dcc9a4]/65">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-medium tabular-nums text-[#f4ead6]">
        {value}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// PRICE FORMATTING
//
// Currency-aware: defaults to EUR symbol but picks USD/GBP
// glyphs when explicitly stored on the lot. Avoids the
// previous "$" hardcode on what was actually EUR data.
// ------------------------------------------------------

function formatPrice(value: number, currency: string): string {
  const symbol =
    currency === "USD" ? "$" :
    currency === "GBP" ? "£" :
    currency === "EUR" ? "€" :
                          ""
  const amount = value.toFixed(2)
  return symbol ? `${symbol}${amount}` : `${amount} ${currency}`
}
