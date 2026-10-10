// Cloudflare Worker: bind the private rankings bucket as RANKINGS.
// Only the public exporter snapshot is served; no arbitrary object access.
export default {
  async fetch(request, env) {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' };
    if (new URL(request.url).pathname !== '/tiers.json') return new Response('{"error":"Not found"}', { status: 404, headers });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('{"error":"Method not allowed"}', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    try {
      const object = await env.RANKINGS.get('tiers.json');
      if (!object) return new Response('{"error":"Awaiting rankings"}', { status: 503, headers });
      return new Response(request.method === 'HEAD' ? null : object.body, { headers });
    } catch {
      return new Response('{"error":"Rankings unavailable"}', { status: 503, headers });
    }
  }
};
