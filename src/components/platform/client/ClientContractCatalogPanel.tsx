"use client"

import React, { forwardRef, useState } from "react"
import {
  COLORS,
  RADII,
  formatKg,
  formatPrice,
} from "./dashboardTokens"
import LotMediaCarousel from "@/src/components/platform/media/LotMediaCarousel"
import type {
  LotMediaItem,
  LotMediaSummary,
} from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// 📚 MONTHLY CONTRACT CATALOG
//
// Full catalog strip rendered below the recommended row.
// Header: eyebrow + toolbar with non-functional filter
// chip-dropdowns (Origin / Variety / Process / SCA /
// Price / More filters), a "Sort by" dropdown, and a
// grid/list view toggle.
//
// Cards (compact, image-driven):
//   - tonal-gradient image with a single corner badge
//   - serif name
//   - region · country with pin
//   - 4-stat row (Variety / Process / SCA / Price)
//   - footer: "Available N kg" + "+" hint
//
// Filters/sort/view-toggle are intentionally
// non-functional in this sprint — they're surfaced as
// disabled UI so the catalog can preview its target
// shape without backend work.
//////////////////////////////////////////////////////

type ContractCatalogBadgeKey =
  | "contract-ready"
  | "split-lot"
  | "high-sca"
  | "high-altitude"
  | "limited-contract-pool"

export type ContractCatalogStripLot = {
  id: string
  lotNumber: string
  name: string
  producerName: string | null
  farmName: string | null
  region: string | null
  country: string | null
  process: string
  variety: string
  scaScore: number | null
  altitude: number | null
  contractAssignableRoastedKg: number
  pricePerKgRoasted: number | null
  currency: string
  recommendedSurface: "CONTRACT_CATALOG" | "SPLIT"
  badges: ContractCatalogBadgeKey[]
  // DASHBOARD-IMAGES-1 — public media. PUBLIC_MARKET only
  // (the catalog mapper filters before emitting).
  media?: LotMediaItem[]
  primaryMedia?: LotMediaItem | null
  mediaSummary?: LotMediaSummary
}

type Props = {
  lots: ReadonlyArray<ContractCatalogStripLot>
  loading: boolean
  errorMsg: string | null
  // CONTRACT-REQUEST-1 — opens the Configure monthly supply modal
  onConfigureMonthlySupply?: (lot: ContractCatalogStripLot) => void
  pendingRequestLotIds?: ReadonlySet<string>
}

const ContractCatalogStrip = forwardRef<HTMLDivElement, Props>(
  function ContractCatalogStrip(
    { lots, loading, errorMsg, onConfigureMonthlySupply, pendingRequestLotIds },
    ref,
  ) {

    return (
      <section
        ref={ref}
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
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
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
              Monthly Contract Catalog
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
              Catalog lots reserved for recurring roasted supply
            </div>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: COLORS.textMuted,
              fontWeight: 300,
            }}
          >
            {loading ? "…" : `${lots.length} catalog lots`}
          </div>
        </div>

        {/* TOOLBAR */}
        <Toolbar />

        {/* BODY */}
        {loading ? (
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
            Loading catalog…
          </p>
        ) : errorMsg ? (
          <ErrorBlock message={errorMsg} />
        ) : lots.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 14,
            }}
          >
            {lots.map((lot) => (
              <CatalogCard
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
)

export default ContractCatalogStrip

// ------------------------------------------------------
// TOOLBAR (chip dropdowns + sort + view toggle)
// ------------------------------------------------------

const FILTER_CHIPS = [
  { label: "Origin" },
  { label: "Variety" },
  { label: "Process" },
  { label: "SCA" },
  { label: "Price" },
  { label: "More filters" },
] as const

function Toolbar() {
  const [view, setView] = useState<"grid" | "list">("grid")
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FILTER_CHIPS.map((c) => (
          <FilterChip key={c.label} label={c.label} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <SortByChip />
        <ViewToggle view={view} onChange={setView} />
      </div>
    </div>
  )
}

function FilterChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      title="Filters coming soon"
      disabled
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        fontSize: 11,
        color: COLORS.textMuted,
        background: "rgba(255,255,255,0.025)",
        border: COLORS.borderInner,
        borderRadius: RADII.pill,
        cursor: "not-allowed",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <ChevronDown />
    </button>
  )
}

function SortByChip() {
  return (
    <button
      type="button"
      title="Sort coming soon"
      disabled
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        fontSize: 11,
        color: COLORS.textMuted,
        background: "rgba(255,255,255,0.025)",
        border: COLORS.borderInner,
        borderRadius: RADII.pill,
        cursor: "not-allowed",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      Sort: SCA Score (High to Low)
      <ChevronDown />
    </button>
  )
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "list"
  onChange: (v: "grid" | "list") => void
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: RADII.pill,
        border: COLORS.borderInner,
        background: "rgba(255,255,255,0.025)",
        overflow: "hidden",
      }}
    >
      <ToggleButton active={view === "grid"} onClick={() => onChange("grid")}>
        <GridIcon />
      </ToggleButton>
      <ToggleButton active={view === "list"} onClick={() => onChange("list")}>
        <ListIcon />
      </ToggleButton>
    </div>
  )
}

