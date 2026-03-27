import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { placeId } = await req.json()

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents,formattedAddress`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
      },
    }
  )

  const data = await res.json()

  return NextResponse.json(data)
}