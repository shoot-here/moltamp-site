import { getAuthUser } from '../../_shared/auth';
import { jsonOk, jsonError } from '../../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/widgets/:widgetId/ratings
 * Public: average rating + count. Authed: also user's own rating.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  const widget = await DB.prepare(
    `SELECT id FROM community_widgets WHERE widget_id = ? AND status = 'active' LIMIT 1`,
  ).bind(widgetId).first<{ id: number }>();

  if (!widget) return jsonError('Widget not found', 404);

  const stats = await DB.prepare(
    `SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as rating_count
     FROM widget_ratings WHERE widget_id = ?`,
  ).bind(widget.id).first<{ avg_rating: number | null; rating_count: number }>();

  const result: Record<string, unknown> = {
    avg_rating: stats?.avg_rating ?? 0,
    rating_count: stats?.rating_count ?? 0,
    user_rating: null,
  };

  const user = await getAuthUser(context.request, DB);
  if (user) {
    const userRating = await DB.prepare(
      `SELECT rating FROM widget_ratings WHERE widget_id = ? AND user_id = ? LIMIT 1`,
    ).bind(widget.id, user.id).first<{ rating: number }>();
    result.user_rating = userRating?.rating ?? null;
  }

  return jsonOk(result);
};

/**
 * POST /api/widgets/:widgetId/ratings
 * Auth required. Upsert user's rating (1-5).
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  const user = await getAuthUser(context.request, DB);
  if (!user) return jsonError('Not authenticated', 401);

  let body: { rating?: number };
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  const rating = body.rating;
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonError('Rating must be an integer from 1 to 5');
  }

  const widget = await DB.prepare(
    `SELECT id FROM community_widgets WHERE widget_id = ? AND status = 'active' LIMIT 1`,
  ).bind(widgetId).first<{ id: number }>();

  if (!widget) return jsonError('Widget not found', 404);

  await DB.prepare(
    `INSERT INTO widget_ratings (widget_id, user_id, rating)
     VALUES (?, ?, ?)
     ON CONFLICT (widget_id, user_id) DO UPDATE SET rating = excluded.rating, updated_at = datetime('now')`,
  ).bind(widget.id, user.id, rating).run();

  const stats = await DB.prepare(
    `SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as rating_count
     FROM widget_ratings WHERE widget_id = ?`,
  ).bind(widget.id).first<{ avg_rating: number | null; rating_count: number }>();

  return jsonOk({
    success: true,
    avg_rating: stats?.avg_rating ?? 0,
    rating_count: stats?.rating_count ?? 0,
    user_rating: rating,
  });
};
