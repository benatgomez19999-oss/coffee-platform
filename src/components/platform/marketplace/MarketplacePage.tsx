"use client"

import React from "react"
import PlatformHeader from "@/src/components/shared/general/PlatformHeader"
import MarketplaceHero from "@/src/components/platform/marketplace/MarketplaceHero"
import MarketplaceToolbar from "@/src/components/platform/marketplace/MarketplaceToolbar"
import MarketplaceFiltersSidebar from "@/src/components/platform/marketplace/MarketplaceFiltersSidebar"
import FeaturedLotCard from "@/src/components/platform/marketplace/FeaturedLotCard"
import MarketplaceLotCard from "@/src/components/platform/marketplace/MarketplaceLotCard"
import MarketplaceInsightsPanel from "@/src/components/platform/marketplace/MarketplaceInsightsPanel"
import {
  type MarketplaceLot,
  type MarketplaceMetric,
  type MarketplaceInsight,
  type MarketplaceProcess,
  type MarketplaceVisualTone,
  type MarketplaceBadge,
} from "@/src/components/platform/marketplace/mock-marketplace-data"
import type {
  MarketplaceInsightsDto,
  MarketplaceLotDto,
  MarketplaceLotsResponse,
} from "@/src/services/allocation/marketplace/marketplaceLot.mapper"

//////////////////////////////////////////////////////
// 🛍️ MARKETPLACE PAGE — orchestrator
//
// Receives a real MarketplaceLotsResponse from the server
// (allocation-engine-driven). Falls back to error / empty
// states when the view is null or no marketplace-eligible
// lots exist.
//
// Layout:
//   ┌──────────────── Hero ────────────────┐
//   ├────────────── Toolbar ───────────────┤
//   │  Filters  │   Featured + Grid │  Insights  │
//   └─────────────────────────────────────────────┘
//////////////////////////////////////////////////////

type DashboardUser = {
  name?: string | null
  email?: string | null
  role?: string | null
  onboardingCompleted?: boolean | null
} | null | undefined

type Props = {
  user?: DashboardUser
  view?: MarketplaceLotsResponse | null
  loadError?: boolean
}

