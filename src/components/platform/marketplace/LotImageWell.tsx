"use client"

import React from "react"
import { type MarketplaceVisualTone } from "@/src/components/platform/marketplace/mock-marketplace-data"

//////////////////////////////////////////////////////
// 🌄 LOT IMAGE WELL
//
// Reusable placeholder for the per-lot image that will
// land in Phase 2. Renders a tone-driven CSS+SVG scene
// (sky gradient + mist band + 3 mountain layers + tone-
// specific atmospheric overlays).
//
// When `imageUrl` is provided (Phase 2+), the placeholder
// is bypassed in favour of a real <img>. Layout, badges
// and overlay slots stay identical so the swap is a no-op
// for consumers.
//////////////////////////////////////////////////////

type Props = {
  tone: MarketplaceVisualTone
  imageUrl?: string | null
  className?: string
  // Slot for badges, hover overlays etc. rendered above the
  // placeholder/image inside the same well.
  children?: React.ReactNode
  variant?: "card" | "featured"
}

export default function LotImageWell({
  tone,
  imageUrl,
  className = "",
  children,
  variant = "card",
}: Props) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: TONE_BASE[tone] }}
    >
      {/* ============================================== */}
      {/* 🎨 VISUAL PLACEHOLDER  (rendered when no image)  */}
      {/* ============================================== */}
      {!imageUrl && <Placeholder tone={tone} variant={variant} />}

      {/* ============================================== */}
      {/* 📷 REAL IMAGE  (Phase 2 — drop-in replacement)   */}
      {/* ============================================== */}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Universal bottom gradient — improves text legibility
          on both placeholder AND real images */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,8,3,0.55) 100%)",
        }}
      />

      {/* Slot for badges / favorite toggle / overlay text */}
      {children}
    </div>
  )
}

// ======================================================
// PLACEHOLDER — sky + mist + mountains + decoration
// ======================================================

function Placeholder({
  tone,
  variant,
}: {
  tone: MarketplaceVisualTone
  variant: "card" | "featured"
}) {
  const sky = TONE_SKY[tone]
  const mist = TONE_MIST[tone]
  const ridgeStyle = TONE_RIDGE[tone]
  const decoration = TONE_DECORATION[tone]

  return (
    <>
      {/* Sky glow / sunrise band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-3/5"
        style={{ background: sky }}
      />

      {/* Mist band between sky and mountains */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: variant === "featured" ? "38%" : "42%",
          height: variant === "featured" ? "30%" : "26%",
          background: mist,
          filter: "blur(0.5px)",
        }}
      />

      {/* 3-layer mountain silhouette — back layer */}
      <svg
        aria-hidden
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 w-full"
        style={{
          bottom: 0,
          height: variant === "featured" ? "62%" : "60%",
          opacity: 0.55,
        }}
      >
        <path d={RIDGE_BACK[ridgeStyle]} fill={ridgeFill(tone, "back")} />
      </svg>

      {/* Mid layer */}
      <svg
        aria-hidden
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 w-full"
        style={{
          bottom: 0,
          height: variant === "featured" ? "50%" : "48%",
          opacity: 0.78,
        }}
      >
        <path d={RIDGE_MID[ridgeStyle]} fill={ridgeFill(tone, "mid")} />
      </svg>

      {/* Front layer */}
      <svg
        aria-hidden
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 w-full"
        style={{
          bottom: 0,
          height: variant === "featured" ? "38%" : "36%",
        }}
      >
        <path d={RIDGE_FRONT[ridgeStyle]} fill={ridgeFill(tone, "front")} />
      </svg>

      {/* Optional decoration — leaf/branch hint in the corner.
          Only on the featured variant (cards stay clean). */}
      {variant === "featured" && decoration && (
        <CoffeeBranchAccent />
      )}
    </>
  )
}

// ======================================================
// TONE TABLES
// ======================================================

const TONE_BASE: Record<MarketplaceVisualTone, string> = {
  "misty-green":  "linear-gradient(180deg, #c2cfa8 0%, #6f8559 50%, #2c3a1f 100%)",
  "golden-hills": "linear-gradient(180deg, #efd5a0 0%, #c4985f 50%, #5a3d22 100%)",
  "volcanic":     "linear-gradient(180deg, #4a3a30 0%, #2a1c14 55%, #110805 100%)",
  "forest":       "linear-gradient(180deg, #6f8a64 0%, #3a5232 50%, #1a2814 100%)",
  "sunrise":      "linear-gradient(180deg, #f1c188 0%, #d18a52 45%, #5a2f1a 100%)",
  "terracotta":   "linear-gradient(180deg, #e2b08a 0%, #a96845 45%, #4d2614 100%)",
}

const TONE_SKY: Record<MarketplaceVisualTone, string> = {
  "misty-green":  "radial-gradient(ellipse 60% 70% at 60% 25%, rgba(255,245,220,0.35), transparent 65%)",
  "golden-hills": "radial-gradient(ellipse 70% 70% at 65% 25%, rgba(255,225,170,0.55), transparent 70%)",
  "volcanic":     "radial-gradient(ellipse 60% 60% at 70% 25%, rgba(220,140,80,0.30), transparent 70%)",
  "forest":       "radial-gradient(ellipse 50% 60% at 50% 22%, rgba(220,235,200,0.30), transparent 70%)",
  "sunrise":      "radial-gradient(ellipse 75% 65% at 65% 28%, rgba(255,200,140,0.55), transparent 70%), radial-gradient(ellipse 35% 30% at 70% 22%, rgba(255,232,180,0.6), transparent 70%)",
  "terracotta":   "radial-gradient(ellipse 60% 60% at 60% 25%, rgba(255,200,150,0.45), transparent 70%)",
}

