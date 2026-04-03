import { getAuthUser } from '../../_shared/auth';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/skins/:skinId/download
 * Auth required — community downloads are behind the $20 license paywall.
 * Serve .zip file from D1 blob. Increments download counter.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const skinId = (context.params as Record<string, string>).skinId;
  const { DB } = context.env;

  const user = await getAuthUser(context.request, DB);
  if (!user) {
    return Response.json(
      { error: 'Login required to download skins. Get a license at moltamp.com/buy' },
      { status: 401 },
    );
  }

  const skin = await DB.prepare(
    `SELECT skin_id, file_data, file_size FROM community_skins
     WHERE skin_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(skinId)
    .first<{ skin_id: string; file_data: ArrayBuffer; file_size: number }>();

  if (!skin || !skin.file_data) {
    return Response.json({ error: 'Skin not found' }, { status: 404 });
  }

  // Increment download count (fire-and-forget)
  context.waitUntil(
    DB.prepare(
      `UPDATE community_skins SET download_count = download_count + 1 WHERE skin_id = ?`,
    )
      .bind(skinId)
      .run(),
  );

  return new Response(skin.file_data, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${skin.skin_id}.zip"`,
      'Content-Length': String(skin.file_size),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
