import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, // 🔥 SERVER KEY
          "X-Goog-FieldMask": "suggestions.placePrediction.text.text"
        },
        body: JSON.stringify({
          input: body.input,
          languageCode: "en",
          sessionToken: crypto.randomUUID()
        })
      }
    )

    const data = await res.json()

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: "fail" }, { status: 500 })
  }
}