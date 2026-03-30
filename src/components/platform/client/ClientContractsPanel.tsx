"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import ContractTimelineModal from "@/components/platform/client/ContractTimelineModal"

import {
  selectContract,
  clearSelectedContract
} from "@/clientLayer/layer/contractController"

import { getRegisteredContracts } from "@/clientLayer/layer/contractRegistry"

// ======================================================
// CLIENT CONTRACTS PANEL — STATUS AWARE (PRO)
// ======================================================

export default function ClientContractsPanel({ contracts }: { contracts: any[] }) {

  const router = useRouter()
  const searchParams = useSearchParams()!

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [selectedContractId, setSelectedContractId] =
    useState<string | null>(null)

  const safeContracts = Array.isArray(contracts) ? contracts : []

  // ======================================================
  // CLEAN TEMPLATE WHEN REAL CONTRACT EXISTS
  // ======================================================

  useEffect(() => {
    if (safeContracts.length > 0) {
      setSelectedTemplate(null)
    }
  }, [safeContracts.length])

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
        return "#facc15"
      case "SIGNED":
      case "PAYMENT_PENDING":
        return "#4ade80"
      case "ACTIVE":
        return "#4ade80"
      case "COMPLETED":
        return "#999"
      default:
        return "#fff"
    }
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (

    <div
      style={{
        padding: "30px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)"
      }}
    >

      <div style={{ marginBottom: 20, fontSize: 18 }}>
        Supply Contracts
      </div>

      {/* ======================================================
         NO CONTRACT
      ====================================================== */}

      {safeContracts.length === 0 && (

        <div
          style={{
            padding: 18,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 20,
            background: "rgba(255,255,255,0.03)"
          }}
        >

          <div style={{ marginBottom: 12, opacity: 0.7 }}>
            No supply contract yet
          </div>

          <button
            onClick={() => {
              clearSelectedContract()
              router.push("/contract/create")
            }}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(90deg,#d4af37,#f3d27a)",
              cursor: "pointer",
              fontWeight: 500
            }}
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
                  ? "2px solid #facc15"
                  : "1px solid rgba(255,255,255,0.15)",

              background:
                contract.id === selectedContractId
                  ? "rgba(250,204,21,0.08)"
                  : "rgba(255,255,255,0.03)"
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >

              {/* LEFT SIDE */}

              <div>

                <div style={{
                  fontSize: 13,
                  opacity: 0.7,
                  color: getStatusColor(status)
                }}>
                  {getStatusLabel(status)}
                </div>

                <div style={{ fontSize: 18, marginTop: 2 }}>
                  {contract.monthlyVolumeKg} kg / month
                </div>

              </div>

              {/* RIGHT SIDE ACTIONS */}

              <div style={{ display: "flex", gap: 8 }}>

                {/* SIGN */}

                {status === "AWAITING_SIGNATURE" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/contract/verify-otp?contractId=${contract.id}`)
                    }}
                    style={actionBtn("#facc15")}
                  >
                    Sign
                  </button>
                )}

                {/* PAY */}

                {(status === "SIGNED" || status === "PAYMENT_PENDING") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/contract/payment?contractId=${contract.id}`)
                    }}
                    style={actionBtn("#4ade80")}
                  >
                    Pay
                  </button>
                )}

                {/* VIEW */}

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedContractId(contract.id)
                    setShowTimeline(true)
                  }}
                  style={secondaryBtn}
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
      ====================================================== */}

      {safeContracts.length > 0 && (

        <button
          onClick={() => {
            clearSelectedContract()
            router.push("/contract/create")
          }}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(212,175,55,0.6)",
            background: "linear-gradient(90deg,#d4af37,#f3d27a)",
            cursor: "pointer",
            fontWeight: 500
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

function actionBtn(color: string) {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: "none",
    background: color,
    color: "#000",
    cursor: "pointer",
    fontWeight: 500
  }
}

const secondaryBtn = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer"
}