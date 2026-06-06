//////////////////////////////////////////////////////
// 🧠 MOCK DATA — Marketplace Phase 1
//
// Fully typed, locally hosted. No fetch, no Prisma.
// Phase 2 will swap these arrays for real query results
// without changing the consumer components.
//////////////////////////////////////////////////////

import type {
  LotMediaItem,
  LotMediaSummary,
} from "@/src/services/lot-media/lotMedia.types"

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------

export type MarketplaceBadge =
  | "fresh-arrival"
  | "high-traceability"
  | "organic"
  | "limited-quantity"
  | "washed"
  // ALLOC-3 — allocation-engine-driven badges. Mock fixtures
  // never set these but real DTOs from /api/marketplace/lots do.
  | "exclusive-microlot"
  | "high-sca"
  | "marketplace-lot"

export type MarketplaceProcess =
  | "Washed"
  | "Natural"
  | "Honey"
  | "Anaerobic"

// Visual tone palette for the placeholder image well that
// Phase 2 will replace with a per-lot photo. Each tone
// drives a sky/mist/mountain treatment so cards feel
// distinct without real images.
export type MarketplaceVisualTone =
  | "misty-green"
  | "golden-hills"
  | "volcanic"
  | "forest"
  | "sunrise"
  | "terracotta"

export type MarketplaceLot = {
  id: string
  name: string
  producer: string
  farm: string
  origin: { country: string; region: string; flag: string }
  process: MarketplaceProcess
  variety: string
  // Nullable since real DB rows can be missing these even
  // when the engine cleared the lot for marketplace.
  harvestYear: number | null
  scaScore: number | null
  // Farm altitude in metres. Optional because legacy fixture rows
  // pre-date the field; the real DTO from the marketplace mapper
  // always carries it (null when unrecorded).
  altitude?: number | null
  // availableKg is ROASTED kg of the marketplace allocation portion
  // (so a SPLIT lot shows only its residual marketplace pool, an
  // EXCLUSIVE lot shows only its exclusive pool). Use availableUnit
  // to label the value correctly. Optional for legacy fixture rows
  // that pre-date the green/roasted split — production paths always
  // set both.
  availableKg: number
  availableUnit?: "roasted" | "green"
  // Roasted-equivalent price the card displays. Sourced from the
  // marketplace mapper which prefers the B2B founder-reference table
  // and falls back to the origin-equivalent (green / yield).
  pricePerKgRoasted: number | null
  currency?: string
  // Marker for the price provenance — UI shows "Fallback price"
  // muted text when the adaptive engine path didn't produce the
  // displayed value (i.e. when we fell back to the founder reference
  // table or the wholesale-equivalent of green).
  pricingMode?:
    | "ADAPTIVE_B2B_ENGINE"
    | "B2B_REFERENCE_FALLBACK"
    | "ORIGIN_EQUIVALENT_FALLBACK"
  badges: MarketplaceBadge[]
  // Visual identity for the placeholder image well.
  visualTone: MarketplaceVisualTone
  // Kept for backwards compatibility with anything that
  // still consumes a flat gradient (e.g. tinted accents).
  gradient: string
  // Phase 2 hook: when set, the image well replaces the
  // placeholder with <img src={imageUrl} />.
  imageUrl?: string | null
  isFeatured?: boolean
  // DASHBOARD-IMAGES-1 — public media sequence (already
  // filtered to PUBLIC_MARKET by the marketplace mapper).
  // Optional because legacy fixtures pre-date this field.
  media?: LotMediaItem[]
  primaryMedia?: LotMediaItem | null
  mediaSummary?: LotMediaSummary
}

export type MarketplaceMetric = {
  id: string
  label: string
  value: string
  // Lucide-style icon key — rendered inline as SVG so we
  // don't add a dependency.
  iconKey: "lots" | "score" | "origins" | "fresh"
}

export type FilterGroup = {
  id: string
  label: string
  options: { value: string; label: string; count: number }[]
}

