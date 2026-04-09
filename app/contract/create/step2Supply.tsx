"use client"

// =====================================================
// STEP 2 — SUPPLY CONFIGURATION
//
// In the current architecture, contracts require a
// DemandIntent (which provides greenLotId, validated
// volume, and locked pricing). Step 2 is only reachable
// when the wizard is entered without an intent, which
// cannot produce a valid contract. This component
// directs the user to the trading panel to start the
// correct flow.
// =====================================================

type Supply = {
  origin: string
  monthlyVolume: number
  duration: number
  greenLotId: string | null
  lotName: string | null
  farmName: string | null
  pricePerKg: number | null
}

type Props = {
  supply: Supply
  onNext: (data: Supply) => void
}

export default function Step2Supply({ supply, onNext }: Props) {

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "20px 0" }}>

      <h2 style={{ fontSize: 20 }}>
        Supply Configuration
      </h2>

      <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
        To create a contract, you need to first request a volume
        from the trading panel. This ensures supply availability
        and locks pricing for your contract.
      </p>

      <div>
        <a
          href="/platform"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 999,
            background: "#000",
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Go to Trading Panel
        </a>
      </div>

    </div>
  )
}
