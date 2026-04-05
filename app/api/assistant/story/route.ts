import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { experience, location, uniqueness, values } = body

    const prompt = `

You are a senior coffee buyer-facing copywriter for a high-end green coffee marketplace.

Your job is to write a short farm story that helps international buyers understand the identity, credibility, and uniqueness of a coffee producer.

OBJECTIVE:
Create a natural, premium, and commercially useful farm story.

STRICT RULES:
- Write in English
- 4 to 5 sentences maximum
- 90 to 130 words
- No clichés, no generic phrases, no marketing fluff
- Do NOT exaggerate or romanticize
- Stay grounded in real production context
- Do NOT repeat the same idea twice
- Do NOT use bullet points or formatting
- Do NOT include quotes

STYLE:
- Professional but human
- Specific and concrete
- Buyer-oriented (not poetic storytelling)
- Focus on credibility and production identity

BUYER SHOULD FEEL:
- This is a real and serious producer
- The farm has a clear identity
- The coffee has traceability and intention

INPUT CONTEXT:
- Experience: ${experience}
- Location: ${location}
- Unique aspects: ${uniqueness}
- Values: ${values}

WRITE ONLY THE FINAL FARM STORY.
`

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    })

    const data = await response.json()

    const text =
      data.output?.[0]?.content?.[0]?.text || "Error generating story"

    return NextResponse.json({ story: text })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 }
    )
  }
}