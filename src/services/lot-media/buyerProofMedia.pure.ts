//////////////////////////////////////////////////////
// 🔐 BUYER-PROOF-1 — PURE HELPERS
//
// Filters a lot's combined media (lot + farm) down to
// the rows a particular audience is allowed to see on
// the contract proof endpoint, and builds the compact
// summary the buyer dashboard renders before requesting
// signed read URLs.
//
// No Prisma. No fetch. No DOM. Deterministic. Tested
// under node --test in `__tests__/buyerProofMedia.test.ts`.
//
// AUDIENCE MATRIX (BUYER-PROOF-1)
//   BUYER     — sees PUBLIC_MARKET + BUYER_PRIVATE. Never
//               INTERNAL_ONLY. The route layer additionally
//               scopes by contract ownership.
//   PARTNER   — sees everything (PUBLIC + BUYER + INTERNAL).
//   PRODUCER  — sees everything for their own lots (the
//               route enforces ownership). Treated like
//               PARTNER once they pass auth.
//
// The audience filter is intentionally generous to PARTNER
// / PRODUCER because the route already verified ownership;
// the BUYER branch is the only one with a real boundary.
//////////////////////////////////////////////////////

import type {
  LotMediaItem,
  LotMediaRole,
  LotMediaVisibility,
} from "./lotMedia.types.ts"

//////////////////////////////////////////////////////
// TYPES
//////////////////////////////////////////////////////

export type ContractProofAudience = "BUYER" | "PARTNER" | "PRODUCER"

export type BuyerProofMediaSummary = {
  hasTraceabilityProof: boolean
  hasCertificate: boolean
  // BUYER-PROOF-1 has no "final export bag" role yet — the
  // shipment guard will populate this in BUYER-PROOF-2. We
  // surface it as `null` so the UI can render a "coming
  // soon" tile without a missing-field branch.
  hasFinalBagPhoto: null
  itemCount: number
  // Stable ordered list of slot codes that are NOT covered
  // — gives the buyer dashboard an at-a-glance hint without
  // re-implementing the rules in the UI.
  missing: Array<"TRACEABILITY_PROOF" | "CERTIFICATE">
}

//////////////////////////////////////////////////////
// ROLE PREDICATES
//
// We treat any verified TRACEABILITY_BAG row as buyer
// traceability proof, regardless of visibility — public
// traceability bags are rare but they still count as
// proof for an authenticated buyer. CERTIFICATE follows
// the same rule.
//////////////////////////////////////////////////////

export function isTraceabilityProofMedia(item: LotMediaItem): boolean {
  return item.role === "TRACEABILITY_BAG"
}

export function isCertificateProofMedia(item: LotMediaItem): boolean {
  return item.role === "CERTIFICATE"
}

//////////////////////////////////////////////////////
// AUDIENCE FILTER
//
// Defaults match LOT-MEDIA-2: an item with `visibility`
// undefined is treated as PUBLIC_MARKET. The BUYER
// audience therefore sees legacy LOT-MEDIA-1 rows.
//////////////////////////////////////////////////////

function effectiveVisibility(item: LotMediaItem): LotMediaVisibility {
  return item.visibility ?? "PUBLIC_MARKET"
}

export function filterMediaForContractProofAudience(
  items: ReadonlyArray<LotMediaItem>,
  audience: ContractProofAudience,
): LotMediaItem[] {
  if (audience === "PARTNER" || audience === "PRODUCER") {
    // Route already enforced ownership — surface everything.
    return items.slice()
  }
  // BUYER — public + buyer-private only.
  return items.filter((item) => {
    const v = effectiveVisibility(item)
    return v === "PUBLIC_MARKET" || v === "BUYER_PRIVATE"
  })
}

//////////////////////////////////////////////////////
// SUMMARY BUILDER
//
// Operates on the *audience-filtered* list so the summary
// counts only reflect what the caller will actually see.
//////////////////////////////////////////////////////

export function buildBuyerProofMediaSummary(
  items: ReadonlyArray<LotMediaItem>,
): BuyerProofMediaSummary {
  let hasTraceabilityProof = false
  let hasCertificate = false
  for (const item of items) {
    if (isTraceabilityProofMedia(item)) hasTraceabilityProof = true
    if (isCertificateProofMedia(item)) hasCertificate = true
    if (hasTraceabilityProof && hasCertificate) break
  }
  const missing: BuyerProofMediaSummary["missing"] = []
  if (!hasTraceabilityProof) missing.push("TRACEABILITY_PROOF")
  if (!hasCertificate) missing.push("CERTIFICATE")
  return {
    hasTraceabilityProof,
    hasCertificate,
    hasFinalBagPhoto: null,
    itemCount: items.length,
    missing,
  }
}

//////////////////////////////////////////////////////
// LABELS
//
// Stable, audience-neutral labels used by the proof
// dashboard tile titles. Kept here (not in the UI) so
// the API can echo them when convenient and tests can
// pin them down.
//////////////////////////////////////////////////////

export function normaliseProofMediaRoleLabel(role: LotMediaRole): string {
  switch (role) {
    case "TRACEABILITY_BAG":
      return "Traceability proof"
    case "CERTIFICATE":
      return "Certificate"
    case "FARM":
      return "Farm photo"
    case "PROCESS":
      return "Process photo"
    case "PRODUCER":
      return "Producer photo"
    case "PRODUCT_DETAIL":
      return "Product detail"
    case "EDITORIAL_FALLBACK":
      return "Editorial"
    default:
      return "Photo"
  }
}
