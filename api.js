// TMDB requests, provider lookups, and shared title cleanup.

function buildTMDBUrl(endpointPath, queryParams = {}) {
    if (!TMDB_PROXY_URL || TMDB_PROXY_URL === 'YOUR_CLOUDFLARE_WORKER_URL') {
        const message = 'TMDB proxy is not configured. Deploy worker.js and set tmdbProxyUrl in config.js.';
        console.error(message);
        if (!tmdbProxyAlertShown) {
            showToast(message, 'error');
            tmdbProxyAlertShown = true;
        }
        throw new Error(message);
    }
    const normalizedEndpoint = `/${String(endpointPath).replace(/^\/+/, '').replace(/^3\//, '')}`;
    const params = queryParams instanceof URLSearchParams ? new URLSearchParams(queryParams) : new URLSearchParams();
    if (!(queryParams instanceof URLSearchParams)) {
        Object.entries(queryParams || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) params.set(key, String(value));
        });
    }
    params.delete('api_key');
    const baseUrl = TMDB_PROXY_URL.replace(/\/+$/, '');
    const query = params.toString();
    return `${baseUrl}/3${normalizedEndpoint}${query ? `?${query}` : ''}`;
}

function normalizePlatformName(name) {
    if (!name) return 'Not Streaming in IN';
    const lower = name.toLowerCase();
    if (lower.includes('amazon prime') || lower.includes('prime video')) return 'Prime Video';
    if (lower.includes('disney') || lower.includes('hotstar')) return 'Disney+ Hotstar';
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('jio')) return 'JioCinema';
    if (lower.includes('zee5')) return 'Zee5';
    if (lower.includes('sonyliv')) return 'SonyLIV';
    return name;
}

function getPlatformBadgeClass(platform) {
    if (!platform) return 'bg-slate-700';
    const p = platform.toLowerCase();
    if (p.includes('netflix')) return 'badge-netflix';
    if (p.includes('prime')) return 'badge-prime';
    if (p.includes('hotstar') || p.includes('disney')) return 'badge-hotstar';
    if (p.includes('jio')) return 'badge-jiocinema';
    return 'bg-slate-700';
}

async function fetchIndiaWatchProviderMap() {
    if (!indiaWatchProviderMapPromise) {
        indiaWatchProviderMapPromise = (async () => {
            const response = await fetch(buildTMDBUrl('/watch/providers/movie', { watch_region: 'IN' }));
            if (!response.ok) throw new Error(`TMDB provider lookup returned ${response.status}.`);
            const data = await response.json();
            const providerIdsByName = new Map();

            (data.results || []).forEach(provider => {
                const normalizedName = normalizePlatformName(provider.provider_name);
                if (!providerIdsByName.has(normalizedName)) providerIdsByName.set(normalizedName, new Set());
                providerIdsByName.get(normalizedName).add(String(provider.provider_id));
            });

            return new Map([...providerIdsByName.entries()].map(([name, ids]) => [name, [...ids].join('|')]));
        })().catch(error => {
            console.warn('Could not load TMDB India watch providers.', error);
            return new Map();
        });
    }
    return indiaWatchProviderMapPromise;
}

async function fetchCandidateIndiaPlatforms(mediaType, id) {
    try {
        const response = await fetch(buildTMDBUrl(`/${mediaType}/${id}/watch/providers`));
        if (!response.ok) throw new Error(`TMDB provider lookup returned ${response.status}.`);
        const data = await response.json();
        const indiaProviders = data.results?.IN || {};
        const platforms = [...new Set((indiaProviders.flatrate || []).map(provider => normalizePlatformName(provider.provider_name)))];
        const freePlatforms = [...new Set([...(indiaProviders.free || []), ...(indiaProviders.ads || [])].map(provider => normalizePlatformName(provider.provider_name)))];
        return { platforms, freePlatforms, platform: platforms[0] || (freePlatforms.length ? `Free: ${freePlatforms[0]}` : 'Not Streaming in IN') };
    } catch (error) {
        console.warn(`Could not load India platforms for ${mediaType} ${id}.`, error);
        return { platforms: [], freePlatforms: [], platform: 'Not Streaming in IN' };
    }
}

