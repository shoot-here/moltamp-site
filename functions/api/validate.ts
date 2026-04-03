interface Env {
  DB: D1Database;
}

/**
 * License validation endpoint — server-authoritative.
 * The server is the ONLY authority. No signatures, no HMAC.
 * App calls this on every launch.
 *
 * POST /api/validate
 * Body: { "email": "...", "license_key": "MOLT-XXXX-XXXX-XXXX-XXXX", "machine_id": "..." }
 *
 * Returns:
 *   200 { "valid": true }  — key is legit
 *   200 { "valid": false } — key not found or revoked
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const body = await context.request.json<{
    email: string;
    license_key: string;
    machine_id: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const licenseKey = body.license_key?.trim().toUpperCase();
  const machineId = body.machine_id?.trim();

  if (!email || !licenseKey) {
    return Response.json(
      { valid: false, error: 'email and license_key required' },
      { status: 400 },
    );
  }

  const result = await DB.prepare(
    `SELECT id FROM licenses
     WHERE email = ? AND license_key = ? AND revoked_at IS NULL
     LIMIT 1`,
  )
    .bind(email, licenseKey)
    .first();

  if (result) {
    // Update last validated timestamp and machine_id
    await DB.prepare(
      `UPDATE licenses SET last_validated_at = datetime('now') WHERE email = ? AND license_key = ?`,
    )
      .bind(email, licenseKey)
      .run();

    return Response.json({ valid: true });
  }

  return Response.json({ valid: false });
};
