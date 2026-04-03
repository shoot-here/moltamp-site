import { jsonOk, clearCookie } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * POST /api/auth/logout
 * Clears session from D1 and removes cookie.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const cookie = context.request.headers.get('Cookie') ?? '';
  const match = cookie.match(/moltamp_session=([a-f0-9]{64})/);

  if (match) {
    await DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(match[1]).run();
  }

  const response = jsonOk({ success: true });
  return clearCookie(response, 'moltamp_session');
};
