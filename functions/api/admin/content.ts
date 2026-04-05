import { verifyAdmin, unauthorized } from "./_auth";

interface Env {
  DB: D1Database;
  ADMIN_SECRET?: string;
}

/**
 * GET /api/admin/content — Read current content config
 * PUT /api/admin/content — Update content config
 *
 * The content_json blob has this shape:
 * {
 *   nag_messages: [{ headline, body, cta }],
 *   nag_config: { interval_min, interval_max, dismiss_delay },
 *   whats_new: [{ version, date, highlights }],
 *   update: { latest, notes, url },
 *   notifications: [{ id, type, message, url?, expires? }],
 *   min_version: "1.2.0",
 *   upgrade_message: "...",
 *   upgrade_url: "...",
 *   redirect_content_url: "...",
 *   redirect_version_url: "...",
 * }
 */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!verifyAdmin(context.request, context.env)) return unauthorized();

  const row = await context.env.DB
    .prepare("SELECT content_json, updated_at, updated_by FROM admin_content WHERE id = 1")
    .first<{ content_json: string; updated_at: string; updated_by: string }>();

  const content = row ? JSON.parse(row.content_json) : {};

  return Response.json({
    content,
    updated_at: row?.updated_at || null,
    updated_by: row?.updated_by || null,
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  if (!verifyAdmin(context.request, context.env)) return unauthorized();

  const body = await context.request.json<{ content: Record<string, unknown> }>();

  if (!body.content || typeof body.content !== "object") {
    return Response.json({ error: "content object required" }, { status: 400 });
  }

  const json = JSON.stringify(body.content);

  await context.env.DB
    .prepare("UPDATE admin_content SET content_json = ?, updated_at = datetime('now'), updated_by = 'admin' WHERE id = 1")
    .bind(json)
    .run();

  return Response.json({ ok: true });
};
