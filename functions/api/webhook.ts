import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  DB: D1Database;
}

/**
 * Generate a license key: MOLT-XXXX-XXXX-XXXX-XXXX
 */
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join(''),
  );
  return `MOLT-${segments.join('-')}`;
}

/**
 * Send the license key email via Resend.
 */
async function sendLicenseEmail(
  apiKey: string,
  email: string,
  licenseKey: string,
): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MOLTamp Licenses <license@moltamp.com>',
      to: [email],
      subject: 'Your MOLTamp License Key',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">MOLTamp</h1>
          <p style="color: #666; margin-bottom: 32px;">Your lifetime license key is ready.</p>

          <div style="background: #f5f5f7; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #666; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">License Key</p>
            <p style="font-family: 'SF Mono', monospace; font-size: 20px; font-weight: 600; letter-spacing: 0.08em; color: #000; margin: 0;">
              ${licenseKey}
            </p>
          </div>

          <h3 style="font-size: 14px; margin-bottom: 12px;">How to activate:</h3>
          <ol style="color: #444; font-size: 14px; line-height: 2; padding-left: 20px;">
            <li>Open MOLTamp</li>
            <li>Go to <strong>Settings → License</strong></li>
            <li>Enter your email and paste the key above</li>
            <li>Click <strong>Activate</strong></li>
          </ol>

          <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            This license works offline after first activation. No subscription, no expiration.
            <br>Need help? Reply to this email or contact <a href="mailto:support@moltamp.com" style="color: #007aff;">support@moltamp.com</a>
          </p>
        </div>
      `,
    }),
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, DB } =
    context.env;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe not configured', { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const signature = context.request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const rawBody = await context.request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_email || session.metadata?.email;

    if (!email) {
      console.error('No email found in session:', session.id);
      return new Response('No email', { status: 400 });
    }

    const licenseKey = generateLicenseKey();

    // Store license in D1
    await DB.prepare(
      `INSERT INTO licenses (email, license_key, stripe_session_id, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
    )
      .bind(email, licenseKey, session.id)
      .run();

    // Send license key email
    if (RESEND_API_KEY) {
      try {
        await sendLicenseEmail(RESEND_API_KEY, email, licenseKey);
        console.log(`License emailed: ${email} -> ${licenseKey}`);
      } catch (err) {
        console.error(`Failed to email license to ${email}:`, err);
        // License is still in D1 — user can contact support
      }
    } else {
      console.log(`License created (no email configured): ${email} -> ${licenseKey}`);
    }
  }

  return new Response('ok', { status: 200 });
};
