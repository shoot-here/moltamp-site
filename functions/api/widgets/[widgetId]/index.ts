import { getAuthUser } from '../../_shared/auth';
import { jsonOk, jsonError } from '../../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/widgets/:widgetId
 * Public widget detail.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  const row = await DB.prepare(
    `SELECT cw.widget_id, cw.name, cw.version, cw.author_name, cw.description,
            cw.download_count, cw.file_size, cw.created_at, cw.updated_at,
            GROUP_CONCAT(wt.tag) as tags,
            (SELECT ROUND(AVG(wr.rating), 1) FROM widget_ratings wr WHERE wr.widget_id = cw.id) as avg_rating,
            (SELECT COUNT(*) FROM widget_ratings wr WHERE wr.widget_id = cw.id) as rating_count
     FROM community_widgets cw
     LEFT JOIN widget_tags wt ON wt.widget_id = cw.id
     WHERE cw.widget_id = ? AND cw.status = 'active'
     GROUP BY cw.id
     LIMIT 1`,
  )
    .bind(widgetId)
    .first<Record<string, unknown>>();

  if (!row) return jsonError('Widget not found', 404);

  return jsonOk({
    widget: {
      widget_id: row.widget_id,
      name: row.name,
      version: row.version,
      author_name: row.author_name,
      description: row.description,
      tags: row.tags ? (row.tags as string).split(',') : [],
      download_count: row.download_count,
      file_size: row.file_size,
      avg_rating: row.avg_rating ?? 0,
      rating_count: row.rating_count ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
};

/**
 * DELETE /api/widgets/:widgetId
 * Owner-only delete. Removes from D1.
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  const user = await getAuthUser(context.request, DB);
  if (!user) return jsonError('Not authenticated', 401);

  const widget = await DB.prepare(
    `SELECT id, user_id FROM community_widgets WHERE widget_id = ? LIMIT 1`,
  )
    .bind(widgetId)
    .first<{ id: number; user_id: number }>();

  if (!widget) return jsonError('Widget not found', 404);
  if (widget.user_id !== user.id) return jsonError('Not authorized', 403);

  // Delete from D1 (tags cascade via ON DELETE CASCADE)
  await DB.prepare(`DELETE FROM community_widgets WHERE id = ?`).bind(widget.id).run();

  return jsonOk({ success: true });
};
