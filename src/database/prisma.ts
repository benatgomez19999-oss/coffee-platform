// =====================================================
// PRISMA CLIENT (SINGLETON)
// =====================================================

import { PrismaClient } from "@prisma/client"


// =====================================================
// GLOBAL TYPE (para evitar múltiples instancias en dev)
// =====================================================

const globalForPrisma =
  globalThis as unknown as {
    prisma: PrismaClient | undefined
  }


// =====================================================
// CREATE CLIENT
// =====================================================

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient()


// =====================================================
// SAVE GLOBAL (DEV ONLY)
// =====================================================

if (process.env.NODE_ENV !== "production") {

  globalForPrisma.prisma = prisma

}