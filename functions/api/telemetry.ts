interface Env {
  DB: D1Database;
}

/**
 * POST /api/telemetry — Anonymous opt-in usage ping.
 *
 * Users enable this in Settings → "Help Improve MOLTamp".
 * Payload is minimal: version, platform, uptime, feature flags.
 * No PII, no IP logging, no tracking IDs.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  let body: {
    version?: string;
    platform?: string;
    arch?: string;
    uptime?: number;
    sessions?: number;
    skins?: number;
    widgets?: number;
    tickers?: number;
  };

  try {
    body = await context.request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const version = String(body.version || 'unknown').slice(0, 20);
  const platform = String(body.platform || 'unknown').slice(0, 20);
  const arch = String(body.arch || 'unknown').slice(0, 20);
  const uptime = Math.max(0, Math.min(body.uptime || 0, 999999));
  const sessions = Math.max(0, Math.min(body.sessions || 0, 9999));
  const skins = Math.max(0, Math.min(body.skins || 0, 9999));
  const widgets = Math.max(0, Math.min(body.widgets || 0, 9999));
  const tickers = Math.max(0, Math.min(body.tickers || 0, 9999));

  try {
    await DB.prepare(
      `INSERT INTO telemetry_pings (version, platform, arch, uptime_min, sessions, skins, widgets, tickers, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(version, platform, arch, uptime, sessions, skins, widgets, tickers)
      .run();
  } catch {
    // Non-fatal — table may not exist yet
  }

  return new Response('ok', { status: 200 });
};
