"use client"

import React, { useCallback, useMemo, useState } from "react"
import type {
  LotMediaItem,
  LotMediaSummary,
} from "@/src/services/lot-media/lotMedia.types"
import {
  buildLotMediaDisplaySequence,
  buildLotMediaTrustBadge,
} from "./lotMediaCarousel.helpers"

//////////////////////////////////////////////////////
// 🎞️ LotMediaCarousel (DASHBOARD-IMAGES-1)
//
// Compact image rail for marketplace + client dashboard
// cards. Public-only by contract — callers pass DTO media
// which is already filtered to PUBLIC_MARKET.
//
//   - 0 media → deterministic tonal fallback (matches the
//     existing card aesthetic).
//   - 1 medium → static <img>, no dots/arrows.
//   - 2+ media → dots + (optional) prev/next arrows. The
//     primary image is always first; the rest follow in
//     the order the DTO returned.
//
// Local state only — no fetch. Broken images quietly fall
// back to the tonal placeholder so a bad URL never breaks
// the card.
//////////////////////////////////////////////////////

export type LotMediaCarouselAspect = "card" | "featured" | "compact"

type Props = {
  media?: ReadonlyArray<LotMediaItem> | null
  primaryMedia?: LotMediaItem | null
  mediaSummary?: LotMediaSummary | null
  fallbackKey: string
  title?: string
  className?: string
  aspect?: LotMediaCarouselAspect
  showDots?: boolean
  showArrows?: boolean
  // Optional slot rendered above the image (badges /
  // favorite toggles). Mirrors LotImageWell's children prop
  // so swap-in is a no-op for card layouts.
  children?: React.ReactNode
  // When false, the trust badge is suppressed (cards that
  // already display verification chips can opt out).
  showTrustBadge?: boolean
}

const ASPECT_CLASS: Record<LotMediaCarouselAspect, string> = {
  card:     "aspect-[16/10]",
  featured: "aspect-[21/9]",
  compact:  "aspect-[4/3]",
}

