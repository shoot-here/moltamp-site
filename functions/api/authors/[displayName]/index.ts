import { jsonOk, jsonError } from '../../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/authors/:displayName
 * Public — author stats.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const displayName = decodeURIComponent(
    (context.params as Record<string, string>).displayName,
  );
  const { DB } = context.env;

  const author = await DB.prepare(
    `SELECT u.id, u.display_name, u.created_at,
            COUNT(cs.id) as skin_count,
            COALESCE(SUM(cs.download_count), 0) as total_downloads
     FROM users u
     LEFT JOIN community_skins cs ON cs.user_id = u.id AND cs.status = 'active'
     WHERE u.display_name = ?
     GROUP BY u.id
     LIMIT 1`,
  ).bind(displayName).first<{
    id: number;
    display_name: string;
    created_at: string;
    skin_count: number;
    total_downloads: number;
  }>();

  if (!author) return jsonError('Author not found', 404);

  return jsonOk({
    author: {
      display_name: author.display_name,
      joined: author.created_at,
      skin_count: author.skin_count,
      total_downloads: author.total_downloads,
    },
  });
};
