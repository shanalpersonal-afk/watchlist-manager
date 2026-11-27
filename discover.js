// Discover feeds, taste wizard screens, and AI recommendation results.

let aiPicksCache = new Map();

function applyDiscoverPreset(preset) {
    ['genre', 'language', 'platform'].forEach(name => setMultiFilterValues('trending', name, []));
    setSinglePillSelection('trendingTypeOptions', 'trendingType', 'All');
    setSinglePillSelection('trendingFreshnessOptions', 'trendingFreshness', '6m');
    setSinglePillSelection('trendingSortOptions', 'trendingSort', 'popularity');
    if (preset === 'profile') {
        setMultiFilterValues('trending', 'platform', ['my_subs']);
        setMultiFilterValues('trending', 'language', ['my_langs']);
    } else if (preset === 'hindi') {
        setSinglePillSelection('trendingTypeOptions', 'trendingType', 'movie');
        setMultiFilterValues('trending', 'language', ['hi']);
    } else if (preset === 'korean') {
        setMultiFilterValues('trending', 'language', ['ko']);
    } else if (preset === 'netflix') {
        setMultiFilterValues('trending', 'platform', ['Netflix']);
    } else if (preset === 'prime') {
        setMultiFilterValues('trending', 'platform', ['Prime Video']);
    } else if (preset === 'comedy') {
        setMultiFilterValues('trending', 'genre', ['Comedy']);
    }
    discoverMode = preset === 'profile' ? 'profile' : (preset === 'fresh' ? 'trending' : 'custom');
    updateDiscoverFilterUI();
    resetTrendingDiscover();
}

function handleCustomDiscoverFilterChange() {
    discoverMode = 'custom';
    updateDiscoverFilterUI();
    resetTrendingDiscover();
}

function updateDiscoverFilterUI() {
    const activeClasses = ['bg-sky-500', 'text-white', 'font-bold', 'shadow-md'];
    const inactiveClasses = ['bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'font-semibold'];
    const modeButtons = document.querySelectorAll('.discover-mode-chip');
    modeButtons.forEach(button => {
        const mode = button.dataset.discoverMode || (button.dataset.discoverPreset === 'fresh' ? 'trending' : button.dataset.discoverPreset);
        const active = mode === discoverMode;
        button.classList.remove(...activeClasses, ...inactiveClasses);
        button.classList.add(...(active ? activeClasses : inactiveClasses));
        button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('aiMoodBar')?.classList.toggle('hidden', discoverMode !== 'ai');

    const labels = [];
    getMultiFilterValues('trending', 'platform').forEach(value => labels.push(value === 'my_subs' ? 'My OTTs' : value));
    getMultiFilterValues('trending', 'language').forEach(value => labels.push(value === 'my_langs' ? 'My Languages' : (LANGUAGE_NAMES[value] || value)));
    getMultiFilterValues('trending', 'genre').forEach(value => labels.push(value));
    const type = document.getElementById('trendingType')?.value || 'All';
    if (type !== 'All') labels.push(type === 'tv' ? 'TV' : 'Movies');
    if (document.getElementById('trendingFreshness')?.value === 'all') labels.push('All Time');
    if (document.getElementById('trendingSort')?.value === 'newest') labels.push('Newest');

    const filterButton = document.getElementById('openTrendingFiltersBtn');
    const count = discoverMode === 'custom' ? labels.length : 0;
    if (filterButton) filterButton.textContent = `🎛️ Filter${count ? ` (${count})` : ''}`;
    const summary = document.getElementById('discoverActiveSummary');
    const summaryText = document.getElementById('discoverActiveSummaryText');
    const showSummary = labels.length > 0 && (discoverMode === 'profile' || discoverMode === 'custom');
    summary?.classList.toggle('hidden', !showSummary);
    if (summaryText) summaryText.textContent = labels.join(' • ');
}

function initDiscoverPresets() {
    document.querySelectorAll('[data-discover-preset]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.discoverPreset === 'profile') loadPersonalizedRecommendations();
            else applyDiscoverPreset(button.dataset.discoverPreset);
        });
    });
}

