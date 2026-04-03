import { getAuthUser } from '../../_shared/auth';

interface Env {
  DB: D1Database;
}

/**
 * GET /api/widgets/:widgetId/download
 * Auth required — community downloads are behind the $20 license paywall.
 * Serve .zip file from D1 blob. Increments download counter.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  const user = await getAuthUser(context.request, DB);
  if (!user) {
    return Response.json(
      { error: 'Login required to download widgets. Get a license at moltamp.com/buy' },
      { status: 401 },
    );
  }

  const widget = await DB.prepare(
    `SELECT widget_id, file_data, file_size FROM community_widgets
     WHERE widget_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(widgetId)
    .first<{ widget_id: string; file_data: ArrayBuffer; file_size: number }>();

  if (!widget || !widget.file_data) {
    return Response.json({ error: 'Widget not found' }, { status: 404 });
  }

  // Increment download count (fire-and-forget)
  context.waitUntil(
    DB.prepare(
      `UPDATE community_widgets SET download_count = download_count + 1 WHERE widget_id = ?`,
    )
      .bind(widgetId)
      .run(),
  );

  return new Response(widget.file_data, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${widget.widget_id}.zip"`,
      'Content-Length': String(widget.file_size),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
