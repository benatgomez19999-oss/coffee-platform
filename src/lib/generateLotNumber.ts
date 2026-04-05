import { prisma } from "@/src/database/prisma";
export async function generateLotNumber() {
  const year = new Date().getFullYear();

  // contar cuantos drafts hay este año
  const count = await prisma.producerLotDraft.count();

  const sequence = String(count + 1).padStart(4, "0");

  return `LOT-CO-${year}-${sequence}`;
}