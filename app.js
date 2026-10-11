const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || 'https://gvxysxktqexuhrfkikjv.supabase.co').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_COVBM_Uc-UaQsywiDVtc9g_46fqORa1';
const ALLOWED_TABLES = new Set(['clients', 'events', 'receivables', 'deposits']);
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, content-type, prefer'
};

function response(body, status = 200, contentType = 'application/json; charset=utf-8') {
  const responseBody = [204, 205, 304].includes(status) ? null : body;
  return new Response(responseBody, { status, headers: { ...CORS_HEADERS, 'Content-Type': contentType } });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return response(null, 204);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return response(JSON.stringify({ error: 'Method tidak diizinkan.' }), 405);
  if (request.headers.get('apikey') !== SUPABASE_PUBLISHABLE_KEY) return response(JSON.stringify({ error: 'API key tidak valid.' }), 401);

  const requestUrl = new URL(request.url);
  const pathParts = requestUrl.pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.lastIndexOf('julieta-api');
  const routeParts = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : pathParts;
  const table = routeParts[0];
  if (!ALLOWED_TABLES.has(table) || routeParts.length !== 1) return response(JSON.stringify({ error: 'Endpoint tidak ditemukan.' }), 404);

  const query = requestUrl.search;
  const headers = new Headers({
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Prefer: request.headers.get('prefer') || 'return=representation'
  });
  const body = ['GET', 'DELETE'].includes(request.method) ? undefined : await request.text();
  if (body) headers.set('Content-Type', request.headers.get('content-type') || 'application/json');

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { method: request.method, headers, body });
    return response(await upstream.text(), upstream.status, upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  } catch {
    return response(JSON.stringify({ error: 'Tidak dapat terhubung ke Supabase.' }), 502);
  }
});