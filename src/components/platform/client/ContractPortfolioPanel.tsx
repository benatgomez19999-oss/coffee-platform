"use client"

import React from "react"
import {
  COLORS,
  RADII,
  formatKg,
  formatPrice,
  formatShipmentDate,
  formatDaysUntil,
} from "./dashboardTokens"
import type { PortfolioMetrics } from "@/src/services/client-dashboard/contractPortfolioMetrics"
import {
  pickRecentActiveContracts,
  type DashboardContractLike,
} from "@/src/services/client-dashboard/recentActiveContracts"

//////////////////////////////////////////////////////
// 📋 CONTRACT PORTFOLIO — compact sidebar
//
// Right-column companion panel for the catalog. Shows:
//   - 2×2 cell grid (Active / Pending / Monthly Volume / Next Delivery)
//   - Recent contracts list (max 3) via pickRecentActiveContracts
//   - Footer "View all contracts →" link
//
// Strictly read-only. Contracts data is passed in so the
// list can show real titles and statuses without re-fetching.
//////////////////////////////////////////////////////

type Props = {
  metrics: PortfolioMetrics
  contracts: ReadonlyArray<DashboardContractLike>
  loading: boolean
  contractsHref?: string
}

export default function ContractPortfolioPanel({
  metrics, contracts, loading, contractsHref = "/platform/contracts",
}: Props) {

  const recent = pickRecentActiveContracts(contracts, 3)
  const pendingTotal = metrics.pendingSignatureContracts + metrics.pendingPaymentContracts

  return (
    <aside
      style={{
        padding: 22,
        borderRadius: RADII.card,
        background: COLORS.panelBg,
        border: COLORS.borderSoft,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minHeight: "100%",
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
          Contract Portfolio
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: COLORS.textPrimary,
            letterSpacing: "-0.005em",
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
          }}
        >
          Your active supply at a glance
        </div>
      </div>

      {/* 2×2 SUMMARY CELLS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          opacity: loading ? 0.6 : 1,
          transition: "opacity 200ms ease-out",
        }}
      >
        <SummaryCell label="Active" value={String(metrics.activeContracts)} />
        <SummaryCell label="Pending" value={String(pendingTotal)} />
        <SummaryCell
          label="Monthly Volume"
          value={`${formatKg(metrics.monthlyGreenKg)} kg`}
        />
        <SummaryCell
          label="Next Delivery"
          value={formatShipmentDate(metrics.nextShipment.dateIso)}
          sub={
            metrics.nextShipment.dateIso
              ? formatDaysUntil(metrics.nextShipment.dateIso) || null
              : null
          }
        />
      </div>

      {/* RECENT CONTRACTS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COLORS.textFaint,
            }}
          >
            Recent Contracts
          </div>
          <a
            href={contractsHref}
            style={{
              fontSize: 11,
              color: COLORS.gold,
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            View all
          </a>
        </div>

        {loading ? (
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>Loading…</p>
        ) : recent.length === 0 ? (
          <EmptyRow />
        ) : (
          <div data-testid="client-portfolio-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((r) => (
              <RecentRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 4,
          display: "flex",
        }}
      >
        <a
          href={contractsHref}
          style={{
            flex: 1,
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.05em",
            borderRadius: 12,
            color: COLORS.gold,
            textDecoration: "none",
            background: COLORS.goldFaint,
            border: `1px solid ${COLORS.goldSoft}`,
          }}
        >
          View all contracts <ArrowRight />
        </a>
      </div>
    </aside>
  )
}

// ------------------------------------------------------
// SUMMARY CELL
// ------------------------------------------------------

function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string | null
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: COLORS.panelInner,
        border: COLORS.borderInner,
        minHeight: 70,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: COLORS.textFaint,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: COLORS.gold,
          letterSpacing: "-0.01em",
          lineHeight: 1.15,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={value}
      >
        {value}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 3,
            fontSize: 10,
            color: COLORS.textMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={sub}
        >
          {sub}
        </div>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------
// RECENT CONTRACT ROW
// ------------------------------------------------------

function RecentRow({
  row,
}: {
  row: ReturnType<typeof pickRecentActiveContracts>[number]
}) {
  const volume =
    row.monthlyVolumeKg != null ? `${formatKg(row.monthlyVolumeKg)} kg/month` : null
  const price =
    row.lockedPricePerKg != null
      ? `${formatPrice(row.lockedPricePerKg, "EUR")}/kg`
      : null
  const meta = [volume, price].filter(Boolean).join(" · ")

  return (
    <div
      data-testid="client-portfolio-row"
      data-id={row.id}
      style={{
        padding: 12,
        borderRadius: 12,
        background: COLORS.panelInner,
        border: COLORS.borderInner,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: RADII.pill,
              background: row.status === "ACTIVE" ? COLORS.emeraldDot : COLORS.gold,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 12.5,
              color: COLORS.textPrimary,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={row.title}
          >
            {row.title}
          </div>
        </div>
        <StatusBadge status={row.status} />
      </div>

      {row.subtitle ? (
        <div
          style={{
            fontSize: 10.5,
            color: COLORS.textMuted,
            fontWeight: 300,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={row.subtitle}
        >
          {row.subtitle}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          fontSize: 10.5,
          color: COLORS.textMuted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={meta}>
          {meta || "—"}
        </span>
        {row.nextExecutionIso ? (
          <span style={{ color: COLORS.textFaint, whiteSpace: "nowrap" }}>
            Next: {formatShipmentDate(row.nextExecutionIso)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE"
  const label =
    status === "ACTIVE" ? "Active" :
    status === "AWAITING_SIGNATURE" ? "Signing" :
    status === "PAYMENT_PENDING" ? "Pay" :
    titleCase(status)
  return (
    <span
      data-testid="client-portfolio-status"
      data-status={status}
      style={{
        fontSize: 9,
        letterSpacing: "0.06em",
        padding: "2px 7px",
        borderRadius: RADII.pill,
        color: isActive ? COLORS.emerald : COLORS.gold,
        background: isActive ? COLORS.emeraldBg : COLORS.amberBg,
        border: `1px solid ${isActive ? COLORS.emeraldLine : COLORS.amberLine}`,
        fontWeight: 600,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function titleCase(value: string): string {
  if (!value) return value
  const lower = value.toLowerCase().replace(/_/g, " ")
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function EmptyRow() {
  return (
    <div
      data-testid="client-portfolio-empty"
      style={{
        padding: "14px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(214,176,79,0.18)",
        fontSize: 11.5,
        color: COLORS.textMuted,
        lineHeight: 1.55,
      }}
    >
      No active contracts yet. Configure your first monthly supply from the
      recommended lots above.
    </div>
  )
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  )
}
