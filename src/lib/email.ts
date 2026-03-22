// =====================================================
// 📧 EMAIL SERVICE (PRODUCTION - RESEND)
// =====================================================

import { Resend } from "resend";

// =====================================================
// INIT
// =====================================================

if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️ RESEND_API_KEY not set");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// =====================================================
// SEND EMAIL
// =====================================================

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    console.log("📧 SENDING EMAIL VIA RESEND...");
    console.log("TO:", to);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // 🔥 IMPORTANTE (modo test)
      to,
      subject,
      html,
    });

    console.log("✅ EMAIL SENT");
    console.log("ID:", response?.data?.id);

  } catch (error: any) {
    console.error("❌ EMAIL ERROR:", error);
    throw new Error("Email sending failed");
  }
}