async function searchTMDBCandidates(query) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const response = await fetch(buildTMDBUrl('/search/multi', { query: cleanQuery }));
    if (!response.ok) throw new Error(`TMDB search failed (${response.status}).`);
    const data = await response.json();
    const normalizedQuery = cleanQuery.toLocaleLowerCase();

    return (data.results || [])
        .filter(result => result.media_type === 'movie' || result.media_type === 'tv')
        .sort((a, b) => {
            const aExact = [a.title, a.name, a.original_title, a.original_name]
                .some(title => title && title.trim().toLocaleLowerCase() === normalizedQuery);
            const bExact = [b.title, b.name, b.original_title, b.original_name]
                .some(title => title && title.trim().toLocaleLowerCase() === normalizedQuery);
            return Number(bExact) - Number(aExact) || (b.popularity || 0) - (a.popularity || 0);
        })
        .slice(0, 4)
        .map(result => {
            const languageCode = result.original_language;
            const genreId = result.genre_ids?.[0];
            return {
                id: result.id,
                mediaType: result.media_type,
                title: result.title || result.name,
                year: (result.release_date || result.first_air_date || '').split('-')[0] || 'N/A',
                rating: result.vote_average ? result.vote_average.toFixed(1) : 'N/A',
                language: languageCode ? (LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase()) : 'Unknown Language',
                genre: genreId ? (TMDB_GENRES[genreId] || 'General') : 'General',
                poster: result.poster_path ? `https://image.tmdb.org/t/p/w200${result.poster_path}` : null,
                overview: result.overview || '',
                popularity: result.popularity || 0
            };
        });
}

async function fetchTMDBDetails(queryTitle) {
    const cleanTitle = queryTitle.trim();
    try {
        const searchRes = await fetch(buildTMDBUrl('/search/multi', { query: cleanTitle }));
        const searchData = await searchRes.json();
        const results = (searchData.results || []).filter(result => result.media_type === 'movie' || result.media_type === 'tv');
        const normalizedTitle = cleanTitle.toLocaleLowerCase();
        const exactMatch = results.find(result => [
            result.title,
            result.name,
            result.original_title,
            result.original_name
        ].some(candidate => candidate && candidate.trim().toLocaleLowerCase() === normalizedTitle));
        const match = exactMatch || results.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
        const mediaType = match?.media_type;

        if (match) {
            const displayTitle = match.title || match.name;
            const releaseYear = (match.release_date || match.first_air_date || '').split('-')[0] || 'N/A';
            const posterUrl = match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null;
            const ratingVal = match.vote_average ? match.vote_average.toFixed(1) : 'N/A';
            
            // Language Extraction
            const langCode = match.original_language;
            const languageName = langCode ? (LANGUAGE_NAMES[langCode] || langCode.toUpperCase()) : 'Unknown Language';

            let primaryGenre = match.genre_ids ? (TMDB_GENRES[match.genre_ids[0]] || 'General') : 'General';

            let indiaPlatforms = [];
            let freePlatforms = [];
            try {
                const providerRes = await fetch(buildTMDBUrl(`/${mediaType}/${match.id}/watch/providers`));
                const providerData = await providerRes.json();
                const indiaProviders = providerData.results?.IN || {};
                indiaPlatforms = [...new Set((indiaProviders.flatrate || []).map(p => normalizePlatformName(p.provider_name)))];
                freePlatforms = [...new Set([...(indiaProviders.free || []), ...(indiaProviders.ads || [])].map(p => normalizePlatformName(p.provider_name)))];
            } catch (e) {}

            return {
                valid: true,
                title: displayTitle,
                type: mediaType,
                typeLabel: mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie',
                year: releaseYear,
                genre: primaryGenre,
                rating: ratingVal,
                language: languageName, // Saves original language name
                platform: indiaPlatforms[0] || (freePlatforms.length ? `Free: ${freePlatforms[0]}` : 'Not Streaming in IN'),
                platforms: indiaPlatforms,
                freePlatforms,
                poster: posterUrl,
                overview: match.overview || ''
            };
        }
    } catch (err) {}
    return { valid: false, error: `Could not find "${cleanTitle}".` };
}

