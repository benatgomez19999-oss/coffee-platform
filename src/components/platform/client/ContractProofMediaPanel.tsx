"use client"

import React, { useEffect, useState } from "react"
import { COLORS, RADII } from "./dashboardTokens"

//////////////////////////////////////////////////////
// 🔐 CONTRACT PROOF MEDIA PANEL — BUYER-PROOF-1
//
// Fetches `/api/contracts/[contractId]/proof-media` and
// renders a compact grid of buyer-proof tiles:
//
//   • Traceability proof
//   • Certificate
//   • Final export bag (informational tile — populated
//     by BUYER-PROOF-2; this sprint shows "coming soon")
//   • Any other rows the buyer is entitled to see
//
// Public-bucket rows render as <img>. Private rows
// rendered through their freshly signed read URL. If
// signing fails we show a small "couldn't load" tile
// instead of breaking the panel.
//
// AUDIENCE: the API tells us whether the caller is
// BUYER / PARTNER / PRODUCER; we use the value to decide
// whether to surface the "no proof yet" hint copy. For
// PARTNER / PRODUCER we keep the panel functional but
// drop the buyer-facing reassurance text.
//////////////////////////////////////////////////////

type ProofMediaDto = {
  id: string
  role: string
  roleLabel: string
  source: string
  visibility: "PUBLIC_MARKET" | "BUYER_PRIVATE" | "INTERNAL_ONLY"
  owner: "LOT" | "FARM"
  position: number
  isPrimary: boolean
  altText: string | null
  caption: string | null
  credit: string | null
  resolvedUrl: string | null
  signed: boolean
  expiresInSeconds: number | null
  signError?: string
}

type ProofMediaSummary = {
  hasTraceabilityProof: boolean
  hasCertificate: boolean
  hasFinalBagPhoto: null
  itemCount: number
  missing: Array<"TRACEABILITY_PROOF" | "CERTIFICATE">
}

type ProofMediaResponse = {
  contractId: string
  greenLotId: string | null
  generatedAt: string
  audience: "BUYER" | "PARTNER" | "PRODUCER"
  storageConfigured: boolean
  media: ProofMediaDto[]
  summary: ProofMediaSummary
}

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: ProofMediaResponse }

type Props = {
  contractId: string
  contractTitle?: string
}

export default function ContractProofMediaPanel({
  contractId,
  contractTitle,
}: Props) {

  const [state, setState] = useState<FetchState>({ kind: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ kind: "loading" })
    fetch(`/api/contracts/${encodeURIComponent(contractId)}/proof-media`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(
            (body && typeof body.error === "string" && body.error) ||
              `Failed to load proof media (${res.status}).`,
          )
        }
        const data = (await res.json()) as ProofMediaResponse
        if (!cancelled) setState({ kind: "ok", data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Failed to load proof media."
        setState({ kind: "error", message })
      })
    return () => {
      cancelled = true
    }
  }, [contractId])

  return (
    <div
      style={{
        padding: 20,
        borderRadius: RADII.card,
        background: COLORS.panelBg,
        border: COLORS.borderSoft,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Header contractTitle={contractTitle} state={state} />

      {state.kind === "loading" && <LoadingTiles />}
      {state.kind === "error" && <ErrorTile message={state.message} />}
      {state.kind === "ok" && (
        <ProofGrid response={state.data} />
      )}
    </div>
  )
}

// ------------------------------------------------------
// HEADER
// ------------------------------------------------------

function Header({
  contractTitle,
  state,
}: {
  contractTitle?: string
  state: FetchState
}) {
  const subtitle =
    state.kind === "ok"
      ? state.data.summary.itemCount > 0
        ? `${state.data.summary.itemCount} item${state.data.summary.itemCount === 1 ? "" : "s"}`
        : "Proof will appear here once your partner uploads it."
      : state.kind === "loading"
        ? "Loading proof…"
        : ""
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: COLORS.gold,
          opacity: 0.85,
        }}
      >
        Buyer proof
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: COLORS.textPrimary,
          letterSpacing: "-0.005em",
          fontFamily:
            "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
        }}
      >
        {contractTitle ? `Proof — ${contractTitle}` : "Traceability proof"}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 12,
            color: COLORS.textMuted,
            fontWeight: 300,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------
// LOADING / ERROR
// ------------------------------------------------------

function LoadingTiles() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10,
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            aspectRatio: "4/3",
            borderRadius: RADII.inner,
            background: COLORS.panelInner,
            border: COLORS.borderInner,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
}

