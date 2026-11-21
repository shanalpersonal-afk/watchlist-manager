// ==========================================
// 1. Firebase Configuration & Initialization
// ==========================================
// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

if (!window.APP_CONFIG) {
    console.error('Application configuration is missing. Make sure config.js loads before app.js.');
}

const firebaseConfig = window.APP_CONFIG?.firebaseConfig;
const TMDB_API_KEY = window.APP_CONFIG?.tmdbApiKey;

if (typeof firebase !== 'undefined' && firebaseConfig && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const firebaseReady = typeof firebase !== 'undefined' && firebase.apps.length > 0;
const db = firebaseReady ? firebase.firestore() : null;
const auth = firebaseReady ? firebase.auth() : null;

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

let unsubscribeWatchlist = null;
let currentWatchlistItems = [];
let currentUser = null;
const selectedDocIds = new Set();
let renderedDocIds = new Set();
let activeTourStep = -1;
let tourOpenedBulkPanel = false;
let tourOpenedFilterDrawer = false;
let tourTarget = null;
let tourOriginalStyles = null;
let tourStartingView = null;
let currentViewName = 'library';
let bulkReviewItems = [];
let bulkUploadCounts = { added: 0, skipped: 0, notFound: 0, processed: 0, total: 0, failures: 0 };
let isManageMode = false;
let onlyWatchableNow = false;
let pendingWatchableActivation = false;
let trendingLoadToken = 0;
const trendingCache = new Map();
let indiaWatchProviderMapPromise = null;
const OTT_SERVICES = ['Netflix', 'Prime Video', 'Disney+ Hotstar', 'JioCinema', 'Zee5', 'SonyLIV'];
const TRENDING_GENRE_IDS = {
    Action: { movie: 28, tv: 10759 },
    Comedy: { movie: 35, tv: 35 },
    Drama: { movie: 18, tv: 18 },
    Crime: { movie: 80, tv: 80 },
    Thriller: { movie: 53, tv: 9648 },
    Romance: { movie: 10749, tv: 10749 },
    'Sci-Fi': { movie: 878, tv: 10765 },
    Horror: { movie: 27, tv: 9648 },
    Animation: { movie: 16, tv: 16 },
    Documentary: { movie: 99, tv: 99 }
};

const WATCHLIST_TOUR_STEPS = [
    { selector: '#navLibraryBtn', title: 'My Library', description: 'Your saved movies and shows live in your personal library.' },
    { selector: '#filterDrawer', title: 'Filter your library', description: 'Filter, sort, or group your saved titles. On a phone, the filter drawer opens for this step.' },
    { selector: '#primaryGroupSelect', title: 'Group your titles', description: 'Choose a primary group to arrange your library into collapsible sections.' },
    { selector: '#navAddBtn', title: 'Add Titles', description: 'Open Add Titles to search TMDB and add a specific movie or show.' },
    { selector: '#candidateSearchInput', title: 'Smart Title Search', description: 'Search once and pick the correct movie or TV show from the best matches.' },
    { selector: '#bulkUploadToggle', title: 'Bulk Upload', description: 'Add several titles at once by entering one title per line.' }
];

// ==========================================
// 2. Auth State & Lifecycle Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.addEventListener('click', loginWithGoogle);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', logoutUser);

    const startTourBtn = document.getElementById('startTourBtn');
    if (startTourBtn) startTourBtn.addEventListener('click', startWatchlistTour);
    const tourNextBtn = document.getElementById('tourNextBtn');
    if (tourNextBtn) tourNextBtn.addEventListener('click', advanceWatchlistTour);
    const tourSkipBtn = document.getElementById('tourSkipBtn');
    if (tourSkipBtn) tourSkipBtn.addEventListener('click', endWatchlistTour);
    document.getElementById('candidateSearchBtn')?.addEventListener('click', searchCandidateInput);
    document.getElementById('candidateSearchInput')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchCandidateInput();
        }
    });
    document.getElementById('openSubscriptionsBtn')?.addEventListener('click', openSubscriptionsModal);
    document.getElementById('closeSubscriptionsBtn')?.addEventListener('click', closeSubscriptionsModal);
    document.getElementById('saveSubscriptionsBtn')?.addEventListener('click', saveSubscriptions);
    document.getElementById('subscriptionsModal')?.addEventListener('click', event => {
        if (event.target.id === 'subscriptionsModal') closeSubscriptionsModal();
    });
    document.getElementById('trendingPanel')?.addEventListener('toggle', event => {
        if (event.currentTarget.open) loadTrendingDiscover();
    });
    initLibraryPreferences();
    updateWatchableNowButton();
    switchView('library');
    window.addEventListener('resize', positionTourTooltip);
    window.addEventListener('scroll', positionTourTooltip, { passive: true });

    if (auth) {
        auth.onAuthStateChanged(user => {
            const splash = document.getElementById('splashScreen');
            const dashboard = document.getElementById('appDashboard');
            
            if (user) {
                currentUser = user;
                if (splash) splash.classList.add('hidden');
                if (dashboard) dashboard.classList.remove('hidden');

                document.getElementById('userNameDisplay').textContent = user.displayName || user.email;
                if (user.photoURL) document.getElementById('userAvatar').src = user.photoURL;

                setupFirebaseListener();
            } else {
                currentUser = null;
                if (unsubscribeWatchlist) {
                    unsubscribeWatchlist();
                    unsubscribeWatchlist = null;
                }
                currentWatchlistItems = [];
                selectedDocIds.clear();
                renderWatchlist();
                if (splash) splash.classList.remove('hidden');
                if (dashboard) dashboard.classList.add('hidden');
            }
        });
    }
});

function startWatchlistTour() {
    endWatchlistTour();
    tourStartingView = currentViewName;
    activeTourStep = 0;
    showWatchlistTourStep();
}

