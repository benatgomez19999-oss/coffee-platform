import { NextResponse } from "next/server"

function parseAddressComponents(components: any[]) {
  const get = (type: string) =>
    components.find((c: any) => c.types.includes(type))

  return {
    streetNumber: get("street_number")?.long_name || "",
    route: get("route")?.long_name || "",
    city:
      get("locality")?.long_name ||
      get("postal_town")?.long_name ||
      "",
    region:
      get("administrative_area_level_1")?.short_name || "",
    postalCode: get("postal_code")?.long_name || "",
    country: get("country")?.long_name || "",
  }
}

export async function POST(req: Request) {
  const { placeId } = await req.json()

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents,formattedAddress`,
    {
      headers: {
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
      },
    }
  )

  const data = await res.json()

  const parsed = parseAddressComponents(data.addressComponents || [])

  return NextResponse.json({
    address: data.formattedAddress || "",
    street: parsed.route,
    streetNumber: parsed.streetNumber,
    city: parsed.city,
    region: parsed.region,
    postalCode: parsed.postalCode,
    country: parsed.country,
  })
}