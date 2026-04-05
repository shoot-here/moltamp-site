/**
 * Admin auth — simple secret key check.
 * Set ADMIN_SECRET in Cloudflare Worker secrets.
 * Admin panel sends it as Authorization: Bearer <secret>.
 */

export function verifyAdmin(request: Request, env: { ADMIN_SECRET?: string }): boolean {
  const secret = env.ADMIN_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("Authorization");
  if (!auth) return false;

  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === secret;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
