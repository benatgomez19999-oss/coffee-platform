"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import ContractTimelineModal from "@/components/platform/ContractTimelineModal"

import {
  selectContract,
  clearSelectedContract
} from "@/clientLayer/layer/contractController"

import { getRegisteredContracts } from "@/clientLayer/layer/contractRegistry"

// ======================================================
// CLIENT CONTRACTS PANEL — CLEAN VERSION
// ======================================================

export default function ClientContractsPanel({ contracts }: { contracts: any[] }) {

  const router = useRouter()
  const searchParams = useSearchParams()!

  const contractSuccess =
    searchParams.get("contract") === "success"

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [selectedContractId, setSelectedContractId] =
    useState<string | null>(null)

  // ======================================================
  // STATE — SOURCE OF TRUTH = PROPS
  // ======================================================

  const activeContracts = contracts || []

  // ======================================================
  // CLEAN TEMPLATE WHEN REAL CONTRACT EXISTS
  // ======================================================

  useEffect(() => {
    if (activeContracts.length > 0) {
      setSelectedTemplate(null)
    }
  }, [activeContracts.length])

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

      {activeContracts.length === 0 && (

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
            No active supply contract
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
         ACTIVE CONTRACTS
      ====================================================== */}

      {activeContracts.map(contract => (

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
                : "1px solid rgba(74,222,128,0.35)",

            background:
              contract.id === selectedContractId
                ? "rgba(250,204,21,0.12)"
                : "rgba(255,255,255,0.03)"
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.01)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "scale(1)")
          }
        >

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >

            <div>
              <div style={{ fontWeight: 500, fontSize: 14, opacity: 0.8 }}>
                Active Contract
              </div>

              <div style={{ fontSize: 18, marginTop: 2 }}>
                {contract.monthlyVolumeKg} kg / month
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContractId(contract.id)
                setShowTimeline(true)
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                cursor: "pointer"
              }}
            >
              View Contract
            </button>

          </div>

        </div>

      ))}

      {/* ======================================================
         NEW CONTRACT BUTTON
      ====================================================== */}

      {activeContracts.length > 0 && (

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
         TEMPLATES (solo si no hay contratos)
      ====================================================== */}

      {activeContracts.length === 0 &&
        getRegisteredContracts().map(template => (

          <div
            key={template.id}
            style={{
              padding: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              marginBottom: 12,
              cursor: "pointer"
            }}
            onClick={() => setSelectedTemplate(template)}
          >

            <div style={{ fontWeight: 500 }}>
              {template.title}
            </div>

            <div style={{ opacity: 0.6, fontSize: 13 }}>
              {template.monthlyVolumeKg}kg / month · {template.durationMonths} months
            </div>

          </div>

        ))}

      {/* ======================================================
         TEMPLATE VIEW
      ====================================================== */}

      {selectedTemplate && (

        <div
          style={{
            marginTop: 30,
            padding: 20,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12
          }}
        >

          <div style={{ fontSize: 18, marginBottom: 10 }}>
            {selectedTemplate.title}
          </div>

          <div style={{ opacity: 0.7 }}>
            Product: {selectedTemplate.product}
          </div>

          <div style={{ opacity: 0.7 }}>
            Monthly Volume: {selectedTemplate.monthlyVolumeKg} kg
          </div>

          <div style={{ opacity: 0.7 }}>
            Duration: {selectedTemplate.durationMonths} months
          </div>

          <div style={{ opacity: 0.7 }}>
            Total Supply: {selectedTemplate.monthlyVolumeKg * selectedTemplate.durationMonths} kg
          </div>

          <button
            onClick={() => {
              clearSelectedContract()
              router.push("/contract/create")
            }}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.05)",
              cursor: "pointer"
            }}
          >
            View Contract
          </button>

        </div>

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