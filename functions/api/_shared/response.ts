/** Shared response helpers for consistent API patterns. */

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function jsonErrors(errors: string[], status = 400): Response {
  return Response.json({ errors }, { status });
}

export function setCookie(
  response: Response,
  name: string,
  value: string,
  maxAge: number,
): Response {
  const headers = new Headers(response.headers);
  headers.append(
    'Set-Cookie',
    `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function clearCookie(response: Response, name: string): Response {
  const headers = new Headers(response.headers);
  headers.append(
    'Set-Cookie',
    `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
