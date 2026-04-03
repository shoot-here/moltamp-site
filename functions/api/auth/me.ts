import { getAuthUser } from '../_shared/auth';
import { jsonOk, jsonError, setCookie } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/auth/me
 * Returns current user info or 401.
 * Silently refreshes session on each call (rolling 90-day window).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const user = await getAuthUser(context.request, DB);

  if (!user) {
    return jsonError('Not authenticated', 401);
  }

  // Rolling session refresh — extend expiry by 90 days on each authenticated visit
  const cookie = context.request.headers.get('Cookie') ?? '';
  const match = cookie.match(/moltamp_session=([a-f0-9]{64})/);
  if (match) {
    await DB.prepare(
      `UPDATE sessions SET expires_at = datetime('now', '+90 days') WHERE id = ?`,
    )
      .bind(match[1])
      .run();
  }

  // Refresh cookie TTL too (90 days = 7776000 seconds)
  const response = jsonOk({ user });
  return setCookie(response, 'moltamp_session', match![1], 7776000);
};
