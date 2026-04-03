import { getAuthUser, generateSessionId } from '../_shared/auth';
import { jsonOk, jsonError, setCookie } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * POST /api/auth/login
 * Body: { email, license_key, display_name? }
 * Sets httpOnly session cookie on success.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const body = await context.request.json<{
    email?: string;
    license_key?: string;
    display_name?: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const licenseKey = body.license_key?.trim().toUpperCase();
  const displayName = body.display_name?.trim() || email?.split('@')[0] || 'User';

  if (!email || !licenseKey) {
    return jsonError('Email and license key are required');
  }

  // Validate license exists and is not revoked
  const license = await DB.prepare(
    `SELECT id FROM licenses
     WHERE email = ? AND license_key = ? AND revoked_at IS NULL
     LIMIT 1`,
  )
    .bind(email, licenseKey)
    .first();

  if (!license) {
    return jsonError('Invalid email or license key', 401);
  }

  // Upsert user — create on first login, ignore if exists
  await DB.prepare(
    `INSERT OR IGNORE INTO users (email, display_name) VALUES (?, ?)`,
  )
    .bind(email, displayName)
    .run();

  const user = await DB.prepare(
    `SELECT id, email, display_name FROM users WHERE email = ? LIMIT 1`,
  )
    .bind(email)
    .first<{ id: number; email: string; display_name: string }>();

  if (!user) {
    return jsonError('Failed to create user', 500);
  }

  // Update display name if provided and different
  if (displayName && displayName !== user.display_name) {
    await DB.prepare(`UPDATE users SET display_name = ? WHERE id = ?`)
      .bind(displayName, user.id)
      .run();
    user.display_name = displayName;
  }

  // Clean up expired sessions for this user
  await DB.prepare(
    `DELETE FROM sessions WHERE user_id = ? AND expires_at < datetime('now')`,
  )
    .bind(user.id)
    .run();

  // Create new session (90 days)
  const sessionId = generateSessionId();
  const ip = context.request.headers.get('CF-Connecting-IP') ?? '';
  const ua = context.request.headers.get('User-Agent') ?? '';

  await DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
     VALUES (?, ?, datetime('now', '+90 days'), ?, ?)`,
  )
    .bind(sessionId, user.id, ip, ua)
    .run();

  // Set cookie (90 days = 7776000 seconds)
  const response = jsonOk({
    success: true,
    user: { id: user.id, email: user.email, display_name: user.display_name },
  });

  return setCookie(response, 'moltamp_session', sessionId, 7776000);
};
