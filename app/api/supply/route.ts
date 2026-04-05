import { NextResponse } from "next/server"
import { getRealSupply } from "@/src/services/supply.service"

export async function GET() {
  const supply = await getRealSupply()

  return NextResponse.json(supply)
}