export type MarketplaceInsight = {
  trendLabel: string
  // Avg roasted price across the visible marketplace lots, EUR/kg.
  // (Legacy field name `trendCurrentUsd` was renamed once the data
  // moved from mock USD prices to real EUR roasted prices.)
  trendCurrentEur: number
  trend30dPoints: number[]
  topOrigins: { country: string; flag: string; pct: number }[]
  freshArrivals: { country: string; flag: string; lots: number }[]
}

// ------------------------------------------------------
// HEADER METRICS — "Market at a glance"
// ------------------------------------------------------

export const MARKETPLACE_METRICS: MarketplaceMetric[] = [
  { id: "lots",    label: "Available lots", value: "412",  iconKey: "lots" },
  { id: "sca",     label: "Avg SCA Score",  value: "87.6", iconKey: "score" },
  { id: "origins", label: "Origins",        value: "19",   iconKey: "origins" },
  { id: "fresh",   label: "Fresh arrivals", value: "28",   iconKey: "fresh" },
]

// ------------------------------------------------------
// FEATURED LOT
// ------------------------------------------------------

export const FEATURED_LOT: MarketplaceLot = {
  id: "feat-finca-el-paraiso",
  name: "Finca El Paraíso Geisha",
  producer: "Diego Samuel Bermúdez",
  farm: "Finca El Paraíso",
  origin: { country: "Colombia", region: "Huila", flag: "🇨🇴" },
  process: "Washed",
  variety: "Geisha",
  harvestYear: 2026,
  scaScore: 92.25,
  availableKg: 1250,
  pricePerKgRoasted: 24.8,
  badges: ["fresh-arrival", "high-traceability", "limited-quantity"],
  visualTone: "sunrise",
  gradient:
    "linear-gradient(120deg, #1a0f08 0%, #2a1810 22%, #4a2f1a 50%, #6b4528 78%, #8d6238 100%)",
  imageUrl: null,
  isFeatured: true,
}

// ------------------------------------------------------
// LOT GRID — 8 cards
// ------------------------------------------------------

