"use strict";
/**
 * HTTP client for GeM.
 *
 * GeM refuses connections from some server regions (e.g. Render's Singapore
 * servers). When GEM_PROXY_URL and GEM_PROXY_KEY are set, requests go through
 * the GeM relay (a Vercel function in Mumbai, see frontend-react/api/gem-proxy.js);
 * otherwise they go to GeM directly (fine from India, e.g. local development).
 *
 * It is a normal axios instance, so callers use gemHttp.get/post as before.
 */
const axiosModule = require('axios');
const axios = axiosModule.default || axiosModule;

const PROXY_URL = process.env.GEM_PROXY_URL;
const PROXY_KEY = process.env.GEM_PROXY_KEY;
const useProxy = !!(PROXY_URL && PROXY_KEY);

async function relayAdapter(config) {
    const url = axios.getUri(config);
    const headers = {};
    const raw = typeof config.headers?.toJSON === 'function' ? config.headers.toJSON() : (config.headers || {});
    for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string' || typeof v === 'number') headers[k] = String(v);
    }
    let relay;
    try {
        relay = await axios.post(PROXY_URL, {
            url,
            method: String(config.method || 'get').toUpperCase(),
            headers,
            body: typeof config.data === 'string' ? config.data : undefined,
        }, {
            headers: { 'x-proxy-key': PROXY_KEY, 'Content-Type': 'application/json' },
            timeout: Math.max(config.timeout || 0, 30000) + 5000,
        });
    }
    catch (err) {
        const e = new Error(`GeM relay unreachable: ${err.response ? `HTTP ${err.response.status}` : (err.code || err.message)}`);
        e.code = err.code || 'ERELAY';
        throw e;
    }
    const r = relay.data || {};
    if (!r.status) {
        const e = new Error(`GeM relay could not reach GeM: ${r.error || 'unknown error'}`);
        e.code = r.error || 'ERELAY';
        throw e;
    }
    const buf = Buffer.from(r.body_base64 || '', 'base64');
    const data = config.responseType === 'arraybuffer' ? buf : buf.toString('utf8');
    if (config.maxContentLength > 0 && buf.length > config.maxContentLength) {
        throw new Error('maxContentLength size exceeded');
    }
    const response = {
        data,
        status: r.status,
        statusText: r.error || '',
        headers: new axios.AxiosHeaders(r.headers || {}),
        config,
        request: {},
    };
    // AxiosHeaders keeps set-cookie as an array, like the normal Node adapter
    const validate = config.validateStatus || ((s) => s >= 200 && s < 300);
    if (r.error && r.status === 413) {
        throw new axios.AxiosError(r.error, 'ERR_BAD_RESPONSE', config, {}, response);
    }
    if (!validate(r.status)) {
        throw new axios.AxiosError(`Request failed with status code ${r.status}`,
            r.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, {}, response);
    }
    return response;
}

const gemHttp = useProxy ? axios.create({ adapter: relayAdapter }) : axios.create();
gemHttp.viaRelay = useProxy;

if (useProxy) console.log('[GeM] Requests go through the GeM relay');

module.exports = { gemHttp };
