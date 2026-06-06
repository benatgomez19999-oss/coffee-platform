"use client"

import React, { useState } from "react"
import {
  type MarketplaceLot,
  type MarketplaceBadge,
  BADGE_LABELS,
  BADGE_TONES,
} from "@/src/components/platform/marketplace/mock-marketplace-data"
import LotMediaCarousel from "@/src/components/platform/media/LotMediaCarousel"

//////////////////////////////////////////////////////
// 🪪 LOT CARD — grid item
//
// The image area is a LotImageWell (tone-driven
// placeholder). Phase 2 just sets `lot.imageUrl` and
// the well swaps to a real <img>. Layout doesn't change.
//////////////////////////////////////////////////////

export default function MarketplaceLotCard({ lot }: { lot: MarketplaceLot }) {
  const [favorite, setFavorite] = useState<boolean>(false)
  const primaryBadge = lot.badges[0]

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[#e2d6bd] bg-[#fffbf5] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#cfb48a] hover:shadow-[0_18px_36px_rgba(60,38,20,0.13)]">

      {/* ============================================== */}
      {/* 🎞️ MEDIA CAROUSEL                              */}
      {/* ============================================== */}

      <LotMediaCarousel
        media={lot.media}
        primaryMedia={lot.primaryMedia}
        mediaSummary={lot.mediaSummary}
        fallbackKey={lot.id}
        title={lot.name}
        aspect="card"
        className="h-[148px]"
        showTrustBadge={false}
      >
        {/* Primary badge — top-left, drawn over the carousel */}
        {primaryBadge && (
          <div className="absolute left-3 top-3 z-10">
            <BadgePill badge={primaryBadge} />
          </div>
        )}

        {/* Favorite toggle — top-right */}
        <button
          type="button"
          onClick={() => setFavorite((v) => !v)}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-white/15 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <HeartIcon filled={favorite} />
        </button>
      </LotMediaCarousel>

      {/* ============================================== */}
      {/* BODY                                            */}
      {/* ============================================== */}

      <div className="flex flex-1 flex-col p-4">

        {/* Title + producer/farm */}
        <div>
          <h3
            className="text-[15px] font-semibold leading-tight text-[#2f2418]"
            style={{ letterSpacing: "-0.005em" }}
          >
            {lot.name}
          </h3>
          <p className="mt-1 text-[11.5px] text-[#7b6851]">
            {lot.producer} <span className="text-[#bfae92]">·</span> {lot.farm}
          </p>
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          <Stat label="Process"   value={lot.process} />
          <Stat label="Variety"   value={lot.variety} />
          <Stat label="SCA Score" value={lot.scaScore != null ? lot.scaScore.toFixed(2) : "—"} mono />
          <Stat
            label="Altitude"
            value={lot.altitude != null ? `${lot.altitude.toLocaleString()} m` : "—"}
            mono
          />
          <Stat
            label="Available"
            value={`${lot.availableKg.toLocaleString()} kg ${lot.availableUnit ?? "roasted"}`}
            mono
            spanFull
          />
        </div>

        {/* Footer — price + CTA */}
        <div className="mt-5 flex items-end justify-between border-t border-[#e2d6bd] pt-4">
          <div className="flex flex-col items-start">
            <div className="flex items-baseline gap-1">
              <span
                className="text-[20px] font-semibold tabular-nums text-[#2f2418]"
                style={{ letterSpacing: "-0.02em" }}
              >
                {lot.pricePerKgRoasted != null
                  ? formatPrice(lot.pricePerKgRoasted, lot.currency ?? "EUR")
                  : "—"}
              </span>
              <span className="text-[11px] text-[#9a8b73]">
                /kg {lot.availableUnit ?? "roasted"}
              </span>
            </div>
            {lot.pricingMode != null && lot.pricingMode !== "ADAPTIVE_B2B_ENGINE" && (
              <span className="text-[9.5px] uppercase tracking-[0.18em] text-[#9a8b73]">
                Fallback price
              </span>
            )}
          </div>

          <button
            type="button"
            className="whitespace-nowrap rounded-full border border-[#cfb48a] bg-[#fcf8f0] px-4 py-1.5 text-[12px] font-medium text-[#5f472f] transition-colors hover:bg-[#f7efdf] hover:text-[#3f2e1d]"
          >
            View lot
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function Stat({
  label,
  value,
  mono,
  spanFull,
}: {
  label: string
  value: string
  mono?: boolean
  spanFull?: boolean
}) {
  return (
    <div className={`min-w-0 ${spanFull ? "col-span-2" : ""}`}>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#9a8b73]">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-[12.5px] text-[#2f2418] ${mono ? "tabular-nums" : ""}`}
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function BadgePill({ badge }: { badge: MarketplaceBadge }) {
  const tone = BADGE_TONES[badge]
  const cls =
    tone === "amber"   ? "bg-[#f3e9d7]/95 text-[#7a5230] border-[#c4b28e]" :
    tone === "olive"   ? "bg-[#e8f0e6]/95 text-[#3a6b35] border-[#b7cbb0]" :
    tone === "bronze"  ? "bg-[#f7efdf]/95 text-[#5f472f] border-[#cfb48a]" :
                         "bg-[#e8f0e6]/95 text-[#3a6b35] border-[#a5c096]"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-medium backdrop-blur-sm ${cls}`}
    >
      {BADGE_LABELS[badge]}
    </span>
  )
}

// ------------------------------------------------------
// PRICE FORMATTING — currency-aware (mirrors FeaturedLotCard).
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