async function loadAIPicksRecommendations(forceRefresh = false) {
    const shelf = document.getElementById('trendingShelf');
    if (!shelf) return;
    discoverMode = 'ai';
    updateDiscoverFilterUI();
    const requestToken = ++trendingLoadToken;
    trendingPage = 1;
    document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
    const cleanBucket = items => [...new Map(items.map(item => {
        const title = String(item.title || '').trim();
        return [title.toLocaleLowerCase(), title];
    }).filter(([key, title]) => key && title)).values()];
    const lovedTitles = cleanBucket([...(userProfile.tasteSeedMovies || []), ...currentWatchlistItems.filter(item => item.watched)]);
    const savedToWatch = cleanBucket(currentWatchlistItems.filter(item => !item.watched));
    const dismissedTitles = cleanBucket((userProfile.dismissedTitles || []).map(title => ({ title })));
    const excludeTitles = cleanBucket([...currentWatchlistItems.map(item => ({ title: item.title })), ...dismissedTitles].map(item => ({ title: item.title })));
    const moodPrompt = document.getElementById('aiMoodInput')?.value.trim() || '';
    const signature = JSON.stringify({ moodPrompt: moodPrompt.toLocaleLowerCase(), loved: lovedTitles.map(title => title.toLocaleLowerCase()).sort(), dismissed: dismissedTitles.map(title => title.toLocaleLowerCase()).sort() });
    if (forceRefresh) aiPicksCache.clear();
    if (!forceRefresh && aiPicksCache.has(signature)) {
        const cached = aiPicksCache.get(signature).filter(candidate => !isAlreadyInWatchlist(candidate) && !userProfile.dismissedIds.includes(String(candidate.id)));
        renderTrendingShelf(cached.map(candidate => ({ ...candidate })), false);
        return;
    }
    renderTrendingSkeletons(shelf);

    try {
        const workerUrl = `${String(TMDB_PROXY_URL || '').replace(/\/+$/, '')}/ai/recommend`;
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lovedTitles, savedToWatch, dismissedTitles, languages: userProfile.languages || [], genres: userProfile.genres || [], subscriptions: userProfile.subscriptions || [], excludeTitles, moodPrompt })
        });
        if (!response.ok) throw new Error('AI request failed.');
        const payload = await response.json();
        const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
        if (!recommendations.length) throw new Error('AI returned no recommendations.');

        const enrichedResults = await Promise.allSettled(recommendations.map(async recommendation => {
            const matches = await searchTMDBCandidates(String(recommendation.title || ''));
            const expectedType = recommendation.mediaType === 'tv' ? 'tv' : 'movie';
            const sameType = matches.filter(match => match.mediaType === expectedType);
            const desiredYearNumber = Number(recommendation.year || '');
            const normalizedTitle = String(recommendation.title || '').trim().toLocaleLowerCase();
            const match = sameType.slice().sort((a, b) => {
                const titleMatch = candidate => [candidate.title, candidate.originalTitle].some(value => String(value || '').trim().toLocaleLowerCase() === normalizedTitle);
                const yearDistance = candidate => Number.isFinite(desiredYearNumber) && Number.isFinite(Number(candidate.year)) ? Math.abs(Number(candidate.year) - desiredYearNumber) : Number.POSITIVE_INFINITY;
                return Number(titleMatch(b)) - Number(titleMatch(a)) || yearDistance(a) - yearDistance(b) || (b.popularity || 0) - (a.popularity || 0);
            })[0];
            return match ? { ...match, aiReason: String(recommendation.reason || '').trim() } : null;
        }));
        if (requestToken !== trendingLoadToken) return;
        const candidates = [...new Map(enrichedResults.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []).map(candidate => [`${candidate.mediaType}:${candidate.id}`, candidate])).values()]
            .filter(candidate => !isAlreadyInWatchlist(candidate) && !userProfile.dismissedIds.includes(String(candidate.id))).slice(0, 10);
        if (!candidates.length) throw new Error('AI titles could not be matched in TMDB.');
        aiPicksCache.set(signature, candidates.map(candidate => ({ ...candidate })));
            renderTrendingShelf(candidates);
        document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
        await Promise.all(candidates.map(async candidate => {
            const providers = await fetchCandidateIndiaPlatforms(candidate.mediaType, candidate.id);
            candidate.platforms = providers.platforms;
            candidate.freePlatforms = providers.freePlatforms;
            candidate.platform = providers.platform;
            if (requestToken === trendingLoadToken) updateTrendingPlatformBadge(candidate);
        }));
        aiPicksCache.set(signature, candidates.map(candidate => ({ ...candidate })));
    } catch (error) {
        if (requestToken !== trendingLoadToken) return;
        showToast('AI Picks are unavailable right now. Showing your personalized picks instead.', 'info');
        loadPersonalizedRecommendations();
    }
}

function applyProfileDefaultsToDiscover() {
    const profile = currentUser && userProfileUid === currentUser.uid ? userProfile : normalizeUserProfile(null);
    if (document.getElementById('trendingPlatformOptions')) {
        setMultiFilterValues('trending', 'platform', profile.subscriptions.length ? ['my_subs'] : []);
    }
    if (document.getElementById('trendingLanguageOptions')) {
        setMultiFilterValues('trending', 'language', profile.languages.length ? ['my_langs'] : []);
    }
    if (document.getElementById('trendingGenreOptions')) setMultiFilterValues('trending', 'genre', profile.genres || []);
    discoverMode = profile.subscriptions.length || profile.languages.length ? 'profile' : 'trending';
    updateDiscoverFilterUI();
}

