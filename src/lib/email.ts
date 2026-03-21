// =====================================================
// 📧 EMAIL SERVICE (PRODUCTION READY - SENDGRID)
// =====================================================

import sgMail from "@sendgrid/mail";

// =====================================================
// INIT
// =====================================================

if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY not set");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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
    const msg = {
      to,
      from: "benat.gomez19999@gmail.com", // ⚠️ sender verificado
      subject,
      html,
    };

    const res = await sgMail.send(msg);

    console.log("📧 EMAIL SENT SUCCESS");
    console.log("TO:", to);
    console.log("STATUS:", res[0]?.statusCode);

  } catch (error: any) {
    console.error("❌ EMAIL ERROR:", error?.response?.body || error.message);
    throw new Error("Email sending failed");
  }
}