function showWatchlistTourStep() {
    const step = WATCHLIST_TOUR_STEPS[activeTourStep];
    const tooltip = document.getElementById('tourTooltip');
    if (!step || !tooltip) return endWatchlistTour();

    if (tourTarget && tourOriginalStyles) {
        Object.assign(tourTarget.style, tourOriginalStyles);
    }
    tourTarget = document.querySelector(step.selector);
    if (!tourTarget) return advanceWatchlistTour();

    const targetView = tourTarget.closest('#libraryView, #addView');
    if (tourTarget.id === 'navLibraryBtn') switchView('library');
    else if (tourTarget.id === 'navAddBtn') switchView('add');
    else if (targetView) switchView(targetView.id === 'addView' ? 'add' : 'library');

    if (step.selector === '#bulkUploadToggle') {
        const panel = tourTarget.closest('details');
        if (panel && !panel.open) {
            tourOpenedBulkPanel = true;
            panel.open = true;
        }
    }

    tourOriginalStyles = {
        outline: tourTarget.style.outline,
        outlineOffset: tourTarget.style.outlineOffset,
        position: tourTarget.style.position,
        zIndex: tourTarget.style.zIndex
    };
    tourTarget.style.outline = '3px solid #38bdf8';
    tourTarget.style.outlineOffset = '4px';
    if (getComputedStyle(tourTarget).position === 'static') tourTarget.style.position = 'relative';
    tourTarget.style.zIndex = '40';

    const filterDrawer = document.getElementById('filterDrawer');
    if ((step.selector === '#filterDrawer' || tourTarget.id === 'primaryGroupSelect') && filterDrawer?.classList.contains('hidden')) {
        tourOpenedFilterDrawer = true;
        filterDrawer.classList.remove('hidden');
        filterDrawer.classList.add('grid');
    }

    document.getElementById('tourStepCount').textContent = `Step ${activeTourStep + 1} of ${WATCHLIST_TOUR_STEPS.length}`;
    document.getElementById('tourTitle').textContent = step.title;
    document.getElementById('tourDescription').textContent = step.description;
    const nextButton = document.getElementById('tourNextBtn');
    nextButton.textContent = activeTourStep === WATCHLIST_TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
    tooltip.classList.remove('hidden');

    tourTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    window.setTimeout(positionTourTooltip, 350);
}

function positionTourTooltip() {
    if (activeTourStep < 0 || !tourTarget) return;
    const tooltip = document.getElementById('tourTooltip');
    if (!tooltip || tooltip.classList.contains('hidden')) return;

    const targetRect = tourTarget.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const left = Math.max(margin, Math.min(targetRect.left, window.innerWidth - tooltipRect.width - margin));
    const topBelow = targetRect.bottom + margin;
    const top = topBelow + tooltipRect.height <= window.innerHeight - margin
        ? topBelow
        : Math.max(margin, targetRect.top - tooltipRect.height - margin);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function advanceWatchlistTour() {
    activeTourStep += 1;
    if (activeTourStep >= WATCHLIST_TOUR_STEPS.length) {
        endWatchlistTour();
        return;
    }
    showWatchlistTourStep();
}

function endWatchlistTour() {
    if (tourTarget && tourOriginalStyles) {
        Object.assign(tourTarget.style, tourOriginalStyles);
    }
    const tooltip = document.getElementById('tourTooltip');
    if (tooltip) {
        tooltip.classList.add('hidden');
        tooltip.style.left = '';
        tooltip.style.top = '';
    }
    if (tourOpenedBulkPanel) {
        const panel = document.getElementById('bulkUploadToggle')?.closest('details');
        if (panel) panel.open = false;
    }
    if (tourOpenedFilterDrawer) {
        const drawer = document.getElementById('filterDrawer');
        drawer?.classList.add('hidden');
        drawer?.classList.remove('grid');
    }
    if (tourStartingView) switchView(tourStartingView);

    activeTourStep = -1;
    tourTarget = null;
    tourOriginalStyles = null;
    tourOpenedBulkPanel = false;
    tourOpenedFilterDrawer = false;
    tourStartingView = null;
}

function switchView(viewName) {
    if (viewName !== 'library' && viewName !== 'add') return;
    currentViewName = viewName;
    document.getElementById('libraryView')?.classList.toggle('hidden', viewName !== 'library');
    document.getElementById('addView')?.classList.toggle('hidden', viewName !== 'add');

    const activeClasses = ['bg-sky-500', 'text-white', 'border-sky-500'];
    const inactiveClasses = ['bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-300', 'dark:border-slate-800', 'hover:border-sky-400'];
    [['navLibraryBtn', 'library'], ['navAddBtn', 'add']].forEach(([buttonId, buttonView]) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.classList.remove(...activeClasses, ...inactiveClasses);
        button.classList.add(...(buttonView === viewName ? activeClasses : inactiveClasses));
        button.setAttribute('aria-current', buttonView === viewName ? 'page' : 'false');
    });

    const nextHash = viewName === 'library' ? '#library' : '#add';
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

function initLibraryPreferences() {
    const primary = document.getElementById('primaryGroupSelect');
    const secondary = document.getElementById('secondaryGroupSelect');
    if (!primary || !secondary) return;

    let savedPrimary = 'status';
    let savedSecondary = 'platform';
    try {
        savedPrimary = localStorage.getItem('watchlist_primary_group') || savedPrimary;
        savedSecondary = localStorage.getItem('watchlist_secondary_group') || savedSecondary;
    } catch (error) {
        console.warn('Could not load saved grouping preferences.', error);
    }

    primary.value = [...primary.options].some(option => option.value === savedPrimary) ? savedPrimary : 'status';
    secondary.value = [...secondary.options].some(option => option.value === savedSecondary) ? savedSecondary : 'platform';
}

function saveGroupingPreferencesAndRender() {
    const primary = document.getElementById('primaryGroupSelect');
    const secondary = document.getElementById('secondaryGroupSelect');
    try {
        if (primary) localStorage.setItem('watchlist_primary_group', primary.value);
        if (secondary) localStorage.setItem('watchlist_secondary_group', secondary.value);
    } catch (error) {
        console.warn('Could not save grouping preferences.', error);
    }
    renderWatchlist();
}

function toggleSearchPanel() {
    const panel = document.getElementById('searchBarPanel');
    const button = document.getElementById('toggleSearchBtn');
    if (!panel) return;
    const isOpening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isOpening);
    if (button) button.setAttribute('aria-expanded', String(isOpening));
    if (isOpening) document.getElementById('searchQuery')?.focus();
}

