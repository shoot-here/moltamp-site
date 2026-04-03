import { getAuthUser } from '../_shared/auth';
import { jsonOk, jsonError } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/widgets/mine
 * List current user's uploaded widgets.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const user = await getAuthUser(context.request, DB);
  if (!user) return jsonError('Not authenticated', 401);

  const rows = await DB.prepare(
    `SELECT cw.widget_id, cw.name, cw.version, cw.author_name, cw.description,
            cw.download_count, cw.file_size, cw.status,
            cw.created_at, cw.updated_at,
            GROUP_CONCAT(wt.tag) as tags
     FROM community_widgets cw
     LEFT JOIN widget_tags wt ON wt.widget_id = cw.id
     WHERE cw.user_id = ?
     GROUP BY cw.id
     ORDER BY cw.created_at DESC`,
  )
    .bind(user.id)
    .all();

  const widgets = rows.results.map((row: Record<string, unknown>) => ({
    widget_id: row.widget_id,
    name: row.name,
    version: row.version,
    author_name: row.author_name,
    description: row.description,
    tags: row.tags ? (row.tags as string).split(',') : [],
    download_count: row.download_count,
    file_size: row.file_size,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return jsonOk({ widgets });
};
