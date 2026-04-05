import Stripe from 'stripe';
import { licenseEmailHtml, sendEmail } from './_shared/emails';

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
        await sendEmail(RESEND_API_KEY, {
          from: 'MOLTamp Licenses <license@moltamp.com>',
          to: email,
          subject: 'Your MOLTamp License Key',
          html: licenseEmailHtml(licenseKey),
          replyTo: 'support@moltamp.com',
        });
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
