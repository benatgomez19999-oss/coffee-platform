// =====================================================
// PRISMA CLIENT (VERCEL + NEXT SAFE)
// =====================================================

import { PrismaClient } from "@prisma/client";

// =====================================================
// GLOBAL CACHE (avoid multiple instances in dev)
// =====================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// =====================================================
// DATABASE URL (SAFE RESOLUTION)
// =====================================================

const databaseUrl =
  process.env.DATABASE_URL_NEW || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("❌ DATABASE_URL is not defined");
}

// (Opcional: quitar en producción si molesta)
console.log("🔥 PRISMA USING DB:", databaseUrl);

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
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

// =====================================================
// SAVE GLOBAL (DEV ONLY)
// =====================================================

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}