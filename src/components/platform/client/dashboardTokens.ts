//////////////////////////////////////////////////////
// 🎨 CLIENT DASHBOARD — DESIGN TOKENS
//
// Single source of truth for the dark editorial palette
// used by the redesigned /platform/client surfaces.
// Kept inline (no theme file) so each panel can simply
// import COLORS / RADII without prop drilling.
//////////////////////////////////////////////////////

export const COLORS = {
  // Page surfaces
  bg:          "#08100d",
  bgDeep:      "#050a07",
  panelBg:     "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)",
  panelInner:  "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)",
  panelHero:   "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
  // Borders
  borderSoft:  "1px solid rgba(214,176,79,0.18)",
  borderInner: "1px solid rgba(214,176,79,0.12)",
  borderFaint: "1px solid rgba(255,255,255,0.06)",
  divider:     "1px solid rgba(255,255,255,0.06)",
  // Type
  textPrimary: "#f4efe3",
  textMuted:   "rgba(244,239,227,0.66)",
  textFaint:   "rgba(244,239,227,0.42)",
  // Accent (gold / amber)
  gold:        "#d6b04f",
  goldHi:      "#e3c376",
  goldSoft:    "rgba(214,176,79,0.22)",
  goldFaint:   "rgba(214,176,79,0.08)",
  goldLine:    "rgba(214,176,79,0.30)",
  // Filled primary button (matches the "Configure monthly supply" gold pill in the target mock)
  goldFill:    "linear-gradient(180deg, #e3c376 0%, #d6b04f 100%)",
  goldFillHover: "linear-gradient(180deg, #ecd089 0%, #d6b04f 100%)",
  goldFillText:  "#1a0f08",
  // Status badges
  emerald:     "#86c69b",
  emeraldBg:   "rgba(74,222,128,0.10)",
  emeraldLine: "rgba(74,222,128,0.28)",
  emeraldDot:  "#5db888",
  amber:       "#e2b65c",
  amberBg:     "rgba(214,176,79,0.10)",
  amberLine:   "rgba(214,176,79,0.30)",
  // Card badges
  badgeFilledBg:   "#d4af37",
  badgeFilledText: "#1a0f08",
  badgeOutlineBg:  "rgba(214,176,79,0.10)",
  badgeOutlineText:"#e3c376",
} as const

export const RADII = {
  card:  22,
  inner: 16,
  pill:  999,
  chip:  10,
} as const

export const SPACING = {
  pageMaxWidth: 1440,
  pagePaddingX: 80,
} as const

// ---- Number / date helpers (UI-only) -----------------

export function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0"
  return Math.round(value).toLocaleString()
}

export function formatPrice(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const symbol =
    currency === "USD" ? "$" :
    currency === "GBP" ? "£" :
    currency === "EUR" ? "€" :
                          ""
  const amount = value.toFixed(2)
  return symbol ? `${symbol}${amount}` : `${amount} ${currency}`
}

export function formatShipmentDate(iso: string | null): string {
  if (!iso) return "Not scheduled"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "Not scheduled"
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDaysUntil(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const days = Math.round((t - now.getTime()) / (24 * 60 * 60 * 1000))
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days < 0) return `${Math.abs(days)} days ago`
  return `In ${days} days`
}
