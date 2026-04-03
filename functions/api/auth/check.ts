import { jsonOk, jsonError } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * POST /api/auth/check
 * Body: { email }
 * Returns whether this email has an existing user account (i.e. has logged in before).
 * Used to show "Welcome back" and hide the display_name field.
 * Does NOT reveal whether a license exists — only whether they've logged in before.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const body = await context.request.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return jsonError('Email required');
  }

  const user = await DB.prepare(
    `SELECT display_name FROM users WHERE email = ? LIMIT 1`,
  )
    .bind(email)
    .first<{ display_name: string }>();

  return jsonOk({
    exists: !!user,
    display_name: user?.display_name ?? null,
  });
};
