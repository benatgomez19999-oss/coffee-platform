import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { experience, location, uniqueness, values } = body

    // 🧠 PROMPT CONTROLADO (clave del producto)
    const prompt = `
You are a professional coffee copywriter.

Write a short, natural and premium farm story (max 4-5 sentences).

Avoid clichés. Be specific and human.

Expand the input if needed.

Context:
- Experience: ${experience}
- Location: ${location}
- Unique aspects: ${uniqueness}
- Values: ${values}

Tone:
- Professional but warm
- Buyer-oriented
- Authentic, not generic
`

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    })

    const data = await response.json()

    const text = data.output?.[0]?.content?.[0]?.text || "Error generating story"

    return NextResponse.json({ story: text })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to generate story" }, { status: 500 })
  }
}