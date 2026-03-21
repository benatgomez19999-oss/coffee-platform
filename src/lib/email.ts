// =====================================================
// 📧 EMAIL SERVICE (TEMP / DEV)
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
  // =====================================================
  // 🔥 DEV MODE (solo log)
  // =====================================================

  console.log("📧 EMAIL SENT:");
  console.log("TO:", to);
  console.log("SUBJECT:", subject);
  console.log("HTML:", html);

  // =====================================================
  // 🚀 FUTURO
  // =====================================================
  // 👉 aquí conectarás Resend / Nodemailer
}