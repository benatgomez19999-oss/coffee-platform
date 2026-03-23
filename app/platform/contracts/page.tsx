"use client"

import { useEffect, useState } from "react"

export default function ContractsPage() {

  const [contracts, setContracts] = useState<any[]>([])

  useEffect(() => {
    const fetchContracts = async () => {
      const res = await fetch("/api/contracts")

      if (res.ok) {
        const data = await res.json()
        setContracts(data.contracts || [])
      }
    }

    fetchContracts()
  }, [])

  return (
    <div style={{
      padding: "120px 80px",
      color: "white"
    }}>

      <h2 style={{
        fontWeight: 300,
        marginBottom: "40px"
      }}>
        Your Contracts
      </h2>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>

        {contracts.length === 0 && (
          <div style={{ opacity: 0.6 }}>
            No contracts yet
          </div>
        )}

        {contracts.map((contract) => (
          <div
            key={contract.id}
            style={{
              padding: "20px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >

            <div>
              <div style={{ fontSize: "14px", opacity: 0.6 }}>
                Contract ID
              </div>
              <div>{contract.id}</div>
            </div>

            <button
              onClick={() => window.open(`/api/contracts/${contract.id}/pdf`)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "white",
                cursor: "pointer"
              }}
            >
              View PDF
            </button>

          </div>
        ))}

      </div>

    </div>
  )
}