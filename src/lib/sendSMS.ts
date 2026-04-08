import twilioClient from "@/src/lib/twilio"

//////////////////////////////////////////////////////
// sendSMS — minimal safe wrapper over Twilio client.
//
// Never throws. Silently skips if:
// - `to` is null / undefined / empty
// - TWILIO_PHONE_NUMBER env var is missing
// - Twilio itself throws
//
// SMS is reinforcement only — never a hard dependency.
//////////////////////////////////////////////////////

export async function sendSMS(
  to: string | null | undefined,
  body: string
): Promise<void> {
  if (!to) return

  const from = process.env.TWILIO_PHONE_NUMBER
  if (!from) return

  try {
    await twilioClient.messages.create({ to, from, body })
  } catch (err) {
    console.error("[sendSMS] Failed to send SMS — skipping silently:", err)
  }
}
