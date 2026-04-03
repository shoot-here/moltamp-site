/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
  SKINS_BUCKET: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  RESEND_API_KEY: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