async function openTasteOnboardingModal() {
    const uid = currentUser?.uid;
    if (!uid || userProfileUid !== uid) return;
    tasteSelectedLanguages = new Set(userProfile.languages || []);
    tasteSelectedGenres = new Set(userProfile.genres || []);
    tasteSelectedSeeds = new Map((userProfile.tasteSeedMovies || []).map(seed => [`${seed.mediaType}:${seed.id}`, seed]));
    tasteStepIndex = 0;
    tasteSteps = [];
    renderTasteChoicePills();
    renderTasteWizard();
    showModal('tasteOnboardingModal');
}

function buildTasteSteps() {
    const languages = [...tasteSelectedLanguages];
    const genres = [...tasteSelectedGenres];
    const fallbackLanguages = languages.length ? languages : ['en', 'hi'];
    const fallbackGenres = genres.length ? genres : ['Drama'];
    tasteSteps = fallbackLanguages.flatMap(language => fallbackGenres.map(genre => ({ language, genre })));
}

function renderTasteWizard() {
    const preferences = document.getElementById('tastePreferencesStep');
    const posters = document.getElementById('tastePosterStep');
    const isPreferences = tasteStepIndex === 0;
    preferences?.classList.toggle('hidden', !isPreferences);
    posters?.classList.toggle('hidden', isPreferences);
    document.getElementById('tasteBackBtn')?.classList.toggle('hidden', isPreferences);
    document.getElementById('tasteSkipStepBtn')?.classList.toggle('hidden', isPreferences);
    document.getElementById('tasteNextBtn')?.classList.toggle('hidden', false);
    const nextButton = document.getElementById('tasteNextBtn');
    if (nextButton) nextButton.textContent = isPreferences ? 'Next →' : (tasteStepIndex >= tasteSteps.length ? 'Finish →' : 'Next →');
    if (!isPreferences) {
        const pair = tasteSteps[tasteStepIndex - 1];
        const header = document.getElementById('tasteStepHeader');
        if (header) header.textContent = `Step ${tasteStepIndex + 1} of ${tasteSteps.length + 1} • ${LANGUAGE_NAMES[pair.language] || pair.language} • ${pair.genre}`;
        const searchInput = document.getElementById('tasteSearchInput');
        if (searchInput) {
            searchInput.value = '';
            tasteSearchToken += 1;
            clearTimeout(tasteSearchTimer);
        }
        loadTastePairPage(false);
    }
    updateTasteSaveButton();
}

function nextTasteStep() { if (tasteStepIndex === 0) buildTasteSteps(); if (tasteStepIndex >= tasteSteps.length) { saveTasteOnboarding(); return; } tasteStepIndex += 1; renderTasteWizard(); }

function previousTasteStep() { tasteStepIndex = Math.max(0, tasteStepIndex - 1); renderTasteWizard(); }

function skipTasteStep() { if (tasteStepIndex >= tasteSteps.length) return saveTasteOnboarding(); tasteStepIndex += 1; renderTasteWizard(); }

async function loadTastePairPage(append = false) {
    const pair = tasteSteps[tasteStepIndex - 1];
    if (!pair) return;
    if (!append) { tastePage = 1; tastePairItems = []; tastePairSeen = new Set(); }
    else tastePage += 1;
    const container = document.getElementById('tasteSearchResults');
    const more = document.getElementById('tasteLoadMoreBtn');
    document.getElementById('tasteLoadMoreBtn')?.classList.remove('hidden');
    if (!append && container) container.textContent = 'Loading titles…';
    if (more) more.disabled = true;
    const voteCount = ['hi', 'ta', 'te', 'ml', 'kn'].includes(pair.language) ? 5 : 20;
    try {
        const settledResults = await Promise.allSettled(['movie', 'tv'].map(async mediaType => {
            const genreId = TRENDING_GENRE_IDS[pair.genre]?.[mediaType];
            const params = new URLSearchParams({ sort_by: 'popularity.desc', with_original_language: pair.language, 'vote_count.gte': String(voteCount), page: String(tastePage) });
            if (genreId) params.set('with_genres', String(genreId));
            const response = await fetch(buildTMDBUrl(`/discover/${mediaType}`, params));
            if (!response.ok) throw new Error('TMDB discovery failed.');
            const data = await response.json();
            return (data.results || []).map(result => mapTrendingResult(result, mediaType));
        }));
        settledResults.filter(result => result.status === 'rejected').forEach(result => console.warn('A Taste Wizard media query failed.', result.reason));
        const results = settledResults.filter(result => result.status === 'fulfilled').map(result => result.value);
        if (!results.length) throw new Error('All Taste Wizard media queries failed.');
        const items = results.flat().filter(item => { const key = `${item.mediaType}:${item.id}`; if (tastePairSeen.has(key)) return false; tastePairSeen.add(key); return true; });
        tastePairItems = append ? [...tastePairItems, ...items] : items;
        renderTasteTitleGrid(tastePairItems);
        if (more) more.disabled = false;
    } catch (error) {
        if (container && !append) container.textContent = 'Titles are unavailable right now.';
        if (more) more.disabled = false;
    }
}

