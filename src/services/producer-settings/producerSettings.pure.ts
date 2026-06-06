//////////////////////////////////////////////////////
// ⚙️ PRODUCER SETTINGS — PURE HELPERS (PRODUCER-SETTINGS-1)
//
// No Prisma, no fetch. Validates + sanitises the PATCH
// body sent by the settings drawer and projects the
// public media readiness panel into producer-friendly
// copy (no enum names, no DTO labels).
//
// Persistence map (existing schema only — NO new columns):
//   User.phone               ← contact phone / WhatsApp
//   User.name                ← contact person (full name)
//   Producer.name            ← producer / company display name
//   Producer.country         ← producer country
//   Farm.name                ← farm name
//   Farm.region              ← farm region
//   Farm.altitude            ← farm altitude (metres)
//
// Notifications + operational preferences are NOT
// persisted on the server this sprint — the drawer
// stores them in localStorage. See the route doc for
// the rationale.
//////////////////////////////////////////////////////

import type {
  LotMediaReadinessPanel,
  LotMediaReadinessPanelSlot,
} from "../lot-media/lotMedia.types.ts"

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

export const PRODUCER_NAME_MAX = 120
export const CONTACT_NAME_MAX = 120
export const PHONE_MAX = 40
export const COUNTRY_MAX = 64
export const FARM_NAME_MAX = 120
export const FARM_REGION_MAX = 120

export const MIN_ALTITUDE_M = 0
// 3000m covers every commercial coffee farm; flags
// data-entry errors (e.g. someone typing 18000).
export const MAX_ALTITUDE_M = 3500

// ------------------------------------------------------
// INPUT SHAPES
// ------------------------------------------------------

export type ProducerProfilePatch = {
  contactName?: string | null
  phone?: string | null
  producerName?: string | null
  country?: string | null
}

export type FarmProfilePatch = {
  farmId: string
  name?: string | null
  region?: string | null
  altitude?: number | null
}

export type ProducerSettingsPatch = {
  producerProfile?: ProducerProfilePatch
  farmProfile?: FarmProfilePatch
}

// ------------------------------------------------------
// VALIDATION RESULT
// ------------------------------------------------------

export type SettingsValidationError = {
  code:
    | "PRODUCER_NAME_TOO_LONG"
    | "CONTACT_NAME_TOO_LONG"
    | "PHONE_TOO_LONG"
    | "PHONE_INVALID"
    | "COUNTRY_TOO_LONG"
    | "FARM_ID_REQUIRED"
    | "FARM_NAME_TOO_LONG"
    | "FARM_REGION_TOO_LONG"
    | "ALTITUDE_INVALID"
    | "UNKNOWN_SECTION"
  message: string
}

export type ProducerProfileNormalised = {
  contactName?: string | null
  phone?: string | null
  producerName?: string | null
  country?: string | null
}

export type FarmProfileNormalised = {
  farmId: string
  name?: string | null
  region?: string | null
  altitude?: number | null
}

export type ProducerSettingsNormalisedPatch = {
  producerProfile?: ProducerProfileNormalised
  farmProfile?: FarmProfileNormalised
}

export type ProducerSettingsValidationResult =
  | { ok: true; patch: ProducerSettingsNormalisedPatch }
  | { ok: false; error: SettingsValidationError }

// ------------------------------------------------------
// PRIMITIVES
// ------------------------------------------------------

function trim(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

// "" → null so the column can be cleared.
function normaliseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const t = value.trim()
  return t === "" ? null : t
}

// Lightweight phone validator — accepts digits with optional `+`,
// spaces, dashes, parentheses. Producer flow is global so we
// avoid country-specific rules.
const PHONE_RE = /^\+?[0-9\s\-()]{6,}$/

export function sanitisePhone(value: unknown): {
  ok: true
  value: string | null | undefined
} | { ok: false; code: "PHONE_TOO_LONG" | "PHONE_INVALID" } {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false, code: "PHONE_INVALID" }
  const t = value.trim()
  if (t === "") return { ok: true, value: null }
  if (t.length > PHONE_MAX) return { ok: false, code: "PHONE_TOO_LONG" }
  if (!PHONE_RE.test(t)) return { ok: false, code: "PHONE_INVALID" }
  return { ok: true, value: t }
}

export function sanitiseAltitude(value: unknown): {
  ok: true
  value: number | null | undefined
} | { ok: false; code: "ALTITUDE_INVALID" } {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, code: "ALTITUDE_INVALID" }
  }
  if (value < MIN_ALTITUDE_M || value > MAX_ALTITUDE_M) {
    return { ok: false, code: "ALTITUDE_INVALID" }
  }
  return { ok: true, value: Math.round(value) }
}

// ------------------------------------------------------
// MAIN VALIDATION
// ------------------------------------------------------

