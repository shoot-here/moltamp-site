interface Env {
  DB: D1Database;
}

/**
 * Crash report submission — opt-in only.
 * Desktop app prompts user before sending.
 *
 * POST /api/crash
 * Body: { "error": "...", "stack": "...", "version": "0.1.0", "platform": "darwin", "timestamp": "..." }
 *
 * Returns:
 *   200 { "received": true }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const body = await context.request.json<{
      error: string;
      stack?: string;
      version: string;
      platform?: string;
      timestamp: string;
    }>();

    if (!body.error || !body.version || !body.timestamp) {
      return Response.json(
        { received: false, error: "error, version, and timestamp required" },
        { status: 400 },
      );
    }

    await DB.prepare(
      `INSERT INTO crash_reports (error, stack, version, platform, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        body.error.slice(0, 1000),
        (body.stack || "").slice(0, 5000),
        body.version,
        body.platform || "unknown",
        body.timestamp,
      )
      .run();

    return Response.json({ received: true });
  } catch {
    return Response.json({ received: false }, { status: 500 });
  }
};