function ToggleButton({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 10px",
        fontSize: 11,
        color: active ? COLORS.goldFillText : COLORS.textMuted,
        background: active ? COLORS.gold : "transparent",
        border: 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------
// CATALOG CARD
// ------------------------------------------------------

function CatalogCard({
  lot,
  onConfigureMonthlySupply,
  pending,
}: {
  lot: ContractCatalogStripLot
  onConfigureMonthlySupply?: (lot: ContractCatalogStripLot) => void
  pending?: boolean
}) {
  const subtitleParts: string[] = []
  if (lot.region) subtitleParts.push(lot.region)
  if (lot.country && lot.country !== lot.region) subtitleParts.push(lot.country)
  const subtitle = subtitleParts.join(", ")

  const cornerBadge = pickCornerBadge(lot)

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
      <div style={{ position: "relative", height: 116 }} className="group">
        <LotMediaCarousel
          media={lot.media}
          primaryMedia={lot.primaryMedia}
          mediaSummary={lot.mediaSummary}
          fallbackKey={lot.id}
          title={lot.name}
          aspect="compact"
          className="absolute inset-0 h-full w-full"
          showTrustBadge={false}
        >
          {cornerBadge ? (
            <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}>
              <Badge label={cornerBadge.label} kind={cornerBadge.kind} />
            </div>
          ) : null}
        </LotMediaCarousel>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: COLORS.textPrimary,
              letterSpacing: "-0.005em",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={lot.name}
          >
            {lot.name}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 10.5,
              color: COLORS.textMuted,
              fontWeight: 300,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
            title={subtitle || "Origin pending"}
          >
            {subtitle ? (
              <>
                <PinIcon /> {subtitle}
              </>
            ) : (
              "Origin pending"
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            rowGap: 6,
            columnGap: 10,
          }}
        >
          <Stat label="Variety"  value={lot.variety || "—"} />
          <Stat label="Process"  value={lot.process ? titleCase(lot.process) : "—"} />
          <Stat
            label="SCA"
            value={lot.scaScore != null ? lot.scaScore.toFixed(2) : "—"}
            mono
          />
          <Stat
            label="Price/kg"
            value={
              lot.pricePerKgRoasted != null
                ? formatPrice(lot.pricePerKgRoasted, lot.currency)
                : "—"
            }
            mono
            accent
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.04)",
            marginTop: "auto",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 10.5, color: COLORS.textMuted, fontVariantNumeric: "tabular-nums" }}>
            Available {formatKg(lot.contractAssignableRoastedKg)} kg
          </span>
          {pending ? (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: COLORS.gold,
                background: COLORS.goldFaint,
                border: `1px solid ${COLORS.goldSoft}`,
                padding: "3px 8px",
                borderRadius: RADII.pill,
                whiteSpace: "nowrap",
              }}
              title="You already have a request open for this lot."
            >
              Pending request
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onConfigureMonthlySupply?.(lot)}
              disabled={
                !onConfigureMonthlySupply ||
                lot.pricePerKgRoasted == null ||
                lot.contractAssignableRoastedKg <= 0
              }
              title={
                lot.pricePerKgRoasted == null
                  ? "Pricing is pending for this lot."
                  : lot.contractAssignableRoastedKg <= 0
                    ? "No volume available right now."
                    : "Configure monthly supply for this lot."
              }
              aria-label="Configure monthly supply"
              style={{
                width: 26,
                height: 26,
                borderRadius: RADII.pill,
                background: COLORS.goldFaint,
                border: `1px solid ${COLORS.goldSoft}`,
                color: COLORS.gold,
                cursor:
                  !onConfigureMonthlySupply ||
                  lot.pricePerKgRoasted == null ||
                  lot.contractAssignableRoastedKg <= 0
                    ? "not-allowed"
                    : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                lineHeight: 1,
                opacity:
                  lot.pricePerKgRoasted == null ||
                  lot.contractAssignableRoastedKg <= 0
                    ? 0.4
                    : 1,
              }}
            >
              +
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

// ------------------------------------------------------
// BADGE PICKING (one per card max, mock-aligned)
// ------------------------------------------------------

function pickCornerBadge(lot: ContractCatalogStripLot): { label: string; kind: "filled" | "outline" } | null {
  if (lot.scaScore != null && lot.scaScore >= 88) return { label: "High SCA", kind: "filled" }
  if (lot.recommendedSurface === "SPLIT") return { label: "Exclusive", kind: "outline" }
  if (lot.altitude != null && lot.altitude >= 1900) return { label: "High Altitude", kind: "outline" }
  if (lot.badges.includes("contract-ready")) return { label: "Fresh", kind: "outline" }
  return null
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
          fontSize: 8.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLORS.textFaint,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontVariantNumeric: mono ? "tabular-nums" : "normal",
          color: accent ? COLORS.gold : COLORS.textPrimary,
          fontWeight: accent ? 500 : 400,
          marginTop: 2,
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
        fontSize: 8.5,
        letterSpacing: "0.08em",
        padding: "3px 7px",
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
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function EmptyBlock() {
  return (
    <div
      style={{
        padding: "26px 22px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.025)",
        border: "1px dashed rgba(214,176,79,0.18)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: COLORS.textPrimary,
          fontWeight: 400,
          marginBottom: 6,
        }}
      >
        No catalog lots available right now.
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: COLORS.textMuted,
          fontWeight: 300,
          lineHeight: 1.6,
        }}
      >
        Check the marketplace for one-off lots, or try again after new producer
        lots are published.
      </p>
      <a
        href="/platform/marketplace"
        style={{
          display: "inline-block",
          marginTop: 12,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.04em",
          borderRadius: 10,
          color: COLORS.gold,
          textDecoration: "none",
          background: COLORS.goldFaint,
          border: `1px solid ${COLORS.goldSoft}`,
        }}
      >
        Open marketplace
      </a>
    </div>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        background: "rgba(255,140,140,0.06)",
        border: "1px solid rgba(255,140,140,0.18)",
      }}
    >
      <div style={{ fontSize: 13, color: "#f3c5b8" }}>
        Unable to load the contract catalog.
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11.5,
          color: COLORS.textMuted,
          fontWeight: 300,
        }}
      >
        {message}
      </div>
    </div>
  )
}