export const MARKETPLACE_LOTS: MarketplaceLot[] = [
  {
    id: "lot-banko-gotiti",
    name: "Banko Gotiti Washed",
    producer: "Testi Coffee",
    farm: "Banko Gotiti Farm",
    origin: { country: "Ethiopia", region: "Guji", flag: "🇪🇹" },
    process: "Washed",
    variety: "Heirloom",
    harvestYear: 2026,
    scaScore: 88.5,
    availableKg: 2100,
    pricePerKgRoasted: 8.4,
    badges: ["fresh-arrival"],
    visualTone: "forest",
    gradient:
      "linear-gradient(135deg, #2d3a1f 0%, #4a5a2c 40%, #7a8a3f 80%, #a3b35a 100%)",
    imageUrl: null,
  },
  {
    id: "lot-santa-rosa",
    name: "Santa Rosa Honey",
    producer: "Finca Santa Rosa",
    farm: "Chirripó étrange",
    origin: { country: "Costa Rica", region: "Tarrazú", flag: "🇨🇷" },
    process: "Honey",
    variety: "Bourbon, Caturra",
    harvestYear: 2026,
    scaScore: 87.25,
    availableKg: 2100,
    pricePerKgRoasted: 9.35,
    badges: ["high-traceability"],
    visualTone: "golden-hills",
    gradient:
      "linear-gradient(135deg, #3a2b1e 0%, #5a4030 40%, #8a6845 80%, #c08552 100%)",
    imageUrl: null,
  },
  {
    id: "lot-kariniibu-ab",
    name: "Kariniibu AB",
    producer: "Karinga Farmers Co-op",
    farm: "Nyeri, Kenya",
    origin: { country: "Kenya", region: "Nyeri", flag: "🇰🇪" },
    process: "Washed",
    variety: "SL28, SL34",
    harvestYear: 2026,
    scaScore: 89.75,
    availableKg: 1800,
    pricePerKgRoasted: 11.2,
    badges: ["organic"],
    visualTone: "misty-green",
    gradient:
      "linear-gradient(135deg, #1f2e1c 0%, #2f4a2c 40%, #4f7048 80%, #7ba175 100%)",
    imageUrl: null,
  },
  {
    id: "lot-kayonza",
    name: "Kayonza Natural",
    producer: "Kayonza Washing Station",
    farm: "Rulindo, Rwanda",
    origin: { country: "Rwanda", region: "Rulindo", flag: "🇷🇼" },
    process: "Natural",
    variety: "Red Bourbon",
    harvestYear: 2026,
    scaScore: 86.3,
    availableKg: 950,
    pricePerKgRoasted: 10.15,
    badges: ["fresh-arrival"],
    visualTone: "terracotta",
    gradient:
      "linear-gradient(135deg, #3d231a 0%, #5d3a25 40%, #8a5b3b 80%, #b8845f 100%)",
    imageUrl: null,
  },
  {
    id: "lot-la-pradera",
    name: "La Pradera Caturra",
    producer: "Juan Valdez Farm",
    farm: "Huila, Colombia",
    origin: { country: "Colombia", region: "Huila", flag: "🇨🇴" },
    process: "Washed",
    variety: "Caturra",
    harvestYear: 2026,
    scaScore: 86.0,
    availableKg: 2500,
    pricePerKgRoasted: 7.8,
    badges: ["washed"],
    visualTone: "golden-hills",
    gradient:
      "linear-gradient(135deg, #2a1f14 0%, #4a3520 40%, #75543a 80%, #a07f5a 100%)",
    imageUrl: null,
  },
  {
    id: "lot-chelbesa",
    name: "Chelbesa Natural",
    producer: "Chelbesa Washing Station",
    farm: "Yirgacheffe, Ethiopia",
    origin: { country: "Ethiopia", region: "Yirgacheffe", flag: "🇪🇹" },
    process: "Natural",
    variety: "Heirloom",
    harvestYear: 2026,
    scaScore: 87.1,
    availableKg: 800,
    pricePerKgRoasted: 12.4,
    badges: ["limited-quantity"],
    visualTone: "volcanic",
    gradient:
      "linear-gradient(135deg, #2c2418 0%, #4a3d28 40%, #7a6740 80%, #b09660 100%)",
    imageUrl: null,
  },
  {
    id: "lot-los-volcanes",
    name: "Los Volcanes Washed",
    producer: "Los Volcanes Farm",
    farm: "Antigua, Guatemala",
    origin: { country: "Guatemala", region: "Antigua", flag: "🇬🇹" },
    process: "Washed",
    variety: "Bourbon",
    harvestYear: 2026,
    scaScore: 85.9,
    availableKg: 1600,
    pricePerKgRoasted: 9.1,
    badges: ["high-traceability"],
    visualTone: "volcanic",
    gradient:
      "linear-gradient(135deg, #1f2a1a 0%, #324729 40%, #557349 80%, #88a877 100%)",
    imageUrl: null,
  },
  {
    id: "lot-muganza",
    name: "Muganza Honey",
    producer: "Muganza Dukunde Kawa Co-op",
    farm: "Gakenke, Rwanda",
    origin: { country: "Rwanda", region: "Gakenke", flag: "🇷🇼" },
    process: "Honey",
    variety: "Bourbon",
    harvestYear: 2026,
    scaScore: 86.3,
    availableKg: 1200,
    pricePerKgRoasted: 10.6,
    badges: ["organic"],
    visualTone: "sunrise",
    gradient:
      "linear-gradient(135deg, #3a2a1c 0%, #5c4128 40%, #8a653e 80%, #b8905f 100%)",
    imageUrl: null,
  },
]

// ------------------------------------------------------
// FILTER GROUPS (sidebar) — visuals only
// ------------------------------------------------------

export const FILTER_ORIGINS: FilterGroup = {
  id: "origin",
  label: "Origin",
  options: [
    { value: "co", label: "Colombia",  count: 84 },
    { value: "et", label: "Ethiopia",  count: 72 },
    { value: "gt", label: "Guatemala", count: 58 },
    { value: "ke", label: "Kenya",     count: 49 },
    { value: "rw", label: "Rwanda",    count: 31 },
  ],
}

