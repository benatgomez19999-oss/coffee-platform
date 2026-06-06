//////////////////////////////////////////////////////
// 🌱 PRODUCER ONBOARDING — PURE HELPERS (PRODUCER-ONBOARDING-V2)
//
// Validates + sanitises the producer onboarding payload.
// Reuses the same altitude / phone validators as
// PRODUCER-SETTINGS-1 so the onboarding rules cannot
// diverge from the settings editor.
//
// Persistence map (existing schema only — NO new fields):
//   Producer.name      ← businessName
//   Producer.country   ← country
//   Farm.name          ← businessName
//   Farm.region        ← region
//   Farm.altitude      ← altitude (real meters; never defaulted)
//////////////////////////////////////////////////////

import {
  sanitiseAltitude,
  CONTACT_NAME_MAX,
  COUNTRY_MAX,
  FARM_NAME_MAX,
  FARM_REGION_MAX,
  MAX_ALTITUDE_M,
  MIN_ALTITUDE_M,
} from "../producer-settings/producerSettings.pure.ts"

// Re-export altitude range so the UI can show the same hint
// without coupling to producer-settings directly.
export { MIN_ALTITUDE_M, MAX_ALTITUDE_M, FARM_REGION_MAX, COUNTRY_MAX }

export const BUSINESS_NAME_MAX = FARM_NAME_MAX
export { CONTACT_NAME_MAX }

//////////////////////////////////////////////////////
// INPUT / OUTPUT SHAPES
//////////////////////////////////////////////////////

export type ProducerOnboardingInput = {
  businessName?: unknown
  country?: unknown
  region?: unknown
  altitude?: unknown
  contactName?: unknown
}

export type ProducerOnboardingNormalised = {
  businessName: string
  country: string
  region: string
  altitude: number
  contactName: string | null
}

export type ProducerOnboardingError = {
  code:
    | "BUSINESS_NAME_REQUIRED"
    | "BUSINESS_NAME_TOO_LONG"
    | "COUNTRY_REQUIRED"
    | "COUNTRY_TOO_LONG"
    | "REGION_REQUIRED"
    | "REGION_TOO_LONG"
    | "ALTITUDE_REQUIRED"
    | "ALTITUDE_INVALID"
    | "CONTACT_NAME_TOO_LONG"
  message: string
}

export type ProducerOnboardingValidationResult =
  | { ok: true; input: ProducerOnboardingNormalised }
  | { ok: false; error: ProducerOnboardingError }

//////////////////////////////////////////////////////
// PRIMITIVES
//////////////////////////////////////////////////////

function trim(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

//////////////////////////////////////////////////////
// PUBLIC: sanitiseFarmRegion
//
// Trims and length-caps. Returns null when missing so
// the caller can decide whether that's an error (we
// reject it in onboarding; producer-settings allows
// clearing).
//////////////////////////////////////////////////////

export function sanitiseFarmRegion(value: unknown): string | null {
  const t = trim(value)
  if (t === "") return null
  if (t.length > FARM_REGION_MAX) return t.slice(0, FARM_REGION_MAX)
  return t
}

//////////////////////////////////////////////////////
// PUBLIC: sanitiseProducerCountry
//
// Free-text + cap. We deliberately do not enforce an
// allow-list at this layer — the UI gives a select for
// the common coffee origins but operators can later
// add more without a code change.
//////////////////////////////////////////////////////

export function sanitiseProducerCountry(value: unknown): string | null {
  const t = trim(value)
  if (t === "") return null
  if (t.length > COUNTRY_MAX) return t.slice(0, COUNTRY_MAX)
  return t
}

//////////////////////////////////////////////////////
// PUBLIC: validateFarmAltitude
//
// Delegates to PRODUCER-SETTINGS-1's sanitiseAltitude
// so onboarding and settings agree on the range. The
// difference: onboarding REQUIRES a value (no
// undefined/null pass-through).
//////////////////////////////////////////////////////

export function validateFarmAltitude(value: unknown): {
  ok: true
  value: number
} | { ok: false; code: "ALTITUDE_REQUIRED" | "ALTITUDE_INVALID" } {
  if (value === undefined || value === null || value === "") {
    return { ok: false, code: "ALTITUDE_REQUIRED" }
  }
  const numeric =
    typeof value === "string" ? Number(value.trim()) : value
  const r = sanitiseAltitude(numeric)
  if (!r.ok) return { ok: false, code: r.code }
  if (r.value === undefined || r.value === null) {
    return { ok: false, code: "ALTITUDE_REQUIRED" }
  }
  return { ok: true, value: r.value }
}

//////////////////////////////////////////////////////
// PUBLIC: sanitiseProducerOnboardingInput
//
// Full payload validation. Returns either the
// normalised values ready to insert, or the first
// blocking error.
//////////////////////////////////////////////////////

export function sanitiseProducerOnboardingInput(
  raw: ProducerOnboardingInput,
): ProducerOnboardingValidationResult {

  // businessName → producer + farm name
  const businessName = trim(raw.businessName)
  if (businessName === "") {
    return {
      ok: false,
      error: {
        code: "BUSINESS_NAME_REQUIRED",
        message: "Farm or company name is required.",
      },
    }
  }
  if (businessName.length > BUSINESS_NAME_MAX) {
    return {
      ok: false,
      error: {
        code: "BUSINESS_NAME_TOO_LONG",
        message: "Farm or company name is too long.",
      },
    }
  }

  // country
  const country = sanitiseProducerCountry(raw.country)
  if (country === null) {
    return {
      ok: false,
      error: {
        code: "COUNTRY_REQUIRED",
        message: "Country is required.",
      },
    }
  }
  // sanitiseProducerCountry returns the trimmed string up to
  // COUNTRY_MAX, so we don't re-check length here.

  // region
  const region = sanitiseFarmRegion(raw.region)
  if (region === null) {
    return {
      ok: false,
      error: {
        code: "REGION_REQUIRED",
        message: "Farm region is required (e.g. Huila, Antioquia).",
      },
    }
  }

  // altitude — REQUIRED, no fallback to 1800.
  const altitude = validateFarmAltitude(raw.altitude)
  if (!altitude.ok) {
    return {
      ok: false,
      error: {
        code: altitude.code,
        message:
          altitude.code === "ALTITUDE_REQUIRED"
            ? "Farm altitude is required."
            : `Farm altitude must be a number between ${MIN_ALTITUDE_M} and ${MAX_ALTITUDE_M} metres.`,
      },
    }
  }

  // contactName — optional
  let contactName: string | null = null
  if (raw.contactName !== undefined && raw.contactName !== null) {
    const c = trim(raw.contactName)
    if (c !== "") {
      if (c.length > CONTACT_NAME_MAX) {
        return {
          ok: false,
          error: {
            code: "CONTACT_NAME_TOO_LONG",
            message: "Contact name is too long.",
          },
        }
      }
      contactName = c
    }
  }

  return {
    ok: true,
    input: {
      businessName,
      country,
      region,
      altitude: altitude.value,
      contactName,
    },
  }
}
