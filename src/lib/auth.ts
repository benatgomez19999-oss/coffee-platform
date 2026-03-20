import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"

// =====================================================
// ENV
// =====================================================

const JWT_SECRET = process.env.JWT_SECRET!

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET missing")
}

// =====================================================
// HASH PASSWORD
// =====================================================

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

// =====================================================
// COMPARE PASSWORD
// =====================================================

export async function comparePassword(
  password: string,
  hash: string
) {
  return bcrypt.compare(password, hash)
}

// =====================================================
// SIGN TOKEN
// =====================================================

export function signToken(payload: { userId: string }) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d"
  })
}

// =====================================================
// VERIFY TOKEN
// =====================================================

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string
    }
  } catch {
    return null
  }
}