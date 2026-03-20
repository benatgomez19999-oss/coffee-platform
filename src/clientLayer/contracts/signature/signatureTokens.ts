import { SignatureToken } from "./signatureTypes"

function getTokenStore(): SignatureToken[] {

  if (typeof window === "undefined") {
    return []
  }

  const raw =
    localStorage.getItem("signature_tokens")

  return raw ? JSON.parse(raw) : []

}

function saveTokenStore(tokens: SignatureToken[]) {

  if (typeof window === "undefined") return

  localStorage.setItem(
    "signature_tokens",
    JSON.stringify(tokens)
  )

}

export function createSignatureToken(
  contractId: string,
  phone: string
) {

  const token = crypto.randomUUID()

  const entry: SignatureToken = {

    token,
    contractId,
    phone,

    expiresAt: Date.now() + 10 * 60 * 1000,

    verified: false,
    signed: false

  }

  const tokens = getTokenStore()

  tokens.push(entry)

  saveTokenStore(tokens)

  return entry

}

export function getSignatureToken(token: string) {

  const tokens = getTokenStore()

  return tokens.find(t => t.token === token)

}

export function markTokenSigned(token: string) {

  const tokens = getTokenStore()

  const entry =
    tokens.find(t => t.token === token)

  if (!entry) return

  entry.signed = true

  saveTokenStore(tokens)

}