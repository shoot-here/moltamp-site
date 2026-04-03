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
            GROUP_CONCAT(st.tag) as tags,
            (SELECT ROUND(AVG(sr.rating), 1) FROM skin_ratings sr WHERE sr.skin_id = cs.id) as avg_rating,
            (SELECT COUNT(*) FROM skin_ratings sr WHERE sr.skin_id = cs.id) as rating_count
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
      avg_rating: row.avg_rating ?? 0,
      rating_count: row.rating_count ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
};

/**
 * PATCH /api/skins/:skinId
 * Owner-only update. Allows editing description and tags.
 * Body: { description?, tags? }
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
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

  const body = await context.request.json<{
    description?: string;
    tags?: string;
  }>();

  // Update description if provided
  if (body.description !== undefined) {
    const desc = body.description.trim();
    if (desc.length === 0 || desc.length > 500) {
      return jsonError('Description must be 1-500 characters');
    }
    await DB.prepare(
      `UPDATE community_skins SET description = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(desc, skin.id)
      .run();
  }

  // Update tags if provided
  if (body.tags !== undefined) {
    const tags = body.tags
      .split(',')
      .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
      .filter((t: string) => t.length > 0 && t.length <= 24)
      .slice(0, 5);

    await DB.prepare(`DELETE FROM skin_tags WHERE skin_id = ?`).bind(skin.id).run();
    for (const tag of tags) {
      await DB.prepare(`INSERT INTO skin_tags (skin_id, tag) VALUES (?, ?)`).bind(skin.id, tag).run();
    }
  }

  return jsonOk({ success: true });
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
