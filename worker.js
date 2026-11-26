const GITHUB_PAGES_ORIGIN = 'https://shanalpersonal-afk.github.io';

function isAllowedOrigin(origin) {
    return origin === GITHUB_PAGES_ORIGIN
        || /^http:\/\/localhost(?::\d+)?$/.test(origin || '')
        || /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin || '');
}

function jsonResponse(payload, status, origin) {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
    if (origin && isAllowedOrigin(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

        if (!isAllowedOrigin(origin)) {
            return jsonResponse({ error: 'Origin is not allowed.' }, 403, null);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                    'Vary': 'Origin'
                }
            });
        }

        if (request.method === 'POST' && requestUrl.pathname === '/ai/recommend') {
            return handleAiRecommendations(request, env, origin);
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Vary': 'Origin'
            });
            return new Response(body, { status: upstreamResponse.status, headers });
        } catch (error) {
            return jsonResponse({ error: 'TMDB request failed.' }, 502, origin);
        }
    }
};

// Ask Gemini for balanced picks using positive, saved, and negative taste signals.
async function handleAiRecommendations(request, env, origin) {
    if (!env?.GEMINI_API_KEY) {
        return jsonResponse({ error: 'GEMINI_API_KEY secret is not configured.' }, 500, origin);
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, origin);
    }
    const {
        lovedTitles = [], savedToWatch = [], dismissedTitles = [], languages = [], genres = [], subscriptions = [], excludeTitles = [], moodPrompt = ''
    } = body && typeof body === 'object' ? body : {};
    const prompt = buildAiRecommendationPrompt({ lovedTitles, savedToWatch, dismissedTitles, languages, genres, subscriptions, excludeTitles, moodPrompt });

    try {
        const upstreamResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
            })
        });
        if (!upstreamResponse.ok) {
            return jsonResponse({ error: 'The AI recommendation service could not complete the request.' }, 502, origin);
        }
        const upstreamData = await upstreamResponse.json();
        const responseText = upstreamData.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || '';
        const parsed = parseAiRecommendationJson(responseText);
        const exclusions = new Set((Array.isArray(excludeTitles) ? excludeTitles : []).map(normalizeTitleForExclude));
        const recommendations = parsed
            .filter(item => item && typeof item.title === 'string' && item.title.trim())
            .filter(item => !exclusions.has(normalizeTitleForExclude(item.title)))
            .filter(item => item.mediaType === 'movie' || item.mediaType === 'tv')
            .slice(0, 12)
            .map(item => ({
                title: item.title.trim(),
                year: String(item.year || ''),
                mediaType: item.mediaType,
                language: String(item.language || ''),
                reason: String(item.reason || 'A strong match for your viewing taste.').trim()
            }));
        return jsonResponse({ recommendations }, 200, origin);
    } catch (error) {
        return jsonResponse({ error: 'Could not read recommendations from the AI service.' }, 502, origin);
    }
}

// Build the three-bucket Gemini prompt and enforce the requested recommendation mix.
function buildAiRecommendationPrompt({ lovedTitles, savedToWatch, dismissedTitles, languages, genres, subscriptions, excludeTitles, moodPrompt }) {
    return [
        'Act as a thoughtful Indian and global streaming curator. Return exactly 12 specific movie or TV recommendations.',
        'Split the 12 into 4 direct vibe matches, 4 recent OTT releases from 2022–2026, and 4 hidden gems or cross-language picks.',
        'Balance the recommendations evenly across every chosen language. Prefer the listed subscriptions when possible.',
        'Treat lovedTitles as the strongest positive signals. Each direct vibe match reason must reference one loved title by name.',
        'Treat savedToWatch as titles the user plans to watch; use them as context without recommending them again.',
        'Treat dismissedTitles as negative signals and avoid similar tone, style, or storytelling.',
        'Avoid obvious IMDb Top-10 clichés (Inception, Dark, Parasite, Breaking Bad, 3 Idiots) unless essential to the taste match.',
        'Never repeat any excludeTitles, including alternate spellings or translations.',
        'Each reason must be a concise 10-word pitch; for direct vibe matches reference a loved title.',
        'Return only a strict JSON array. Every object must have exactly: { "title": "...", "year": "YYYY", "mediaType": "movie" | "tv", "language": "...", "reason": "..." }. No markdown.',
        `Loved titles: ${JSON.stringify(Array.isArray(lovedTitles) ? lovedTitles : [])}`,
        `Saved to watch: ${JSON.stringify(Array.isArray(savedToWatch) ? savedToWatch : [])}`,
        `Dismissed titles: ${JSON.stringify(Array.isArray(dismissedTitles) ? dismissedTitles : [])}`,
        `Languages: ${JSON.stringify(Array.isArray(languages) ? languages : [])}`,
        `Genres: ${JSON.stringify(Array.isArray(genres) ? genres : [])}`,
        `Subscriptions: ${JSON.stringify(Array.isArray(subscriptions) ? subscriptions : [])}`,
        `Mood: ${String(moodPrompt || '').slice(0, 500)}`,
        `Strict exclusions: ${JSON.stringify(Array.isArray(excludeTitles) ? excludeTitles : [])}`
    ].join('\n');
}

// Parse model text as JSON without evaluating or executing returned content.
function parseAiRecommendationJson(text) {
    const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start < 0 || end < start) throw new Error('Gemini response did not contain a JSON array.');
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error('Gemini response must be an array.');
    return parsed;
}

// Normalize title text before checking the user's exclusion list.
function normalizeTitleForExclude(value) {
    return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}
