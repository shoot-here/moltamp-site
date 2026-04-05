/**
 * Shared email templates and sender for MOLTamp.
 * All transactional emails go through Resend.
 *
 * Brand: dark background, electric blue accent, terminal aesthetic.
 */

const BRAND = {
  bg: '#08080a',
  card: '#111114',
  cardBorder: '#222228',
  text: '#f0f0f2',
  textDim: '#8a8a96',
  textSecondary: '#a0a0aa',
  accent: '#4d9fff',
  success: '#22c55e',
  keyBg: '#1a1a20',
  keyBorder: '#2a2a35',
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Courier New', monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  logoUrl: 'https://moltamp.com/images/logo.png',
  siteUrl: 'https://moltamp.com',
};

/** Wrap content in the branded dark email shell */
function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>MOLTamp</title></head>
<body style="margin:0; padding:0; background:${BRAND.bg}; -webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:32px;">
    <a href="${BRAND.siteUrl}" style="text-decoration:none; display:inline-flex; align-items:center;">
      <img src="${BRAND.logoUrl}" alt="MOLTamp" width="32" height="32" style="display:block; border:0; margin-right:10px;" />
      <span style="font-family:${BRAND.sans}; font-size:18px; font-weight:700; color:${BRAND.text}; letter-spacing:-0.02em;">MOLTamp</span>
    </a>
  </td></tr>

  <!-- Card -->
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.card}; border:1px solid ${BRAND.cardBorder}; border-radius:16px;">
    <tr><td style="padding:36px 32px;">
      ${content}
    </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:28px; text-align:center;">
    <p style="font-family:${BRAND.sans}; font-size:12px; color:${BRAND.textDim}; line-height:1.6; margin:0;">
      <a href="${BRAND.siteUrl}" style="color:${BRAND.textDim}; text-decoration:none;">moltamp.com</a>
      &nbsp;&middot;&nbsp;
      <a href="mailto:support@moltamp.com" style="color:${BRAND.textDim}; text-decoration:none;">support@moltamp.com</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/** License delivery email */
export function licenseEmailHtml(licenseKey: string): string {
  return shell(`
    <p style="font-family:${BRAND.sans}; font-size:15px; color:${BRAND.text}; margin:0 0 6px; font-weight:600;">
      You're in.
    </p>
    <p style="font-family:${BRAND.sans}; font-size:14px; color:${BRAND.textSecondary}; margin:0 0 28px; line-height:1.5;">
      Your lifetime license key is ready. No subscription, no expiration &mdash; it's yours forever.
    </p>

    <!-- Terminal-style key box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.keyBg}; border:1px solid ${BRAND.keyBorder}; border-radius:12px; overflow:hidden;">
        <!-- Window chrome -->
        <tr><td style="padding:10px 14px; border-bottom:1px solid ${BRAND.keyBorder};">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ff5f57; margin-right:6px;"></span></td>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#febc2e; margin-right:6px;"></span></td>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#28c840;"></span></td>
            <td style="padding-left:16px;">
              <span style="font-family:${BRAND.mono}; font-size:11px; color:${BRAND.textDim};">license</span>
            </td>
          </tr></table>
        </td></tr>
        <!-- Key -->
        <tr><td align="center" style="padding:24px 20px;">
          <p style="font-family:${BRAND.mono}; font-size:11px; color:${BRAND.accent}; text-transform:uppercase; letter-spacing:0.08em; margin:0 0 10px;">License Key</p>
          <p style="font-family:${BRAND.mono}; font-size:20px; font-weight:600; letter-spacing:0.06em; color:${BRAND.text}; margin:0;">
            ${licenseKey}
          </p>
        </td></tr>
      </table>
    </td></tr>
    </table>

    <!-- Steps -->
    <p style="font-family:${BRAND.mono}; font-size:11px; color:${BRAND.accent}; text-transform:uppercase; letter-spacing:0.08em; margin:0 0 14px;">
      &gt; Activate
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${[
        'Open MOLTamp',
        'Go to <strong style="color:' + BRAND.text + ';">Settings \u2192 License</strong>',
        'Paste the key above and enter your email',
        'Click <strong style="color:' + BRAND.text + ';">Activate</strong>',
      ].map((step, i) => `
      <tr><td style="padding:10px 0; border-bottom:1px solid ${BRAND.cardBorder};">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="28" valign="top">
            <span style="display:inline-block; width:22px; height:22px; border-radius:6px; background:${BRAND.accent}15; color:${BRAND.accent}; font-family:${BRAND.mono}; font-size:11px; font-weight:600; text-align:center; line-height:22px;">${i + 1}</span>
          </td>
          <td style="padding-left:10px;">
            <span style="font-family:${BRAND.sans}; font-size:14px; color:${BRAND.textSecondary}; line-height:22px;">${step}</span>
          </td>
        </tr></table>
      </td></tr>`).join('')}
    </table>

    <!-- Community CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.accent}08; border:1px solid ${BRAND.accent}15; border-radius:10px;">
    <tr><td style="padding:16px 20px;">
      <p style="font-family:${BRAND.sans}; font-size:13px; color:${BRAND.textSecondary}; margin:0; line-height:1.5;">
        You now have access to the <a href="${BRAND.siteUrl}/skins" style="color:${BRAND.accent}; text-decoration:none; font-weight:500;">skin community</a> &mdash; browse, upload, and share skins with other users.
      </p>
    </td></tr>
    </table>

    <p style="font-family:${BRAND.sans}; font-size:12px; color:${BRAND.textDim}; margin:24px 0 0; line-height:1.6;">
      Need help? Just reply to this email.
    </p>
  `);
}

/** Auto-reply for support inquiries */
export function supportAutoReplyHtml(): string {
  return shell(`
    <p style="font-family:${BRAND.sans}; font-size:15px; color:${BRAND.text}; margin:0 0 6px; font-weight:600;">
      Got it.
    </p>
    <p style="font-family:${BRAND.sans}; font-size:14px; color:${BRAND.textSecondary}; margin:0 0 24px; line-height:1.6;">
      Thanks for reaching out. I've received your message and will get back to you as soon as I can &mdash; usually within 24 hours.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.keyBg}; border:1px solid ${BRAND.keyBorder}; border-radius:10px; margin-bottom:24px;">
    <tr><td style="padding:20px;">
      <p style="font-family:${BRAND.mono}; font-size:11px; color:${BRAND.accent}; text-transform:uppercase; letter-spacing:0.08em; margin:0 0 12px;">&gt; Quick fixes</p>
      <ul style="font-family:${BRAND.sans}; font-size:13px; color:${BRAND.textSecondary}; line-height:2; margin:0; padding-left:18px;">
        <li><strong style="color:${BRAND.text};">License not arriving?</strong> Check spam/promotions. Still missing? Reply with your purchase email.</li>
        <li><strong style="color:${BRAND.text};">Activation issues?</strong> Make sure you're using the exact email you purchased with.</li>
        <li><strong style="color:${BRAND.text};">Crash or bug?</strong> MOLTamp auto-reports crashes, but details help &mdash; what were you doing when it happened?</li>
      </ul>
    </td></tr>
    </table>

    <p style="font-family:${BRAND.sans}; font-size:13px; color:${BRAND.textSecondary}; margin:0; line-height:1.6;">
      &mdash; The MOLTamp Team
    </p>
  `);
}

/** Send an email via Resend */
export async function sendEmail(
  apiKey: string,
  opts: {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
  },
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error: ${res.status} ${text}`);
  }
}