const TONE_MIST: Record<MarketplaceVisualTone, string> = {
  "misty-green":  "linear-gradient(180deg, transparent, rgba(240,245,225,0.45), transparent)",
  "golden-hills": "linear-gradient(180deg, transparent, rgba(255,235,195,0.40), transparent)",
  "volcanic":     "linear-gradient(180deg, transparent, rgba(180,140,100,0.18), transparent)",
  "forest":       "linear-gradient(180deg, transparent, rgba(220,230,200,0.30), transparent)",
  "sunrise":      "linear-gradient(180deg, transparent, rgba(255,220,180,0.55), transparent)",
  "terracotta":   "linear-gradient(180deg, transparent, rgba(255,210,170,0.35), transparent)",
}

type RidgeStyle = "rolling" | "peaked" | "volcanic"

const TONE_RIDGE: Record<MarketplaceVisualTone, RidgeStyle> = {
  "misty-green":  "rolling",
  "golden-hills": "rolling",
  "volcanic":     "volcanic",
  "forest":       "peaked",
  "sunrise":      "peaked",
  "terracotta":   "rolling",
}

const TONE_DECORATION: Record<MarketplaceVisualTone, boolean> = {
  "misty-green":  true,
  "golden-hills": true,
  "volcanic":     false,
  "forest":       true,
  "sunrise":      true,
  "terracotta":   true,
}

// Mountain silhouette paths — three layers per style.
// Back is most distant, front is closest, mid is between.

const RIDGE_BACK: Record<RidgeStyle, string> = {
  rolling:
    "M0,200 Q150,130 300,170 T600,150 T900,170 T1200,150 L1200,320 L0,320 Z",
  peaked:
    "M0,210 L150,140 L280,180 L420,110 L560,160 L720,120 L880,170 L1040,130 L1200,160 L1200,320 L0,320 Z",
  volcanic:
    "M0,220 L160,150 L320,190 L480,130 L620,180 L780,140 L920,180 L1080,150 L1200,170 L1200,320 L0,320 Z",
}

const RIDGE_MID: Record<RidgeStyle, string> = {
  rolling:
    "M0,230 Q200,180 400,210 T800,200 T1200,220 L1200,320 L0,320 Z",
  peaked:
    "M0,240 L120,180 L240,220 L380,160 L520,210 L680,170 L820,220 L980,180 L1120,210 L1200,200 L1200,320 L0,320 Z",
  volcanic:
    "M0,250 L140,200 L280,240 L440,180 L600,230 L760,200 L900,240 L1060,210 L1200,230 L1200,320 L0,320 Z",
}

const RIDGE_FRONT: Record<RidgeStyle, string> = {
  rolling:
    "M0,275 Q200,235 400,260 T800,255 T1200,270 L1200,320 L0,320 Z",
  peaked:
    "M0,275 L160,240 L300,265 L460,235 L620,260 L780,240 L940,270 L1100,250 L1200,265 L1200,320 L0,320 Z",
  volcanic:
    "M0,285 L120,255 L260,275 L420,245 L580,275 L740,255 L880,275 L1040,255 L1200,275 L1200,320 L0,320 Z",
}

function ridgeFill(
  tone: MarketplaceVisualTone,
  layer: "back" | "mid" | "front"
): string {
  // Back layer is hazier (less opaque), front is darker.
  if (tone === "volcanic") {
    return layer === "back" ? "rgba(20,12,8,0.6)"
         : layer === "mid"  ? "rgba(10,5,3,0.85)"
                            : "rgba(5,2,1,1)"
  }
  if (tone === "sunrise" || tone === "terracotta" || tone === "golden-hills") {
    return layer === "back" ? "rgba(60,30,15,0.45)"
         : layer === "mid"  ? "rgba(40,20,10,0.7)"
                            : "rgba(20,10,5,0.92)"
  }
  // misty-green / forest
  return layer === "back" ? "rgba(20,28,15,0.45)"
       : layer === "mid"  ? "rgba(12,18,10,0.7)"
                          : "rgba(6,10,5,0.92)"
}

// ======================================================
// COFFEE BRANCH ACCENT — featured-only decoration
// ======================================================

function CoffeeBranchAccent() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 200"
      className="pointer-events-none absolute right-3 top-3 h-[110px] w-[140px] opacity-25"
    >
      <g
        stroke="rgba(255, 220, 170, 0.85)"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      >
        {/* Stem */}
        <path d="M 30 40 Q 80 55 130 50 T 220 45" />
        {/* Leaves (paired) */}
        <path d="M 60 45 Q 70 25 90 30" />
        <path d="M 60 55 Q 70 75 90 70" />
        <path d="M 110 47 Q 120 27 140 32" />
        <path d="M 110 53 Q 120 73 140 68" />
        <path d="M 170 45 Q 180 25 200 30" />
        {/* Cherries */}
        <circle cx="155" cy="55" r="3.5" />
        <circle cx="162" cy="58" r="3.5" />
        <circle cx="158" cy="63" r="3.5" />
      </g>
    </svg>
  )
}
