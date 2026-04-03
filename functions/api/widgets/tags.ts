import { jsonOk } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/widgets/tags
 * List all tags with their usage counts.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT tag, COUNT(*) as count
     FROM widget_tags wt
     JOIN community_widgets cw ON wt.widget_id = cw.id
     WHERE cw.status = 'active'
     GROUP BY tag
     ORDER BY count DESC`,
  ).all();

  return jsonOk({
    tags: rows.results.map((r: Record<string, unknown>) => ({
      tag: r.tag,
      count: r.count,
    })),
  });
};