export const FILTER_PROCESSES: FilterGroup = {
  id: "process",
  label: "Process",
  options: [
    { value: "washed",    label: "Washed",    count: 120 },
    { value: "natural",   label: "Natural",   count: 128 },
    { value: "honey",     label: "Honey",     count:  66 },
    { value: "anaerobic", label: "Anaerobic", count:  14 },
  ],
}

export const FILTER_CERTIFICATIONS: FilterGroup = {
  id: "certifications",
  label: "Certifications",
  options: [
    { value: "organic",       label: "Organic",       count: 92 },
    { value: "fair-trade",    label: "Fair Trade",    count: 71 },
    { value: "rainforest",    label: "Rainforest",    count: 44 },
    { value: "bird-friendly", label: "Bird Friendly", count: 18 },
  ],
}

export const FILTER_HARVEST_YEARS: FilterGroup = {
  id: "harvest",
  label: "Harvest year",
  options: [
    { value: "2026", label: "2026", count: 312 },
    { value: "2025", label: "2025", count: 100 },
  ],
}

// ------------------------------------------------------
// TOOLBAR DROPDOWN OPTIONS — visuals only
// ------------------------------------------------------

export const TOOLBAR_FILTERS: { id: string; label: string }[] = [
  { id: "origin",       label: "Origin" },
  { id: "process",      label: "Process" },
  { id: "variety",      label: "Variety" },
  { id: "harvest",      label: "Harvest Year" },
  { id: "availability", label: "Availability" },
  { id: "price",        label: "Price (USD/kg)" },
]

// ------------------------------------------------------
// INSIGHTS PANEL
// ------------------------------------------------------

export const MARKETPLACE_INSIGHTS: MarketplaceInsight = {
  trendLabel: "All lots · 30-day avg",
  trendCurrentEur: 10.42,
  trend30dPoints: [
    9.6, 9.8, 9.9, 10.1, 10.0, 10.2, 10.3, 10.1, 10.4, 10.2,
    10.3, 10.5, 10.4, 10.3, 10.5, 10.6, 10.4, 10.5, 10.3, 10.2,
    10.4, 10.5, 10.6, 10.4, 10.3, 10.5, 10.4, 10.3, 10.4, 10.42,
  ],
  topOrigins: [
    { country: "Colombia",  flag: "🇨🇴", pct: 28 },
    { country: "Ethiopia",  flag: "🇪🇹", pct: 25 },
    { country: "Guatemala", flag: "🇬🇹", pct: 17 },
    { country: "Kenya",     flag: "🇰🇪", pct: 13 },
    { country: "Rwanda",    flag: "🇷🇼", pct:  7 },
  ],
  freshArrivals: [
    { country: "Colombia",  flag: "🇨🇴", lots: 12 },
    { country: "Ethiopia",  flag: "🇪🇹", lots:  9 },
    { country: "Guatemala", flag: "🇬🇹", lots:  4 },
    { country: "Rwanda",    flag: "🇷🇼", lots:  3 },
  ],
}

// ------------------------------------------------------
// BADGE LABELS / TONES
// ------------------------------------------------------

export const BADGE_LABELS: Record<MarketplaceBadge, string> = {
  "fresh-arrival":     "Fresh arrival",
  "high-traceability": "High traceability",
  "organic":           "Organic",
  "limited-quantity":  "Limited quantity",
  "washed":            "Washed",
  "exclusive-microlot": "Exclusive microlot",
  "high-sca":           "High SCA",
  "marketplace-lot":    "Marketplace lot",
}

export type BadgeTone = "amber" | "olive" | "bronze" | "emerald" | "gold"

export const BADGE_TONES: Record<MarketplaceBadge, BadgeTone> = {
  "fresh-arrival":     "amber",
  "high-traceability": "bronze",
  "organic":           "emerald",
  "limited-quantity":  "amber",
  "washed":            "olive",
  "exclusive-microlot": "gold",
  "high-sca":           "bronze",
  "marketplace-lot":    "olive",
}
