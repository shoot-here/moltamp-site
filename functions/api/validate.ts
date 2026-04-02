interface Env {
  DB: D1Database;
}

/**
 * License validation endpoint.
 * Called by the Moltamp desktop app to check a license key.
 *
 * POST /api/validate
 * Body: { "email": "...", "license_key": "MOLT-XXXX-XXXX-XXXX-XXXX" }
 *
 * Returns:
 *   200 { "valid": true }  — key is legit
 *   200 { "valid": false } — key not found or doesn't match email
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const body = await context.request.json<{
    email: string;
    license_key: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const licenseKey = body.license_key?.trim().toUpperCase();

  if (!email || !licenseKey) {
    return Response.json(
      { valid: false, error: 'Email and license_key required' },
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
    // Update last validated timestamp
    await DB.prepare(
      `UPDATE licenses SET last_validated_at = datetime('now') WHERE email = ? AND license_key = ?`,
    )
      .bind(email, licenseKey)
      .run();

    return Response.json({ valid: true });
  }

  return Response.json({ valid: false });
};
