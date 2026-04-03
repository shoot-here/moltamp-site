interface Env {
  DB: D1Database;
  LICENSE_HMAC_SECRET: string;
}

/**
 * License validation endpoint.
 * Called by the Moltamp desktop app to check a license key.
 *
 * POST /api/validate
 * Body: { "email": "...", "license_key": "MOLT-XXXX-XXXX-XXXX-XXXX", "machine_id": "..." }
 *
 * Returns:
 *   200 { "valid": true, "signature": "hmac_hex" }  — key is legit
 *   200 { "valid": false } — key not found or doesn't match email
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, LICENSE_HMAC_SECRET } = context.env;

  const body = await context.request.json<{
    email: string;
    license_key: string;
    machine_id: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const licenseKey = body.license_key?.trim().toUpperCase();
  const machineId = body.machine_id?.trim();

  if (!email || !licenseKey || !machineId) {
    return Response.json(
      { valid: false, error: 'email, license_key, and machine_id required' },
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

    const signature = await hmacSign(
      LICENSE_HMAC_SECRET,
      email + licenseKey + machineId,
    );

    return Response.json({ valid: true, signature });
  }

  return Response.json({ valid: false });
};

/**
 * Generate an HMAC-SHA256 hex signature using the Web Crypto API.
 */
async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
