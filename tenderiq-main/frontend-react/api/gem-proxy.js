// GeM relay. GeM refuses connections from the API server's region (Render,
// Singapore), but accepts them from India — this function runs in Vercel's
// Mumbai region (vercel.json "regions": ["bom1"]) and forwards the API
// server's requests to GeM.
//
// Locked down: only callers with the shared key (GEM_PROXY_KEY, set on both
// Vercel and Render) are served, and only GeM hosts can be reached.

const ALLOWED_HOSTS = new Set(['bidplus.gem.gov.in', 'gem.gov.in', 'mkp.gem.gov.in']);
const PASS_HEADERS = ['accept', 'content-type', 'cookie', 'referer', 'origin', 'user-agent', 'x-requested-with'];
// Vercel caps a function response at ~4.5 MB; base64 adds a third
const MAX_BYTES = 3 * 1024 * 1024;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const key = process.env.GEM_PROXY_KEY;
  if (!key || req.headers['x-proxy-key'] !== key) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { url, method = 'GET', headers = {}, body } = req.body || {};
  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'bad url' });
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: 'host not allowed' });
  }
  if (!['GET', 'POST'].includes(method)) return res.status(400).json({ error: 'bad method' });

  const outHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    if (PASS_HEADERS.includes(k.toLowerCase()) && typeof v === 'string') outHeaders[k] = v;
  }

  try {
    const r = await fetch(target, {
      method,
      headers: outHeaders,
      body: method === 'POST' && typeof body === 'string' ? body : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return res.status(200).json({ status: 413, error: `GeM file too large to relay (${Math.round(buf.length / 1024)} KB)` });
    }
    res.status(200).json({
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || '',
        'set-cookie': typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [],
      },
      body_base64: buf.toString('base64'),
    });
  } catch (err) {
    res.status(200).json({ status: 0, error: err.cause?.code || err.name || err.message });
  }
}