function renderTasteChoicePills() {
    const render = (containerId, choices, selected, onChange) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.replaceChildren();
        choices.forEach(([value, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            const active = selected.has(value);
            button.setAttribute('aria-pressed', String(active));
            button.className = `rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`;
            button.addEventListener('click', () => {
                if (selected.has(value)) selected.delete(value); else selected.add(value);
                onChange();
                renderTasteChoicePills();
            });
            container.appendChild(button);
        });
    };
    render('tasteLanguageOptions', Object.entries(LANGUAGE_NAMES), tasteSelectedLanguages, updateTasteSaveButton);
    render('tasteGenreOptions', Object.keys(TRENDING_GENRE_IDS).map(name => [name, name]), tasteSelectedGenres, updateTasteSaveButton);
}

function renderTasteTitleGrid(items) {
    const container = document.getElementById('tasteSearchResults');
    if (!container) return;
    container.replaceChildren();
    if (!items.length) {
        container.textContent = 'No titles found. Try another search.';
        return;
    }
    container.className = 'grid grid-cols-3 gap-2';
    items.forEach(item => {
        const key = `${item.mediaType}:${item.id}`;
        const selected = tasteSelectedSeeds.has(key);
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', `${selected ? 'Remove' : 'Select'} ${item.title}`);
        button.className = `relative overflow-hidden rounded-lg border-2 text-left ${selected ? 'border-sky-400 ring-2 ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.6)]' : 'border-transparent'}`;
        if (item.poster) {
            const poster = document.createElement('img');
            poster.src = item.poster.replace('/w200/', '/w500/');
            poster.alt = `Poster for ${item.title}`;
            poster.loading = 'lazy';
            poster.className = 'aspect-[2/3] w-full object-cover';
            button.appendChild(poster);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'flex aspect-[2/3] items-center justify-center bg-slate-200 text-3xl dark:bg-slate-800';
            fallback.textContent = '🎬';
            button.appendChild(fallback);
        }
        if (selected) {
            const check = document.createElement('span');
            check.textContent = '✓';
            check.className = 'absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white shadow';
            button.appendChild(check);
        }
        const label = document.createElement('span');
        label.textContent = item.title;
        label.className = 'block truncate bg-white px-1.5 py-1 text-[10px] font-semibold dark:bg-slate-900';
        button.appendChild(label);
        button.addEventListener('click', () => {
            if (tasteSelectedSeeds.has(key)) tasteSelectedSeeds.delete(key);
            else tasteSelectedSeeds.set(key, { id: item.id, mediaType: item.mediaType, title: item.title, poster: item.poster || null });
            renderTasteTitleGrid(items);
            updateTasteSaveButton();
        });
        container.appendChild(button);
    });
}

function updateTasteSaveButton() {
    const count = tasteSelectedSeeds.size;
    const button = document.getElementById('saveTasteProfileBtn');
    const label = document.getElementById('tasteSelectionCount');
    if (label) label.textContent = `${count} titles selected`;
    if (button) { button.textContent = `✨ Finish & Show Picks (${count} selected)`; button.classList.toggle('bg-amber-500', count >= 5); button.classList.toggle('bg-slate-300', count < 5); }
}

async function saveTasteOnboarding() {
    if (!currentUser) return;
    userProfile.languages = [...tasteSelectedLanguages];
    userProfile.genres = [...tasteSelectedGenres];
    userProfile.tasteSeedMovies = [...tasteSelectedSeeds.values()].slice(0, 20);
    userProfile.hasCompletedTasteOnboarding = true;
    trackEvent('taste_wizard_completed');
    try { localStorage.setItem(`watchlist_taste_done_${currentUser.uid}`, 'true'); } catch (error) { /* Keep completion in the profile. */ }
    await persistUserProfileSilently();
    hideModal('tasteOnboardingModal');
    applyProfileDefaultsToDiscover();
    switchView('add');
    loadPersonalizedRecommendations();
    showToast('Taste profile saved. Your picks are ready.', 'success');
}

async function completeTasteOnboarding() {
    if (!currentUser) return;
    userProfile.hasCompletedTasteOnboarding = true;
    try { localStorage.setItem(`watchlist_taste_done_${currentUser.uid}`, 'true'); } catch (error) { /* Keep completion in the profile. */ }
    await persistUserProfileSilently();
    hideModal('tasteOnboardingModal');
}

