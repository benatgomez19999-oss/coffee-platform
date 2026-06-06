"use client"

import { useCallback, useEffect, useState } from "react"

//////////////////////////////////////////////////////
// 🧪 TEST SETUP PANEL — DEV-TEST-SETUP-1
//
// Pre-round UI for automated agents. Every visible
// label, status line and data-testid is chosen for
// machine readability (literal strings, no icons in
// status text, deterministic ordering).
//
// Hits these dev-only endpoints (no client secrets):
//   POST /api/dev/test-setup/login-as     { role }
//   POST /api/dev/test-setup/reset
//   GET  /api/dev/test-setup/status
//////////////////////////////////////////////////////

type DevRole = "client" | "producer" | "partner" | "eu-partner"

type StatusPayload = {
  user: { email: string; role: string | null } | null
  activeIntentCount: number
}

type ActionPhase =
  | { kind: "idle" }
  | { kind: "running"; label: string }
  | { kind: "ok"; label: string }
  | { kind: "error"; label: string; message: string }

const ROLE_LABEL: Record<DevRole, string> = {
  client: "Login as CLIENT",
  producer: "Login as PRODUCER",
  partner: "Login as PARTNER",
  "eu-partner": "Login as EU_PARTNER",
}

export default function TestSetupPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [phase, setPhase] = useState<ActionPhase>({ kind: "idle" })

  const refreshStatus = useCallback(async () => {
    try {
      setStatusError(null)
      const res = await fetch("/api/dev/test-setup/status", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(`Status fetch failed (${res.status})`)
      }
      const data = (await res.json()) as StatusPayload
      setStatus(data)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const handleLogin = useCallback(
    async (role: DevRole) => {
      const label = ROLE_LABEL[role]
      setPhase({ kind: "running", label })
      try {
        const res = await fetch("/api/dev/test-setup/login-as", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            (typeof data?.error === "string" && data.error) ||
              `Login failed (${res.status})`,
          )
        }
        setPhase({ kind: "ok", label })
        await refreshStatus()
      } catch (err) {
        setPhase({
          kind: "error",
          label,
          message: err instanceof Error ? err.message : "Unknown error",
        })
      }
    },
    [refreshStatus],
  )

  const handleReset = useCallback(async () => {
    const label = "Reset intents/contracts"
    setPhase({ kind: "running", label })
    try {
      const res = await fetch("/api/dev/test-setup/reset", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          (typeof data?.error === "string" && data.error) ||
            `Reset failed (${res.status})`,
        )
      }
      setPhase({ kind: "ok", label })
      await refreshStatus()
    } catch (err) {
      setPhase({
        kind: "error",
        label,
        message: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }, [refreshStatus])

  const phaseLine = renderPhaseLine(phase)
  const indicatorLines = renderIndicatorLines(status, statusError)

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1410",
        color: "#f4efe3",
        padding: "32px",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#d6b04f",
            }}
          >
            Dev · Test setup
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "6px 0 0" }}>
            Pre-round setup
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#cdc0a4",
              marginTop: 8,
            }}
          >
            Reset platform state and switch the active session role. Used
            before automated UI rounds. All actions hit dev-only routes
            gated by INTERNAL_DEV_TOOLS_ENABLED.
          </p>
        </header>

        <section
          aria-label="status"
          data-testid="dev-test-setup-status"
          style={{
            border: "1px solid rgba(214,176,79,0.30)",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#d6b04f",
              marginBottom: 8,
            }}
          >
            Status
          </div>
          <pre
            data-testid="dev-test-setup-status-text"
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              color: "#f4efe3",
            }}
          >
            {indicatorLines}
          </pre>
        </section>

        <section
          aria-label="actions"
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            data-testid="dev-test-setup-reset"
            onClick={handleReset}
            disabled={phase.kind === "running"}
            style={buttonStyle({
              kind: "warning",
              disabled: phase.kind === "running",
            })}
          >
            Reset intents/contracts
          </button>

          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {(Object.keys(ROLE_LABEL) as DevRole[]).map((role) => (
              <button
                key={role}
                type="button"
                data-testid={`dev-test-setup-login-${role}`}
                onClick={() => handleLogin(role)}
                disabled={phase.kind === "running"}
                style={buttonStyle({
                  kind: "primary",
                  disabled: phase.kind === "running",
                })}
              >
                {ROLE_LABEL[role]}
              </button>
            ))}
          </div>
        </section>

        <section
          aria-label="last-action"
          data-testid="dev-test-setup-last-action"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 12,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#cdc0a4",
              marginBottom: 6,
            }}
          >
            Last action
          </div>
          <div
            data-testid="dev-test-setup-last-action-text"
            style={{ fontSize: 13, color: "#f4efe3" }}
          >
            {phaseLine}
          </div>
        </section>
      </div>
    </main>
  )
}

// ------------------------------------------------------
// RENDER HELPERS — literal, machine-friendly strings
// ------------------------------------------------------

function renderPhaseLine(phase: ActionPhase): string {
  if (phase.kind === "idle") return "Last action: none"
  if (phase.kind === "running") return `Running: ${phase.label}`
  if (phase.kind === "ok") return `OK: ${phase.label}`
  return `ERROR: ${phase.label} - ${phase.message}`
}

function renderIndicatorLines(
  status: StatusPayload | null,
  error: string | null,
): string {
  if (error) {
    return [
      "user: ERROR",
      `error: ${error}`,
      "activeIntentCount: ?",
    ].join("\n")
  }
  if (!status) {
    return ["user: loading", "activeIntentCount: loading"].join("\n")
  }
  const userLine = status.user
    ? `user: ${status.user.email} (${status.user.role ?? "no-role"})`
    : "user: none"
  return [userLine, `activeIntentCount: ${status.activeIntentCount}`].join(
    "\n",
  )
}

function buttonStyle(opts: {
  kind: "primary" | "warning"
  disabled: boolean
}): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 10,
    border: "1px solid",
    cursor: opts.disabled ? "not-allowed" : "pointer",
    opacity: opts.disabled ? 0.6 : 1,
    fontFamily: "inherit",
    textAlign: "left",
  }
  if (opts.kind === "primary") {
    return {
      ...base,
      borderColor: "rgba(214,176,79,0.45)",
      background: "rgba(214,176,79,0.12)",
      color: "#f4efe3",
    }
  }
  return {
    ...base,
    borderColor: "rgba(226,182,92,0.55)",
    background: "rgba(226,182,92,0.18)",
    color: "#f4efe3",
    fontWeight: 600,
  }
}