function ErrorTile({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: RADII.inner,
        background: COLORS.panelInner,
        border: COLORS.borderInner,
        color: COLORS.textMuted,
        fontSize: 12.5,
        lineHeight: 1.55,
      }}
    >
      {message}
    </div>
  )
}

// ------------------------------------------------------
// PROOF GRID
// ------------------------------------------------------

function ProofGrid({ response }: { response: ProofMediaResponse }) {
  const { media, summary, audience } = response

  // We promote TRACEABILITY_BAG + CERTIFICATE to the top
  // of the grid since that's what the buyer expects to
  // see first. Everything else flows after.
  const sorted = [...media].sort((a, b) => {
    return proofRolePriority(a.role) - proofRolePriority(b.role)
  })

  const showFinalBagPlaceholder = audience === "BUYER"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {audience === "BUYER" && summary.missing.length > 0 && (
        <div
          style={{
            padding: 10,
            borderRadius: RADII.chip,
            background: COLORS.goldFaint,
            border: `1px solid ${COLORS.goldSoft}`,
            color: COLORS.gold,
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          Waiting on: {summary.missing
            .map((code) =>
              code === "TRACEABILITY_PROOF" ? "traceability proof" : "certificate",
            )
            .join(", ")}
          .
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        {sorted.map((item) => (
          <ProofTile key={item.id} item={item} />
        ))}
        {showFinalBagPlaceholder && (
          <FinalBagPlaceholderTile />
        )}
        {media.length === 0 && !showFinalBagPlaceholder && (
          <div
            style={{
              gridColumn: "1 / -1",
              fontSize: 12,
              color: COLORS.textFaint,
              fontStyle: "italic",
              padding: 10,
            }}
          >
            No proof media has been uploaded yet.
          </div>
        )}
      </div>
    </div>
  )
}

function proofRolePriority(role: string): number {
  switch (role) {
    case "TRACEABILITY_BAG": return 0
    case "CERTIFICATE":      return 1
    case "FARM":             return 2
    case "PROCESS":          return 3
    case "PRODUCER":         return 4
    case "PRODUCT_DETAIL":   return 5
    default:                 return 6
  }
}

// ------------------------------------------------------
// TILES
// ------------------------------------------------------

function ProofTile({ item }: { item: ProofMediaDto }) {
  const label = item.roleLabel
  const isPrivate =
    item.visibility === "BUYER_PRIVATE" ||
    item.visibility === "INTERNAL_ONLY"

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRadius: RADII.inner,
        overflow: "hidden",
        background: COLORS.panelInner,
        border: COLORS.borderInner,
      }}
    >
      <div
        style={{
          aspectRatio: "4/3",
          background: "#1a1410",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {item.resolvedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.resolvedUrl}
            alt={item.altText ?? label}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <UnavailableTileBody message={item.signError ?? "Image unavailable."} />
        )}
        {isPrivate && item.resolvedUrl && (
          <PrivateBadge />
        )}
      </div>
      <div
        style={{
          padding: "6px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            color: COLORS.textPrimary,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        {item.caption && (
          <div
            style={{
              fontSize: 10.5,
              color: COLORS.textMuted,
              lineHeight: 1.45,
            }}
          >
            {item.caption}
          </div>
        )}
      </div>
    </div>
  )
}

function FinalBagPlaceholderTile() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRadius: RADII.inner,
        overflow: "hidden",
        background: COLORS.panelInner,
        border: `1px dashed ${COLORS.goldSoft}`,
      }}
    >
      <div
        style={{
          aspectRatio: "4/3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.textFaint,
          fontSize: 11,
        }}
      >
        Coming soon
      </div>
      <div style={{ padding: "6px 10px 10px" }}>
        <div
          style={{
            fontSize: 11.5,
            color: COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          Final export bag
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: COLORS.textFaint,
            lineHeight: 1.45,
          }}
        >
          Uploaded when your shipment is sealed.
        </div>
      </div>
    </div>
  )
}

function UnavailableTileBody({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 10,
        textAlign: "center",
        color: COLORS.textFaint,
        fontSize: 10.5,
        lineHeight: 1.45,
      }}
    >
      {message}
    </div>
  )
}

function PrivateBadge() {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        padding: "2px 7px",
        fontSize: 9.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: COLORS.gold,
        background: "rgba(8,16,13,0.78)",
        border: `1px solid ${COLORS.goldSoft}`,
        borderRadius: RADII.pill,
        fontWeight: 600,
      }}
    >
      Private
    </div>
  )
}