function mapTrendingResult(result, mediaType = result.media_type) {
    const languageCode = result.original_language;
    const genreId = result.genre_ids?.[0];
    return {
        id: result.id,
        mediaType,
        title: result.title || result.name,
        year: (result.release_date || result.first_air_date || '').split('-')[0] || 'N/A',
        rating: result.vote_average ? result.vote_average.toFixed(1) : 'N/A',
        language: languageCode ? (LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase()) : 'Unknown Language',
        genre: genreId ? (TMDB_GENRES[genreId] || 'General') : 'General',
        poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
        overview: result.overview || '',
        popularity: result.popularity || 0,
        sortDate: result.release_date || result.first_air_date || ''
    };
}

function formatTrendingDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function resetTrendingDiscover() {
    trendingPage = 1;
    displayedTrendingIds.clear();
    document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
    loadTrendingDiscover();
}

async function loadPersonalizedRecommendations() {
    const shelf = document.getElementById('trendingShelf');
    if (!shelf) return;
    discoverMode = 'profile';
    updateDiscoverFilterUI();
    const savedItems = [
        ...currentWatchlistItems.filter(item => item.watched && item.tmdbId),
        ...currentWatchlistItems.filter(item => !item.watched && item.tmdbId)
    ].map(item => ({ id: item.tmdbId, mediaType: item.type === 'tv' ? 'tv' : 'movie', title: item.title, poster: item.poster }));
    const seeds = [];
    const seenSeeds = new Set();
    [...savedItems, ...(userProfile.tasteSeedMovies || [])].forEach(seed => {
        const key = `${seed.mediaType}:${seed.id}`;
        if (seed.id && !seenSeeds.has(key) && seeds.length < 3) {
            seenSeeds.add(key);
            seeds.push(seed);
        }
    });
    if (!seeds.length) {
        applyProfileDefaultsToDiscover();
        discoverMode = 'profile';
        updateDiscoverFilterUI();
        resetTrendingDiscover();
        return;
    }

    const requestToken = ++trendingLoadToken;
    trendingPage = 1;
    document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
    renderTrendingSkeletons(shelf);
    try {
        const results = await Promise.allSettled(seeds.map(async seed => {
            const response = await fetch(buildTMDBUrl(`/${seed.mediaType}/${seed.id}/recommendations`, { page: '1' }));
            if (!response.ok) throw new Error(`TMDB recommendations returned ${response.status}.`);
            const data = await response.json();
            return (data.results || []).map(result => mapTrendingResult(result, seed.mediaType));
        }));
        if (requestToken !== trendingLoadToken) return;
        const merged = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        const unique = [...new Map(merged.map(candidate => [`${candidate.mediaType}:${candidate.id}`, candidate])).values()]
            .filter(candidate => !isAlreadyInWatchlist(candidate) && !userProfile.dismissedIds.includes(String(candidate.id)))
            .slice(0, 12);
        renderTrendingShelf(unique);
        document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
        await Promise.all(unique.map(async candidate => {
            const providers = await fetchCandidateIndiaPlatforms(candidate.mediaType, candidate.id);
            candidate.platforms = providers.platforms;
            candidate.freePlatforms = providers.freePlatforms;
            candidate.platform = providers.platform;
            if (requestToken === trendingLoadToken) updateTrendingPlatformBadge(candidate);
        }));
    } catch (error) {
        if (requestToken === trendingLoadToken) shelf.textContent = 'Could not load personalized recommendations right now.';
    }
}

function loadMoreTrending() {
    trendingPage += 1;
    loadTrendingDiscover();
}

