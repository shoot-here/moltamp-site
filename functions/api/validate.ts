interface Env {
  DB: D1Database;
  LICENSE_SIGNING_KEY?: string; // Ed25519 private key (PKCS8 DER, base64)
}

/**
 * License validation endpoint — server-authoritative with signed responses.
 *
 * POST /api/validate
 * Body: { "email": "...", "license_key": "MOLT-XXXX-...", "machine_id": "..." }
 *
 * Returns:
 *   200 { "valid": true,  "ts": 1712275200000, "sig": "base64..." }
 *   200 { "valid": false, "ts": 1712275200000, "sig": "base64..." }
 *
 * The app verifies the Ed25519 signature to confirm this response
 * actually came from our server — not a mock/redirect.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, LICENSE_SIGNING_KEY } = context.env;

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
      { valid: false, error: "email and license_key required" },
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

  const valid = !!result;

  if (valid) {
    // Update last validated timestamp
    await DB.prepare(
      `UPDATE licenses SET last_validated_at = datetime('now') WHERE email = ? AND license_key = ?`,
    )
      .bind(email, licenseKey)
      .run();
  }

  // Sign the response
  const ts = Date.now();

  if (LICENSE_SIGNING_KEY) {
    try {
      const sig = await signResponse(valid, ts, machineId, LICENSE_SIGNING_KEY);
      return Response.json({ valid, ts, sig });
    } catch (err) {
      console.error("Signing failed:", err);
      // Fall through to unsigned response (backwards compat during key setup)
    }
  }

  // Unsigned fallback (only during initial setup before key is configured)
  return Response.json({ valid, ts });
};

/**
 * Sign the response payload with Ed25519.
 * Payload: "${valid}:${ts}:${machine_id}"
 * Uses Web Crypto API (Cloudflare Workers compatible).
 */
async function signResponse(
  valid: boolean,
  ts: number,
  machineId: string,
  privateKeyB64: string,
): Promise<string> {
  const payload = `${valid}:${ts}:${machineId}`;

  // Import the Ed25519 private key
  const keyData = Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "Ed25519" },
    false,
    ["sign"],
  );

  // Sign the payload
  const sigBuf = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(payload),
  );

  // Return base64-encoded signature
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}
