import { verifyAdmin, unauthorized } from "./_auth";
import { licenseEmailHtml, sendEmail } from "../_shared/emails";

interface Env {
  DB: D1Database;
  ADMIN_SECRET?: string;
  RESEND_API_KEY?: string;
}

/**
 * GET /api/admin/licenses — List all licenses (with search)
 * Query params: ?q=search&limit=50&offset=0
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!verifyAdmin(context.request, context.env)) return unauthorized();

  const url = new URL(context.request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query: string;
  let bindings: string[];

  if (q) {
    query = `SELECT id, email, license_key, stripe_session_id, created_at, last_validated_at, revoked_at, notes
             FROM licenses
             WHERE email LIKE ? OR license_key LIKE ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`;
    bindings = [`%${q}%`, `%${q}%`, String(limit), String(offset)];
  } else {
    query = `SELECT id, email, license_key, stripe_session_id, created_at, last_validated_at, revoked_at, notes
             FROM licenses
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`;
    bindings = [String(limit), String(offset)];
  }

  const { results } = await context.env.DB.prepare(query).bind(...bindings).all();

  // Total count for pagination
  const countQuery = q
    ? `SELECT COUNT(*) as count FROM licenses WHERE email LIKE ? OR license_key LIKE ?`
    : `SELECT COUNT(*) as count FROM licenses`;
  const countBindings = q ? [`%${q}%`, `%${q}%`] : [];
  const countRow = await context.env.DB.prepare(countQuery).bind(...countBindings).first<{ count: number }>();

  return Response.json({
    licenses: results,
    total: countRow?.count || 0,
    limit,
    offset,
  });
};

/**
 * POST /api/admin/licenses — Resend license email or revoke/unrevoke
 * Body: { action: "resend" | "revoke" | "unrevoke", license_id: number }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!verifyAdmin(context.request, context.env)) return unauthorized();

  const body = await context.request.json<{
    action: string;
    license_id: number;
  }>();

  const { action, license_id } = body;

  if (!license_id) {
    return Response.json({ error: "license_id required" }, { status: 400 });
  }

  const license = await context.env.DB
    .prepare("SELECT id, email, license_key, revoked_at FROM licenses WHERE id = ?")
    .bind(license_id)
    .first<{ id: number; email: string; license_key: string; revoked_at: string | null }>();

  if (!license) {
    return Response.json({ error: "License not found" }, { status: 404 });
  }

  if (action === "resend") {
    const apiKey = context.env.RESEND_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Email not configured (RESEND_API_KEY)" }, { status: 503 });
    }

    try {
      await sendEmail(apiKey, {
        from: "MOLTamp Licenses <license@moltamp.com>",
        to: license.email,
        subject: "Your MOLTamp License Key",
        html: licenseEmailHtml(license.license_key),
        replyTo: "support@moltamp.com",
      });
      return Response.json({ ok: true, message: `Email resent to ${license.email}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ error: `Failed to send: ${msg}` }, { status: 500 });
    }
  }

  if (action === "revoke") {
    await context.env.DB
      .prepare("UPDATE licenses SET revoked_at = datetime('now') WHERE id = ?")
      .bind(license_id)
      .run();
    return Response.json({ ok: true, message: "License revoked" });
  }

  if (action === "unrevoke") {
    await context.env.DB
      .prepare("UPDATE licenses SET revoked_at = NULL WHERE id = ?")
      .bind(license_id)
      .run();
    return Response.json({ ok: true, message: "License restored" });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
};