async function loadTrendingDiscover() {
    const shelf = document.getElementById('trendingShelf');
    const button = document.getElementById('loadTrendingBtn');
    const loadMoreButton = document.getElementById('loadMoreTrendingBtn');
    if (!shelf) return;

    const type = document.getElementById('trendingType')?.value || 'All';
    const selectedGenres = getMultiFilterValues('trending', 'genre');
    const selectedLanguages = getMultiFilterValues('trending', 'language');
    const selectedPlatforms = getMultiFilterValues('trending', 'platform');
    const freshness = document.getElementById('trendingFreshness')?.value || '6m';
    const sort = document.getElementById('trendingSort')?.value || 'popularity';
    const profile = currentUser && userProfileUid === currentUser.uid ? userProfile : normalizeUserProfile(null);
    const page = trendingPage;
    const append = page > 1;
    const profileCacheKey = `${profile.subscriptions.join(',')}|${profile.languages.join(',')}`;
    const cacheKey = `${type}|${selectedGenres.slice().sort().join(',')}|${selectedLanguages.slice().sort().join(',')}|${selectedPlatforms.slice().sort().join(',')}|${freshness}|${sort}|${profileCacheKey}|${page}`;
    const requestToken = ++trendingLoadToken;

    if (trendingCache.has(cacheKey)) {
        if (button) button.disabled = false;
        if (loadMoreButton) loadMoreButton.disabled = false;
        const cachedCandidates = trendingCache.get(cacheKey).filter(candidate =>
            !isAlreadyInWatchlist(candidate) && !profile.dismissedIds.includes(String(candidate.id)) && (!append || !displayedTrendingIds.has(String(candidate.id)))
        );
        renderTrendingShelf(cachedCandidates, append);
        cachedCandidates.filter(candidate => !candidate.platform).forEach(candidate => {
            fetchCandidateIndiaPlatforms(candidate.mediaType, candidate.id).then(providers => {
                candidate.platforms = providers.platforms;
                candidate.freePlatforms = providers.freePlatforms;
                candidate.platform = providers.platform;
                updateTrendingPlatformBadge(candidate);
            });
        });
        return;
    }

    if (button) button.disabled = true;
    if (loadMoreButton) loadMoreButton.disabled = true;
    if (!append) {
        shelf.replaceChildren();
        renderTrendingSkeletons(shelf);
    }
    try {
        const wantsMySubs = selectedPlatforms.includes('my_subs');
        const platformNames = [...new Set([
            ...selectedPlatforms.filter(value => value !== 'my_subs'),
            ...(wantsMySubs ? profile.subscriptions : [])
        ])];
        let providerIds = '';
        if (platformNames.length > 0) {
            const providerMap = await fetchIndiaWatchProviderMap();
            providerIds = [...new Set(platformNames.flatMap(service =>
                (providerMap.get(normalizePlatformName(service)) || '').split('|').filter(Boolean)
            ))].join('|');
            if (!providerIds) {
                trendingCache.set(cacheKey, []);
                if (requestToken === trendingLoadToken) renderTrendingShelf([], append);
                return;
            }
        }

        const mediaTypes = type === 'All' ? ['movie', 'tv'] : [type];
        const todayDate = new Date();
        const sixMonthsAgo = new Date(todayDate.getFullYear(), todayDate.getMonth() - 6, 1);
        const lastDayOfStartMonth = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1, 0).getDate();
        sixMonthsAgo.setDate(Math.min(todayDate.getDate(), lastDayOfStartMonth));
        const today = formatTrendingDate(todayDate);
        const startDate = formatTrendingDate(sixMonthsAgo);
        const twelveMonthsAgo = new Date(todayDate.getFullYear(), todayDate.getMonth() - 12, 1);
        const lastDayOfTwelveMonthStart = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + 1, 0).getDate();
        twelveMonthsAgo.setDate(Math.min(todayDate.getDate(), lastDayOfTwelveMonthStart));
        const twelveMonthStartDate = formatTrendingDate(twelveMonthsAgo);

        const languages = [...new Set([
            ...selectedLanguages.filter(value => value !== 'my_langs'),
            ...(selectedLanguages.includes('my_langs') ? profile.languages : [])
        ])];
        if (languages.length === 0) languages.push('All');
        const indianLanguages = new Set(['hi', 'ta', 'te', 'ml', 'kn']);
        const lowerVoteCount = languages.some(language => indianLanguages.has(language));
        const freshnessNote = document.getElementById('discoverFreshnessNote');
        if (freshnessNote) { freshnessNote.textContent = ''; freshnessNote.classList.add('hidden'); }
        let widenedForResults = false;
        const queryJobs = mediaTypes.flatMap(mediaType => languages.map(languageCode => ({ mediaType, languageCode })));
        const settledResultSets = await Promise.allSettled(queryJobs.map(async ({ mediaType, languageCode }) => {
            const fetchWindow = async months => {
                const params = new URLSearchParams({
                    watch_region: 'IN', with_watch_monetization_types: 'flatrate',
                    'vote_count.gte': freshness === '6m' && lowerVoteCount ? '1' : '10',
                    sort_by: sort === 'newest' ? (mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc') : 'popularity.desc'
                });
                params.set('page', String(page));
                if (providerIds) params.set('with_watch_providers', providerIds);
                const genreIds = [...new Set(selectedGenres.flatMap(genreName => { const genreId = TRENDING_GENRE_IDS[genreName]?.[mediaType]; return genreId ? [String(genreId)] : []; }))];
                if (genreIds.length) params.set('with_genres', genreIds.join('|'));
                if (languageCode !== 'All') params.set('with_original_language', languageCode);
                if (freshness === '6m') {
                    const windowStart = months === 12 ? twelveMonthStartDate : startDate;
                    if (mediaType === 'movie') {
                        params.set('primary_release_date.gte', windowStart);
                        params.set('primary_release_date.lte', today);
                    } else {
                        params.set('first_air_date.gte', windowStart);
                        params.set('first_air_date.lte', today);
                    }
                }
                const response = await fetch(buildTMDBUrl(`/discover/${mediaType}`, params));
                if (!response.ok) throw new Error(`TMDB ${mediaType} discover returned ${response.status}.`);
                const data = await response.json();
                return (data.results || []).map(result => mapTrendingResult(result, mediaType));
            };
            let candidates = await fetchWindow(6);
            if (freshness === '6m' && candidates.length < 6) {
                candidates = await fetchWindow(12);
                widenedForResults = true;
            }
            return { languageCode, candidates };
        }));
        const resultSets = settledResultSets.filter(result => result.status === 'fulfilled').map(result => result.value);
        settledResultSets.filter(result => result.status === 'rejected').forEach(result => console.warn('A Discover media query failed.', result.reason));
        if (!resultSets.length) throw new Error('All India Discover queries failed.');
        if (widenedForResults && freshnessNote) {
            freshnessNote.textContent = 'Expanded to last 12 months for more results';
            freshnessNote.classList.remove('hidden');
        }

        const sortCandidates = candidates => candidates.sort((a, b) => sort === 'newest'
            ? (Date.parse(b.sortDate) || 0) - (Date.parse(a.sortDate) || 0)
            : b.popularity - a.popularity);
        let candidates;
        if (languages.length > 1) {
            const byLanguage = new Map();
            resultSets.forEach(({ languageCode, candidates: results }) => {
                if (!byLanguage.has(languageCode)) byLanguage.set(languageCode, []);
                byLanguage.get(languageCode).push(...results);
            });
            const languageQueues = [...byLanguage.values()].map(queue => queue.sort((a, b) => b.popularity - a.popularity));
            candidates = [];
            const seenIds = new Set();
            while (candidates.length < 12 && languageQueues.some(queue => queue.length)) {
                languageQueues.forEach(queue => {
                    while (queue.length && candidates.length < 12) {
                        const candidate = queue.shift();
                        const id = String(candidate.id);
                        if (seenIds.has(id) || displayedTrendingIds.has(id) || isAlreadyInWatchlist(candidate) || profile.dismissedIds.includes(id)) continue;
                        seenIds.add(id);
                        candidates.push(candidate);
                        break;
                    }
                });
            }
        } else {
            candidates = sortCandidates(resultSets.flatMap(resultSet => resultSet.candidates));
            candidates = [...new Map(candidates.map(candidate => [`${candidate.mediaType}:${candidate.id}`, candidate])).values()];
            candidates = candidates.filter(candidate => !displayedTrendingIds.has(String(candidate.id)) && !isAlreadyInWatchlist(candidate) && !profile.dismissedIds.includes(String(candidate.id))).slice(0, 12);
        }

        trendingCache.set(cacheKey, candidates);
        if (platformNames.length === 1 && !wantsMySubs) {
            candidates.forEach(candidate => {
                candidate.platform = platformNames[0];
                candidate.platforms = [platformNames[0]];
            });
        }
        if (requestToken === trendingLoadToken) renderTrendingShelf(candidates, append);
        {
            Promise.all(candidates.map(async candidate => {
                const providers = await fetchCandidateIndiaPlatforms(candidate.mediaType, candidate.id);
                candidate.platforms = providers.platforms;
                candidate.freePlatforms = providers.freePlatforms;
                const normalizedAvailable = providers.platforms.map(normalizePlatformName);
                const preferredPlatform = wantsMySubs
                    ? profile.subscriptions.find(subscription => normalizedAvailable.includes(normalizePlatformName(subscription)))
                    : platformNames.find(subscription => normalizedAvailable.includes(normalizePlatformName(subscription)));
                candidate.platform = preferredPlatform ? normalizePlatformName(preferredPlatform) : providers.platform;
                if (requestToken === trendingLoadToken) updateTrendingPlatformBadge(candidate);
            })).then(() => trendingCache.set(cacheKey, candidates));
        }
    } catch (error) {
        if (requestToken === trendingLoadToken) {
            if (!append) shelf.textContent = `Could not load India discovery: ${error.message}`;
            else console.warn('Could not load more India discovery results.', error);
        }
    } finally {
        if (requestToken === trendingLoadToken && button) button.disabled = false;
        if (requestToken === trendingLoadToken && loadMoreButton) loadMoreButton.disabled = false;
    }
}

