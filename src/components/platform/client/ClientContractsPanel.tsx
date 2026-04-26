"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import ContractTimelineModal from "@/src/components/platform/client/ContractTimelineModal"

import {
  selectContract,
  clearSelectedContract
} from "@/src/clientLayer/layer/contractController"

// ======================================================
// CLIENT CONTRACTS PANEL — STATUS AWARE
//
// CTA routing:
//   - "Start Pilot Contract" / "+ New Contract" used to
//     route to /contract/create directly. That route is a
//     dead-end without a DemandIntent. They now scroll to
//     the Supply Desk panel where the user picks a lot and
//     submits a real intent — which is the only legitimate
//     entry to /contract/create.
// ======================================================

export default function ClientContractsPanel({ contracts }: { contracts: any[] }) {

  const router = useRouter()
  const searchParams = useSearchParams()!

  const [showTimeline, setShowTimeline] = useState(false)
  const [selectedContractId, setSelectedContractId] =
    useState<string | null>(null)

  const safeContracts = Array.isArray(contracts) ? contracts : []

  // ======================================================
  // SCROLL TO SUPPLY DESK — CTA replacement for dead-end
  // ======================================================

  function goToSupplyDesk() {
    const el = document.getElementById("supply-desk")
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // ======================================================
  // HELPERS
  // ======================================================

  function getStatusLabel(status: string) {
    switch (status) {
      case "AWAITING_SIGNATURE":
        return "Pending Signature"
      case "SIGNED":
      case "PAYMENT_PENDING":
        return "Pending Payment"
      case "ACTIVE":
        return "Active"
      case "COMPLETED":
        return "Completed"
      default:
        return status
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "AWAITING_SIGNATURE":
        return "#e2c15d"
      case "SIGNED":
      case "PAYMENT_PENDING":
        return "#7be09f"
      case "ACTIVE":
        return "#7be09f"
      case "COMPLETED":
        return "rgba(244,239,227,0.5)"
      default:
        return "#f4efe3"
    }
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div
      style={{
        padding: 30,
        borderRadius: 22,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)",
        border: "1px solid rgba(214,176,79,0.18)",
      }}
    >

      <div
        style={{
          fontSize: 18,
          color: "#f4efe3",
          fontWeight: 400,
          letterSpacing: "-0.005em",
          marginBottom: 18,
        }}
      >
        Supply Contracts
      </div>

      {/* ======================================================
         NO CONTRACT — calm empty state
      ====================================================== */}

      {safeContracts.length === 0 && (
        <div
          style={{
            padding: 22,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.025)",
            display: "flex",
            alignItems: "center",
            gap: 18,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(214,176,79,0.08)",
                border: "1px solid rgba(214,176,79,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#d6b04f",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
                stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 2.5H12L17 7.5V17.5H5V2.5Z" />
                <path d="M12 2.5V7.5H17" />
                <path d="M7.5 11H14.5" />
                <path d="M7.5 14H12.5" />
              </svg>
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  color: "#f4efe3",
                  fontWeight: 400,
                  marginBottom: 4,
                }}
              >
                No supply contract yet
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(244,239,227,0.55)",
                  lineHeight: 1.6,
                }}
              >
                Start your first pilot contract to secure roasted coffee supply.
              </div>
            </div>
          </div>

          <button
            onClick={goToSupplyDesk}
            style={primaryGoldPill}
          >
            Start Pilot Contract
          </button>
        </div>
      )}

      {/* ======================================================
         CONTRACT LIST (STATUS AWARE)
      ====================================================== */}

      {safeContracts.map(contract => {

        const status = contract.status

        return (
          <div
            key={contract.id}
            onClick={() => {
              selectContract(contract.id)
              setSelectedContractId(contract.id)
            }}
            style={{
              cursor: "pointer",
              padding: 18,
              borderRadius: 14,
              marginBottom: 12,
              transition: "all 0.15s ease",

              border:
                contract.id === selectedContractId
                  ? "1px solid rgba(226,193,93,0.55)"
                  : "1px solid rgba(255,255,255,0.1)",

              background:
                contract.id === selectedContractId
                  ? "rgba(214,176,79,0.05)"
                  : "rgba(255,255,255,0.025)",
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
              }}
            >

              {/* LEFT SIDE */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: getStatusColor(status),
                  }}
                >
                  {getStatusLabel(status)}
                </div>

                <div
                  style={{
                    fontSize: 17,
                    marginTop: 4,
                    color: "#f4efe3",
                    fontWeight: 400,
                  }}
                >
                  {contract.monthlyVolumeKg} kg / month
                </div>
              </div>

              {/* RIGHT SIDE ACTIONS */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>

                {status === "AWAITING_SIGNATURE" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/contract/verify-otp?contractId=${contract.id}`)
                    }}
                    style={actionPill("rgba(226,193,93,0.85)")}
                  >
                    Sign
                  </button>
                )}

                {(status === "SIGNED" || status === "PAYMENT_PENDING") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/contract/payment?contractId=${contract.id}`)
                    }}
                    style={actionPill("rgba(123,224,159,0.85)")}
                  >
                    Pay
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedContractId(contract.id)
                    setShowTimeline(true)
                  }}
                  style={secondaryPill}
                >
                  View
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* ======================================================
         NEW CONTRACT BUTTON
         (Now routes to Supply Desk, not the dead-end wizard.)
      ====================================================== */}

      {safeContracts.length > 0 && (
        <button
          onClick={goToSupplyDesk}
          style={{
            ...primaryGoldPill,
            marginTop: 12,
          }}
        >
          + New Contract
        </button>
      )}

      {/* ======================================================
         TIMELINE
      ====================================================== */}

      {showTimeline && selectedContractId && (
        <ContractTimelineModal
          contractId={selectedContractId}
          onClose={() => setShowTimeline(false)}
        />
      )}

    </div>
  )
}


// ======================================================
// STYLES
// ======================================================

const primaryGoldPill: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 999,
  border: "1px solid rgba(214,176,79,0.5)",
  background: "linear-gradient(90deg, #d6b04f, #e2c15d)",
  color: "#1a1409",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 13,
  letterSpacing: "0.02em",
  flexShrink: 0,
}

const secondaryPill: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "#f4efe3",
  cursor: "pointer",
  fontSize: 12,
  letterSpacing: "0.02em",
}

function actionPill(color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    cursor: "pointer",
    fontSize: 12,
    letterSpacing: "0.04em",
    fontWeight: 400,
  }
}
