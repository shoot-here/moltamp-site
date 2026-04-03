import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID: string;
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID } = context.env;

  if (!STRIPE_SECRET_KEY) {
    return Response.json(
      { error: 'Stripe is not configured yet' },
      { status: 503 },
    );
  }

  const body = await context.request.json<{ email: string }>();
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Valid email required' }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: [
      {
        price: STRIPE_PRICE_ID, // Create this in Stripe dashboard: $20 one-time
        quantity: 1,
      },
    ],
    success_url: `${new URL(context.request.url).origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${new URL(context.request.url).origin}/buy`,
    metadata: {
      product: 'moltamp-license',
      email,
    },
  });

  return Response.json({ url: session.url });
};