function toggleFilterDrawer() {
    const drawer = document.getElementById('filterDrawer');
    const button = document.getElementById('toggleFilterDrawerBtn');
    if (!drawer) return;
    const isOpening = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !isOpening);
    drawer.classList.toggle('grid', isOpening);
    if (button) button.setAttribute('aria-expanded', String(isOpening));
}

function toggleManageMode() {
    isManageMode = !isManageMode;
    const actions = document.getElementById('batchActionsBar');
    const button = document.getElementById('toggleManageBtn');
    if (actions) actions.classList.toggle('hidden', !isManageMode);
    if (button) {
        button.setAttribute('aria-pressed', String(isManageMode));
        button.classList.toggle('bg-sky-500', isManageMode);
        button.classList.toggle('text-white', isManageMode);
        button.classList.toggle('border-sky-500', isManageMode);
    }
    if (!isManageMode) selectedDocIds.clear();
    renderWatchlist();
}

function getSubscriptionStorageKey() {
    return `watchlist_subs_${currentUser?.uid || 'guest'}`;
}

function getUserSubscriptions() {
    try {
        const saved = JSON.parse(localStorage.getItem(getSubscriptionStorageKey()) || '[]');
        return Array.isArray(saved) ? saved.filter(service => OTT_SERVICES.includes(service)) : [];
    } catch (error) {
        return [];
    }
}

function openSubscriptionsModal() {
    const subscriptions = new Set(getUserSubscriptions());
    document.querySelectorAll('#subscriptionsModal [data-subscription]').forEach(input => {
        input.checked = subscriptions.has(input.dataset.subscription);
    });
    document.getElementById('subscriptionsModal')?.classList.remove('hidden');
}

function closeSubscriptionsModal() {
    document.getElementById('subscriptionsModal')?.classList.add('hidden');
    pendingWatchableActivation = false;
}

function saveSubscriptions() {
    const subscriptions = [...document.querySelectorAll('#subscriptionsModal [data-subscription]:checked')]
        .map(input => input.dataset.subscription);
    try {
        localStorage.setItem(getSubscriptionStorageKey(), JSON.stringify(subscriptions));
    } catch (error) {
        alert('Could not save your subscriptions in this browser.');
        return;
    }

    document.getElementById('subscriptionsModal')?.classList.add('hidden');
    if (pendingWatchableActivation) onlyWatchableNow = subscriptions.length > 0;
    else if (subscriptions.length === 0) onlyWatchableNow = false;
    pendingWatchableActivation = false;
    updateWatchableNowButton();
    renderWatchlist();
}

function updateWatchableNowButton() {
    const button = document.getElementById('watchableNowBtn');
    if (!button) return;
    button.setAttribute('aria-pressed', String(onlyWatchableNow));
    button.classList.toggle('ring-2', onlyWatchableNow);
    button.classList.toggle('ring-emerald-400', onlyWatchableNow);
}

function toggleWatchableNow() {
    if (!onlyWatchableNow && getUserSubscriptions().length === 0) {
        pendingWatchableActivation = true;
        openSubscriptionsModal();
        return;
    }
    onlyWatchableNow = !onlyWatchableNow;
    updateWatchableNowButton();
    renderWatchlist();
}

function getItemPlatforms(item) {
    return Array.isArray(item.platforms) && item.platforms.length > 0
        ? item.platforms
        : [item.platform].filter(Boolean);
}

function itemIsOnSubscribedOTT(item, subscriptions = getUserSubscriptions()) {
    const normalizedSubscriptions = new Set(subscriptions.map(normalizePlatformName));
    return getItemPlatforms(item).some(platform => normalizedSubscriptions.has(normalizePlatformName(platform)));
}

function loginWithGoogle() {
    if (!auth) {
        alert("Firebase Auth SDK is not available.");
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        alert(`Auth Error: ${error.message}`);
    });
}

function logoutUser() {
    if (auth) auth.signOut();
}

function setupFirebaseListener() {
    if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
    }
    if (db && currentUser) {
        unsubscribeWatchlist = db.collection('watchlist')
            .where('userId', '==', currentUser.uid)
            .onSnapshot(snapshot => {
                currentWatchlistItems = [];
                snapshot.forEach(doc => {
                    currentWatchlistItems.push({ docId: doc.id, ...doc.data() });
                });
                const existingIds = new Set(currentWatchlistItems.map(item => item.docId));
                selectedDocIds.forEach(docId => {
                    if (!existingIds.has(docId)) selectedDocIds.delete(docId);
                });
                populateFilterDropdowns();
                renderWatchlist();
            });
    }
}

function getWatchlist() {
    return currentWatchlistItems;
}

function getItemLanguage(item) {
    return item.language || 'Unknown Language';
}

