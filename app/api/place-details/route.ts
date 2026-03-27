import { NextResponse } from "next/server"

// ================= PARSE GOOGLE ADDRESS =================
function parseAddressComponents(components: any[]) {
  const get = (type: string) =>
    components.find((c: any) => c.types.includes(type))

  const street = get("route")?.longText || ""
  const number = get("street_number")?.longText || ""

  return {
    // 🔥 FULL ADDRESS LINE (Stripe style)
    addressLine1: `${street} ${number}`.trim(),

    // 🔹 RAW PARTS
    street,
    streetNumber: number,

    // 🔹 CITY (fallback UK etc)
    city:
      get("locality")?.longText ||
      get("postal_town")?.longText ||
      "",

    // 🔹 REGION (state / comunidad)
    region: get("administrative_area_level_1")?.longText || "",
    regionCode: get("administrative_area_level_1")?.shortText || "",

    // 🔹 SUBREGION (province / county)
    subregion: get("administrative_area_level_2")?.longText || "",

    // 🔹 POSTAL
    postalCode: get("postal_code")?.longText || "",

    // 🔹 COUNTRY (ISO)
    country: get("country")?.shortText || "",
  }
}

export async function POST(req: Request) {
  const { placeId, language } = await req.json()

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents,formattedAddress,location`,
    {
      headers: {
  "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
  "Accept-Language": language || "en",
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

  // 🔥 NEW STRUCTURE
  addressLine1: parsed.addressLine1,

  street: parsed.street,
  streetNumber: parsed.streetNumber,

  city: parsed.city,

  region: parsed.region,
  regionCode: parsed.regionCode,
  subregion: parsed.subregion,

  postalCode: parsed.postalCode,
  country: parsed.country,

  // 🔥 PRO DATA
  placeId,
  lat: data.location?.latitude || null,
  lng: data.location?.longitude || null,
})
}