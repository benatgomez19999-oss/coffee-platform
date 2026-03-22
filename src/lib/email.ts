// =====================================================
// 📧 EMAIL SERVICE (PRODUCTION - RESEND)
// =====================================================

import { Resend } from "resend";

// =====================================================
// ⚠️ IMPORTANTE SOBRE VERCEL
// =====================================================
//
// ❌ NO inicializar Resend fuera de la función
// porque en build time puede no existir la env var
//
// 👉 Se inicializa DENTRO de sendEmail()
// =====================================================


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

    // =====================================================
    // 🔐 CHECK ENV (runtime seguro)
    // =====================================================

    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY not set");
      throw new Error("Missing RESEND_API_KEY");
    }

    // =====================================================
    // 🚀 INIT RESEND (EN RUNTIME)
    // =====================================================

    const resend = new Resend(process.env.RESEND_API_KEY);

    // =====================================================
    // ✉️ SEND EMAIL
    // =====================================================

    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // 🔥 usar este en tests
      to,
      subject,
      html,
    });

    // =====================================================
    // ✅ SUCCESS LOGS
    // =====================================================

    console.log("✅ EMAIL SENT");
    console.log("ID:", response?.data?.id);

  } catch (error: any) {
    // =====================================================
    // ❌ ERROR HANDLING
    // =====================================================

    console.error("❌ EMAIL ERROR:", error);
    throw new Error("Email sending failed");
  }
}