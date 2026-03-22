// =====================================================
// ALTURA COLLECTIVE EMAIL TEMPLATE
// =====================================================

export function alturaEmailTemplate({
  title,
  subtitle,
  buttonText,
  url,
}: {
  title: string
  subtitle: string
  buttonText: string
  url: string
}) {
  return `
  <div style="background:#0b0f0f;padding:40px 20px;font-family:Arial,sans-serif;color:white;">
    
    <div style="max-width:480px;margin:0 auto;background:#111;padding:32px;border-radius:16px;text-align:center;border:1px solid rgba(255,255,255,0.08);">

      <!-- LOGO / BRAND -->
      <h1 style="margin-bottom:20px;font-size:20px;font-weight:500;letter-spacing:1px;">
        Altura Collective
      </h1>

      <!-- TITLE -->
      <h2 style="margin-bottom:10px;font-weight:500;">
        ${title}
      </h2>

      <!-- SUBTITLE -->
      <p style="color:#bbb;margin-bottom:30px;font-size:14px;">
        ${subtitle}
      </p>

      <!-- CTA -->
      <a href="${url}" 
         style="
          display:inline-block;
          padding:12px 28px;
          background:linear-gradient(90deg,#d4af37,#f3d27a);
          color:#111;
          text-decoration:none;
          border-radius:999px;
          font-weight:600;
        ">
        ${buttonText}
      </a>

      <!-- FALLBACK -->
      <p style="margin-top:30px;font-size:12px;color:#666;">
        If the button doesn't work, use this link:
      </p>

      <p style="word-break:break-all;font-size:12px;color:#888;">
        ${url}
      </p>

      <!-- FOOTER -->
      <p style="margin-top:30px;font-size:11px;color:#555;">
        © Altura Collective
      </p>

    </div>

  </div>
  `
}