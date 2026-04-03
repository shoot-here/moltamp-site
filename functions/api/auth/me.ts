import { getAuthUser } from '../_shared/auth';
import { jsonOk, jsonError } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/auth/me
 * Returns current user info or 401.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env.DB);

  if (!user) {
    return jsonError('Not authenticated', 401);
  }

  return jsonOk({ user });
};
