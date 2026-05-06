export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(markup: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(markup, { ...init, headers });
}

export function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      location
    }
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}
