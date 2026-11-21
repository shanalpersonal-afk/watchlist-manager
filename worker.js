const ALLOWED_ORIGINS = new Set([
    'https://erson-afk.github.io',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
]);

function jsonResponse(payload, status, origin) {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        headers.set('Access-Control-Max-Age', '86400');
        headers.set('Vary', 'Origin');
    }
    return new Response(JSON.stringify(payload), { status, headers });
}

export default {
    async fetch(request, env) {
        const requestUrl = new URL(request.url);
        const origin = request.headers.get('Origin');

        if (!origin || !ALLOWED_ORIGINS.has(origin)) {
            return jsonResponse({ error: 'Origin is not allowed.' }, 403, null);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                    'Vary': 'Origin'
                }
            });
        }

        if (request.method !== 'GET') {
            return jsonResponse({ error: 'Only GET requests are supported.' }, 405, origin);
        }

        const allowedPath = /^\/3\/(search|discover|watch|movie|tv)\//.test(requestUrl.pathname);
        if (!allowedPath) {
            return jsonResponse({ error: 'TMDB endpoint is not allowed.' }, 403, origin);
        }

        if (!env?.TMDB_API_KEY) {
            return jsonResponse({ error: 'TMDB API key is not configured on the Worker.' }, 500, origin);
        }

        const upstreamUrl = new URL(`https://api.themoviedb.org${requestUrl.pathname}`);
        requestUrl.searchParams.forEach((value, key) => {
            if (key.toLowerCase() !== 'api_key') upstreamUrl.searchParams.append(key, value);
        });
        upstreamUrl.searchParams.set('api_key', env.TMDB_API_KEY);

        try {
            const upstreamResponse = await fetch(upstreamUrl.toString());
            const body = await upstreamResponse.text();
            const headers = new Headers({
                'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Vary': 'Origin'
            });
            return new Response(body, { status: upstreamResponse.status, headers });
        } catch (error) {
            return jsonResponse({ error: 'TMDB request failed.' }, 502, origin);
        }
    }
};
