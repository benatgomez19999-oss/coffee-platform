import { headers } from "next/headers"
import { verifyToken } from "@/src/lib/auth"
import { prisma } from "@/src/database/prisma"

export async function requireAuth() {

  const headersList = await headers()
  const cookieHeader = headersList.get("cookie") || ""

  const token = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("auth_token="))
    ?.split("=")[1]

  if (!token) {
    throw new Error("UNAUTHORIZED")
  }

  const payload = verifyToken(token)

  if (!payload) {
    throw new Error("UNAUTHORIZED")
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      company: true
    }
  })

  if (!user) {
  throw new Error("UNAUTHORIZED")
}

  return user
}