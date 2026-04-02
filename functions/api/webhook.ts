import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
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
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DB } = context.env;

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

    // TODO: Send license key email via Resend or Cloudflare Email Workers
    // For now, log it — you'll wire up email delivery next
    console.log(`License created: ${email} -> ${licenseKey}`);
  }

  return new Response('ok', { status: 200 });
};
