/** Session-based auth helper. Call at the top of any authed endpoint. */

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
}

export async function getAuthUser(
  request: Request,
  db: D1Database,
): Promise<AuthUser | null> {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/moltamp_session=([a-f0-9]{64})/);
  if (!match) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > datetime('now')
       LIMIT 1`,
    )
    .bind(match[1])
    .first<{ id: number; email: string; display_name: string }>();

  return row ?? null;
}

/** Generate a cryptographically random 64-char hex session ID. */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
