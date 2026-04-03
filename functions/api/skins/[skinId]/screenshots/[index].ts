interface Env {
  DB: D1Database;
}

/**
 * GET /api/skins/:skinId/screenshots/:index
 * Serve a screenshot image (0, 1, or 2).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const skinId = (context.params as Record<string, string>).skinId;
  const idx = parseInt((context.params as Record<string, string>).index ?? '0');
  const { DB } = context.env;

  if (isNaN(idx) || idx < 0 || idx > 2) {
    return new Response('Invalid index', { status: 400 });
  }

  // Get the skin's internal ID first
  const skin = await DB.prepare(
    `SELECT id FROM community_skins WHERE skin_id = ? AND status = 'active' LIMIT 1`,
  ).bind(skinId).first<{ id: number }>();

  if (!skin) return new Response('Skin not found', { status: 404 });

  const row = await DB.prepare(
    `SELECT image_data, content_type, file_size FROM skin_screenshots
     WHERE skin_id = ? AND sort_order = ? LIMIT 1`,
  ).bind(skin.id, idx).first<{ image_data: ArrayBuffer; content_type: string; file_size: number }>();

  if (!row || !row.image_data) {
    return new Response('Screenshot not found', { status: 404 });
  }

  return new Response(row.image_data, {
    headers: {
      'Content-Type': row.content_type,
      'Content-Length': String(row.file_size),
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
