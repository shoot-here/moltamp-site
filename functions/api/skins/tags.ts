import { jsonOk } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/skins/tags
 * List all tags with their usage counts.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT tag, COUNT(*) as count
     FROM skin_tags st
     JOIN community_skins cs ON st.skin_id = cs.id
     WHERE cs.status = 'active'
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