export default function LotMediaCarousel({
  media,
  primaryMedia,
  mediaSummary,
  fallbackKey,
  title,
  className = "",
  aspect = "card",
  showDots = true,
  showArrows = true,
  children,
  showTrustBadge = true,
}: Props) {

  const sequence = useMemo(
    () => buildLotMediaDisplaySequence({ media, primaryMedia }),
    [media, primaryMedia],
  )

  const [index, setIndex] = useState(0)
  const [erroredIds, setErroredIds] = useState<ReadonlySet<string>>(new Set())

  const safeIndex = useMemo(() => {
    if (sequence.length === 0) return 0
    if (index < 0) return 0
    if (index >= sequence.length) return sequence.length - 1
    return index
  }, [index, sequence.length])

  const current = sequence[safeIndex]
  const isCurrentBroken = current ? erroredIds.has(current.id) : false
  const hasUsableImage =
    Boolean(current?.url) && !isCurrentBroken
  const showFallback = sequence.length === 0 || !hasUsableImage

  const goPrev = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (sequence.length <= 1) return
      setIndex((i) => (i - 1 + sequence.length) % sequence.length)
    },
    [sequence.length],
  )

  const goNext = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (sequence.length <= 1) return
      setIndex((i) => (i + 1) % sequence.length)
    },
    [sequence.length],
  )

  const goTo = useCallback(
    (next: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (sequence.length === 0) return
      const clamped = Math.max(0, Math.min(next, sequence.length - 1))
      setIndex(clamped)
    },
    [sequence.length],
  )

  const onImageError = useCallback((id: string) => {
    setErroredIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const alt =
    current?.altText?.trim() ||
    title?.trim() ||
    "Coffee lot image"

  const trustBadge = showTrustBadge
    ? buildLotMediaTrustBadge({
        summary: mediaSummary ?? null,
        hasAnyMedia: sequence.length > 0,
      })
    : null

  const aspectClass = ASPECT_CLASS[aspect]

  return (
    <div
      className={`relative overflow-hidden ${aspectClass} ${className}`}
      style={{ background: pickFallbackGradient(fallbackKey) }}
      role="group"
      aria-roledescription="carousel"
      aria-label={title ? `Images for ${title}` : "Lot images"}
    >
      {/* FALLBACK PLACEHOLDER — deterministic tonal gradient.
          Rendered when there is no image to show or the current
          image's URL has errored. Matches the gradients used in
          existing card thumbnails so a no-media card looks the
          same as before. */}
      {showFallback && (
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0"
            style={{ background: pickFallbackGradient(fallbackKey) }}
          />
        </div>
      )}

      {/* REAL IMAGE */}
      {!showFallback && current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.url}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => onImageError(current.id)}
          loading="lazy"
        />
      )}

      {/* Bottom gradient — improves text legibility on top of
          either the fallback or a real image. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,8,3,0.55) 100%)",
        }}
      />

      {/* TRUST BADGE — never shows source enum names. Only
          appears when we actually have a public image to back
          the claim. */}
      {trustBadge && (
        <div className="absolute right-3 top-3 z-10">
          <TrustBadge label={trustBadge.label} tone={trustBadge.tone} />
        </div>
      )}

      {/* "Image pending" microcopy — only when there is no
          public media at all. Skipped on the featured aspect
          to keep the hero card clean. */}
      {sequence.length === 0 && aspect !== "featured" && (
        <div
          className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[9.5px] font-medium uppercase tracking-[0.16em] text-white/70 backdrop-blur-sm"
          aria-hidden
        >
          Image pending
        </div>
      )}

      {/* Slot for badges / favorite toggles passed by caller */}
      {children}

      {/* ARROWS */}
      {showArrows && sequence.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-black/30 text-white/90 backdrop-blur-sm opacity-0 transition-opacity hover:bg-black/50 focus:opacity-100 group-hover:opacity-100"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-black/30 text-white/90 backdrop-blur-sm opacity-0 transition-opacity hover:bg-black/50 focus:opacity-100 group-hover:opacity-100"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}

      {/* DOTS */}
      {showDots && sequence.length > 1 && (
        <div
          className="absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5"
          role="tablist"
          aria-label="Image selector"
        >
          {sequence.map((m, i) => {
            const active = i === safeIndex
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Show image ${i + 1}`}
                onClick={goTo(i)}
                className={
                  "h-1.5 rounded-full transition-all duration-200 " +
                  (active
                    ? "w-4 bg-white/90"
                    : "w-1.5 bg-white/40 hover:bg-white/70")
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------
// TRUST BADGE
// ------------------------------------------------------

function TrustBadge({
  label,
  tone,
}: {
  label: string
  tone: "partner" | "curated" | "illustrative"
}) {
  const cls =
    tone === "partner"
      ? "bg-[#d4af37] text-[#1a0f08] border-[#d4af37]"
      : tone === "curated"
        ? "bg-[#86c69b]/85 text-[#0f1d14] border-[#86c69b]"
        : "bg-black/45 text-white/85 border-white/15 backdrop-blur-sm"

  return (
    <span
      className={
        "rounded-full border px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] " +
        cls
      }
    >
      {label}
    </span>
  )
}

// ------------------------------------------------------
// FALLBACK GRADIENT
//
// Deterministic per fallbackKey so a given lot always
// shows the same swatch when it has no media. Six tones
// match the gradients used in existing card thumbnails
// across marketplace + client dashboard.
// ------------------------------------------------------

const FALLBACK_GRADIENTS: ReadonlyArray<string> = [
  "linear-gradient(135deg, #1f2e1c 0%, #2f4a2c 60%, #4f7048 100%)",
  "linear-gradient(135deg, #3a2b1e 0%, #5a4030 60%, #8a6845 100%)",
  "linear-gradient(135deg, #2c2418 0%, #4a3d28 60%, #7a6740 100%)",
  "linear-gradient(135deg, #2d3a1f 0%, #4a5a2c 60%, #7a8a3f 100%)",
  "linear-gradient(120deg, #1a0f08 0%, #2a1810 30%, #6b4528 100%)",
  "linear-gradient(135deg, #3d231a 0%, #5d3a25 60%, #8a5b3b 100%)",
]

function pickFallbackGradient(key: string): string {
  if (!key) return FALLBACK_GRADIENTS[0]
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0
  }
  return FALLBACK_GRADIENTS[Math.abs(h) % FALLBACK_GRADIENTS.length]
}

// ------------------------------------------------------
// ICONS
// ------------------------------------------------------

function ChevronLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
