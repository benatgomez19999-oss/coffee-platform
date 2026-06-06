//////////////////////////////////////////////////////
// 🏷️ PRODUCER-PROOF-POLISH — PURE LABEL HELPERS
//
// Maps the coarse machine codes returned by
// /api/partner/export-ready (proofReady + proofMissing)
// to human-readable strings used by the export-ready
// UI badge / detail / CTA.
//
// Kept pure (no React, no Prisma, no fetch) so it can
// be unit-tested under `node --test` alongside the rest
// of the lot-media helpers, and so the partner UI never
// re-implements the mapping inline.
//
// IMPORTANT — no enum names ever appear in the output.
// Producer / partner copy never mentions BUYER_PRIVATE,
// TRACEABILITY_BAG, Supabase, buckets, etc.
//////////////////////////////////////////////////////

export type ProofReadinessBadgeTone = "ok" | "warning"

export type ProofReadinessBadge = {
  tone: ProofReadinessBadgeTone
  label: string
}

//////////////////////////////////////////////////////
// formatProofMissingLabel
//
// Maps a single machine code (as returned by the
// export-ready advisory) to a human-readable label.
// Unknown codes fall back to a safe generic string —
// we never leak the raw code to the operator.
//////////////////////////////////////////////////////

export function formatProofMissingLabel(code: unknown): string {
  if (typeof code !== "string") return "Required proof"
  switch (code) {
    case "TRACEABILITY_PROOF":
      return "Private traceability proof"
    case "CERTIFICATE":
      return "Quality certificate"
    case "FINAL_BAG_PHOTO":
      return "Final bag / label photo"
    default:
      return "Required proof"
  }
}

//////////////////////////////////////////////////////
// formatProofBadge
//
// One-call decision for the row badge. proofReady
// undefined falls back to "warning" so we never claim
// readiness based on missing data.
//////////////////////////////////////////////////////

export function formatProofBadge(input: {
  proofReady?: boolean | null
  proofMissing?: ReadonlyArray<string> | null
}): ProofReadinessBadge {
  if (input.proofReady === true) {
    return { tone: "ok", label: "Proof ready" }
  }
  return { tone: "warning", label: "Proof missing" }
}

//////////////////////////////////////////////////////
// formatProofMissingDetail
//
// Joins the proofMissing codes into a friendly,
// punctuation-stable sentence. Useful for the row
// detail copy + screen-reader summary.
//////////////////////////////////////////////////////

export function formatProofMissingDetail(
  codes: ReadonlyArray<string> | null | undefined,
): string {
  if (!codes || codes.length === 0) {
    return "Add a private traceability or final-bag proof before shipping this lot."
  }
  const labels = codes.map(formatProofMissingLabel)
  const list =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`
  return `Missing: ${list}.`
}

//////////////////////////////////////////////////////
// buildProofCtaHref
//
// Centralises the deep-link to the media upload page
// so the UI doesn't hand-build query strings. Defaults
// to the partner surface (PARTNER-MEDIA-UI-1); callers
// can override `basePath` if they want to deep-link to
// /platform/producer/media instead. Only includes
// non-empty params so an unknown lot doesn't produce
// `?lotId=`.
//////////////////////////////////////////////////////

export const PARTNER_MEDIA_BASE_PATH = "/platform/partner/media"
export const PRODUCER_MEDIA_BASE_PATH = "/platform/producer/media"

export function buildProofCtaHref(input: {
  lotId?: string | null
  farmId?: string | null
  focus?: "private-proof" | "public-listing"
  basePath?: string
}): string {
  const basePath = (input.basePath ?? PARTNER_MEDIA_BASE_PATH).trim() ||
    PARTNER_MEDIA_BASE_PATH
  const params = new URLSearchParams()
  if (input.lotId && input.lotId.trim()) {
    params.set("lotId", input.lotId.trim())
  }
  if (input.farmId && input.farmId.trim()) {
    params.set("farmId", input.farmId.trim())
  }
  if (input.focus) {
    params.set("focus", input.focus)
  }
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
