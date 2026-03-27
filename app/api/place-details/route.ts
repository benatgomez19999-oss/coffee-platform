import { NextResponse } from "next/server"

function parseAddressComponents(components: any[]) {
  const get = (type: string) =>
    components.find((c: any) => c.types.includes(type))

  return {
    streetNumber: get("street_number")?.longText || "",
    route: get("route")?.longText || "",
    city:
      get("locality")?.longText ||
      get("postal_town")?.longText ||
      "",
    region:
      get("administrative_area_level_1")?.shortText || "",
    postalCode: get("postal_code")?.longText || "",
    country: get("country")?.longText || "",
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

  const components =
    data.addressComponents ||
    data.address_components ||
    []

  const parsed = parseAddressComponents(components)

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