function getGroupKey(item, groupBy) {
    switch (groupBy) {
        case 'platform':
            return normalizePlatformName((item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform);
        case 'genre':
            return item.genre || 'Unknown Genre';
        case 'language':
            return getItemLanguage(item);
        case 'type':
            return item.type === 'tv' ? 'TV Shows' : 'Movies';
        case 'status':
            return item.watched ? 'Watched' : 'To Watch';
        default:
            return '';
    }
}

// ==========================================
// 3. Theme Switcher & UI Helpers
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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

function populateFilterDropdowns() {
    const items = getWatchlist();
    
    // Genres
    const genreSelect = document.getElementById('filterGenre');
    if (genreSelect) {
        const selectedGenre = genreSelect.value;
        const genres = [...new Set(items.map(i => i.genre).filter(Boolean))].sort();
        genreSelect.innerHTML = '<option value="All">All Genres</option>';
        genres.forEach(g => { genreSelect.innerHTML += `<option value="${g}">${g}</option>`; });
        genreSelect.value = [...genreSelect.options].some(option => option.value === selectedGenre) ? selectedGenre : 'All';
    }

    // Languages (Populates dynamically!)
    const langSelect = document.getElementById('filterLanguage');
    if (langSelect) {
        const selectedLanguage = langSelect.value;
        const languages = [...new Set(items.map(getItemLanguage))].sort((a, b) => {
            if (a === 'Unknown Language') return 1;
            if (b === 'Unknown Language') return -1;
            return a.localeCompare(b);
        });
        langSelect.innerHTML = '<option value="All">All Languages</option>';
        languages.forEach(l => { langSelect.innerHTML += `<option value="${l}">${l}</option>`; });
        langSelect.value = [...langSelect.options].some(option => option.value === selectedLanguage) ? selectedLanguage : 'All';
    }

    // Platforms
    const platformSelect = document.getElementById('filterPlatform');
    if (platformSelect) {
        const selectedPlatform = platformSelect.value;
        const allPlatforms = items.flatMap(i => i.platforms || [i.platform]).filter(Boolean);
        const uniquePlatforms = [...new Set(allPlatforms.map(normalizePlatformName))].sort();
        platformSelect.innerHTML = '<option value="All">All Platforms</option>';
        uniquePlatforms.forEach(p => { platformSelect.innerHTML += `<option value="${p}">${p}</option>`; });
        platformSelect.value = [...platformSelect.options].some(option => option.value === selectedPlatform) ? selectedPlatform : 'All';
    }
}

// ==========================================
// 4. TMDB Details & Rendering Engine
// ==========================================
async function fetchTMDBDetails(queryTitle) {
    const cleanTitle = queryTitle.trim();
    try {
        const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
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
            try {
                const providerRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${match.id}/watch/providers?api_key=${TMDB_API_KEY}`);
                const providerData = await providerRes.json();
                if (providerData.results && providerData.results.IN && providerData.results.IN.flatrate) {
                    const rawPlatforms = providerData.results.IN.flatrate.map(p => p.provider_name);
                    indiaPlatforms = [...new Set(rawPlatforms.map(normalizePlatformName))];
                }
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
                platform: indiaPlatforms[0] || 'Not Streaming in IN',
                platforms: indiaPlatforms,
                poster: posterUrl
            };
        }
    } catch (err) {}
    return { valid: false, error: `Could not find "${cleanTitle}".` };
}

async function searchTMDBCandidates(query) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQuery)}`);
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
                popularity: result.popularity || 0
            };
        });
}

function isAlreadyInWatchlist(candidate) {
    const candidateTitle = candidate.title.trim().toLocaleLowerCase();
    const candidateYear = String(candidate.year || 'N/A');
    return currentWatchlistItems.some(item =>
        (item.tmdbId !== undefined && String(item.tmdbId) === String(candidate.id)) ||
        ((item.title || '').trim().toLocaleLowerCase() === candidateTitle && String(item.year || 'N/A') === candidateYear)
    );
}

function renderCandidateResults(candidates) {
    const container = document.getElementById('candidateResults');
    if (!container) return;
    container.replaceChildren();

    if (candidates.length === 0) {
        container.textContent = 'No movie or TV show matches found.';
        container.className = 'mt-4 text-sm text-slate-500 dark:text-slate-400';
        return;
    }
    container.className = 'mt-4 grid gap-3';

    candidates.forEach(candidate => {
        const card = document.createElement('article');
        card.className = 'flex flex-col sm:flex-row gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3';

        if (candidate.poster) {
            const poster = document.createElement('img');
            poster.src = candidate.poster;
            poster.alt = `Poster for ${candidate.title}`;
            poster.loading = 'lazy';
            poster.className = 'h-32 w-24 rounded object-cover';
            card.appendChild(poster);
        } else {
            const posterFallback = document.createElement('div');
            posterFallback.textContent = '🎬';
            posterFallback.className = 'flex h-32 w-24 shrink-0 items-center justify-center rounded bg-slate-200 dark:bg-slate-800 text-3xl';
            card.appendChild(posterFallback);
        }

        const details = document.createElement('div');
        details.className = 'flex min-w-0 flex-1 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center';
        const info = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = candidate.title;
        title.className = 'font-bold text-slate-900 dark:text-slate-100';
        const typeBadge = document.createElement('span');
        typeBadge.textContent = candidate.mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie';
        typeBadge.className = 'mt-1 inline-flex rounded-full bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300';
        const metadata = document.createElement('p');
        metadata.textContent = `${candidate.year} · ${candidate.language} · ⭐ ${candidate.rating} · ${candidate.genre}`;
        metadata.className = 'mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400';
        info.append(title, typeBadge, metadata);

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.dataset.tmdbId = String(candidate.id);
        addButton.dataset.mediaType = candidate.mediaType;
        addButton.className = 'shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:cursor-default disabled:opacity-70';
        const alreadySaved = isAlreadyInWatchlist(candidate);
        addButton.textContent = alreadySaved ? '✓ Already Saved' : '+ Add to Watchlist';
        addButton.disabled = alreadySaved;
        addButton.addEventListener('click', async () => {
            try {
                const saved = await saveCandidateToWatchlist(candidate, addButton);
                if (!saved) {
                    addButton.disabled = true;
                    addButton.textContent = '✓ Already Saved';
                }
            } catch (error) {
                alert(`Could not add title: ${error.message}`);
            }
        });
        details.append(info, addButton);
        card.appendChild(details);
        container.appendChild(card);
    });
}

