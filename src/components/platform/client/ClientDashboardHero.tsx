"use client"

import React from "react"
import {
  COLORS,
  RADII,
  formatKg,
  formatShipmentDate,
  formatDaysUntil,
} from "./dashboardTokens"

//////////////////////////////////////////////////////
// 🪟 CLIENT DASHBOARD HERO — catalog-first polish
//
// Layout matches the target mock:
//   - Headline + subtitle on the left, coffee imagery
//     soft-blended on the right.
//   - 5-cell KPI strip directly below the copy block,
//     each cell: round icon + label + value + sub.
//
// KPIs:
//   ACTIVE CONTRACTS · MONTHLY VOLUME · PENDING REQUESTS
//   NEXT DELIVERY · CATALOG LOTS AVAILABLE
//
// "Catalog Lots Available" replaces the old "Available
// Supply" KPI so the client never reads global figures
// as their own.
//////////////////////////////////////////////////////

export type HeroKpis = {
  activeContracts: number
  uniqueOrigins: number
  monthlyGreenKg: number
  pendingRequests: number
  nextShipmentIso: string | null
  nextShipmentCountry: string | null
  catalogLotsAvailable: number
}

type Props = {
  userName?: string | null
  kpis: HeroKpis
}

export default function ClientDashboardHero({ kpis }: Props) {
  return (
    <section style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          borderRadius: RADII.card,
          overflow: "hidden",
          minHeight: 360,
          border: COLORS.borderSoft,
          background: `
            radial-gradient(ellipse at 80% 0%, rgba(214,176,79,0.06), transparent 50%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))
          `,
        }}
      >
        {/* RIGHT IMAGE — coffee plant / cherries (operator will swap this asset later) */}
        <div
          style={{
            position: "absolute",
            right: 0, top: 0, bottom: 0,
            width: "62%",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <img
            src="/images/client_taza.png"
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = "none"
            }}
          />
          {/* Smooth horizontal gradient so the image fades into the dark card on the left */}
          <div
            style={{
              position: "absolute", inset: 0,
              background:
                "linear-gradient(90deg, " +
                COLORS.bg + " 0%, " +
                COLORS.bg + " 18%, " +
                "rgba(8,16,13,0.92) 32%, " +
                "rgba(8,16,13,0.72) 46%, " +
                "rgba(8,16,13,0.42) 60%, " +
                "rgba(8,16,13,0.15) 78%, " +
                "rgba(8,16,13,0) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0,
              background:
                "radial-gradient(ellipse 70% 90% at 72% 52%, transparent 0%, transparent 40%, rgba(8,16,13,0.35) 72%, rgba(8,16,13,0.65) 100%)",
            }}
          />
        </div>

        {/* CONTENT */}
        <div style={{ position: "relative", zIndex: 1, padding: "48px 48px 36px" }}>
          <h1
            style={{
              fontSize: "clamp(2.6rem, 4.4vw, 3.8rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: COLORS.textPrimary,
              margin: 0,
              lineHeight: 1.05,
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            }}
          >
            Your Coffee Supply Desk
          </h1>
          <p
            style={{
              marginTop: 16,
              maxWidth: 520,
              fontSize: "1rem",
              lineHeight: 1.6,
              color: COLORS.textMuted,
              fontWeight: 300,
            }}
          >
            Select premium lots for monthly roasted supply and manage your
            active contracts in one place.
          </p>

          {/* KPI ROW */}
          <div
            style={{
              marginTop: 36,
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 14,
              maxWidth: 1180,
            }}
          >
            <KpiCard
              icon={<DocIcon />}
              label="Active Contracts"
              value={String(kpis.activeContracts)}
              sub="View all contracts →"
              isLink
            />
            <KpiCard
              icon={<BoxIcon />}
              label="Monthly Volume"
              value={`${formatKg(kpis.monthlyGreenKg)} kg`}
              sub="Roasted commitment"
            />
            <KpiCard
              icon={<ClockIcon />}
              label="Pending Requests"
              value={String(kpis.pendingRequests)}
              sub={kpis.pendingRequests > 0 ? "Requires your review" : "Nothing pending"}
            />
            <KpiCard
              icon={<ShipmentIcon />}
              label="Next Delivery"
              value={formatShipmentDate(kpis.nextShipmentIso)}
              sub={
                kpis.nextShipmentIso
                  ? (formatDaysUntil(kpis.nextShipmentIso) || (kpis.nextShipmentCountry ?? "—"))
                  : "No scheduled deliveries"
              }
            />
            <KpiCard
              icon={<LeafIcon />}
              label="Catalog Lots Available"
              value={String(kpis.catalogLotsAvailable)}
              sub="Ready for contract"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------
// KPI CARD — boxed cell matching the target mock
// ------------------------------------------------------

function KpiCard({
  icon, label, value, sub, isLink,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  isLink?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "14px 16px",
        borderRadius: 14,
        background: "rgba(8,16,13,0.55)",
        border: COLORS.borderSoft,
        backdropFilter: "blur(6px)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: RADII.pill,
          background: COLORS.goldFaint,
          border: `1px solid ${COLORS.goldSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.gold,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: COLORS.textFaint,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={label}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: COLORS.gold,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
            marginTop: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={value}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: isLink ? COLORS.gold : COLORS.textMuted,
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={sub}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// ICONS
// ------------------------------------------------------

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  )
}

function ShipmentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="15" height="12" rx="1" />
      <path d="M16 8h4l3 3v7h-7" />
      <circle cx="6" cy="20" r="1.5" />
      <circle cx="19" cy="20" r="1.5" />
    </svg>
  )
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  )
}