export default function MarketplacePage({ user, view, loadError = false }: Props) {

  const safeUser = user ?? {
    role: "CLIENT",
    onboardingCompleted: true,
    name: null,
  }

  const cards = view ? view.lots.map(dtoToLot) : []
  const hasLots = cards.length > 0

  // Pick the featured lot:
  //   1. first exclusive microlot
  //   2. else first lot (already sorted by SCA desc by the server)
  const featured: MarketplaceLot | null = (() => {
    if (!hasLots) return null
    const exclusive = cards.find((c) => c.badges.includes("exclusive-microlot"))
    return exclusive ?? cards[0] ?? null
  })()

  const gridLots = featured
    ? cards.filter((c) => c.id !== featured.id)
    : []

  const heroMetrics = view ? buildHeroMetrics(view) : EMPTY_METRICS
  const insights = view ? buildInsights(view) : EMPTY_INSIGHTS

  return (
    <>
      {/* Shared platform header — handles role-aware theming */}
      <PlatformHeader user={safeUser} assistantContext="dashboard" />

      <main
        className="relative min-h-screen"
        style={{
          paddingTop: "94px",
          paddingBottom: "64px",
          background:
            "radial-gradient(ellipse 1100px 600px at 12% 12%, rgba(212,175,55,0.08), transparent 60%), radial-gradient(ellipse 900px 500px at 92% 35%, rgba(155,179,119,0.06), transparent 65%), #f4eedf",
        }}
      >
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-6 lg:px-10">

          {/* HERO */}
          <MarketplaceHero metrics={heroMetrics} />

          {/* TOOLBAR */}
          <MarketplaceToolbar />

          {/* MAIN GRID — 3 columns on desktop */}
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">

            {/* LEFT SIDEBAR */}
            <div className="lg:sticky lg:top-[94px] lg:self-start">
              <MarketplaceFiltersSidebar />
            </div>

            {/* CENTER COLUMN */}
            <section className="flex flex-col gap-6">

              {loadError && <ErrorState />}

              {!loadError && !hasLots && <EmptyState />}

              {!loadError && hasLots && featured && (
                <>
                  <FeaturedLotCard lot={featured} />

                  {gridLots.length > 0 && (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {gridLots.map((lot) => (
                        <MarketplaceLotCard key={lot.id} lot={lot} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* RIGHT INSIGHTS */}
            <div className="lg:sticky lg:top-[94px] lg:self-start">
              <MarketplaceInsightsPanel insights={insights} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

// ------------------------------------------------------
// EMPTY / ERROR STATES
// ------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-3xl border border-[#e2d6bd] bg-[#fffbf5] px-8 py-16 text-center">
      <h2 className="text-[18px] font-semibold text-[#2f2418]">
        No marketplace lots available yet
      </h2>
      <p className="mt-2 text-[13px] text-[#7b6851]">
        New arrivals appear here as soon as the allocation engine flags them
        for open marketplace sale.
      </p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="rounded-3xl border border-[#e2c2a8] bg-[#fff4ec] px-8 py-16 text-center">
      <h2 className="text-[18px] font-semibold text-[#7a3a18]">
        Unable to load marketplace lots
      </h2>
      <p className="mt-2 text-[13px] text-[#7b6851]">
        Please refresh the page in a moment.
      </p>
    </div>
  )
}

// ------------------------------------------------------
// DTO → VIEW MODEL ADAPTER
//
// Converts MarketplaceLotDto (allocation-engine output) into
// the existing MarketplaceLot shape consumed by Featured /
// Grid card components — keeping the visual design intact.
// ------------------------------------------------------

const PROCESS_LABELS: Record<string, MarketplaceProcess> = {
  Washed: "Washed",
  Natural: "Natural",
  Honey: "Honey",
  Anaerobic: "Anaerobic",
  WASHED: "Washed",
  NATURAL: "Natural",
  HONEY: "Honey",
  ANAEROBIC: "Anaerobic",
}

const TONE_GRADIENTS: Record<MarketplaceVisualTone, string> = {
  "misty-green":
    "linear-gradient(135deg, #1f2e1c 0%, #2f4a2c 40%, #4f7048 80%, #7ba175 100%)",
  "golden-hills":
    "linear-gradient(135deg, #3a2b1e 0%, #5a4030 40%, #8a6845 80%, #c08552 100%)",
  "volcanic":
    "linear-gradient(135deg, #2c2418 0%, #4a3d28 40%, #7a6740 80%, #b09660 100%)",
  "forest":
    "linear-gradient(135deg, #2d3a1f 0%, #4a5a2c 40%, #7a8a3f 80%, #a3b35a 100%)",
  "sunrise":
    "linear-gradient(120deg, #1a0f08 0%, #2a1810 22%, #4a2f1a 50%, #6b4528 78%, #8d6238 100%)",
  "terracotta":
    "linear-gradient(135deg, #3d231a 0%, #5d3a25 40%, #8a5b3b 80%, #b8845f 100%)",
}

function dtoToLot(dto: MarketplaceLotDto): MarketplaceLot {
  const tone = (dto.visual.gradientKey as MarketplaceVisualTone) ?? "misty-green"
  return {
    id: dto.id,
    name: dto.name,
    producer: dto.producerName,
    farm: dto.farmName,
    origin: {
      country: dto.country,
      region: dto.region ?? "",
      flag: getFlagEmoji(dto.country),
    },
    process: (PROCESS_LABELS[dto.process] ?? "Washed") as MarketplaceProcess,
    variety: dto.variety,
    harvestYear: dto.harvestYear,
    scaScore: dto.scaScore,
    altitude: dto.altitude,
    // Display kg = roasted kg of the marketplace allocation portion.
    // The DTO already isolated the relevant pool (residual or exclusive).
    availableKg: Math.round(dto.marketplaceRoastedKg),
    availableUnit: "roasted",
    // Display roasted price — the mapper picks B2B (founder reference
    // table) when available, falls back to origin-equivalent green/yield
    // otherwise. pricingMode carries which path produced this value so
    // the cards can show "Origin equivalent" when in fallback mode.
    pricePerKgRoasted: dto.roastedPricePerKg,
    currency: dto.currency,
    pricingMode: dto.pricingMode,
    badges: dto.badges as MarketplaceBadge[],
    visualTone: tone,
    gradient: TONE_GRADIENTS[tone] ?? TONE_GRADIENTS["misty-green"],
    imageUrl: dto.visual.imageUrl,
    isFeatured: false,
    // DASHBOARD-IMAGES-1 — pass the public media sequence
    // through so MarketplaceLotCard/FeaturedLotCard can render
    // the carousel. The mapper already filtered PUBLIC_MARKET
    // only; this component never re-filters.
    media: dto.media ?? [],
    primaryMedia: dto.primaryMedia ?? null,
    mediaSummary: dto.mediaSummary,
  }
}

// ------------------------------------------------------
// HERO METRICS — converts API metrics to the existing
// MarketplaceMetric[] shape used by MarketplaceHero.
// ------------------------------------------------------

const EMPTY_METRICS: MarketplaceMetric[] = [
  { id: "lots",    label: "Available lots", value: "0",  iconKey: "lots" },
  { id: "sca",     label: "Avg SCA Score",  value: "—",  iconKey: "score" },
  { id: "origins", label: "Origins",        value: "0",  iconKey: "origins" },
  { id: "fresh",   label: "Fresh arrivals", value: "0",  iconKey: "fresh" },
]

function buildHeroMetrics(view: MarketplaceLotsResponse): MarketplaceMetric[] {
  const m = view.metrics
  return [
    { id: "lots",    label: "Available lots", value: String(m.availableLots), iconKey: "lots" },
    {
      id: "sca",
      label: "Avg SCA Score",
      value: m.avgScaScore != null ? m.avgScaScore.toFixed(1) : "—",
      iconKey: "score",
    },
    { id: "origins", label: "Origins",        value: String(m.origins),        iconKey: "origins" },
    { id: "fresh",   label: "Fresh arrivals", value: String(m.freshArrivals),  iconKey: "fresh" },
  ]
}

// ------------------------------------------------------
// INSIGHTS — converts API insights to MarketplaceInsight.
// We do NOT fabricate a 30-day price trend; the sparkline
// stays empty until a real time series is wired up.
// ------------------------------------------------------

const EMPTY_INSIGHTS: MarketplaceInsight = {
  trendLabel: "Price trend not available yet",
  trendCurrentEur: 0,
  trend30dPoints: [],
  topOrigins: [],
  freshArrivals: [],
}

function buildInsights(view: MarketplaceLotsResponse): MarketplaceInsight {
  const insights: MarketplaceInsightsDto = view.insights

  // Average current ROASTED price across marketplace lots — shown
  // as the numeric badge that accompanies the (currently empty)
  // sparkline. Currency is whatever the lot data uses (default EUR).
  const priced = view.lots.filter(
    (l): l is typeof l & { roastedPricePerKg: number } =>
      typeof l.roastedPricePerKg === "number"
  )
  const trendCurrentEur =
    priced.length > 0
      ? Math.round(
          (priced.reduce((sum, l) => sum + l.roastedPricePerKg, 0) / priced.length) * 100
        ) / 100
      : 0

  return {
    trendLabel:
      view.lots.length > 0
        ? `Avg roasted price across ${view.lots.length} marketplace lot${view.lots.length === 1 ? "" : "s"}`
        : "Price trend not available yet",
    trendCurrentEur,
    trend30dPoints: [], // 30-day series not yet wired
    topOrigins: insights.topOriginsByVolume.map((row) => ({
      country: row.label,
      flag: getFlagEmoji(row.label),
      pct: row.percentage,
    })),
    freshArrivals: insights.freshArrivalsByOrigin.map((row) => ({
      country: row.label,
      flag: getFlagEmoji(row.label),
      lots: row.count,
    })),
  }
}

// ------------------------------------------------------
// FLAG EMOJI — small static map covering the producing
// countries in the schema today. Unknown ⇒ globe.
// ------------------------------------------------------

const FLAG_BY_COUNTRY: Record<string, string> = {
  Colombia: "🇨🇴",
  Ethiopia: "🇪🇹",
  Kenya: "🇰🇪",
  Guatemala: "🇬🇹",
  Rwanda: "🇷🇼",
  Brazil: "🇧🇷",
  Peru: "🇵🇪",
  "Costa Rica": "🇨🇷",
  Honduras: "🇭🇳",
  Panama: "🇵🇦",
  Mexico: "🇲🇽",
  Indonesia: "🇮🇩",
  Vietnam: "🇻🇳",
  Uganda: "🇺🇬",
  Burundi: "🇧🇮",
  Tanzania: "🇹🇿",
  Bolivia: "🇧🇴",
  Ecuador: "🇪🇨",
  Nicaragua: "🇳🇮",
}

function getFlagEmoji(country: string): string {
  if (!country) return "🌍"
  const direct = FLAG_BY_COUNTRY[country]
  if (direct) return direct
  return "🌍"
}