function renderTrendingSkeletons(shelf) {
    shelf.replaceChildren();
    for (let index = 0; index < 6; index += 1) {
        const card = document.createElement('div');
        card.className = 'overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950';
        card.innerHTML = '<div class="aspect-[2/3] animate-pulse bg-slate-200 dark:bg-slate-800"></div><div class="space-y-2 p-2"><div class="h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div><div class="h-2 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div></div>';
        shelf.appendChild(card);
    }
}

function updateTrendingPlatformBadge(candidate) {
    const card = [...document.querySelectorAll('#trendingShelf article')].find(item => item.dataset.tmdbId === String(candidate.id));
    const badge = card?.querySelector('[data-platform-badge]');
    if (!badge) return;
    const isFree = !(candidate.platforms || []).length && (candidate.freePlatforms || []).length > 0;
    const platform = candidate.platform || 'Not Streaming in IN';
    badge.textContent = isFree ? `🆓 ${platform}` : platform;
    badge.className = `absolute top-2 right-2 max-w-[85%] truncate rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-md ${isFree ? 'bg-emerald-600' : getPlatformBadgeClass(platform)}`;
}

function renderTrendingShelf(candidates, append = false) {
    const shelf = document.getElementById('trendingShelf');
    const loadMoreButton = document.getElementById('loadMoreTrendingBtn');
    if (!shelf) return;
    if (!append) {
        shelf.replaceChildren();
        displayedTrendingIds.clear();
    }
    if (candidates.length === 0) {
        if (!shelf.children.length) shelf.textContent = 'No new titles found for these filters.';
        if (loadMoreButton) loadMoreButton.classList.add('hidden');
        return;
    }
    candidates.forEach(candidate => {
        displayedTrendingIds.add(String(candidate.id));
        const card = document.createElement('article');
        card.dataset.tmdbId = String(candidate.id);
        card.className = 'overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950';
        const posterFrame = document.createElement('div');
        posterFrame.className = 'relative aspect-[2/3] cursor-pointer';
        posterFrame.addEventListener('click', () => openDetailPreview(candidate));
        if (candidate.poster) {
            const poster = document.createElement('img');
            poster.src = candidate.poster;
            poster.alt = `Poster for ${candidate.title}`;
            poster.loading = 'lazy';
            poster.className = 'h-full w-full object-cover';
            posterFrame.appendChild(poster);
        } else {
            const fallback = document.createElement('div');
            fallback.textContent = '🎬';
            fallback.className = 'flex h-full items-center justify-center bg-slate-200 dark:bg-slate-900 text-3xl';
            posterFrame.appendChild(fallback);
        }
        const platformBadge = document.createElement('span');
        const candidatePlatform = candidate.platform || '…';
        platformBadge.dataset.platformBadge = 'true';
        platformBadge.textContent = candidatePlatform;
        platformBadge.className = `absolute top-2 right-2 max-w-[85%] truncate rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-md ${candidate.platform ? getPlatformBadgeClass(candidatePlatform) : 'bg-slate-700/70'}`;
        if (!(candidate.platforms || []).length && (candidate.freePlatforms || []).length) {
            platformBadge.textContent = `🆓 ${candidate.platform || `Free: ${candidate.freePlatforms[0]}`}`;
            platformBadge.className = 'absolute right-2 top-2 max-w-[85%] truncate rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-md';
        }
        posterFrame.appendChild(platformBadge);
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = '✕';
        dismiss.setAttribute('aria-label', `Hide ${candidate.title}`);
        dismiss.className = 'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/70 text-xs text-white/80 hover:bg-rose-600';
        dismiss.addEventListener('click', event => { event.stopPropagation(); dismissRecommendation(candidate.id, candidate.title); });
        posterFrame.appendChild(dismiss);
        card.appendChild(posterFrame);

        const body = document.createElement('div');
        body.className = 'p-2';
        const title = document.createElement('h3');
        title.textContent = candidate.title;
        title.title = candidate.title;
        title.className = 'truncate text-xs font-bold text-slate-900 dark:text-slate-100';
        const type = document.createElement('span');
        type.textContent = candidate.mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie';
        type.className = 'mt-1 inline-flex rounded-full bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-[9px] font-bold text-sky-700 dark:text-sky-300';
        const metadata = document.createElement('p');
        metadata.textContent = `${candidate.year} · ⭐ ${candidate.rating}`;
        metadata.className = 'mt-1 text-[10px] text-slate-500 dark:text-slate-400';
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white shadow-lg hover:bg-sky-600 disabled:opacity-80';
        const saved = isAlreadyInWatchlist(candidate);
        add.textContent = saved ? '✓' : '+';
        add.setAttribute('aria-label', saved ? 'Already saved' : `Add ${candidate.title} to watchlist`);
        add.disabled = saved;
        add.addEventListener('click', async event => {
            event.stopPropagation();
            try {
                const didSave = await saveCandidateToWatchlist(candidate, add);
                add.textContent = '✓';
                add.setAttribute('aria-label', 'Saved');
                add.disabled = true;
                if (didSave) showToast(`Added ${candidate.title}.`);
            } catch (error) {
                showToast(`Could not add title: ${error.message}`, 'error');
            }
        });
        posterFrame.appendChild(add);
        body.append(title, type, metadata);
        card.appendChild(body);
        shelf.appendChild(card);
    });
    if (loadMoreButton) loadMoreButton.classList.remove('hidden');
}