async function searchCandidateInput() {
    const input = document.getElementById('candidateSearchInput');
    const button = document.getElementById('candidateSearchBtn');
    const container = document.getElementById('candidateResults');
    const query = input?.value.trim() || '';
    if (!container) return;
    if (!query) {
        container.textContent = 'Enter a title to search.';
        return;
    }

    if (button) button.disabled = true;
    container.className = 'mt-4 text-sm text-slate-500 dark:text-slate-400';
    container.textContent = 'Searching TMDB...';
    try {
        renderCandidateResults(await searchTMDBCandidates(query));
    } catch (error) {
        container.textContent = `Could not search TMDB: ${error.message}`;
    } finally {
        if (button) button.disabled = false;
    }
}

async function fetchIndiaProviders(mediaType, tmdbId) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
        const data = await response.json();
        const rawProviders = data.results?.IN?.flatrate?.map(provider => provider.provider_name) || [];
        const platforms = [...new Set(rawProviders.map(normalizePlatformName))];
        return { platforms, platform: platforms[0] || 'Not Streaming in IN' };
    } catch (error) {
        return { platforms: [], platform: 'Not Streaming in IN' };
    }
}

async function saveCandidateToWatchlist(candidate, button = null) {
    const user = currentUser;
    if (!user || !db) {
        throw new Error('Please sign in before adding titles.');
    }
    if (isAlreadyInWatchlist(candidate)) return false;
    if (button) {
        button.disabled = true;
        button.textContent = 'Adding...';
    }

    try {
        const providers = await fetchIndiaProviders(candidate.mediaType, candidate.id);
        if (currentUser?.uid !== user.uid) throw new Error('Your sign-in changed. Please search again.');
        await db.collection('watchlist').add({
            tmdbId: candidate.id,
            type: candidate.mediaType,
            typeLabel: candidate.mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie',
            title: candidate.title,
            year: candidate.year,
            genre: candidate.genre,
            rating: candidate.rating,
            language: candidate.language,
            poster: candidate.poster,
            platform: providers.platform,
            platforms: providers.platforms,
            watched: false,
            addedBy: user.displayName || user.email,
            userId: user.uid
        });
        if (button) button.textContent = '✓ Added';
        return true;
    } catch (error) {
        if (button) {
            button.disabled = false;
            button.textContent = '+ Add to Watchlist';
        }
        throw error;
    }
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
        poster: result.poster_path ? `https://image.tmdb.org/t/p/w200${result.poster_path}` : null,
        popularity: result.popularity || 0,
        sortDate: result.release_date || result.first_air_date || ''
    };
}

