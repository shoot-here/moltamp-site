import { getAuthUser } from '../../_shared/auth';
import { jsonOk, jsonError } from '../../_shared/response';

interface Env {
  DB: D1Database;
}

const MAX_COMMENT_LENGTH = 500;
const RATE_LIMIT_PER_HOUR = 10;

/**
 * GET /api/widgets/:widgetId/comments?page=1&limit=20
 * Public — list comments for a widget.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;
  const url = new URL(context.request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(10, parseInt(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  // Get widget's internal ID
  const widget = await DB.prepare(
    `SELECT id FROM community_widgets WHERE widget_id = ? AND status = 'active' LIMIT 1`,
  ).bind(widgetId).first<{ id: number }>();

  if (!widget) return jsonError('Widget not found', 404);

  const countResult = await DB.prepare(
    `SELECT COUNT(*) as total FROM widget_comments WHERE widget_id = ?`,
  ).bind(widget.id).first<{ total: number }>();

  const rows = await DB.prepare(
    `SELECT wc.id, wc.comment, wc.created_at, u.display_name
     FROM widget_comments wc
     JOIN users u ON wc.user_id = u.id
     WHERE wc.widget_id = ?
     ORDER BY wc.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(widget.id, limit, offset).all();

  return jsonOk({
    comments: rows.results.map((r: Record<string, unknown>) => ({
      id: r.id,
      comment: r.comment,
      author: r.display_name,
      created_at: r.created_at,
    })),
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      pages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
};

/**
 * POST /api/widgets/:widgetId/comments
 * Auth required. Body: { comment: string }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  try {
    const user = await getAuthUser(context.request, DB);
    if (!user) return jsonError('Not authenticated', 401);

    const body = await context.request.json<{ comment?: string }>();
    const comment = body.comment?.trim();

    if (!comment) return jsonError('Comment cannot be empty');
    if (comment.length > MAX_COMMENT_LENGTH) {
      return jsonError(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
    }

    // Get widget's internal ID
    const widget = await DB.prepare(
      `SELECT id FROM community_widgets WHERE widget_id = ? AND status = 'active' LIMIT 1`,
    ).bind(widgetId).first<{ id: number }>();

    if (!widget) return jsonError('Widget not found', 404);

    // Rate limit check
    const recentCount = await DB.prepare(
      `SELECT COUNT(*) as count FROM widget_comments
       WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`,
    ).bind(user.id).first<{ count: number }>();

    if ((recentCount?.count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return jsonError('Too many comments. Try again later.', 429);
    }

    await DB.prepare(
      `INSERT INTO widget_comments (widget_id, user_id, comment) VALUES (?, ?, ?)`,
    ).bind(widget.id, user.id, comment).run();

    return jsonOk({
      success: true,
      comment: { comment, author: user.display_name, created_at: new Date().toISOString() },
    });
  } catch (e) {
    console.error('Comment error:', e);
    return jsonError(`Failed: ${e instanceof Error ? e.message : 'unknown'}`, 500);
  }
};
