"use client"

import React from "react"
import {
  COLORS,
  RADII,
  formatKg,
  formatPrice,
} from "./dashboardTokens"
import type { RecommendedContractLot } from "@/src/services/client-dashboard/recommendedContractLots"
import LotMediaCarousel from "@/src/components/platform/media/LotMediaCarousel"

//////////////////////////////////////////////////////
// 🛎️ SUPPLY DESK — Recommended for monthly supply
//
// Three large editorial product cards rendered as the
// catalog-first hero of the dashboard. Each card has:
//   - tonal-gradient image area (real lot images later)
//   - badge stack (HIGH SCA / EXCLUSIVE / FRESH …)
//   - serif lot name + producer + region with pin icon
//   - 6-stat 2×3 grid (Variety / Process / SCA · Altitude / Available / Price)
//   - primary "Configure monthly supply" gold-fill CTA
//   - secondary "View details" outlined CTA
//
// Every CTA is non-mutating in this sprint. The primary
// button stays disabled with a "Contract request flow
// lands next." tooltip so QA can verify no DemandIntent
// is ever created from this panel.
//////////////////////////////////////////////////////

type Props = {
  lots: ReadonlyArray<RecommendedContractLot>
  loading: boolean
  errorMsg: string | null
  onScrollToCatalog?: () => void
  // CONTRACT-REQUEST-1 — opens the Configure monthly supply
  // modal for the clicked lot. Wiring lives in Dashboard.tsx.
  onConfigureMonthlySupply?: (lot: RecommendedContractLot) => void
  // Lot ids the buyer already has a pending request on (OPEN /
  // COUNTERED / WAITING). Used to swap the CTA for a chip.
  pendingRequestLotIds?: ReadonlySet<string>
}