// Provider lookup: fetch India service IDs once and combine normalized aliases.
async function fetchIndiaWatchProviderMap() {
    if (!indiaWatchProviderMapPromise) {
        indiaWatchProviderMapPromise = (async () => {
            const response = await fetch(`https://api.themoviedb.org/3/watch/providers/movie?api_key=${TMDB_API_KEY}&watch_region=IN`);
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

// Date helper: format dates using the browser's local calendar for the India window.
function formatTrendingDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function loadTrendingDiscover() {
    const shelf = document.getElementById('trendingShelf');
    const button = document.getElementById('loadTrendingBtn');
    if (!shelf) return;

    const type = document.getElementById('trendingType')?.value || 'All';
    const genre = document.getElementById('trendingGenre')?.value || 'All';
    const language = document.getElementById('trendingLanguage')?.value || 'All';
    const platform = document.getElementById('trendingPlatform')?.value || 'All';
    const freshness = document.getElementById('trendingFreshness')?.value || '6m';
    const sort = document.getElementById('trendingSort')?.value || 'popularity';
    const cacheKey = `${type}|${genre}|${language}|${platform}|${freshness}|${sort}`;
    const requestToken = ++trendingLoadToken;

    if (trendingCache.has(cacheKey)) {
        if (button) button.disabled = false;
        renderTrendingShelf(trendingCache.get(cacheKey));
        return;
    }

    if (button) button.disabled = true;
    shelf.textContent = 'Loading titles available in India...';
    try {
        let providerIds = null;
        if (platform !== 'All') {
            const providerMap = await fetchIndiaWatchProviderMap();
            providerIds = providerMap.get(normalizePlatformName(platform));
            if (!providerIds) {
                trendingCache.set(cacheKey, []);
                if (requestToken === trendingLoadToken) renderTrendingShelf([]);
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

        const resultSets = await Promise.all(mediaTypes.map(async mediaType => {
            const params = new URLSearchParams({
                api_key: TMDB_API_KEY,
                watch_region: 'IN',
                with_watch_monetization_types: 'flatrate',
                'vote_count.gte': '5',
                sort_by: sort === 'newest'
                    ? (mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc')
                    : 'popularity.desc'
            });
            if (platform !== 'All') params.set('with_watch_providers', providerIds);

            const genreId = genre !== 'All' ? TRENDING_GENRE_IDS[genre]?.[mediaType] : null;
            if (genreId) params.set('with_genres', String(genreId));
            if (language !== 'All') params.set('with_original_language', language);

            if (freshness === '6m') {
                if (mediaType === 'movie') {
                    params.set('region', 'IN');
                    params.set('with_release_type', '4');
                    params.set('release_date.gte', startDate);
                    params.set('release_date.lte', today);
                } else {
                    params.set('air_date.gte', startDate);
                    params.set('air_date.lte', today);
                }
            }

            const response = await fetch(`https://api.themoviedb.org/3/discover/${mediaType}?${params.toString()}`);
            if (!response.ok) throw new Error(`TMDB ${mediaType} discover returned ${response.status}.`);
            const data = await response.json();
            return (data.results || []).map(result => mapTrendingResult(result, mediaType));
        }));

        let candidates = resultSets.flat();
        candidates.sort((a, b) => sort === 'newest'
            ? (Date.parse(b.sortDate) || 0) - (Date.parse(a.sortDate) || 0)
            : b.popularity - a.popularity);
        candidates = candidates.slice(0, 12);
        trendingCache.set(cacheKey, candidates);
        if (requestToken === trendingLoadToken) renderTrendingShelf(candidates);
    } catch (error) {
        if (requestToken === trendingLoadToken) shelf.textContent = `Could not load India discovery: ${error.message}`;
    } finally {
        if (requestToken === trendingLoadToken && button) button.disabled = false;
    }
}

function renderTrendingShelf(candidates) {
    const shelf = document.getElementById('trendingShelf');
    if (!shelf) return;
    shelf.replaceChildren();
    if (candidates.length === 0) {
        shelf.textContent = 'No titles found for these filters.';
        return;
    }

    candidates.forEach(candidate => {
        const card = document.createElement('article');
        card.className = 'overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950';
        if (candidate.poster) {
            const poster = document.createElement('img');
            poster.src = candidate.poster;
            poster.alt = `Poster for ${candidate.title}`;
            poster.loading = 'lazy';
            poster.className = 'h-40 w-full object-cover';
            card.appendChild(poster);
        } else {
            const fallback = document.createElement('div');
            fallback.textContent = '🎬';
            fallback.className = 'flex h-40 items-center justify-center bg-slate-200 dark:bg-slate-900 text-3xl';
            card.appendChild(fallback);
        }

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
        add.className = 'mt-2 w-full rounded bg-sky-500 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-sky-600 disabled:opacity-70';
        const saved = isAlreadyInWatchlist(candidate);
        add.textContent = saved ? '✓ Saved' : '+ Add';
        add.disabled = saved;
        add.addEventListener('click', async () => {
            try {
                const didSave = await saveCandidateToWatchlist(candidate, add);
                add.textContent = didSave ? '✓ Added' : '✓ Saved';
                add.disabled = true;
            } catch (error) {
                alert(`Could not add title: ${error.message}`);
            }
        });
        body.append(title, type, metadata, add);
        card.appendChild(body);
        shelf.appendChild(card);
    });
}

function updateBulkStatus() {
    const statusText = document.getElementById('bulkStatusText');
    if (!statusText) return;
    const { added, skipped, notFound, processed, total, failures } = bulkUploadCounts;
    const summary = `Added: ${added} • Already Saved: ${skipped} • Needs Review: ${bulkReviewItems.length} • Not Found: ${notFound}`;
    statusText.textContent = total && processed < total
        ? `${summary} • Processing: ${processed}/${total}${failures ? ` • Failed: ${failures}` : ''}`
        : `${summary}${failures ? ` • Failed: ${failures}` : ''}`;
}

function renderBulkReviewContainer() {
    const container = document.getElementById('bulkReviewContainer');
    if (!container) return;
    container.replaceChildren();
    container.classList.toggle('hidden', bulkReviewItems.length === 0);
    if (bulkReviewItems.length === 0) {
        updateBulkStatus();
        return;
    }

    const heading = document.createElement('h3');
    heading.textContent = 'Review these matches';
    heading.className = 'text-sm font-bold text-slate-800 dark:text-slate-100';
    container.appendChild(heading);

    bulkReviewItems.forEach(review => {
        const row = document.createElement('div');
        row.className = 'rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3';
        const query = document.createElement('p');
        query.textContent = `Choose the right match for “${review.query}”`;
        query.className = 'mb-2 text-xs font-bold text-slate-800 dark:text-slate-100';
        row.appendChild(query);

        const choices = document.createElement('div');
        choices.className = 'flex flex-wrap gap-2';
        review.candidates.forEach(candidate => {
            const choice = document.createElement('button');
            choice.type = 'button';
            choice.className = 'flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-left text-xs hover:border-sky-400 disabled:opacity-70';
            choice.textContent = `+ ${candidate.title} (${candidate.year}, ${candidate.mediaType === 'tv' ? 'TV' : 'Movie'})`;
            choice.addEventListener('click', async () => {
                choice.disabled = true;
                choice.textContent = `Adding ${candidate.title}...`;
                try {
                    const saved = await saveCandidateToWatchlist(candidate, choice);
                    if (!saved) {
                        choice.textContent = `✓ ${candidate.title} — Already Saved`;
                        return;
                    }
                    bulkReviewItems = bulkReviewItems.filter(item => item !== review);
                    bulkUploadCounts.added += 1;
                    renderBulkReviewContainer();
                } catch (error) {
                    choice.disabled = false;
                    choice.textContent = `+ ${candidate.title} (${candidate.year})`;
                    alert(`Could not add title: ${error.message}`);
                }
            });
            choices.appendChild(choice);
        });
        row.appendChild(choices);
        container.appendChild(row);
    });
    updateBulkStatus();
}

function renderWatchlist() {
    const container = document.getElementById('watchlistDisplay');
    if (!container) return;

    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase().trim() || '';
    const filterType = document.getElementById('filterType')?.value || 'All';
    const filterPlatform = document.getElementById('filterPlatform')?.value || 'All';
    const filterGenre = document.getElementById('filterGenre')?.value || 'All';
    const filterLanguage = document.getElementById('filterLanguage')?.value || 'All';
    const sortBy = document.getElementById('sortBy')?.value || 'default';
    const primaryGroup = document.getElementById('primaryGroupSelect')?.value || 'none';
    const secondaryGroup = document.getElementById('secondaryGroupSelect')?.value || 'none';

    container.innerHTML = '';
    renderedDocIds = new Set();
    if (currentWatchlistItems.length === 0) {
        container.innerHTML = `
            <div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-12 text-center">
                <p class="text-lg font-bold text-slate-800 dark:text-slate-100">Your library is ready for its first title.</p>
                <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Search for a movie or show and add it to your watchlist.</p>
                <button type="button" onclick="switchView('add')" class="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">Find a title</button>
            </div>`;
        updateBatchActionUI();
        return;
    }
    let items = getWatchlist();

    if (searchQuery !== '') items = items.filter(i => i.title.toLowerCase().includes(searchQuery));
    if (filterType !== 'All') items = items.filter(i => i.type === filterType);
    if (filterPlatform !== 'All') items = items.filter(i => (i.platforms || [i.platform]).map(normalizePlatformName).includes(filterPlatform));
    if (filterGenre !== 'All') items = items.filter(i => i.genre === filterGenre);
    if (filterLanguage !== 'All') items = items.filter(i => getItemLanguage(i) === filterLanguage);
    if (onlyWatchableNow) {
        const subscriptions = getUserSubscriptions();
        if (subscriptions.length === 0) {
            onlyWatchableNow = false;
            updateWatchableNowButton();
        } else {
            items = items.filter(item => itemIsOnSubscribedOTT(item, subscriptions));
        }
    }

    if (sortBy === 'rating-desc') items.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    if (sortBy === 'title-asc') items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'title-desc') items.sort((a, b) => (b.title || '').localeCompare(a.title || ''));

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400 font-medium">No matching titles found.</div>`;
        updateBatchActionUI();
        return;
    }

    const activeGroups = [...new Set([primaryGroup, secondaryGroup].filter(group => group !== 'none'))];
    if (activeGroups.length === 0) {
        renderGroupCards(container, items);
    } else if (activeGroups.length === 1) {
        renderGroupedCards(container, items, activeGroups[0]);
    } else {
        renderGroupedCards(container, items, primaryGroup, secondaryGroup);
    }
    updateBatchActionUI();
}

function renderGroupedCards(parentContainer, items, primaryGroup, secondaryGroup = null) {
    const groupItems = (groupBy, groupedItems) => {
        const groups = new Map();
        groupedItems.forEach(item => {
            const key = getGroupKey(item, groupBy);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });
        return [...groups.entries()].sort(([a], [b]) => {
            if (groupBy === 'status') {
                const statusOrder = { 'To Watch': 0, Watched: 1 };
                return (statusOrder[a] ?? 2) - (statusOrder[b] ?? 2) || a.localeCompare(b);
            }
            return a.localeCompare(b);
        });
    };

    const makeSection = (label, level) => {
        const section = document.createElement('details');
        section.open = label !== 'Watched';
        section.className = level === 1 ? 'group-section mb-4' : 'group-section ml-3 mb-3';
        const heading = document.createElement('summary');
        heading.className = 'cursor-pointer select-none font-bold text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 mb-2';
        heading.textContent = label;
        section.appendChild(heading);
        return section;
    };

    groupItems(primaryGroup, items).forEach(([primaryKey, primaryItems]) => {
        const primarySection = makeSection(primaryKey, 1);
        if (secondaryGroup) {
            groupItems(secondaryGroup, primaryItems).forEach(([secondaryKey, secondaryItems]) => {
                const secondarySection = makeSection(secondaryKey, 2);
                renderGroupCards(secondarySection, secondaryItems);
                primarySection.appendChild(secondarySection);
            });
        } else {
            renderGroupCards(primarySection, primaryItems);
        }
        parentContainer.appendChild(primarySection);
    });
}

function renderGroupCards(parentContainer, items) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 my-2';

    items.forEach(item => {
        renderedDocIds.add(item.docId);
        const card = document.createElement('div');
        card.className = `movie-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-sky-400 ${item.watched ? 'opacity-50' : ''}`;
        
        const mainPlatform = normalizePlatformName((item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform);
        const badgeClass = getPlatformBadgeClass(mainPlatform);
        const posterHtml = item.poster ? `<img src="${item.poster}" class="w-full h-44 object-cover">` : `<div class="w-full h-44 bg-slate-200 dark:bg-slate-950 flex items-center justify-center text-3xl">🎬</div>`;

        const needsMetadata = !item.language || !item.rating || item.rating === 'N/A';
        const onYourOTT = itemIsOnSubscribedOTT(item);
        card.innerHTML = `
            <div class="relative">
                ${posterHtml}
                <span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full text-white uppercase shadow-md ${badgeClass}">${mainPlatform}</span>
                <span class="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-950/80 text-amber-300 backdrop-blur-sm">⭐ ${item.rating || 'N/A'}</span>
        ${isManageMode ? `<label class="absolute top-2 left-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-slate-950/80" title="Select ${item.title}">
                    <input type="checkbox" aria-label="Select ${item.title}" ${selectedDocIds.has(item.docId) ? 'checked' : ''} onchange="toggleItemSelection('${item.docId}', this.checked)" class="accent-sky-500">
                </label>` : ''}
                ${needsMetadata ? `<button title="Refresh metadata" aria-label="Refresh metadata for ${item.title}" class="absolute top-2 left-11 w-7 h-7 rounded-full bg-slate-950/80 text-white hover:bg-sky-600" onclick="refreshMetadata('${item.docId}')">↻</button>` : ''}
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 ${item.watched ? 'line-through text-slate-400' : ''}">${item.title}</h4>
                    <div class="text-xs text-slate-500 dark:text-slate-400 space-x-2 mt-1">
                        <span>🌐 ${item.language || 'Unknown Language'}</span>
                        <span>🗓️ ${item.year || 'N/A'}</span>
                    </div>
                    ${onYourOTT ? '<span class="mt-2 inline-flex rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">✓ On Your OTT</span>' : ''}
                </div>
                <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <button class="${item.watched ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}" onclick="toggleWatched('${item.docId}')">
                        ${item.watched ? '↩️ Unwatch' : '✓ Watched'}
                    </button>
                    <button class="text-rose-500 hover:text-rose-400 font-semibold" onclick="deleteItem('${item.docId}')">Delete</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    parentContainer.appendChild(grid);
}

function updateBatchActionUI() {
    const count = document.getElementById('selectedCount');
    if (count) count.textContent = `${selectedDocIds.size} selected`;

    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) {
        const selectedVisibleCount = [...renderedDocIds].filter(docId => selectedDocIds.has(docId)).length;
        selectAll.checked = renderedDocIds.size > 0 && selectedVisibleCount === renderedDocIds.size;
        selectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < renderedDocIds.size;
    }
}

function toggleItemSelection(docId, isSelected) {
    if (isSelected) selectedDocIds.add(docId);
    else selectedDocIds.delete(docId);
    updateBatchActionUI();
}

function toggleSelectAll(isSelected) {
    renderedDocIds.forEach(docId => {
        if (isSelected) selectedDocIds.add(docId);
        else selectedDocIds.delete(docId);
    });
    renderWatchlist();
}

async function refreshMetadata(docId) {
    const item = currentWatchlistItems.find(i => i.docId === docId);
    if (!db || !item) return;

    const metadata = await fetchTMDBDetails(item.title);
    if (!metadata.valid) {
        alert(metadata.error);
        return;
    }

    const { valid, ...updates } = metadata;
    await db.collection('watchlist').doc(docId).update(updates);
}

// ==========================================
// 5. Data Mutations (Watched / Add / Delete)
// ==========================================
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function bulkUploadItems() {
    const textarea = document.getElementById('bulkTitles');
    const progressContainer = document.getElementById('bulkProgressContainer');
    const progressBar = document.getElementById('bulkProgressBar');
    const statusText = document.getElementById('bulkStatusText');
    const uploadButton = document.getElementById('bulkUploadButton');
    const reviewContainer = document.getElementById('bulkReviewContainer');
    const titles = [...new Set((textarea?.value || '').split(/[\n,]+/).map(title => title.trim()).filter(Boolean))];

    if (!currentUser) {
        if (statusText) statusText.textContent = 'Please sign in before uploading titles.';
        if (progressContainer) progressContainer.classList.remove('hidden');
        return;
    }

    if (titles.length === 0) {
        if (statusText) statusText.textContent = 'Enter at least one title to upload.';
        if (progressContainer) progressContainer.classList.remove('hidden');
        return;
    }
    if (!db) {
        if (statusText) statusText.textContent = 'Firestore is not available.';
        if (progressContainer) progressContainer.classList.remove('hidden');
        return;
    }

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (uploadButton) uploadButton.disabled = true;
    if (progressBar) progressBar.style.width = '0%';
    if (reviewContainer) reviewContainer.classList.toggle('hidden', bulkReviewItems.length === 0);
    bulkUploadCounts = { added: 0, skipped: 0, notFound: 0, processed: 0, total: titles.length, failures: 0 };
    updateBulkStatus();

    const failures = [];
    try {
        for (let index = 0; index < titles.length; index += 1) {
            const title = titles[index];
            try {
                const candidates = await searchTMDBCandidates(title);
                if (candidates.length === 0) {
                    failures.push(title);
                    bulkUploadCounts.notFound += 1;
                } else if (isAlreadyInWatchlist(candidates[0])) {
                    bulkUploadCounts.skipped += 1;
                } else if (
                    candidates.length === 1 ||
                    candidates[0].popularity >= (candidates[1]?.popularity || 0) * 2.5
                ) {
                    const saved = await saveCandidateToWatchlist(candidates[0]);
                    if (saved) bulkUploadCounts.added += 1;
                    else bulkUploadCounts.skipped += 1;
                } else {
                    bulkReviewItems.push({ query: title, candidates });
                    renderBulkReviewContainer();
                }
            } catch (error) {
                failures.push(title);
                bulkUploadCounts.failures += 1;
            }

            bulkUploadCounts.processed = index + 1;
            if (progressBar) progressBar.style.width = `${Math.round(((index + 1) / titles.length) * 100)}%`;
            updateBulkStatus();
            if (index < titles.length - 1) await sleep(250);
        }
        if (textarea) textarea.value = failures.join('\n');
        if (failures.length && statusText) statusText.textContent += ` • Retry: ${failures.join(', ')}`;
    } finally {
        if (uploadButton) uploadButton.disabled = false;
    }
}

async function deleteSelected() {
    const docIds = [...selectedDocIds];
    if (!db || docIds.length === 0) return;
    if (!confirm(`Delete ${docIds.length} selected title${docIds.length === 1 ? '' : 's'}? This cannot be undone.`)) return;

    for (let start = 0; start < docIds.length; start += 500) {
        const batch = db.batch();
        docIds.slice(start, start + 500).forEach(docId => batch.delete(db.collection('watchlist').doc(docId)));
        await batch.commit();
    }
    selectedDocIds.clear();
    updateBatchActionUI();
}

async function deleteAll() {
    if (!db || currentWatchlistItems.length === 0) return;
    if (!confirm(`Delete all ${currentWatchlistItems.length} titles in your watchlist? This cannot be undone.`)) return;

    const docIds = currentWatchlistItems.map(item => item.docId);
    for (let start = 0; start < docIds.length; start += 500) {
        const batch = db.batch();
        docIds.slice(start, start + 500).forEach(docId => batch.delete(db.collection('watchlist').doc(docId)));
        await batch.commit();
    }
    selectedDocIds.clear();
    updateBatchActionUI();
}

async function toggleWatched(docId) {
    if (db && docId) {
        const item = currentWatchlistItems.find(i => i.docId === docId);
        if (item) {
            await db.collection('watchlist').doc(docId).update({
                watched: !item.watched
            });
        }
    }
}

async function deleteItem(docId) {
    if (db && docId) {
        await db.collection('watchlist').doc(docId).delete();
    }
}