function extractTitlesFromSocialText(rawText) {
    const titles = [];
    const seenTitles = new Set();
    const socialFiller = /\b(follow for more|save this|link in bio|subscribe|comment below|must[ -]?watch|top\s*(?:5|10))\b/i;
    const ctaPhrases = /\b(follow for more|save this(?: for later)?|link in bio|subscribe(?: now)?|comment below)\b/i;
    const trailingService = /\s*(?:\||—|–|-)?\s*(?:on\s+)?(?:Amazon\s+Prime\s+Video|Prime\s+Video|Netflix|Disney\+\s*Hotstar|Disney\+|Hotstar|JioCinema|Zee5|SonyLIV)\s*$/i;
    const trailingParenthetical = /\s*\((?:19\d{2}|20\d{2}|Netflix|Amazon\s+Prime\s+Video|Prime\s+Video|Disney\+\s*Hotstar|Disney\+|Hotstar|JioCinema|Zee5|SonyLIV|Hindi|English|Korean|Tamil|Telugu|Japanese)\)\s*$/i;

    String(rawText || '').split(/\r?\n/).forEach(rawLine => {
        let line = rawLine
            .replace(/https?:\/\/\S+/gi, ' ')
            .replace(/#\p{L}[\p{L}\p{N}_]*/gu, ' ')
            .replace(/[0-9#*]\uFE0F?\u20E3/gu, ' ')
            .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D]/gu, ' ')
            .replace(/^\s*(?:(?:[-*•>]+)|(?:\d{1,3}[.)]))\s*/, '')
            .trim();

        if (line.length <= 1) return;

        const titleSeparator = line.match(/^(.*?)\s*(?::|->|→|—|–|-)\s+(.+)$/);
        if (titleSeparator && socialFiller.test(titleSeparator[1])) {
            line = titleSeparator[2].trim();
        } else if (socialFiller.test(line)) {
            return;
        }

        line = line.replace(/\s*(?:[,;|—–-]\s*)?(?:follow for more|save this(?: for later)?|link in bio|subscribe(?: now)?|comment below)\b.*$/i, '');
        line = line.replace(/\s*(?:[-|—–]\s*)?(?:now streaming|streaming on|available on|watch on)\b.*$/i, '');
        line = line.replace(/\s+[—–]\s+(?:a must watch|must[ -]?watch|highly recommended|(?:a |an )?(?:masterpiece|amazing|great|incredible|mind[- ]blowing)|worth watching|hidden gem|best movie|best series)\b.*$/i, '');
        for (let pass = 0; pass < 3; pass += 1) {
            const cleanedLine = line
                .replace(trailingService, '')
                .replace(trailingParenthetical, '')
                .replace(/\s*(?:[-|—–]\s*)(?:19\d{2}|20\d{2})\s*$/i, '')
                .replace(/\s*(?:[-|—–]\s*)(?:Hindi|English|Korean|Tamil|Telugu|Japanese)\s*$/i, '')
                .trim();
            if (cleanedLine === line) break;
            line = cleanedLine;
        }

        line = line.replace(/^[\s:;,.!?]+|[\s:;,.!?]+$/g, '').trim();
        if (line.length <= 1) return;

        const duplicateKey = line.toLocaleLowerCase();
        if (!seenTitles.has(duplicateKey)) {
            seenTitles.add(duplicateKey);
            titles.push(line);
        }
    });

    return titles;
}

const TMDB_GENRES = {
    10759: "Action & Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 10762: "Kids", 
    9648: "Mystery", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
    10766: "Soap", 10767: "Talk", 10768: "War & Politics", 37: "Western",
    28: "Action", 12: "Adventure", 14: "Fantasy", 36: "History", 
    27: "Horror", 10402: "Music", 10749: "Romance", 878: "Sci-Fi", 
    10770: "TV Movie", 53: "Thriller", 10752: "War"
};

const LANGUAGE_NAMES = {
    en: "English", hi: "Hindi", ko: "Korean", ta: "Tamil", te: "Telugu",
    ml: "Malayalam", kn: "Kannada", es: "Spanish", fr: "French", ja: "Japanese"
};

const TMDB_PROXY_URL = window.APP_CONFIG?.tmdbProxyUrl;
let tmdbProxyAlertShown = false;
