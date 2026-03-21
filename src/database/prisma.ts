// =====================================================
// PRISMA CLIENT (FORCED ENV FIX FOR VERCEL)
// =====================================================

import { PrismaClient } from "@prisma/client"

// =====================================================
// GLOBAL TYPE
// =====================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// =====================================================
// SELECT DATABASE URL (FORCE NEW ENV)
// =====================================================

const databaseUrl =
  process.env.DATABASE_URL_NEW || process.env.DATABASE_URL

// DEBUG (muy importante ahora)
console.log("🔥 PRISMA USING DB:", databaseUrl)

// =====================================================
// CREATE CLIENT
// =====================================================

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: ["error"],
  })

// =====================================================
// SAVE GLOBAL (ONLY IN DEV)
// =====================================================

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}