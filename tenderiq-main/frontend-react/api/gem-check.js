// Reachability check: can this Vercel region (Mumbai) connect to GeM?
// Fixed URL, no inputs — returns only the HTTP status and timing.
export default async function handler(_req, res) {
  const started = Date.now();
  try {
    const r = await fetch('https://bidplus.gem.gov.in/all-bids', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.text();
    res.status(200).json({
      region: process.env.VERCEL_REGION || null,
      gem_status: r.status,
      has_csrf: /csrf_bd_gem_nk/.test(body),
      ms: Date.now() - started,
    });
  } catch (err) {
    res.status(200).json({
      region: process.env.VERCEL_REGION || null,
      error: err.cause?.code || err.name || err.message,
      ms: Date.now() - started,
    });
  }
}
