import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { getUserFromRequest } from "@/lib/getUserFromRequest"
import { sanitiseProducerOnboardingInput } from "@/src/services/producer-onboarding/producerOnboarding.pure"

//////////////////////////////////////////////////////
// 🧠 CREATE PRODUCER + FARM (PRODUCER-ONBOARDING-V2)
//
// Now requires real region + altitude + country. The
// previous version silently hard-coded altitude=1800 and
// defaulted country to "COLOMBIA", which polluted every
// downstream pricing/marketplace decision.
//
// Validation lives in producerOnboarding.pure so the
// settings + onboarding rules cannot drift.
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {

    // ─── AUTH ────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (user.role !== "PRODUCER") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    // ─── VALIDATION ──────────────────────────────────
    const validation = sanitiseProducerOnboardingInput({
      businessName: body.businessName,
      country: body.country,
      region: body.region,
      altitude: body.altitude,
      contactName: body.contactName,
    })

    if (!validation.ok) {
      return NextResponse.json(
        { code: validation.error.code, error: validation.error.message },
        { status: 400 }
      )
    }

    const input = validation.input

    // ─── TRANSACTION ─────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {

      // 1. PRODUCER (create or update)
      let producer = await tx.producer.findUnique({
        where: { userId: user.id },
      })

      if (!producer) {
        producer = await tx.producer.create({
          data: {
            userId: user.id,
            name: input.businessName,
            country: input.country,
          },
        })
      } else if (
        producer.name !== input.businessName ||
        producer.country !== input.country
      ) {
        // Idempotency: if the producer ran onboarding before with
        // different values, update so the latest input wins.
        producer = await tx.producer.update({
          where: { id: producer.id },
          data: {
            name: input.businessName,
            country: input.country,
          },
        })
      }

      // 2. CONTACT PERSON (optional)
      // User.name doubles as the contact-person display value in
      // the producer settings drawer. We only overwrite when the
      // onboarding form actually supplied one, so existing names
      // are not stomped.
      if (input.contactName && input.contactName !== user.name) {
        await tx.user.update({
          where: { id: user.id },
          data: { name: input.contactName },
        })
      }

      // 3. FARM (idempotent by name)
      const existingFarm = await tx.farm.findFirst({
        where: {
          producerId: producer.id,
          name: input.businessName,
        },
      })

      let farm
      if (existingFarm) {
        // Update region/altitude on a re-run so producers can
        // correct their data without dev intervention.
        farm = await tx.farm.update({
          where: { id: existingFarm.id },
          data: {
            region: input.region,
            altitude: input.altitude,
          },
        })
      } else {
        farm = await tx.farm.create({
          data: {
            name: input.businessName,
            region: input.region,
            altitude: input.altitude,
            producerId: producer.id,
          },
        })
      }

      // 4. COMPLETE ONBOARDING
      await tx.user.update({
        where: { id: user.id },
        data: { onboardingCompleted: true },
      })

      return { producer, farm }
    })

    return NextResponse.json({
      success: true,
      producerId: result.producer.id,
      farmId: result.farm.id,
      farmsCreated: 1,
    })

  } catch (error) {
    console.error("❌ ONBOARDING PRODUCER ERROR:", error)

    return NextResponse.json(
      { error: "Failed to create producer" },
      { status: 500 }
    )
  }
}