export default function SupplyDeskPanel({
  lots, loading, errorMsg, onScrollToCatalog,
  onConfigureMonthlySupply,
  pendingRequestLotIds,
}: Props) {
  return (
    <section
      style={{
        padding: 28,
        borderRadius: RADII.card,
        background: COLORS.panelBg,
        border: COLORS.borderSoft,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* HEADER ROW — eyebrow + secondary link */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: COLORS.gold,
              opacity: 0.85,
              marginBottom: 8,
            }}
          >
            Recommended for monthly supply
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: COLORS.textPrimary,
              letterSpacing: "-0.01em",
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            }}
          >
            Premium lots ready for your roasting line
          </div>
        </div>
        <button
          type="button"
          onClick={onScrollToCatalog}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            fontSize: 12,
            color: COLORS.gold,
            letterSpacing: "0.04em",
          }}
        >
          View all recommendations →
        </button>
      </div>

      {/* BODY */}
      {loading ? (
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
          Loading recommendations…
        </p>
      ) : errorMsg ? (
        <ErrorBlock message={errorMsg} />
      ) : lots.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
          }}
        >
          {lots.slice(0, 3).map((lot) => (
            <RecommendedCard
              key={lot.id}
              lot={lot}
              onConfigureMonthlySupply={onConfigureMonthlySupply}
              pending={pendingRequestLotIds?.has(lot.id) ?? false}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------
// RECOMMENDED CARD
// ------------------------------------------------------

function RecommendedCard({
  lot,
  onConfigureMonthlySupply,
  pending,
}: {
  lot: RecommendedContractLot
  onConfigureMonthlySupply?: (lot: RecommendedContractLot) => void
  pending?: boolean
}) {
  const badges = buildBadges(lot)
  const altitudeLabel =
    lot.altitude != null ? `${lot.altitude.toLocaleString()} m` : "—"
  const scaLabel =
    lot.scaScore != null ? lot.scaScore.toFixed(2) : "—"
  const priceLabel =
    lot.pricePerKgRoasted != null
      ? `${formatPrice(lot.pricePerKgRoasted, lot.currency)} /kg`
      : "—"

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: RADII.inner,
        background: COLORS.panelInner,
        border: COLORS.borderInner,
        overflow: "hidden",
      }}
    >
      {/* IMAGE AREA — public media carousel (tonal fallback when empty) */}
      <div style={{ position: "relative", height: 180 }} className="group">
        <LotMediaCarousel
          media={lot.media}
          primaryMedia={lot.primaryMedia}
          mediaSummary={lot.mediaSummary ?? null}
          fallbackKey={lot.id}
          title={lot.name}
          aspect="card"
          className="absolute inset-0 h-full w-full"
          showTrustBadge
        >
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
              zIndex: 10,
            }}
          >
            {badges.map((b) => (
              <Badge key={b.label} kind={b.kind} label={b.label} />
            ))}
          </div>
        </LotMediaCarousel>
      </div>

      {/* CONTENT */}
      <div
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 500,
              color: COLORS.textPrimary,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            }}
            title={lot.name}
          >
            {lot.name}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: COLORS.textMuted,
              fontWeight: 300,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={lot.origin || "Origin pending"}
          >
            {lot.origin ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <PinIcon /> {lot.origin}
              </span>
            ) : (
              "Origin pending"
            )}
          </div>
        </div>

        {/* 6-stat 2×3 grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            rowGap: 12,
            columnGap: 14,
            paddingTop: 4,
          }}
        >
          <Stat label="Variety"   value={lot.variety || "—"} />
          <Stat label="Process"   value={lot.process ? titleCase(lot.process) : "—"} />
          <Stat label="SCA Score" value={scaLabel} mono />
          <Stat label="Altitude"  value={altitudeLabel} mono />
          <Stat
            label="Available"
            value={`${formatKg(lot.assignableRoastedKg)} kg`}
            mono
          />
          <Stat label="Price/kg" value={priceLabel} mono accent />
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
          {pending ? (
            <button
              type="button"
              data-testid="intent-create-pending"
              data-status="PENDING"
              disabled
              title="You already have a request open for this lot."
              style={{
                padding: "11px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                borderRadius: 12,
                color: COLORS.gold,
                background: COLORS.goldFaint,
                border: `1px solid ${COLORS.goldSoft}`,
                cursor: "not-allowed",
              }}
            >
              Pending request
            </button>
          ) : (
            <button
              type="button"
              data-testid="intent-create-open"
              onClick={() => onConfigureMonthlySupply?.(lot)}
              disabled={!onConfigureMonthlySupply || lot.pricePerKgRoasted == null}
              title={
                lot.pricePerKgRoasted == null
                  ? "Pricing is pending for this lot."
                  : "Send a monthly supply request for this lot."
              }
              style={{
                padding: "11px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                borderRadius: 12,
                color: COLORS.goldFillText,
                background: COLORS.goldFill,
                border: `1px solid ${COLORS.goldHi}`,
                cursor:
                  !onConfigureMonthlySupply || lot.pricePerKgRoasted == null
                    ? "not-allowed"
                    : "pointer",
                opacity: lot.pricePerKgRoasted == null ? 0.5 : 1,
              }}
            >
              Configure monthly supply
            </button>
          )}
          <button
            type="button"
            disabled
            title="Lot details page lands next."
            style={{
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              borderRadius: 12,
              color: COLORS.gold,
              background: "transparent",
              border: `1px solid ${COLORS.goldSoft}`,
              cursor: "not-allowed",
            }}
          >
            View details
          </button>
        </div>
      </div>
    </article>
  )
}

// ------------------------------------------------------
// BADGES (derived locally from the recommendation row)
// ------------------------------------------------------

type CardBadge = { label: string; kind: "filled" | "outline" }

function buildBadges(lot: RecommendedContractLot): CardBadge[] {
  const out: CardBadge[] = []
  if (lot.scaScore != null && lot.scaScore >= 86) {
    out.push({ label: "High SCA", kind: "filled" })
  }
  if (lot.recommendedSurface === "SPLIT") {
    out.push({ label: "Exclusive", kind: "outline" })
  }
  if (lot.altitude != null && lot.altitude >= 1900) {
    out.push({ label: "High Altitude", kind: "outline" })
  }
  // Always show a Fresh tag for newly published lots when nothing else stands out,
  // so cards never look badge-less in the mock.
  if (out.length === 0) {
    out.push({ label: "Fresh", kind: "outline" })
  }
  return out.slice(0, 2)
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function titleCase(value: string): string {
  if (!value) return value
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLORS.textFaint,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: accent ? COLORS.gold : COLORS.textPrimary,
          fontWeight: accent ? 500 : 400,
          fontVariantNumeric: mono ? "tabular-nums" : "normal",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function Badge({
  kind, label,
}: {
  kind: "filled" | "outline"
  label: string
}) {
  const filled = kind === "filled"
  return (
    <span
      style={{
        fontSize: 9.5,
        letterSpacing: "0.08em",
        padding: "4px 9px",
        borderRadius: RADII.pill,
        color: filled ? COLORS.badgeFilledText : COLORS.badgeOutlineText,
        background: filled ? COLORS.badgeFilledBg : "rgba(8,16,13,0.7)",
        border: filled
          ? `1px solid ${COLORS.goldHi}`
          : `1px solid ${COLORS.goldSoft}`,
        fontWeight: filled ? 600 : 500,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        backdropFilter: "blur(4px)",
      }}
    >
      {label}
    </span>
  )
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "20px 18px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(214,176,79,0.18)",
        fontSize: 13,
        color: COLORS.textMuted,
      }}
    >
      No contract-ready lots available right now. Newly published producer lots
      will appear here as soon as they clear the allocation engine.
    </div>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(255,140,140,0.06)",
        border: "1px solid rgba(255,140,140,0.18)",
        fontSize: 12.5,
        color: "#f3c5b8",
      }}
    >
      Unable to load recommendations. {message}
    </div>
  )
}
