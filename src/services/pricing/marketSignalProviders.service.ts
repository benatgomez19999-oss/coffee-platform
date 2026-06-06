//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL PROVIDERS — PREVIEW SERVICE
//
// Orchestrator that:
//   1. resolves a provider from the registry
//   2. fetches its latest candidate (preview)
//   3. validates the candidate via FEED-1's pure validator
//   4. composes a single result the route + UI can render
//
// READ-ONLY. Never writes MarketSignalSnapshot. Never
// refreshes B2B prices. The operator must still apply the
// candidate through the existing manual ingestion form.
//
// The pure pieces (registry, providers, validator) live
// in *.pure.ts modules so this service file stays a thin
// composition layer that can be safely consumed by the
// internal routes without needing Prisma in the call path.
//////////////////////////////////////////////////////

import {
  MSP_DIAGNOSTIC_CODES,
  type MarketSignalProviderPreview,
  type MarketSignalProviderResult,
  type MarketSignalProviderScenario,
  type MarketSignalProviderSummary,
} from "./marketSignalProviders.types.ts"
import {
  getMarketSignalProvider,
  isMarketSignalProviderId,
  summarizeProvider,
} from "./marketSignalProviders.pure.ts"
import { validateMarketSignalCandidate } from "./marketSignalIngestion.pure.ts"
import type { MarketSignalIngestionDiagnostic } from "./marketSignalIngestion.types.ts"

export type PreviewMarketSignalFromProviderInput = {
  providerId: string
  scenario?: MarketSignalProviderScenario
  apiKey?: string | null
  now?: Date
}

function diag(
  code: keyof typeof MSP_DIAGNOSTIC_CODES,
  severity: "info" | "warning" | "error",
  message: string,
): MarketSignalIngestionDiagnostic {
  return { code: MSP_DIAGNOSTIC_CODES[code], severity, message }
}

/**
 * Pure-ish: this function is `async` only because providers are async,
 * but it never touches the database. Tests can call it directly with
 * the mock provider.
 */
export async function previewMarketSignalFromProvider(
  input: PreviewMarketSignalFromProviderInput,
): Promise<MarketSignalProviderPreview> {

  const generatedAt = (input.now ?? new Date()).toISOString()

  // ── 1. Resolve provider ────────────────────────────
  const provider = isMarketSignalProviderId(input.providerId)
    ? getMarketSignalProvider(input.providerId)
    : null

  if (!provider) {
    return {
      generatedAt,
      provider: null,
      providerResult: null,
      validation: null,
      previewCandidate: null,
      diagnostics: [
        diag(
          "MSP_PROVIDER_NOT_FOUND",
          "error",
          `Unknown providerId "${String(input.providerId)}". Use GET /api/internal/pricing/market-signal/providers to list known ids.`,
        ),
      ],
      canApply: false,
    }
  }

  const summary: MarketSignalProviderSummary = summarizeProvider(provider)

  // ── 2. Fetch ──────────────────────────────────────
  let providerResult: MarketSignalProviderResult
  try {
    providerResult = await provider.fetchLatest({
      apiKey: input.apiKey ?? null,
      now: input.now,
      scenario: input.scenario,
    })
  } catch (err) {
    const fetchedAt = generatedAt
    return {
      generatedAt,
      provider: summary,
      providerResult: {
        ok: false,
        providerId: provider.id,
        providerKind: provider.kind,
        fetchedAt,
        raw: null,
        diagnostics: [
          diag(
            "MSP_PROVIDER_FETCH_FAILED",
            "error",
            `Provider fetch threw: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ],
      },
      validation: null,
      previewCandidate: null,
      diagnostics: [
        diag(
          "MSP_PROVIDER_FETCH_FAILED",
          "error",
          `Provider "${provider.id}" fetch failed unexpectedly. No DB writes performed.`,
        ),
      ],
      canApply: false,
    }
  }

  // ── 3. If provider returned an error, stop here ──
  if (!providerResult.ok) {
    return {
      generatedAt,
      provider: summary,
      providerResult,
      validation: null,
      previewCandidate: null,
      diagnostics: providerResult.diagnostics,
      canApply: false,
    }
  }

  // ── 4. Validate the candidate ────────────────────
  const validation = validateMarketSignalCandidate(
    providerResult.candidate,
    { now: input.now },
  )

  const composed: MarketSignalIngestionDiagnostic[] = [
    ...providerResult.diagnostics,
    ...(validation.ok
      ? validation.candidate.diagnostics.concat(
          diag("MSP_PROVIDER_VALIDATED", "info",
            "Candidate passed validateMarketSignalCandidate. Operator must still apply manually."),
        )
      : validation.diagnostics),
    diag("MSP_PROVIDER_PREVIEW_ONLY", "info",
      "Preview only — no MarketSignalSnapshot was written and no B2B prices were refreshed."),
  ]

  return {
    generatedAt,
    provider: summary,
    providerResult,
    validation: validation.ok
      ? { ok: true, candidate: validation.candidate }
      : { ok: false, diagnostics: validation.diagnostics },
    previewCandidate: validation.ok ? validation.candidate : null,
    diagnostics: composed,
    canApply: validation.ok,
  }
}
