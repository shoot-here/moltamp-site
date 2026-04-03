import { getAuthUser } from '../../_shared/auth';
import { jsonOk, jsonError } from '../../_shared/response';

interface Env {
  DB: D1Database;
  SKINS_BUCKET: R2Bucket;
}

/**
 * GET /api/skins/:skinId
 * Public skin detail.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const skinId = (context.params as Record<string, string>).skinId;
  const { DB } = context.env;

  const row = await DB.prepare(
    `SELECT cs.skin_id, cs.name, cs.version, cs.author_name, cs.description,
            cs.colors_json, cs.download_count, cs.file_size, cs.css_size,
            cs.asset_count, cs.created_at, cs.updated_at,
            GROUP_CONCAT(st.tag) as tags
     FROM community_skins cs
     LEFT JOIN skin_tags st ON st.skin_id = cs.id
     WHERE cs.skin_id = ? AND cs.status = 'active'
     GROUP BY cs.id
     LIMIT 1`,
  )
    .bind(skinId)
    .first<Record<string, unknown>>();

  if (!row) return jsonError('Skin not found', 404);

  return jsonOk({
    skin: {
      skin_id: row.skin_id,
      name: row.name,
      version: row.version,
      author_name: row.author_name,
      description: row.description,
      colors: JSON.parse(row.colors_json as string),
      tags: row.tags ? (row.tags as string).split(',') : [],
      download_count: row.download_count,
      file_size: row.file_size,
      css_size: row.css_size,
      asset_count: row.asset_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
};

/**
 * DELETE /api/skins/:skinId
 * Owner-only delete. Removes from R2 and D1.
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const skinId = (context.params as Record<string, string>).skinId;
  const { DB } = context.env;

  const user = await getAuthUser(context.request, DB);
  if (!user) return jsonError('Not authenticated', 401);

  const skin = await DB.prepare(
    `SELECT id, user_id FROM community_skins WHERE skin_id = ? LIMIT 1`,
  )
    .bind(skinId)
    .first<{ id: number; user_id: number }>();

  if (!skin) return jsonError('Skin not found', 404);
  if (skin.user_id !== user.id) return jsonError('Not authorized', 403);

  // Delete from D1 (tags cascade via ON DELETE CASCADE)
  await DB.prepare(`DELETE FROM community_skins WHERE id = ?`).bind(skin.id).run();

  return jsonOk({ success: true });
};
