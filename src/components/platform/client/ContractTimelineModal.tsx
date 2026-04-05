"use client"

import { getContractHistory }
from "@/src/clientLayer/layer/contractLedger"

type Props = {
  contractId: string
  onClose: () => void
}

export default function ContractTimelineModal({
  contractId,
  onClose
}: Props) {

  const history = getContractHistory(contractId)
    .slice()
    .sort((a,b) => b.version - a.version)

  return (

    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>

      <div style={{
        width: 500,
        maxHeight: "80vh",
        overflowY: "auto",
        padding: 30,
        borderRadius: 16,
        background: "#0b0f12",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 20
        }}>

          <div style={{ fontSize: 18 }}>
            Contract Timeline
          </div>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              fontSize: 18
            }}
          >
            ✕
          </button>

        </div>


        {history.length === 0 && (

          <div style={{ opacity: 0.6 }}>
            No contract history
          </div>

        )}


       {history.map((entry, i) => (
  <div
    key={`${entry.contractId}-${entry.version}-${i}`}
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 12
            }}
          >

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6
            }}>

              <div style={{ fontWeight: 500 }}>
                Version {entry.version}
              </div>

              <div style={{ opacity: 0.6, fontSize: 12 }}>
                {entry.type === "create"
                  ? "Contract Created"
                  : "Amendment"}
              </div>

            </div>


            <div style={{ opacity: 0.7 }}>
              {entry.monthlyVolumeKg} kg / month
            </div>

            <div style={{
              fontSize: 12,
              opacity: 0.5,
              marginTop: 4
            }}>
              {new Date(entry.createdAt)
                .toLocaleString()}
            </div>

          </div>

        ))}

      </div>

    </div>

  )

}