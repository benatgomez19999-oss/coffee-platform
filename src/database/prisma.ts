// =====================================================
// PRISMA CLIENT (SINGLETON SAFE FOR VERCEL)
// =====================================================

import { PrismaClient } from "@prisma/client"

// =====================================================
// GLOBAL TYPE (evita múltiples instancias en dev / hot reload)
// =====================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// =====================================================
// CREATE CLIENT
// =====================================================

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"], // opcional: logs mínimos (evita ruido en Vercel)
  })

// =====================================================
// SAVE GLOBAL (ONLY IN DEV)
// =====================================================

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}