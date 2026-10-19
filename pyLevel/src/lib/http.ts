export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
