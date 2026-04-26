"use client"

import { useState, useEffect } from "react"

import {
  evaluateContractSuggestion
} from "@/src/clientLayer/layer/contractIntelligence"

import { selectContract, getSelectedContract }
from "@/src/clientLayer/layer/contractController"


type Props = {
  marketData?: any
}

export default function LeftPanel({ marketData }: Props) {

  // =====================================================
  // TOTAL AVAILABLE (FROM MARKET API — ROASTED KG)
  // =====================================================

  const totalAvailable = marketData?.totals?.roastedAvailableKg ?? 0
  const scaleMax = totalAvailable

  // =====================================================
  // VOLUME STATE
  // =====================================================

  const [volume, setVolume] = useState(0)
  const [suggestion, setSuggestion] = useState<any>(null)
  const [intentResult, setIntentResult] = useState<any>(null)
  const [intentLoading, setIntentLoading] = useState(false)

  // =====================================================
  // MARKET LOTS (for greenLotId selection)
  // =====================================================

  const allLots = marketData
    ? Object.values(marketData.regions as Record<string, any>).flatMap(
        (r: any) => r.lots
      )
    : []

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedLotId && allLots.length > 0) {
      setSelectedLotId(allLots[0].id)
    }
  }, [allLots.length])

  useEffect(() => {

    setVolume(v => {

      if (!Number.isFinite(v)) return 0

      return Math.max(0, Math.min(v, scaleMax))

    })

  }, [scaleMax])

  // =====================================================
  // CONTRACT INTELLIGENCE
  // =====================================================

  useEffect(() => {

    const selected = getSelectedContract()
    const s = evaluateContractSuggestion(volume, selected)
    setSuggestion(s)

  }, [volume])

  // =====================================================
  // SELECTED LOT INFO
  // =====================================================

  const selectedLot = allLots.find((l: any) => l.id === selectedLotId)

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      id="supply-desk"
      style={{
        scrollMarginTop: 110,
        padding: 36,
        borderRadius: 22,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)",
        border: "1px solid rgba(214,176,79,0.18)",
      }}
    >

      {/* ============================================== */}
      {/* PANEL HEADER                                    */}
      {/* ============================================== */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(214,176,79,0.85)",
            marginBottom: 8
          }}
        >
          Supply Desk
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#f4efe3",
            fontWeight: 400,
            letterSpacing: "-0.005em"
          }}
        >
          New contract request
        </div>
      </div>

      {/* ============================================== */}
      {/* EMPTY STATE — no verified lots                  */}
      {/* (No fake "marketplace" CTA — that route does    */}
      {/*  not exist. Calm informational state with a     */}
      {/*  Refresh action so the user can re-check.)     */}
      {/* ============================================== */}
      {allLots.length === 0 && (
        <div
          style={{
            padding: "60px 32px",
            borderRadius: 18,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))",
            border: "1px solid rgba(255,255,255,0.07)",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              margin: "0 auto 20px",
              borderRadius: "50%",
              background: "rgba(214,176,79,0.08)",
              border: "1px solid rgba(214,176,79,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d6b04f",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
              <path d="M6 1v3" />
              <path d="M10 1v3" />
              <path d="M14 1v3" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 17,
              color: "#f4efe3",
              letterSpacing: "-0.005em",
              fontWeight: 400,
            }}
          >
            No verified lots available right now
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "rgba(244,239,227,0.55)",
              maxWidth: 400,
              margin: "12px auto 0",
              lineHeight: 1.7
            }}
          >
            When new lots clear quality verification, they will appear here for
            direct supply requests.
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              padding: "9px 20px",
              borderRadius: 999,
              border: "1px solid rgba(214,176,79,0.28)",
              background: "transparent",
              color: "#d6b04f",
              fontSize: 12,
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {/* ============================================== */}
      {/* TRADING UI — only when lots exist              */}
      {/* ============================================== */}
      {allLots.length > 0 && (
        <>

          {/* SELECTED LOT — prominent card */}
          {selectedLot && (
            <div
              style={{
                padding: 24,
                borderRadius: 16,
                background:
                  "linear-gradient(180deg, rgba(214,176,79,0.05) 0%, rgba(255,255,255,0.018) 100%)",
                border: "1px solid rgba(214,176,79,0.22)",
                marginBottom: 26
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(214,176,79,0.85)"
                }}
              >
                Selected Lot
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 22,
                  fontWeight: 400,
                  color: "#f4efe3",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25
                }}
              >
                {selectedLot.name ?? selectedLot.coffee?.variety ?? "Lot"}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "rgba(244,239,227,0.55)"
                }}
              >
                {selectedLot.origin?.farmName}
                {selectedLot.origin?.region
                  ? ` · ${selectedLot.origin.region}`
                  : ""}
              </div>

              {/* COMPACT METRIC ROW */}
              <div
                style={{
                  marginTop: 22,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 18
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.55,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase"
                    }}
                  >
                    Available
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      marginTop: 4,
                      color: "#f4efe3",
                      fontWeight: 400
                    }}
                  >
                    {selectedLot.volume?.roastedAvailableKg} kg
                  </div>
                </div>

                {selectedLot.pricing?.roastedPricePerKg != null && (
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.55,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase"
                      }}
                    >
                      Per roasted kg
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        marginTop: 4,
                        color: "#f4efe3",
                        fontWeight: 400
                      }}
                    >
                      ${selectedLot.pricing.roastedPricePerKg}
                    </div>
                  </div>
                )}
              </div>

              {/* TAGS — process / SCA */}
              {(selectedLot.coffee?.process ||
                selectedLot.coffee?.scaScore != null) && (
                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap"
                  }}
                >
                  {selectedLot.coffee?.process && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "5px 11px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(244,239,227,0.78)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase"
                      }}
                    >
                      {selectedLot.coffee.process}
                    </span>
                  )}
                  {selectedLot.coffee?.scaScore != null && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "5px 11px",
                        borderRadius: 999,
                        background: "rgba(214,176,79,0.1)",
                        border: "1px solid rgba(214,176,79,0.28)",
                        color: "rgba(226,193,93,0.95)",
                        letterSpacing: "0.06em"
                      }}
                    >
                      SCA {selectedLot.coffee.scaScore}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* REQUEST BOX */}
          <div
            style={{
              padding: 24,
              borderRadius: 16,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 22
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline"
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  color: "#f4efe3",
                  letterSpacing: "-0.01em"
                }}
              >
                {Math.round(volume)} kg / month
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                Requested volume
              </div>
            </div>

            <div style={{ marginTop: 8, opacity: 0.5, fontSize: 12 }}>
              Available across all lots: {Math.round(totalAvailable)} kg roasted
            </div>
          </div>

          {/* VOLUME BAR — only when there is supply */}
          {scaleMax > 0 && (
            <>
              <div style={{ position: "relative", marginBottom: 22 }}>

                {/* REQUEST MARKER */}
                <div
                  style={{
                    position: "absolute",
                    left: `${(volume / scaleMax) * 100}%`,
                    top: -12,
                    transform: "translateX(-50%)",
                    fontSize: 12,
                    color: "#ffffff",
                    pointerEvents: "none"
                  }}
                >
                  ▲
                </div>

                {/* FILL BAR */}
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.08)",
                    boxShadow: "0 0 6px rgba(0,0,0,0.4)"
                  }}
                >
                  <div
                    style={{
                      width: `${(volume / scaleMax) * 100}%`,
                      height: "100%",
                      background:
                        volume / scaleMax < 0.65
                          ? "#4ade80"
                          : volume / scaleMax < 0.9
                          ? "#facc15"
                          : "#f87171",
                      transition: "width 0.15s ease"
                    }}
                  />
                </div>
              </div>

              {/* SCALE LABELS */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  opacity: 0.5,
                  marginBottom: 20
                }}
              >
                <span>0</span>
                <span>{Math.round(scaleMax)} kg</span>
              </div>

              {/* SLIDER */}
              <input
                type="range"
                min={0}
                max={scaleMax}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                }}
                style={{
                  width: "100%",
                  marginBottom: 30
                }}
              />
            </>
          )}

          {/* CONTRACT INTELLIGENCE */}
          {suggestion && (
            <div
              style={{
                marginTop: 20,
                padding: 18,
                borderRadius: 12,
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.4)"
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Contract Intelligence Suggestion
              </div>

              <div style={{ marginTop: 6 }}>
                Suggested upgrade: +{suggestion.delta} kg/month
              </div>

              <button
                onClick={async () => {

                  if (!selectedLotId || intentLoading) return

                  const contract = getSelectedContract()
                  const v = Math.round(volume)

                  setIntentLoading(true)
                  try {
                    const res = await fetch("/api/demand-intent", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        greenLotId: selectedLotId,
                        requestedKg: v,
                        type: contract ? "AMEND" : "CREATE",
                        contractId: contract?.id ?? undefined,
                      })
                    })

                    const data = await res.json()

                    if (!res.ok) {
                      console.error("Intent error:", data)
                      setIntentResult({ error: data.error })
                      return
                    }

                    setIntentResult(data)

                    // GREEN → go to contract wizard
                    if (data.semaphore?.status === "green") {
                      window.location.href =
                        `/contract/create?mode=${contract ? "amend" : "create"}&contractId=${contract?.id ?? ""}&volume=${v}&intentId=${data.intent.id}`
                    }

                  } catch (err) {
                    console.error("Intent request failed:", err)
                  } finally {
                    setIntentLoading(false)
                  }

                }}
                disabled={intentLoading}
                style={{
                  marginTop: 12,
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: intentLoading ? "#888" : "#4ade80",
                  color: "#111",
                  cursor: intentLoading ? "not-allowed" : "pointer"
                }}
              >
                {intentLoading ? "Processing..." : "Request Contract"}
              </button>
            </div>
          )}

          {/* INTENT RESULT FEEDBACK — yellow */}
          {intentResult?.semaphore?.status === "yellow" &&
            intentResult.intent && (
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  borderRadius: 12,
                  background: "rgba(250,204,21,0.08)",
                  border: "1px solid rgba(250,204,21,0.4)"
                }}
              >
                <div style={{ fontSize: 13, opacity: 0.7 }}>Counteroffer</div>
                <div style={{ marginTop: 6 }}>
                  Requested: {intentResult.intent.requestedKg} kg/month
                </div>
                <div>Offered: {intentResult.intent.offeredKg} kg/month</div>
                <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `/api/demand-intent/${intentResult.intent.id}/accept`,
                          { method: "POST" }
                        )
                        if (res.ok) {
                          const contract = getSelectedContract()
                          window.location.href = `/contract/create?mode=${contract ? "amend" : "create"}&contractId=${contract?.id ?? ""}&volume=${intentResult.intent.offeredKg}&intentId=${intentResult.intent.id}`
                        }
                      } catch (err) {
                        console.error("Accept failed:", err)
                      }
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 999,
                      border: "none",
                      background: "#facc15",
                      color: "#111",
                      cursor: "pointer"
                    }}
                  >
                    Accept Offer
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(
                          `/api/demand-intent/${intentResult.intent.id}/cancel`,
                          { method: "POST" }
                        )
                        setIntentResult(null)
                      } catch (err) {
                        console.error("Cancel failed:", err)
                      }
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer"
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

          {/* INTENT RESULT FEEDBACK — red */}
          {intentResult?.semaphore?.status === "red" &&
            intentResult.intent && (
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  borderRadius: 12,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.4)"
                }}
              >
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  Insufficient Supply
                </div>
                <div style={{ marginTop: 6 }}>
                  Requested volume exceeds available capacity.
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(
                          `/api/demand-intent/${intentResult.intent.id}/wait`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ autoExecute: false })
                          }
                        )
                        setIntentResult((prev: any) => ({
                          ...prev,
                          intent: { ...prev.intent, status: "WAITING" }
                        }))
                      } catch (err) {
                        console.error("Wait failed:", err)
                      }
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 999,
                      border: "none",
                      background: "#f87171",
                      color: "#111",
                      cursor: "pointer"
                    }}
                  >
                    Wait for Supply
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(
                          `/api/demand-intent/${intentResult.intent.id}/cancel`,
                          { method: "POST" }
                        )
                        setIntentResult(null)
                      } catch (err) {
                        console.error("Cancel failed:", err)
                      }
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          {/* WAITING */}
          {intentResult?.intent?.status === "WAITING" && (
            <div
              style={{
                marginTop: 20,
                padding: 18,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Waiting for Supply
              </div>
              <div style={{ marginTop: 6, opacity: 0.8 }}>
                You will be notified when supply becomes available.
              </div>
            </div>
          )}

          {/* ERROR */}
          {intentResult?.error && (
            <div
              style={{
                marginTop: 20,
                padding: 14,
                borderRadius: 12,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171",
                fontSize: 13
              }}
            >
              {intentResult.error}
            </div>
          )}

          {/* LOT SELECTOR */}
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
              Select Coffee Lot
            </div>
            <select
              value={selectedLotId ?? ""}
              onChange={(e) => setSelectedLotId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
                fontSize: 14
              }}
            >
              {allLots.map((lot: any) => (
                <option
                  key={lot.id}
                  value={lot.id}
                  style={{ background: "#1a1a1a" }}
                >
                  {lot.name ?? lot.coffee?.variety ?? "Lot"} — {lot.origin?.farmName} ({lot.volume?.roastedAvailableKg} kg)
                </option>
              ))}
            </select>
          </div>

        </>
      )}

    </div>
  )
}