export function validateProducerSettingsPatch(
  body: unknown,
): ProducerSettingsValidationResult {
  if (
    body == null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      ok: false,
      error: { code: "UNKNOWN_SECTION", message: "Invalid request body." },
    }
  }

  const raw = body as Record<string, unknown>
  const patch: ProducerSettingsNormalisedPatch = {}

  // ─── PRODUCER PROFILE ─────────────────────────────
  if (raw.producerProfile !== undefined) {
    if (
      raw.producerProfile == null ||
      typeof raw.producerProfile !== "object" ||
      Array.isArray(raw.producerProfile)
    ) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN_SECTION",
          message: "producerProfile must be an object.",
        },
      }
    }
    const p = raw.producerProfile as Record<string, unknown>
    const out: ProducerProfileNormalised = {}

    if (p.producerName !== undefined) {
      const v = normaliseNullableString(p.producerName)
      if (v && v.length > PRODUCER_NAME_MAX) {
        return {
          ok: false,
          error: { code: "PRODUCER_NAME_TOO_LONG", message: "Producer name is too long." },
        }
      }
      out.producerName = v
    }

    if (p.contactName !== undefined) {
      const v = normaliseNullableString(p.contactName)
      if (v && v.length > CONTACT_NAME_MAX) {
        return {
          ok: false,
          error: { code: "CONTACT_NAME_TOO_LONG", message: "Contact name is too long." },
        }
      }
      out.contactName = v
    }

    if (p.phone !== undefined) {
      const phone = sanitisePhone(p.phone)
      if (!phone.ok) {
        return {
          ok: false,
          error: {
            code: phone.code,
            message:
              phone.code === "PHONE_INVALID"
                ? "Phone number looks invalid."
                : "Phone number is too long.",
          },
        }
      }
      out.phone = phone.value
    }

    if (p.country !== undefined) {
      const v = normaliseNullableString(p.country)
      if (v && v.length > COUNTRY_MAX) {
        return {
          ok: false,
          error: { code: "COUNTRY_TOO_LONG", message: "Country is too long." },
        }
      }
      out.country = v
    }

    patch.producerProfile = out
  }

  // ─── FARM PROFILE ─────────────────────────────────
  if (raw.farmProfile !== undefined) {
    if (
      raw.farmProfile == null ||
      typeof raw.farmProfile !== "object" ||
      Array.isArray(raw.farmProfile)
    ) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN_SECTION",
          message: "farmProfile must be an object.",
        },
      }
    }
    const f = raw.farmProfile as Record<string, unknown>
    const farmId = trim(f.farmId)
    if (!farmId) {
      return {
        ok: false,
        error: { code: "FARM_ID_REQUIRED", message: "farmProfile.farmId is required." },
      }
    }

    const out: FarmProfileNormalised = { farmId }

    if (f.name !== undefined) {
      const v = normaliseNullableString(f.name)
      if (v && v.length > FARM_NAME_MAX) {
        return {
          ok: false,
          error: { code: "FARM_NAME_TOO_LONG", message: "Farm name is too long." },
        }
      }
      // Farm.name is NOT NULL in the schema — never persist an empty
      // string. If the producer cleared it, we leave it undefined so
      // the route layer can skip the update for that field.
      if (v === null) {
        // Treat clearing as a no-op (defensive).
        out.name = undefined
      } else {
        out.name = v
      }
    }

    if (f.region !== undefined) {
      const v = normaliseNullableString(f.region)
      if (v && v.length > FARM_REGION_MAX) {
        return {
          ok: false,
          error: { code: "FARM_REGION_TOO_LONG", message: "Farm region is too long." },
        }
      }
      out.region = v
    }

    if (f.altitude !== undefined) {
      const a = sanitiseAltitude(f.altitude)
      if (!a.ok) {
        return {
          ok: false,
          error: { code: a.code, message: "Altitude must be between 0 and 3500 metres." },
        }
      }
      out.altitude = a.value
    }

    patch.farmProfile = out
  }

  return { ok: true, patch }
}

// ------------------------------------------------------
// FARM SELECTION
// ------------------------------------------------------

export function pickActiveFarmId(
  farms: ReadonlyArray<{ id: string; name: string }>,
  requestedFarmId?: string | null,
): string | null {
  if (!farms || farms.length === 0) return null
  if (requestedFarmId) {
    const match = farms.find((f) => f.id === requestedFarmId)
    if (match) return match.id
  }
  return farms[0].id
}

// ------------------------------------------------------
// READINESS — PRODUCER-FRIENDLY PROJECTION
//
// Takes the LotMediaReadinessPanel (which uses technical
// slot codes) and turns it into the shorter, friendlier
// rows the settings drawer renders. NEVER returns enum
// names like PUBLIC_MARKET or BUYER_PRIVATE.
// ------------------------------------------------------

export type ProducerReadinessRow = {
  code: string
  label: string
  description: string
  ready: boolean
}

export type ProducerReadinessSummary = {
  ready: boolean
  rows: ProducerReadinessRow[]
  missingCount: number
  headline: string
}

const READINESS_LABELS: Readonly<Record<string, { label: string; description: string }>> = {
  PUBLIC_FARM_PHOTO: {
    label: "Farm / origin photo",
    description: "Shown on every lot you publish — required before lots go live.",
  },
  PUBLIC_PROCESS_OR_PRODUCT_PHOTO: {
    label: "Process or product photo",
    description: "Drying beds, washing station or coffee detail — required before publish.",
  },
  PUBLIC_PRODUCER_PHOTO: {
    label: "Producer / team photo",
    description: "Optional. Strengthens the public story behind your lots.",
  },
}

function projectSlot(slot: LotMediaReadinessPanelSlot): ProducerReadinessRow | null {
  const meta = READINESS_LABELS[slot.code]
  if (!meta) return null
  return {
    code: slot.code,
    label: meta.label,
    description: meta.description,
    ready: slot.state === "SATISFIED",
  }
}

export function buildProducerReadinessSummary(
  panel: LotMediaReadinessPanel,
): ProducerReadinessSummary {
  const rows: ProducerReadinessRow[] = []
  for (const s of panel.publicListing.slots) {
    const r = projectSlot(s)
    if (r) rows.push(r)
  }
  const missingRequired = panel.publicListing.slots.filter(
    (s) => s.required && s.state === "MISSING",
  ).length
  const headline = panel.publicListing.ready
    ? "Your farm is ready to publish lots."
    : missingRequired === 1
      ? "1 item missing before your next lot can be published."
      : `${missingRequired} items missing before your next lot can be published.`
  return {
    ready: panel.publicListing.ready,
    rows,
    missingCount: missingRequired,
    headline,
  }
}
