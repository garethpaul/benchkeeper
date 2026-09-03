interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response = new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' }
      });
    } else if (
      url.pathname.startsWith('/work/') ||
      url.pathname.startsWith('/@fs/') ||
      url.pathname.startsWith('/.git')
    ) {
      response = new Response('Not found', { status: 404 });
    } else if (url.pathname === '/api/health') {
      response = Response.json({ ok: true, storage: 'browser-session', externalActions: false });
    } else if (url.pathname.startsWith('/api/')) {
      response = new Response('Not found', { status: 404 });
    } else {
      response = await env.ASSETS.fetch(request);
    }
    const secured = new Response(response.body, response);
    secured.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    );
    secured.headers.set(
      'Permissions-Policy',
      'tools=(self), camera=(), microphone=(), geolocation=()'
    );
    secured.headers.set('Origin-Agent-Cluster', '?1');
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('Referrer-Policy', 'no-referrer');
    return secured;
  }
};
