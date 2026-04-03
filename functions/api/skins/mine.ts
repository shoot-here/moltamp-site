import { getAuthUser } from '../_shared/auth';
import { jsonOk, jsonError } from '../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/skins/mine
 * List current user's uploaded skins.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const user = await getAuthUser(context.request, DB);
  if (!user) return jsonError('Not authenticated', 401);

  const rows = await DB.prepare(
    `SELECT cs.skin_id, cs.name, cs.version, cs.author_name, cs.description,
            cs.colors_json, cs.download_count, cs.file_size, cs.status,
            cs.created_at, cs.updated_at,
            GROUP_CONCAT(st.tag) as tags
     FROM community_skins cs
     LEFT JOIN skin_tags st ON st.skin_id = cs.id
     WHERE cs.user_id = ?
     GROUP BY cs.id
     ORDER BY cs.created_at DESC`,
  )
    .bind(user.id)
    .all();

  const skins = rows.results.map((row: Record<string, unknown>) => ({
    skin_id: row.skin_id,
    name: row.name,
    version: row.version,
    author_name: row.author_name,
    description: row.description,
    colors: JSON.parse(row.colors_json as string),
    tags: row.tags ? (row.tags as string).split(',') : [],
    download_count: row.download_count,
    file_size: row.file_size,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return jsonOk({ skins });
};
