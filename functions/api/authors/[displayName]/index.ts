import { jsonOk, jsonError } from '../../_shared/response';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/authors/:displayName
 * Public — author stats. Looks up by author_name in community_skins
 * (the name from the skin manifest), not users.display_name.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const displayName = decodeURIComponent(
    (context.params as Record<string, string>).displayName,
  );
  const { DB } = context.env;

  const author = await DB.prepare(
    `SELECT cs.author_name as display_name,
            MIN(u.created_at) as created_at,
            COUNT(cs.id) as skin_count,
            COALESCE(SUM(cs.download_count), 0) as total_downloads
     FROM community_skins cs
     LEFT JOIN users u ON cs.user_id = u.id
     WHERE cs.author_name = ? AND cs.status = 'active'
     GROUP BY cs.author_name
     LIMIT 1`,
  ).bind(displayName).first<{
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
