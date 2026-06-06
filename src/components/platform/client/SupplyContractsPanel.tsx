"use client"

import React, { useState } from "react"
import { COLORS, RADII, formatKg, formatShipmentDate } from "./dashboardTokens"
import ContractProofMediaPanel from "./ContractProofMediaPanel"

//////////////////////////////////////////////////////
// 📜 SUPPLY CONTRACTS PANEL
//
// Bottom-row card. Two states:
//
//   • Empty — friendly "no supply contract yet" copy
//             with a subtle "Create pilot contract" CTA
//             that links to the existing pilot route.
//
//   • Active — compact stack with the next 3 contracts:
//              status pill, title (lot or producer name),
//              monthly volume, next shipment.
//
// Styling matches the rest of the dark editorial dashboard.
// No mutating actions in this sprint.
//////////////////////////////////////////////////////

export type SupplyContract = {
  id: string
  status: string
  monthlyGreenKg: number | null
  monthlyVolumeKg: number | null
  nextShipmentAt: string | null
  greenLot?: {
    name?: string | null
    farm?: { name?: string | null; region?: string | null } | null
    producer?: { name?: string | null; country?: string | null } | null
  } | null
}

type Props = {
  contracts: ReadonlyArray<SupplyContract>
  pilotHref?: string
  contractsHref?: string
}

const ACTIVE_STATUSES = new Set(["ACTIVE"])

export default function SupplyContractsPanel({
  contracts,
  pilotHref = "/contract/pilot",
  contractsHref = "/platform/contracts",
}: Props) {

  const active = contracts.filter((c) => ACTIVE_STATUSES.has((c.status ?? "").toUpperCase()))
  const isEmpty = active.length === 0

  return (
    <div
      style={{
        padding: 24,
        borderRadius: RADII.card,
        background: COLORS.panelBg,
        border: COLORS.borderSoft,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: COLORS.gold,
              opacity: 0.85,
              marginBottom: 6,
            }}
          >
            Supply Contracts
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 500,
              color: COLORS.textPrimary,
              letterSpacing: "-0.005em",
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            }}
          >
            Built for consistency and trust.
          </div>
        </div>
        <DocIconLarge />
      </div>

      {isEmpty ? (
        <>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.7,
              color: COLORS.textMuted,
              fontWeight: 300,
            }}
          >
            Pilot contracts can be started from any catalog lot. We coordinate
            the logistics, payment terms, and traceability so you can focus on
            roasting.
          </p>
          <a
            href={pilotHref}
            style={{
              alignSelf: "flex-start",
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              borderRadius: 10,
              color: COLORS.gold,
              textDecoration: "none",
              background: COLORS.goldFaint,
              border: `1px solid ${COLORS.goldSoft}`,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Create a pilot contract <ArrowRight />
          </a>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.slice(0, 3).map((c) => (
            <ContractRow key={c.id} contract={c} />
          ))}
          {active.length > 3 && (
            <a
              href={contractsHref}
              style={{
                fontSize: 11.5,
                color: COLORS.gold,
                textDecoration: "none",
                marginTop: 4,
              }}
            >
              View all {active.length} contracts →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------
// CONTRACT ROW
// ------------------------------------------------------

function ContractRow({ contract }: { contract: SupplyContract }) {
  const [proofOpen, setProofOpen] = useState(false)

  const monthly =
    typeof contract.monthlyGreenKg === "number" && Number.isFinite(contract.monthlyGreenKg)
      ? contract.monthlyGreenKg
      : typeof contract.monthlyVolumeKg === "number" && Number.isFinite(contract.monthlyVolumeKg)
          ? contract.monthlyVolumeKg
          : null

  const title =
    contract.greenLot?.name ||
    contract.greenLot?.farm?.name ||
    contract.greenLot?.producer?.name ||
    "Active contract"

  const subtitle =
    contract.greenLot?.farm?.region ||
    contract.greenLot?.producer?.country ||
    null

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: COLORS.panelInner,
        border: COLORS.borderInner,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              color: COLORS.textPrimary,
              fontWeight: 500,
              letterSpacing: "-0.003em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={title}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
                fontWeight: 300,
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 9.5,
            letterSpacing: "0.06em",
            padding: "3px 7px",
            borderRadius: RADII.pill,
            color: COLORS.emerald,
            background: COLORS.emeraldBg,
            border: `1px solid ${COLORS.emeraldLine}`,
            fontWeight: 600,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {contract.status}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: COLORS.textMuted,
        }}
      >
        <span>
          <span style={{ color: COLORS.textFaint }}>Monthly:</span>{" "}
          <span style={{ color: COLORS.textPrimary, fontVariantNumeric: "tabular-nums" }}>
            {monthly != null ? `${formatKg(monthly)} kg` : "—"}
          </span>
        </span>
        <span>
          <span style={{ color: COLORS.textFaint }}>Next shipment:</span>{" "}
          <span style={{ color: COLORS.textPrimary }}>
            {formatShipmentDate(contract.nextShipmentAt)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setProofOpen((v) => !v)}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: COLORS.gold,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {proofOpen ? "Hide proof" : "View proof"}
        </button>
      </div>
      {proofOpen && (
        <div style={{ marginTop: 4 }}>
          <ContractProofMediaPanel contractId={contract.id} contractTitle={title} />
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------
// ICONS
// ------------------------------------------------------

function DocIconLarge() {
  return (
    <div
      style={{
        width: 44,
        height: 44,
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
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
