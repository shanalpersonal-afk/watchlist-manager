// ==========================================
// 1. Firebase Configuration & Initialization
// ==========================================
// Recent release notes shown in the What's New sheet.
const APP_UPDATES = [
    { version: 'v2.19.0', date: '2026-11-27', title: 'AI Picks', items: ['Ask Gemini for movie and TV recommendations based on your taste, subscriptions, and optional mood.', 'AI titles are matched through TMDB so India OTT details and quick add actions remain available.'] },
    { version: 'v2.18.0', date: '2026-11-27', title: 'Taste based picks and free streaming', items: ['Find free and ad supported India streaming options for titles.', 'Get recommendations based on titles you have watched or loved.', 'Set your taste profile with a guided movie and show picker.'] },
    { version: 'v2.17.3', date: '2026-11-27', title: 'Discover and onboarding', items: ['Hide Discover recommendations and undo the action; reset hidden titles from your profile.', 'New users are guided through the app automatically.', 'See recent changes in the new What’s New sheet.'] },
    { version: 'v2.17.2', date: '2026-11-26', title: 'Discover controls', items: ['Improved recommendation controls and account preferences.'] },
    { version: 'v2.17.1', date: '2026-11-20', title: 'Mobile modal improvements', items: ['Standardized mobile sheets and improved Discover filter state.'] },
    { version: 'v2.17.0', date: '2026-11-18', title: 'A simpler mobile Watchlist', items: ['Updated navigation, Library controls, Discover cards, and guided tour.'] },
    { version: 'v2.16.0', date: '2026-10-30', title: 'Mobile and discovery polish', items: ['Added discovery presets, title previews, and mobile navigation.'] }
];

// Return dated updates from the requested window, or the newest release.
function getRecentUpdates(days = 7) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Math.max(0, Number(days) || 0));
    const recent = APP_UPDATES.filter(update => new Date(`${update.date}T00:00:00`) >= cutoff);
    return recent.length ? recent : APP_UPDATES.slice(0, 1);
}

// Show recent release notes and save the latest version as read.
function openWhatsNewModal() {
    const body = document.getElementById('whatsNewBody');
    if (body) {
        body.replaceChildren();
        getRecentUpdates(7).forEach(update => {
            const section = document.createElement('section');
            section.className = 'mb-5 last:mb-0';
            const heading = document.createElement('div');
            heading.className = 'flex items-baseline justify-between gap-3';
            const title = document.createElement('h3');
            title.className = 'font-bold';
            title.textContent = `${update.version} · ${update.title}`;
            const date = document.createElement('time');
            date.className = 'shrink-0 text-xs text-slate-500';
            date.dateTime = update.date;
            date.textContent = update.date;
            heading.append(title, date);
            const list = document.createElement('ul');
            list.className = 'mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300';
            update.items.forEach(item => { const li = document.createElement('li'); li.textContent = item; list.appendChild(li); });
            section.append(heading, list);
            body.appendChild(section);
        });
    }
    const latest = APP_UPDATES[0];
    try { localStorage.setItem('watchlist_last_seen_update', latest.date); } catch (error) { /* The modal can still be read this session. */ }
    updateWhatsNewDot();
    showModal('whatsNewModal');
}

// Show a dot until the latest release note has been opened.
function updateWhatsNewDot() {
    const dot = document.getElementById('whatsNewDot');
    if (!dot || !APP_UPDATES.length) return;
    let seen = '';
    try { seen = localStorage.getItem('watchlist_last_seen_update') || ''; } catch (error) { /* Treat unavailable storage as unread. */ }
    dot.classList.toggle('hidden', seen >= APP_UPDATES[0].date);
}
// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

if (!window.APP_CONFIG) {
    console.error('Application configuration is missing. Make sure config.js loads before app.js.');
}

const firebaseConfig = window.APP_CONFIG?.firebaseConfig;
const TMDB_PROXY_URL = window.APP_CONFIG?.tmdbProxyUrl;
let tmdbProxyAlertShown = false;

if (!TMDB_PROXY_URL || TMDB_PROXY_URL === 'YOUR_CLOUDFLARE_WORKER_URL') {
    console.error('TMDB proxy is not configured. Set tmdbProxyUrl in config.js to your deployed Cloudflare Worker URL.');
}

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
let activeListId = 'personal';
let userSharedLists = [];
let unsubscribeSharedLists = null;
let isCreatingList = false;
let currentWatchlistItems = [];
let currentUser = null;
let userProfile = { subscriptions: [], languages: [], genres: [], dismissedIds: [], hasCompletedTour: false, hasCompletedTasteOnboarding: false, tasteSeedMovies: [] };
let userProfileUid = null;
let userProfileLoadPromise = Promise.resolve();
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
let candidateSearchDebounce = null;
let candidateSearchToken = 0;
let activePreviewItem = null;
let activePreviewSaved = false;
let pendingSharedListActionId = null;
let isManageMode = false;
let onlyWatchableNow = false;
let pendingWatchableActivation = false;
let trendingLoadToken = 0;
let trendingPage = 1;
let displayedTrendingIds = new Set();
let discoverMode = 'trending';
let modalLockObserver = null;
let tasteSelectedLanguages = new Set();
let tasteSelectedGenres = new Set();
let tasteSelectedSeeds = new Map();
let tasteSearchTimer = null;
let tasteSearchToken = 0;
let tastePopularItems = [];
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
    { selector: '#activeListSelect', title: 'Your Lists', description: 'Switch between your private list and shared watchlists.' },
    { selector: '#toggleFilterDrawerBtn', title: 'Library Filters', description: 'Find titles by platform, type, genre, or language.' },
    { selector: '#candidateSearchInput', title: 'Find a Title', description: 'Search for a movie or show, then add it to your list.' },
    { selector: '#accountMenuBtn', title: 'Your Account', description: 'Manage your profile, theme, tour, and sign-in.' }
];

// ==========================================
// 2. Auth State & Lifecycle Event Listeners
// ==========================================
function syncModalBodyScroll() {
    const anyModalOpen = [...document.querySelectorAll('[data-modal-lock]')].some(modal => !modal.classList.contains('hidden'));
    document.body.classList.toggle('overflow-hidden', anyModalOpen);
}

function showModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
    syncModalBodyScroll();
}

function hideModal(id) {
    document.getElementById(id)?.classList.add('hidden');
    syncModalBodyScroll();
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    modalLockObserver = new MutationObserver(syncModalBodyScroll);
    document.querySelectorAll('[data-modal-lock]').forEach(modal => modalLockObserver.observe(modal, { attributes: true, attributeFilter: ['class'] }));
    syncModalBodyScroll();
    document.getElementById('accountMenuBtn')?.addEventListener('click', () => toggleAccountMenu());
    
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.addEventListener('click', loginWithGoogle);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', () => { toggleAccountMenu(false); logoutUser(); });

    const startTourBtn = document.getElementById('startTourBtn');
    if (startTourBtn) startTourBtn.addEventListener('click', () => { toggleAccountMenu(false); startWatchlistTour(); });
    const tourNextBtn = document.getElementById('tourNextBtn');
    if (tourNextBtn) tourNextBtn.addEventListener('click', advanceWatchlistTour);
    const tourSkipBtn = document.getElementById('tourSkipBtn');
    if (tourSkipBtn) tourSkipBtn.addEventListener('click', endWatchlistTour);
    document.getElementById('candidateSearchBtn')?.addEventListener('click', searchCandidateInput);
    document.getElementById('clearCandidateSearchBtn')?.addEventListener('click', clearCandidateSearch);
    document.getElementById('candidateSearchInput')?.addEventListener('input', event => {
        if (!event.target.value.trim()) {
            candidateSearchToken += 1;
            clearTimeout(candidateSearchDebounce);
            document.getElementById('candidateResults').replaceChildren();
            document.getElementById('candidateSearchSpinner')?.classList.add('hidden');
            document.getElementById('candidateSearchBtn')?.removeAttribute('disabled');
            document.getElementById('clearCandidateSearchBtn')?.classList.add('hidden');
            return;
        }
        document.getElementById('clearCandidateSearchBtn')?.classList.remove('hidden');
        candidateSearchToken += 1;
        clearTimeout(candidateSearchDebounce);
        document.getElementById('candidateSearchSpinner')?.classList.add('hidden');
        document.getElementById('candidateSearchBtn')?.removeAttribute('disabled');
        candidateSearchDebounce = window.setTimeout(searchCandidateInput, 450);
    });
    document.getElementById('clearLibrarySearchBtn')?.addEventListener('click', clearLibrarySearch);
    document.getElementById('candidateSearchInput')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(candidateSearchDebounce);
            searchCandidateInput();
        }
    });
    document.getElementById('openBulkUploadBtn')?.addEventListener('click', event => { event.preventDefault(); openBulkUploadModal(); });
    ['closeBulkUploadBtn', 'closeBulkUploadBackdrop'].forEach(id => document.getElementById(id)?.addEventListener('click', closeBulkUploadModal));
    document.getElementById('openTrendingFiltersBtn')?.addEventListener('click', () => {
        discoverMode = 'custom';
        updateDiscoverFilterUI();
        showModal('discoverFilterSheet');
    });
    document.getElementById('aiPicksChip')?.addEventListener('click', () => {
        discoverMode = 'ai';
        updateDiscoverFilterUI();
    });
    document.getElementById('askAiBtn')?.addEventListener('click', loadAIPicksRecommendations);
    ['closeTrendingFiltersBtn', 'closeTrendingFiltersBackdrop', 'doneTrendingFiltersBtn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => hideModal('discoverFilterSheet')));
    document.getElementById('clearDiscoverFiltersBtn')?.addEventListener('click', () => applyDiscoverPreset('fresh'));
    document.querySelectorAll('[data-quick-scope="library"]').forEach(button => button.addEventListener('click', () => toggleQuickFilterPill(button)));
    document.getElementById('openProfileBtn')?.addEventListener('click', () => { toggleAccountMenu(false); openProfileModal(); });
    document.getElementById('closeProfileBtn')?.addEventListener('click', closeProfileModal);
    document.getElementById('saveProfileBtn')?.addEventListener('click', saveUserProfile);
    document.getElementById('resetDismissedRecommendationsBtn')?.addEventListener('click', resetDismissedRecommendations);
    document.getElementById('resetTasteOnboardingBtn')?.addEventListener('click', resetTasteOnboarding);
    document.getElementById('hideSuggestionBtn')?.addEventListener('click', () => {
        if (activePreviewItem) dismissRecommendation(activePreviewItem.id || activePreviewItem.tmdbId, activePreviewItem.title);
    });
    document.getElementById('openWhatsNewBtn')?.addEventListener('click', () => { toggleAccountMenu(false); openWhatsNewModal(); });
    ['closeWhatsNewBtn', 'doneWhatsNewBtn', 'closeWhatsNewBackdrop'].forEach(id => document.getElementById(id)?.addEventListener('click', () => hideModal('whatsNewModal')));
    updateWhatsNewDot();
    ['closeTasteOnboardingBtn', 'skipTasteOnboardingBtn'].forEach(id => document.getElementById(id)?.addEventListener('click', completeTasteOnboarding));
    document.getElementById('tasteSearchInput')?.addEventListener('input', event => {
        const query = event.target.value.trim();
        clearTimeout(tasteSearchTimer);
        const token = ++tasteSearchToken;
        if (!query) { renderTasteTitleGrid([...tastePopularItems, ...tasteSelectedSeeds.values()]); return; }
        tasteSearchTimer = window.setTimeout(async () => {
            try {
                const results = await searchTMDBCandidates(query);
                if (token === tasteSearchToken) renderTasteTitleGrid(results);
            } catch (error) {
                if (token === tasteSearchToken) document.getElementById('tasteSearchResults').textContent = 'Search is unavailable right now.';
            }
        }, 350);
    });
    document.getElementById('saveTasteProfileBtn')?.addEventListener('click', saveTasteOnboarding);
    document.getElementById('profileModal')?.addEventListener('click', event => {
        if (event.target.id === 'profileModal') closeProfileModal();
    });
    document.getElementById('openSharedListsBtn')?.addEventListener('click', () => {
        document.getElementById('sharedListsStatus').textContent = '';
        showModal('sharedListModal');
    });
    document.getElementById('closeSharedListsBtn')?.addEventListener('click', closeSharedListsModal);
    document.getElementById('sharedListModal')?.addEventListener('click', event => {
        if (event.target.id === 'sharedListModal') closeSharedListsModal();
    });
    document.getElementById('cancelSharedListActionBtn')?.addEventListener('click', closeSharedListConfirmModal);
    document.getElementById('closeSharedListConfirmBtn')?.addEventListener('click', closeSharedListConfirmModal);
    document.getElementById('confirmSharedListActionBtn')?.addEventListener('click', confirmLeaveOrDeleteSharedList);
    document.getElementById('activeListSelect')?.addEventListener('change', event => switchActiveList(event.target.value));
    document.getElementById('createSharedListBtn')?.addEventListener('click', createSharedList);
    document.getElementById('joinSharedListBtn')?.addEventListener('click', () => joinSharedList(document.getElementById('joinInviteCodeInput')?.value));
    document.getElementById('copySharedListCodeBtn')?.addEventListener('click', () => copyActiveSharedListValue('code'));
    document.getElementById('copySharedListLinkBtn')?.addEventListener('click', () => copyActiveSharedListValue('link'));
    document.getElementById('mobileNavSharedBtn')?.addEventListener('click', () => showModal('sharedListModal'));
    ['closeDetailPreviewBtn', 'closeDetailPreviewBackdrop'].forEach(id => document.getElementById(id)?.addEventListener('click', closeDetailPreview));
    document.getElementById('detailPreviewActionBtn')?.addEventListener('click', handleDetailPreviewAction);
    document.getElementById('detailPreviewRefreshBtn')?.addEventListener('click', async () => {
        if (!activePreviewItem?.docId) return;
        await refreshMetadata(activePreviewItem.docId);
        closeDetailPreview();
    });
    document.getElementById('detailPreviewDeleteBtn')?.addEventListener('click', async () => {
        if (!activePreviewItem?.docId) return;
        await deleteItem(activePreviewItem.docId);
        closeDetailPreview();
    });
    document.getElementById('filterDrawer')?.addEventListener('keydown', event => {
        if (event.key === 'Escape') toggleFilterDrawer();
    });
    document.getElementById('trendingPanel')?.addEventListener('toggle', event => {
        if (event.currentTarget.open) resetTrendingDiscover();
    });
    initLibraryPreferences();
    initMultiSelectFilters();
    initDiscoverPresets();
    syncQuickFilterPills();
    updateWatchableNowButton();
    updateLibraryFilterIndicator();
    updateDiscoverFilterUI();
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
                loadSharedLists();
                const joinCode = new URLSearchParams(window.location.search).get('join');
                if (joinCode) {
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('join');
                    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
                    joinSharedList(joinCode);
                }
            } else {
                currentUser = null;
                if (unsubscribeWatchlist) {
                    unsubscribeWatchlist();
                    unsubscribeWatchlist = null;
                }
                if (unsubscribeSharedLists) {
                    unsubscribeSharedLists();
                    unsubscribeSharedLists = null;
                }
                userSharedLists = [];
                activeListId = 'personal';
                renderSharedLists();
                updateActiveListControls();
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
    endWatchlistTour(false);
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
    if ((step.selector === '#filterDrawer' || tourTarget.id === 'groupByOptions') && filterDrawer?.classList.contains('hidden')) {
        tourOpenedFilterDrawer = true;
        filterDrawer.classList.remove('hidden');
        filterDrawer.classList.add('flex');
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

async function endWatchlistTour(markCompleted = true) {
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
        document.getElementById('bulkUploadModal')?.classList.add('hidden');
    }
    if (tourOpenedFilterDrawer) {
        const drawer = document.getElementById('filterDrawer');
        drawer?.classList.add('hidden');
    }
    if (tourStartingView) switchView(tourStartingView);

    activeTourStep = -1;
    tourTarget = null;
    tourOriginalStyles = null;
    tourOpenedBulkPanel = false;
    tourOpenedFilterDrawer = false;
    tourStartingView = null;
    if (markCompleted && currentUser && userProfileUid === currentUser.uid) {
        userProfile.hasCompletedTour = true;
        try { localStorage.setItem(`watchlist_tour_done_${currentUser.uid}`, 'true'); } catch (error) { /* Keep tour completion in the profile. */ }
        await persistUserProfileSilently();
        if (!userProfile.hasCompletedTasteOnboarding && localStorage.getItem(`watchlist_taste_done_${currentUser.uid}`) !== 'true') window.setTimeout(() => {
            if (currentUser && !userProfile.hasCompletedTasteOnboarding) openTasteOnboardingModal();
        }, 350);
    }
}

function switchView(viewName) {
    if (viewName !== 'library' && viewName !== 'add') return;
    currentViewName = viewName;
    document.getElementById('libraryView')?.classList.toggle('hidden', viewName !== 'library');
    document.getElementById('addView')?.classList.toggle('hidden', viewName !== 'add');

    const activeClasses = ['bg-sky-500', 'text-white', 'border-sky-500'];
    const inactiveClasses = ['bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-300', 'dark:border-slate-800', 'hover:border-sky-400'];
    [['navLibraryBtn', 'library'], ['navAddBtn', 'add'], ['mobileNavLibraryBtn', 'library'], ['mobileNavAddBtn', 'add']].forEach(([buttonId, buttonView]) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.classList.remove(...activeClasses, ...inactiveClasses);
        button.classList.add(...(buttonView === viewName ? activeClasses : inactiveClasses));
        button.setAttribute('aria-current', buttonView === viewName ? 'page' : 'false');
    });

    const nextHash = viewName === 'library' ? '#library' : '#add';
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    if (viewName === 'add' && document.getElementById('trendingPanel')?.open) resetTrendingDiscover();
}

// Load grouping defaults and build the Group By and Sort By chips.
function initLibraryPreferences() {
    const groupBy = document.getElementById('groupBySelect');
    const tuckWatched = document.getElementById('tuckWatchedToggle');
    if (!groupBy || !tuckWatched) return;

    let savedGroupBy = 'none';
    let savedTuckWatched = true;
    try {
        savedGroupBy = localStorage.getItem('watchlist_group_by') || savedGroupBy;
        const savedTuck = localStorage.getItem('watchlist_tuck_watched');
        if (savedTuck !== null) savedTuckWatched = savedTuck === 'true';
    } catch (error) {
        console.warn('Could not load saved grouping preferences.', error);
    }

    const groupOptions = [
        { value: 'platform', label: '📺 Platform' }, { value: 'language', label: '🌐 Language' },
        { value: 'genre', label: '🎭 Genre' }, { value: 'type', label: '🎬 Movies vs TV' }, { value: 'none', label: '📋 No Grouping' }
    ];
    const sortOptions = [
        { value: 'default', label: 'Default' }, { value: 'rating-desc', label: '⭐ Rating' },
        { value: 'title-asc', label: 'Title A–Z' }, { value: 'title-desc', label: 'Title Z–A' }
    ];
    savedGroupBy = groupOptions.some(option => option.value === savedGroupBy) ? savedGroupBy : 'none';
    try {
        localStorage.setItem('watchlist_group_by', savedGroupBy);
        localStorage.setItem('watchlist_tuck_watched', String(savedTuckWatched));
    } catch (error) {
        console.warn('Could not save default grouping preferences.', error);
    }
    renderSingleSelectPills('groupByOptions', 'groupBySelect', groupOptions, savedGroupBy, saveGroupingPreferencesAndRender);
    const sortInput = document.getElementById('sortBy');
    const savedSort = sortOptions.some(option => option.value === sortInput.value) ? sortInput.value : 'default';
    renderSingleSelectPills('sortByOptions', 'sortBy', sortOptions, savedSort, renderWatchlist);
    tuckWatched.checked = savedTuckWatched;
}

// Save grouping choices before refreshing the library.
function saveGroupingPreferencesAndRender() {
    const groupBy = document.getElementById('groupBySelect');
    const tuckWatched = document.getElementById('tuckWatchedToggle');
    try {
        if (groupBy) localStorage.setItem('watchlist_group_by', groupBy.value);
        if (tuckWatched) localStorage.setItem('watchlist_tuck_watched', String(tuckWatched.checked));
    } catch (error) {
        console.warn('Could not save grouping preferences.', error);
    }
    renderWatchlist();
}

// Open search or clear its filter when the panel closes.
function toggleSearchPanel() {
    const panel = document.getElementById('searchBarPanel');
    const button = document.getElementById('toggleSearchBtn');
    if (!panel) return;
    const isOpening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isOpening);
    if (button) button.setAttribute('aria-expanded', String(isOpening));
    if (isOpening) document.getElementById('searchQuery')?.focus();
    else {
        const searchInput = document.getElementById('searchQuery');
        if (searchInput) searchInput.value = '';
        renderWatchlist();
    }
}

// Clear the title search and any candidate results.
function clearCandidateSearch() {
    candidateSearchToken += 1;
    clearTimeout(candidateSearchDebounce);
    const input = document.getElementById('candidateSearchInput');
    const results = document.getElementById('candidateResults');
    if (input) input.value = '';
    document.getElementById('clearCandidateSearchBtn')?.classList.add('hidden');
    if (results) results.innerHTML = '';
    document.getElementById('candidateSearchSpinner')?.classList.add('hidden');
    document.getElementById('candidateSearchBtn')?.removeAttribute('disabled');
}

// Clear the library search filter.
function clearLibrarySearch() {
    const input = document.getElementById('searchQuery');
    if (input) input.value = '';
    renderWatchlist();
}

// Draw reusable tappable chips for a single-choice filter.
function renderSingleSelectPills(containerId, inputId, options, selectedValue, onChange) {
    const container = document.getElementById(containerId);
    const valueInput = document.getElementById(inputId);
    if (!container || !valueInput) return;
    container.classList.add('flex', 'flex-wrap', 'gap-1.5');
    valueInput.value = selectedValue;
    container.replaceChildren();
    options.forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.value = option.value;
        button.className = `option-chip${option.value === selectedValue ? ' active' : ''}`;
        button.textContent = option.label;
        button.setAttribute('aria-pressed', String(option.value === selectedValue));
        button.addEventListener('click', () => {
            valueInput.value = option.value;
            container.querySelectorAll('.option-chip').forEach(chip => {
                const active = chip === button;
                chip.classList.toggle('active', active);
                chip.setAttribute('aria-pressed', String(active));
            });
            onChange();
        });
        container.appendChild(button);
    });
}

// Select a single chip and keep its hidden query value synchronized.
function setSinglePillSelection(containerId, inputId, value) {
    const input = document.getElementById(inputId);
    if (input) input.value = value;
    document.querySelectorAll(`#${containerId} .option-chip`).forEach(chip => {
        const active = chip.dataset.value === value;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
    });
}

// Toggle the responsive Filter & Sort sheet.
function toggleFilterDrawer() {
    const drawer = document.getElementById('filterDrawer');
    const button = document.getElementById('toggleFilterDrawerBtn');
    if (!drawer) return;
    const isOpening = drawer.classList.contains('hidden');
    if (isOpening) showModal('filterDrawer');
    else hideModal('filterDrawer');
    if (button) button.setAttribute('aria-expanded', String(isOpening));
}

function toggleAccountMenu(forceOpen) {
    const menu = document.getElementById('accountMenuModal');
    if (!menu) return;
    const open = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
    if (open) showModal('accountMenuModal');
    else hideModal('accountMenuModal');
}

function updateLibraryFilterIndicator() {
    const active = ['type', 'platform', 'genre', 'language'].some(name => getMultiFilterValues('library', name).length > 0) || onlyWatchableNow;
    document.getElementById('libraryFilterDot')?.classList.toggle('hidden', !active);
}

// Reset library chips, grouping, sorting, and search to their defaults.
function clearAllLibraryFilters() {
    ['type', 'platform', 'genre', 'language'].forEach(name => setMultiFilterValues('library', name, []));
    setSinglePillSelection('groupByOptions', 'groupBySelect', 'none');
    setSinglePillSelection('sortByOptions', 'sortBy', 'default');
    const tuckWatched = document.getElementById('tuckWatchedToggle');
    if (tuckWatched) tuckWatched.checked = true;
    const search = document.getElementById('searchQuery');
    if (search) search.value = '';
    onlyWatchableNow = false;
    updateWatchableNowButton();
    updateLibraryFilterIndicator();
    saveGroupingPreferencesAndRender();
}

// Open the paste-list dialog without navigating away from Add Titles.
function openBulkUploadModal() {
    showModal('bulkUploadModal');
    document.getElementById('bulkTitles')?.focus();
}

// Close the paste-list dialog.
function closeBulkUploadModal() {
    hideModal('bulkUploadModal');
}

// Apply a one-tap Discover preset and refresh India results.
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

// Connect each Discover preset chip to its matching filter preset.
function initDiscoverPresets() {
    document.querySelectorAll('[data-discover-preset]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.discoverPreset === 'profile') loadPersonalizedRecommendations();
            else applyDiscoverPreset(button.dataset.discoverPreset);
        });
    });
}

// Ask the Worker for AI ideas, then resolve each title through TMDB.
async function loadAIPicksRecommendations() {
    const shelf = document.getElementById('trendingShelf');
    if (!shelf) return;
    discoverMode = 'ai';
    updateDiscoverFilterUI();
    const requestToken = ++trendingLoadToken;
    trendingPage = 1;
    document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
    renderTrendingSkeletons(shelf);

    const orderedLiked = [
        ...currentWatchlistItems.filter(item => item.watched),
        ...currentWatchlistItems.filter(item => !item.watched),
        ...(userProfile.tasteSeedMovies || [])
    ];
    const likedTitles = [...new Map(orderedLiked.map(item => {
        const title = String(item.title || '').trim();
        return [title.toLocaleLowerCase(), title];
    }).filter(([key, title]) => key && title)).values()];
    const excludeTitles = [...new Set(currentWatchlistItems.map(item => String(item.title || '').trim()).filter(Boolean))];

    try {
        const workerUrl = `${String(TMDB_PROXY_URL || '').replace(/\/+$/, '')}/ai/recommend`;
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                likedTitles,
                languages: userProfile.languages || [],
                genres: userProfile.genres || [],
                subscriptions: userProfile.subscriptions || [],
                excludeTitles,
                moodPrompt: document.getElementById('aiMoodInput')?.value.trim() || ''
            })
        });
        if (!response.ok) throw new Error('AI request failed.');
        const payload = await response.json();
        const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
        if (!recommendations.length) throw new Error('AI returned no recommendations.');

        const enrichedResults = await Promise.allSettled(recommendations.map(async recommendation => {
            const matches = await searchTMDBCandidates(String(recommendation.title || ''));
            const expectedType = recommendation.mediaType === 'tv' ? 'tv' : 'movie';
            const sameType = matches.filter(match => match.mediaType === expectedType);
            const desiredYear = String(recommendation.year || '');
            const desiredYearNumber = Number(desiredYear);
            const match = sameType.slice().sort((a, b) => {
                const yearDistance = candidate => Number.isFinite(desiredYearNumber) && Number.isFinite(Number(candidate.year))
                    ? Math.abs(Number(candidate.year) - desiredYearNumber)
                    : Number.POSITIVE_INFINITY;
                return yearDistance(a) - yearDistance(b) || (b.popularity || 0) - (a.popularity || 0);
            })[0];
            if (!match) return null;
            return { ...match, aiReason: String(recommendation.reason || '').trim() };
        }));
        if (requestToken !== trendingLoadToken) return;
        const candidates = [...new Map(enrichedResults.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []).map(candidate => [String(candidate.id), candidate])).values()]
            .filter(candidate => !isAlreadyInWatchlist(candidate) && !userProfile.dismissedIds.includes(String(candidate.id)))
            .slice(0, 10);
        if (!candidates.length) throw new Error('AI titles could not be matched in TMDB.');
        renderTrendingShelf(candidates);
        document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
        await Promise.all(candidates.map(async candidate => {
            const providers = await fetchCandidateIndiaPlatforms(candidate.mediaType, candidate.id);
            candidate.platforms = providers.platforms;
            candidate.freePlatforms = providers.freePlatforms;
            candidate.platform = providers.platform;
            if (requestToken === trendingLoadToken) updateTrendingPlatformBadge(candidate);
        }));
    } catch (error) {
        if (requestToken !== trendingLoadToken) return;
        showToast('AI Picks are unavailable right now. Showing your personalized picks instead.', 'info');
        loadPersonalizedRecommendations();
    }
}

function toggleManageMode() {
    isManageMode = !isManageMode;
    const actions = document.getElementById('batchActionsBar');
    const button = document.getElementById('toggleManageBtn');
    if (actions) actions.classList.toggle('hidden', !isManageMode);
    if (button) {
        button.setAttribute('aria-pressed', String(isManageMode));
        button.textContent = isManageMode ? 'Done Managing' : '☑️ Manage / Batch Delete';
        button.classList.toggle('bg-sky-500', isManageMode);
        button.classList.toggle('text-white', isManageMode);
        button.classList.toggle('border-sky-500', isManageMode);
    }
    if (!isManageMode) selectedDocIds.clear();
    renderWatchlist();
}

// Profile storage: keep each signed-in user's local fallback under their UID.
function getUserProfileStorageKey(uid = currentUser?.uid) {
    return `watchlist_profile_${uid || 'guest'}`;
}

// Profile data: keep only the supported subscription, language, and genre choices.
function normalizeUserProfile(profile) {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
        subscriptions: Array.isArray(source.subscriptions) ? [...new Set(source.subscriptions.filter(value => OTT_SERVICES.includes(value)))] : [],
        languages: Array.isArray(source.languages) ? [...new Set(source.languages.filter(value => Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, value)))] : [],
        genres: Array.isArray(source.genres) ? [...new Set(source.genres.filter(value => Object.prototype.hasOwnProperty.call(TRENDING_GENRE_IDS, value)))] : [],
        dismissedIds: Array.isArray(source.dismissedIds) ? [...new Set(source.dismissedIds.map(String))] : [],
        hasCompletedTour: source.hasCompletedTour === true,
        hasCompletedTasteOnboarding: source.hasCompletedTasteOnboarding === true,
        tasteSeedMovies: Array.isArray(source.tasteSeedMovies) ? source.tasteSeedMovies.filter(seed => seed && seed.id && (seed.mediaType === 'movie' || seed.mediaType === 'tv')).map(seed => ({ id: seed.id, mediaType: seed.mediaType, title: String(seed.title || ''), poster: seed.poster || null })).slice(0, 20) : []
    };
}

// Watchable Now: expose subscriptions only when they belong to the active account.
function getUserSubscriptions() {
    return currentUser && userProfileUid === currentUser.uid ? userProfile.subscriptions : [];
}

// Discover defaults: apply saved services, languages, and genres to For Me.
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

// Open taste setup with saved chips and a set of popular titles.
async function openTasteOnboardingModal() {
    const uid = currentUser?.uid;
    if (!uid || userProfileUid !== uid) return;
    tasteSelectedLanguages = new Set(userProfile.languages || []);
    tasteSelectedGenres = new Set(userProfile.genres || []);
    tasteSelectedSeeds = new Map((userProfile.tasteSeedMovies || []).map(seed => [`${seed.mediaType}:${seed.id}`, seed]));
    renderTasteChoicePills();
    renderTasteTitleGrid([...tastePopularItems, ...tasteSelectedSeeds.values()]);
    updateTasteSaveButton();
    showModal('tasteOnboardingModal');
    if (tastePopularItems.length) return;
    const titleGrid = document.getElementById('tasteSearchResults');
    if (titleGrid) titleGrid.textContent = 'Loading popular titles…';
    const results = await Promise.allSettled(['hi', 'en', 'ta', 'ko'].flatMap(language => ['movie', ...(language === 'en' || language === 'hi' ? ['tv'] : [])].map(async mediaType => {
        const params = new URLSearchParams({ sort_by: 'popularity.desc', 'vote_count.gte': '100', with_original_language: language, page: '1' });
        const response = await fetch(buildTMDBUrl(`/discover/${mediaType}`, params));
        if (!response.ok) throw new Error(`TMDB ${mediaType} discover returned ${response.status}.`);
        const data = await response.json();
        return (data.results || []).slice(0, 8).map(result => mapTrendingResult(result, mediaType));
    })));
    const seen = new Set();
    tastePopularItems = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(item => {
        const key = `${item.mediaType}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 15);
    if (!tastePopularItems.length) tastePopularItems = [...tasteSelectedSeeds.values()];
    if (currentUser?.uid === uid && !document.getElementById('tasteOnboardingModal')?.classList.contains('hidden') && !document.getElementById('tasteSearchInput')?.value.trim()) {
        renderTasteTitleGrid([...tastePopularItems, ...tasteSelectedSeeds.values()]);
    }
}

// Draw selectable language and genre pills from the app's supported choices.
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

// Render the poster picker and its selected state.
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

// Keep the selected-title count and minimum-pick action in sync.
function updateTasteSaveButton() {
    const count = tasteSelectedSeeds.size;
    const button = document.getElementById('saveTasteProfileBtn');
    const label = document.getElementById('tasteSelectionCount');
    if (label) label.textContent = `Pick 3+ titles you loved (${count}/3)`;
    if (button) button.disabled = count < 3;
}

// Save selected taste chips and seed titles to the signed-in profile.
async function saveTasteOnboarding() {
    if (tasteSelectedSeeds.size < 3 || !currentUser) return;
    userProfile.languages = [...tasteSelectedLanguages];
    userProfile.genres = [...tasteSelectedGenres];
    userProfile.tasteSeedMovies = [...tasteSelectedSeeds.values()].slice(0, 20);
    userProfile.hasCompletedTasteOnboarding = true;
    try { localStorage.setItem(`watchlist_taste_done_${currentUser.uid}`, 'true'); } catch (error) { /* Keep completion in the profile. */ }
    await persistUserProfileSilently();
    hideModal('tasteOnboardingModal');
    applyProfileDefaultsToDiscover();
    switchView('add');
    loadPersonalizedRecommendations();
    showToast('Taste profile saved. Your picks are ready.', 'success');
}

// Skip taste setup once and save that choice so it does not reopen automatically.
async function completeTasteOnboarding() {
    if (!currentUser) return;
    userProfile.hasCompletedTasteOnboarding = true;
    try { localStorage.setItem(`watchlist_taste_done_${currentUser.uid}`, 'true'); } catch (error) { /* Keep completion in the profile. */ }
    await persistUserProfileSilently();
    hideModal('tasteOnboardingModal');
}

// Clear saved seeds and reopen the taste picker from Profile & OTTs.
async function resetTasteOnboarding() {
    if (!currentUser) return;
    userProfile.tasteSeedMovies = [];
    userProfile.hasCompletedTasteOnboarding = false;
    tasteSelectedSeeds.clear();
    try { localStorage.removeItem(`watchlist_taste_done_${currentUser.uid}`); } catch (error) { /* The profile still records the reset. */ }
    await persistUserProfileSilently();
    closeProfileModal();
    openTasteOnboardingModal();
}

// Profile sync: load this user's local preferences first, then merge Firestore data when available.
async function loadUserProfile() {
    if (!currentUser) return;
    const uid = currentUser.uid;
    let localProfile = { subscriptions: [], languages: [], genres: [], dismissedIds: [], hasCompletedTour: false, hasCompletedTasteOnboarding: false, tasteSeedMovies: [] };
    try {
        localProfile = normalizeUserProfile(JSON.parse(localStorage.getItem(getUserProfileStorageKey(uid)) || '{}'));
    } catch (error) {
        localProfile = normalizeUserProfile(null);
    }
    if (!currentUser || currentUser.uid !== uid) return;
    userProfile = localProfile;
    userProfileUid = uid;
    applyProfileDefaultsToDiscover();
    updateWatchableNowButton();
    renderWatchlist();

    try {
        if (db) {
            const snapshot = await db.collection('users').doc(uid).get();
            if (currentUser?.uid === uid && snapshot.exists) {
                userProfile = normalizeUserProfile({ ...userProfile, ...snapshot.data() });
                try { localStorage.setItem(getUserProfileStorageKey(uid), JSON.stringify(userProfile)); } catch (error) { /* Keep the Firestore profile in memory. */ }
            }
        }
    } catch (error) {
        // Profile reads may be blocked until Firestore rules are configured; local preferences still work.
    }
    if (currentUser?.uid === uid) {
        applyProfileDefaultsToDiscover();
        updateWatchableNowButton();
        renderWatchlist();
        const tourDoneLocally = localStorage.getItem(`watchlist_tour_done_${uid}`) === 'true';
        const tasteDoneLocally = localStorage.getItem(`watchlist_taste_done_${uid}`) === 'true';
        if (!userProfile.hasCompletedTour && !tourDoneLocally) {
            window.setTimeout(() => { if (currentUser?.uid === uid && !userProfile.hasCompletedTour) startWatchlistTour(); }, 600);
        } else {
            if (!userProfile.hasCompletedTour && tourDoneLocally) {
                userProfile.hasCompletedTour = true;
                persistUserProfileSilently();
            }
            if (!userProfile.hasCompletedTasteOnboarding && !tasteDoneLocally) {
                window.setTimeout(() => { if (currentUser?.uid === uid && userProfile.hasCompletedTour && !userProfile.hasCompletedTasteOnboarding) openTasteOnboardingModal(); }, 600);
            }
        }
    }
}

// Profile modal: show the currently loaded preferences in their checkbox groups.
async function openProfileModal() {
    if (currentUser && userProfileUid !== currentUser.uid) {
        userProfileLoadPromise = loadUserProfile();
        await userProfileLoadPromise;
    } else {
        await userProfileLoadPromise;
    }
    const profile = userProfileUid === currentUser?.uid ? userProfile : normalizeUserProfile(null);
    const hiddenCount = document.getElementById('hiddenRecommendationsCount');
    if (hiddenCount) hiddenCount.textContent = String(profile.dismissedIds.length);
    document.querySelectorAll('#profileModal [data-profile-group]').forEach(input => {
        input.checked = profile[input.dataset.profileGroup]?.includes(input.dataset.profileValue) || false;
    });
    showModal('profileModal');
}

// Profile modal: close the dialog and cancel any pending Watchable Now activation.
function closeProfileModal() {
    hideModal('profileModal');
    pendingWatchableActivation = false;
}

// Profile sync: save preferences locally and attempt to sync them to the signed-in user's document.
async function saveUserProfile() {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const profile = { ...userProfile, subscriptions: [], languages: [], genres: [] };
    document.querySelectorAll('#profileModal [data-profile-group]:checked').forEach(input => {
        profile[input.dataset.profileGroup].push(input.dataset.profileValue);
    });
    userProfile = normalizeUserProfile(profile);
    userProfileUid = uid;
    try { localStorage.setItem(getUserProfileStorageKey(uid), JSON.stringify(userProfile)); } catch (error) { console.warn('Could not save profile preferences in local storage.', error); }
    const shouldEnableWatchableNow = pendingWatchableActivation;
    hideModal('profileModal');
    trendingCache.clear();
    if (shouldEnableWatchableNow) onlyWatchableNow = userProfile.subscriptions.length > 0;
    else if (userProfile.subscriptions.length === 0) onlyWatchableNow = false;
    pendingWatchableActivation = false;
    applyProfileDefaultsToDiscover();
    updateWatchableNowButton();
    renderWatchlist();
    if (document.getElementById('trendingPanel')?.open) resetTrendingDiscover();
    await persistUserProfileSilently();
}

// Save profile fields locally and sync them without changing modal state.
async function persistUserProfileSilently() {
    if (!currentUser || userProfileUid !== currentUser.uid) return;
    const uid = currentUser.uid;
    userProfile = normalizeUserProfile(userProfile);
    try { localStorage.setItem(getUserProfileStorageKey(uid), JSON.stringify(userProfile)); } catch (error) { /* Keep the current profile in memory. */ }
    try { if (db) await db.collection('users').doc(uid).set(userProfile, { merge: true }); } catch (error) { /* Local storage remains available. */ }
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
        openProfileModal();
        return;
    }
    onlyWatchableNow = !onlyWatchableNow;
    updateWatchableNowButton();
    updateLibraryFilterIndicator();
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

// Listen for shared lists this signed-in user can access.
function loadSharedLists() {
    if (unsubscribeSharedLists) {
        unsubscribeSharedLists();
        unsubscribeSharedLists = null;
    }
    if (!db || !currentUser) return;
    unsubscribeSharedLists = db.collection('lists')
        .where('members', 'array-contains', currentUser.uid)
        .onSnapshot(snapshot => {
            userSharedLists = [];
            const seenListIds = new Set();
            snapshot.docs.forEach(doc => {
                if (seenListIds.has(doc.id)) return;
                seenListIds.add(doc.id);
                userSharedLists.push({ id: doc.id, ...doc.data() });
            });
            if (activeListId !== 'personal' && !userSharedLists.some(list => list.id === activeListId)) {
                activeListId = 'personal';
                setupFirebaseListener();
            }
            updateActiveListControls();
            renderSharedLists();
        }, error => {
            console.error('Could not load shared lists.', error);
            const status = document.getElementById('sharedListsStatus');
            if (status) status.textContent = 'Shared lists could not be loaded. Check your Firestore access rules.';
        });
}

// Create a shared list with a short code that members can share.
async function createSharedList() {
    const nameInput = document.getElementById('newSharedListName');
    const createButton = document.getElementById('createSharedListBtn');
    const status = document.getElementById('sharedListsStatus');
    const name = nameInput?.value.trim();
    if (isCreatingList || !currentUser || !db) return;
    if (!name) {
        if (status) status.textContent = 'Enter a name for your shared list.';
        return;
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let inviteCode = '';
    if (window.crypto?.getRandomValues) {
        const randomValues = new Uint32Array(6);
        window.crypto.getRandomValues(randomValues);
        inviteCode = [...randomValues].map(value => alphabet[value % alphabet.length]).join('');
    } else {
        inviteCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    }
    isCreatingList = true;
    if (createButton) createButton.disabled = true;
    try {
        const listRef = await db.collection('lists').add({
            name,
            ownerId: currentUser.uid,
            inviteCode,
            members: [currentUser.uid]
        });
        if (!userSharedLists.some(list => list.id === listRef.id)) {
            userSharedLists.push({ id: listRef.id, name, ownerId: currentUser.uid, inviteCode, members: [currentUser.uid] });
        }
        updateActiveListControls();
        renderSharedLists();
        nameInput.value = '';
        if (status) status.textContent = 'Shared list created.';
        switchActiveList(listRef.id);
    } catch (error) {
        console.error('Could not create shared list.', error);
        if (status) status.textContent = 'Could not create the list. Check your Firestore access rules.';
    } finally {
        isCreatingList = false;
        if (createButton) createButton.disabled = false;
    }
}

// Join a shared list using its six-character invite code.
async function joinSharedList(code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    const status = document.getElementById('sharedListsStatus');
    if (!currentUser || !db) return;
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
        if (status) status.textContent = 'Enter a valid six-character invite code.';
        return;
    }
    try {
        const snapshot = await db.collection('lists').where('inviteCode', '==', cleanCode).limit(1).get();
        if (snapshot.empty) {
            if (status) status.textContent = 'No shared list was found for that code.';
            return;
        }
        const listDoc = snapshot.docs[0];
        await listDoc.ref.update({ members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        const joinedList = { id: listDoc.id, ...listDoc.data(), members: [...new Set([...(listDoc.data().members || []), currentUser.uid])] };
        userSharedLists = [...userSharedLists.filter(list => list.id !== listDoc.id), joinedList];
        updateActiveListControls();
        renderSharedLists();
        document.getElementById('joinInviteCodeInput').value = '';
        if (status) status.textContent = `Joined ${listDoc.data().name || 'shared list'}.`;
        switchActiveList(listDoc.id);
    } catch (error) {
        console.error('Could not join shared list.', error);
        if (status) status.textContent = 'Could not join the list. Check your Firestore access rules.';
    }
}

// Ask before leaving a shared list or deleting one you own.
function leaveOrDeleteSharedList(listId) {
    const list = userSharedLists.find(item => item.id === listId);
    if (!db || !currentUser || !list) return;
    const isOwner = list.ownerId === currentUser.uid;
    pendingSharedListActionId = listId;
    document.getElementById('sharedListConfirmTitle').textContent = isOwner ? 'Delete shared list?' : 'Leave shared list?';
    document.getElementById('sharedListConfirmMessage').textContent = isOwner
        ? 'This removes the list and all its titles. This cannot be undone.'
        : 'You will no longer see this shared list. You can join again with its invite code.';
    document.getElementById('confirmSharedListActionBtn').textContent = isOwner ? 'Delete List' : 'Leave List';
    showModal('sharedListConfirmModal');
}

// Carry out the confirmed shared-list action using the existing membership rules.
async function confirmLeaveOrDeleteSharedList() {
    const listId = pendingSharedListActionId;
    const list = userSharedLists.find(item => item.id === listId);
    if (!db || !currentUser || !list) return closeSharedListConfirmModal();
    const isOwner = list.ownerId === currentUser.uid;
    closeSharedListConfirmModal();
    try {
        if (isOwner) {
            const snapshot = await db.collection('watchlist').where('listId', '==', listId).get();
            for (let start = 0; start < snapshot.docs.length; start += 500) {
                const batch = db.batch();
                snapshot.docs.slice(start, start + 500).forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            await db.collection('lists').doc(listId).delete();
        } else {
            await db.collection('lists').doc(listId).update({
                members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
        }
        if (activeListId === listId) switchActiveList('personal');
    } catch (error) {
        console.error('Could not update shared list membership.', error);
        const status = document.getElementById('sharedListsStatus');
        if (status) status.textContent = 'Could not update this list. Check your Firestore access rules.';
    }
}

// Close the shared-list confirmation dialog without changing membership.
function closeSharedListConfirmModal() {
    pendingSharedListActionId = null;
    hideModal('sharedListConfirmModal');
}

function closeSharedListsModal() {
    hideModal('sharedListModal');
}

// Switch the library and add destination to the selected list.
function switchActiveList(listId) {
    const isAvailable = listId === 'personal' || userSharedLists.some(list => list.id === listId);
    activeListId = isAvailable ? listId : 'personal';
    updateActiveListControls();
    selectedDocIds.clear();
    setupFirebaseListener();
}

// Keep the list picker, add badge, and bulk-delete safety in sync.
function updateActiveListControls() {
    const picker = document.getElementById('activeListSelect');
    if (picker) {
        picker.replaceChildren();
        const personalOption = document.createElement('option');
        personalOption.value = 'personal';
        personalOption.textContent = '👤 My Private List';
        picker.appendChild(personalOption);
        userSharedLists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = `👨‍👩‍👧‍👦 ${list.name || 'Shared List'}`;
            picker.appendChild(option);
        });
        picker.value = activeListId;
    }
    const activeList = userSharedLists.find(list => list.id === activeListId);
    const badge = document.getElementById('addingTargetBadge');
    if (badge) badge.textContent = activeList ? `Adding to: 👨‍👩‍👧‍👦 ${activeList.name || 'Shared List'}` : 'Adding to: 👤 My Private List';
    const banner = document.getElementById('sharedListBanner');
    const bannerText = document.getElementById('sharedListBannerText');
    if (banner) banner.classList.toggle('hidden', !activeList);
    if (bannerText && activeList) bannerText.textContent = `Code: ${activeList.inviteCode || 'Unavailable'}`;
    document.getElementById('deleteAllBtn')?.classList.toggle('hidden', activeListId !== 'personal');
}

// Copy the active shared list's code or invite link.
async function copyActiveSharedListValue(kind) {
    const list = userSharedLists.find(item => item.id === activeListId);
    if (!list) return;
    const value = kind === 'link'
        ? `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(list.inviteCode || '')}`
        : list.inviteCode || '';
    try {
        await navigator.clipboard.writeText(value);
        showToast(kind === 'link' ? 'Invite link copied.' : 'Invite code copied.');
    } catch (error) {
        showToast('Clipboard access is unavailable in this browser.', 'error');
    }
}

// Show shared lists with invite codes and membership actions.
function renderSharedLists() {
    const container = document.getElementById('sharedListsContainer');
    if (!container) return;
    container.replaceChildren();
    if (!userSharedLists.length) {
        const empty = document.createElement('p');
        empty.className = 'rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-500 dark:text-slate-400';
        empty.textContent = 'You have not joined any shared lists yet.';
        container.appendChild(empty);
        return;
    }
    userSharedLists.forEach(list => {
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3';
        const details = document.createElement('div');
        details.className = 'min-w-0';
        const name = document.createElement('p');
        name.className = 'truncate text-sm font-semibold';
        name.textContent = list.name || 'Shared List';
        const code = document.createElement('p');
        code.className = 'text-[10px] text-slate-500 dark:text-slate-400';
        code.textContent = `Invite code: ${list.inviteCode || 'Unavailable'}`;
        details.append(name, code);
        const actions = document.createElement('div');
        actions.className = 'flex gap-2';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-[10px] font-semibold hover:border-sky-400';
        copy.textContent = 'Copy Link';
        copy.addEventListener('click', async () => {
            const link = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(list.inviteCode || '')}`;
            try {
                await navigator.clipboard.writeText(link);
                showToast('Invite link copied.');
            } catch (error) {
                showToast('Clipboard access is unavailable in this browser.', 'error');
            }
        });
        const leave = document.createElement('button');
        leave.type = 'button';
        leave.className = 'rounded border border-rose-300 dark:border-rose-800 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400';
        leave.textContent = list.ownerId === currentUser?.uid ? 'Delete' : 'Leave';
        leave.addEventListener('click', () => leaveOrDeleteSharedList(list.id));
        actions.append(copy, leave);
        row.append(details, actions);
        container.appendChild(row);
    });
}

function setupFirebaseListener() {
    if (currentUser) userProfileLoadPromise = loadUserProfile();
    if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
    }
    if (db && currentUser) {
        const listeningListId = activeListId;
        const listeningUserId = currentUser.uid;
        const query = listeningListId === 'personal'
            ? db.collection('watchlist').where('userId', '==', currentUser.uid)
            : db.collection('watchlist').where('listId', '==', listeningListId);
        unsubscribeWatchlist = query.onSnapshot(snapshot => {
                if (activeListId !== listeningListId || currentUser?.uid !== listeningUserId) return;
                currentWatchlistItems = [];
                snapshot.forEach(doc => {
                    const item = doc.data();
                    if (listeningListId !== 'personal' || !item.listId) {
                        currentWatchlistItems.push({ docId: doc.id, ...item });
                    }
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
// Show a brief success, info, or error message without blocking the screen.
function showToast(message, variant = 'success', action = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const variantClasses = {
        success: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        error: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
        info: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200'
    };
    toast.className = `rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${variantClasses[variant] || variantClasses.success}`;
    toast.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);
    if (action?.label && typeof action.onClick === 'function') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        button.className = 'ml-3 underline underline-offset-2';
        button.addEventListener('click', () => { action.onClick(); toast.remove(); });
        toast.appendChild(button);
    }
    container.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2', 'transition-all');
        window.setTimeout(() => toast.remove(), 250);
    }, 3200);
}

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

// Filter dropdowns: read checked values for a Library or Discover checkbox group.
function getMultiFilterValues(scope, name) {
    return [...document.querySelectorAll(`[data-multi-scope="${scope}"][data-multi-name="${name}"]:checked`)]
        .map(input => input.value);
}

// Build tappable multi-select chips and keep their checked state readable.
function renderPillFilterGroup(containerId, scope, name, options, selectedValues = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.classList.add('flex', 'flex-wrap', 'gap-1.5');
    const normalizedOptions = [...options];
    selectedValues.forEach(value => {
        if (!normalizedOptions.some(option => option.value === value)) normalizedOptions.push({ value, label: value });
    });
    container.replaceChildren();
    normalizedOptions.forEach(option => {
        const label = document.createElement('label');
        label.className = `option-chip cursor-pointer${selectedValues.includes(option.value) ? ' active' : ''}`;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = option.value;
        input.checked = selectedValues.includes(option.value);
        input.dataset.multiScope = scope;
        input.dataset.multiName = name;
        input.className = 'sr-only';
        input.addEventListener('change', () => {
            label.classList.toggle('active', input.checked);
            if (scope === 'library') {
                syncQuickFilterPills();
                updateLibraryFilterIndicator();
                renderWatchlist();
            } else {
                discoverMode = 'custom';
                updateDiscoverFilterUI();
                resetTrendingDiscover();
            }
        });
        label.append(input, document.createTextNode(option.label));
        container.appendChild(label);
    });
}

// Keep the quick-filter row visually matched to its selected filter chips.
function syncQuickFilterPills() {
    document.querySelectorAll('[data-quick-scope][data-quick-name][data-quick-value]').forEach(button => {
        const selected = getMultiFilterValues(button.dataset.quickScope, button.dataset.quickName).includes(button.dataset.quickValue);
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
}

// Toggle a library filter from its one-tap shortcut.
function toggleQuickFilterPill(button) {
    const { quickScope: scope, quickName: name, quickValue: value } = button.dataset;
    const values = getMultiFilterValues(scope, name);
    setMultiFilterValues(scope, name, values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
    syncQuickFilterPills();
    renderWatchlist();
}

// Filter dropdowns: update the compact summary and preserve requested selections.
function renderCheckboxDropdown(containerId, scope, name, options, selectedValues = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selected = new Set(selectedValues);
    const normalizedOptions = [...options];
    selectedValues.forEach(value => {
        if (!normalizedOptions.some(option => option.value === value)) normalizedOptions.push({ value, label: value });
    });

    const details = document.createElement('details');
    details.className = 'relative';
    const summary = document.createElement('summary');
    summary.className = 'flex cursor-pointer list-none items-center justify-between rounded border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs';
    const summaryText = document.createElement('span');
    summaryText.dataset.multiSummary = `${scope}:${name}`;
    summary.appendChild(summaryText);
    const caret = document.createElement('span');
    caret.textContent = '▾';
    caret.className = 'ml-2 text-slate-500';
    summary.appendChild(caret);
    details.appendChild(summary);

    const panel = document.createElement('div');
    panel.className = 'absolute left-0 top-full z-30 mt-1 max-h-56 min-w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl';
    normalizedOptions.forEach(option => {
        const label = document.createElement('label');
        label.className = 'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-1.5 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = option.value;
        input.checked = selected.has(option.value);
        input.dataset.multiScope = scope;
        input.dataset.multiName = name;
        input.className = 'accent-sky-500';
        input.addEventListener('change', () => {
            updateCheckboxDropdownSummary(details);
            if (scope === 'library') renderWatchlist();
            else resetTrendingDiscover();
        });
        label.append(input, document.createTextNode(option.label));
        panel.appendChild(label);
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.className = 'mt-1 w-full border-t border-slate-200 dark:border-slate-700 pt-2 text-left text-[10px] font-bold text-sky-600 hover:text-sky-500';
    clear.addEventListener('click', event => {
        event.preventDefault();
        panel.querySelectorAll('input:checked').forEach(input => { input.checked = false; });
        updateCheckboxDropdownSummary(details);
        details.open = false;
        if (scope === 'library') renderWatchlist();
        else resetTrendingDiscover();
    });
    panel.appendChild(clear);
    details.appendChild(panel);
    container.replaceChildren(details);
    updateCheckboxDropdownSummary(details);
}

// Filter dropdowns: display All for an empty selection or the number of checked options.
function updateCheckboxDropdownSummary(details) {
    const scopeName = details.querySelector('[data-multi-summary]')?.dataset.multiSummary;
    const summary = details.querySelector('[data-multi-summary]');
    const selectedCount = details.querySelectorAll('input[data-multi-scope]:checked').length;
    if (summary) summary.textContent = selectedCount ? `${selectedCount} selected` : 'All';
    if (scopeName) details.setAttribute('aria-label', `${scopeName.split(':')[1]} filter: ${selectedCount ? `${selectedCount} selected` : 'All'}`);
}

// Filter dropdowns: set selections after profile preferences are loaded.
function setMultiFilterValues(scope, name, values) {
    document.querySelectorAll(`[data-multi-scope="${scope}"][data-multi-name="${name}"]`).forEach(input => {
        input.checked = values.includes(input.value);
        input.parentElement?.classList.toggle('active', input.checked);
    });
    const details = document.querySelector(`[data-multi-summary="${scope}:${name}"]`)?.closest('details');
    if (details) updateCheckboxDropdownSummary(details);
    if (scope === 'library') {
        syncQuickFilterPills();
        updateLibraryFilterIndicator();
    } else updateDiscoverFilterUI();
}

// Build default library and discovery chips, then fill library choices from saved titles.
function initMultiSelectFilters() {
    renderPillFilterGroup('trendingGenreOptions', 'trending', 'genre', [
        'Action', 'Comedy', 'Drama', 'Crime', 'Thriller', 'Romance', 'Sci-Fi', 'Horror', 'Animation', 'Documentary'
    ].map(value => ({ value, label: value })));
    renderPillFilterGroup('trendingLanguageOptions', 'trending', 'language', [
        { value: 'my_langs', label: '✨ My Languages' },
        ...Object.entries({ en: 'English', hi: 'Hindi', ko: 'Korean', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', ja: 'Japanese', es: 'Spanish', fr: 'French' })
            .map(([value, label]) => ({ value, label }))
    ]);
    renderPillFilterGroup('trendingPlatformOptions', 'trending', 'platform', [
        { value: 'my_subs', label: '✨ My Subscriptions' },
        ...OTT_SERVICES.map(value => ({ value, label: value }))
    ]);
    renderSingleSelectPills('trendingTypeOptions', 'trendingType', [
        { value: 'All', label: 'All' }, { value: 'movie', label: 'Movies' }, { value: 'tv', label: 'TV Shows' }
    ], 'All', handleCustomDiscoverFilterChange);
    renderSingleSelectPills('trendingFreshnessOptions', 'trendingFreshness', [
        { value: '6m', label: '🔥 Fresh on OTT' }, { value: 'all', label: 'All Time' }
    ], '6m', handleCustomDiscoverFilterChange);
    renderSingleSelectPills('trendingSortOptions', 'trendingSort', [
        { value: 'popularity', label: 'Trending' }, { value: 'newest', label: 'Newest' }
    ], 'popularity', handleCustomDiscoverFilterChange);
    populateFilterDropdowns();
}

function populateFilterDropdowns() {
    const items = getWatchlist();
    const genres = [...new Set(items.map(item => item.genre).filter(Boolean))].sort();
    const languages = [...new Set([...items.map(getItemLanguage), 'Hindi', 'English', 'Korean'])].sort((a, b) => {
        if (a === 'Unknown Language') return 1;
        if (b === 'Unknown Language') return -1;
        return a.localeCompare(b);
    });
    const platforms = [...new Set([...items.flatMap(item => item.platforms || [item.platform]).filter(Boolean).map(normalizePlatformName), ...OTT_SERVICES])].sort();
    const selectedTypes = getMultiFilterValues('library', 'type');
    const selectedGenres = getMultiFilterValues('library', 'genre');
    const selectedLanguages = getMultiFilterValues('library', 'language');
    const selectedPlatforms = getMultiFilterValues('library', 'platform');
    renderPillFilterGroup('filterTypeOptions', 'library', 'type', [
        { value: 'movie', label: 'Movies' }, { value: 'tv', label: 'TV Shows' }
    ], selectedTypes);
    renderPillFilterGroup('filterGenreOptions', 'library', 'genre', genres.map(value => ({ value, label: value })), selectedGenres);
    renderPillFilterGroup('filterLanguageOptions', 'library', 'language', languages.map(value => ({ value, label: value })), selectedLanguages);
    renderPillFilterGroup('filterPlatformOptions', 'library', 'platform', platforms.map(value => ({ value, label: value })), selectedPlatforms);
    syncQuickFilterPills();
}

// ==========================================
// 4. TMDB Details & Rendering Engine
// ==========================================
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
            poster.className = 'h-40 w-28 rounded-lg object-cover cursor-pointer';
            poster.tabIndex = 0;
            poster.setAttribute('role', 'button');
            poster.addEventListener('click', () => openDetailPreview(candidate));
            card.appendChild(poster);
        } else {
            const posterFallback = document.createElement('div');
            posterFallback.textContent = '🎬';
            posterFallback.className = 'flex h-32 w-24 shrink-0 items-center justify-center rounded bg-slate-200 dark:bg-slate-800 text-3xl';
            posterFallback.classList.add('cursor-pointer');
            posterFallback.addEventListener('click', () => openDetailPreview(candidate));
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
        const synopsis = document.createElement('p');
        synopsis.textContent = candidate.overview || '';
        synopsis.className = 'mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400';
        info.append(title, typeBadge, metadata, synopsis);

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
                } else showToast(`Added ${candidate.title}.`);
            } catch (error) {
                showToast(`Could not add title: ${error.message}`, 'error');
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
    const spinner = document.getElementById('candidateSearchSpinner');
    const requestToken = ++candidateSearchToken;
    if (!container) return;
    if (!query) {
        container.replaceChildren();
        spinner?.classList.add('hidden');
        if (button) button.disabled = false;
        showToast('Enter a title to search.', 'info');
        return;
    }

    if (button) button.disabled = true;
    spinner?.classList.remove('hidden');
    renderCandidateSearchLoading(container);
    try {
        const candidates = await searchTMDBCandidates(query);
        if (requestToken === candidateSearchToken) renderCandidateResults(candidates);
    } catch (error) {
        if (requestToken === candidateSearchToken) {
            container.textContent = `Could not search TMDB: ${error.message}`;
            showToast(`Search failed: ${error.message}`, 'error');
        }
    } finally {
        if (requestToken === candidateSearchToken) {
            spinner?.classList.add('hidden');
            if (button) button.disabled = false;
        }
    }
}

function renderCandidateSearchLoading(container) {
    container.replaceChildren();
    container.className = 'mt-4 grid gap-2';
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3';
    row.innerHTML = '<span class="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" aria-hidden="true"></span><span class="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></span><span class="sr-only">Searching TMDB</span>';
    container.appendChild(row);
}

async function fetchIndiaProviders(mediaType, tmdbId) {
    return fetchCandidateIndiaPlatforms(mediaType, tmdbId);
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
            overview: candidate.overview || '',
            platform: providers.platform,
            platforms: providers.platforms,
            freePlatforms: providers.freePlatforms,
            watched: false,
            addedBy: user.displayName || user.email,
            userId: user.uid,
            ...(activeListId !== 'personal' ? { listId: activeListId } : {})
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

// Open a quick preview with title details and the right add or watched action.
async function openDetailPreview(item, isSaved = Boolean(item?.docId)) {
    if (!item) return;
    showModal('detailPreviewModal');
    activePreviewItem = item;
    activePreviewSaved = isSaved;
    const poster = document.getElementById('detailPreviewPoster');
    const fallback = document.getElementById('detailPreviewPosterFallback');
    const title = document.getElementById('detailPreviewTitle');
    const metadata = document.getElementById('detailPreviewMeta');
    const platforms = document.getElementById('detailPreviewPlatforms');
    const overview = document.getElementById('detailPreviewOverview');
    const aiReason = document.getElementById('detailPreviewAIReason');
    const action = document.getElementById('detailPreviewActionBtn');
    const manageActions = document.getElementById('detailPreviewManageActions');
    document.getElementById('detailPreviewCandidateActions')?.classList.toggle('hidden', isSaved || !(item.id || item.tmdbId));
    const imageUrl = item.poster || null;
    poster.classList.toggle('hidden', !imageUrl);
    fallback.classList.toggle('hidden', Boolean(imageUrl));
    fallback.classList.toggle('flex', !imageUrl);
    if (imageUrl) {
        poster.src = imageUrl.replace('/w200/', '/w500/');
        poster.alt = `Poster for ${item.title || 'title'}`;
    } else poster.removeAttribute('src');
    title.textContent = item.title || 'Untitled';
    metadata.textContent = `${item.year || 'N/A'} · ${item.typeLabel || (item.mediaType === 'tv' || item.type === 'tv' ? '📺 TV Show' : '🎬 Movie')} · ⭐ ${item.rating || 'N/A'} · ${item.language || 'Unknown Language'}`;
    overview.textContent = item.overview || 'No synopsis is available for this title.';
    aiReason?.classList.toggle('hidden', !item.aiReason);
    if (aiReason) aiReason.textContent = item.aiReason ? `🤖 AI Pick: ${item.aiReason}` : '';
    const renderProviders = () => {
        const paid = item.platforms || [];
        const free = item.freePlatforms || [];
        platforms.textContent = [paid.length ? `🇮🇳 Subscription OTTs: ${paid.join(', ')}` : '', free.length ? `🆓 Free / With Ads: ${free.join(', ')}` : ''].filter(Boolean).join(' · ') || '🇮🇳 India OTTs: Not available';
    };
    renderProviders();
    action.textContent = isSaved ? (item.watched ? '↩️ Mark To Watch' : '✓ Mark Watched') : '+ Add to Watchlist';
    manageActions?.classList.toggle('hidden', !isSaved);
    if ((!Array.isArray(item.platforms) || !Array.isArray(item.freePlatforms)) && (item.id || item.tmdbId)) {
        platforms.textContent = '🇮🇳 India OTTs: Loading…';
        const mediaType = item.mediaType || item.type;
        const providerNames = await fetchCandidateIndiaPlatforms(mediaType, item.id || item.tmdbId);
        if (activePreviewItem === item) {
            item.platforms = providerNames.platforms;
            item.freePlatforms = providerNames.freePlatforms;
            if (!item.platform || item.platform === 'Not Streaming in IN') item.platform = providerNames.platform;
            renderProviders();
        }
    }
}

// Close the title preview sheet.
function closeDetailPreview() {
    hideModal('detailPreviewModal');
    activePreviewItem = null;
}

// Add the previewed title or toggle its watched state.
async function handleDetailPreviewAction() {
    if (!activePreviewItem) return;
    const action = document.getElementById('detailPreviewActionBtn');
    if (action?.disabled) return;
    if (action) action.disabled = true;
    try {
        if (activePreviewSaved && activePreviewItem.docId) {
            await toggleWatched(activePreviewItem.docId);
            showToast(activePreviewItem.watched ? 'Moved back to To Watch.' : 'Marked as watched.');
        } else {
            const saved = await saveCandidateToWatchlist(activePreviewItem);
            showToast(saved ? 'Added to your watchlist.' : 'This title is already saved.', saved ? 'success' : 'info');
        }
        closeDetailPreview();
    } catch (error) {
        showToast(`Could not update title: ${error.message}`, 'error');
    } finally {
        if (action) action.disabled = false;
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
        poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
        overview: result.overview || '',
        popularity: result.popularity || 0,
        sortDate: result.release_date || result.first_air_date || ''
    };
}

// Fetch subscription, free, and ad supported India services for one title.
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

// Provider lookup: fetch India service IDs once and combine normalized aliases.
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

// Date helper: format dates using the browser's local calendar for the India window.
function formatTrendingDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Discover pagination: restart results and identifiers after any filter changes.
function resetTrendingDiscover() {
    trendingPage = 1;
    displayedTrendingIds.clear();
    document.getElementById('loadMoreTrendingBtn')?.classList.add('hidden');
    loadTrendingDiscover();
}

// Recommend titles from watched items, then the user's saved taste seeds.
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
        const unique = [...new Map(merged.map(candidate => [String(candidate.id), candidate])).values()]
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

// Discover pagination: request the next TMDB page and append fresh titles.
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
        const queryJobs = mediaTypes.flatMap(mediaType => languages.map(languageCode => ({ mediaType, languageCode })));
        const resultSets = await Promise.all(queryJobs.map(async ({ mediaType, languageCode }) => {
            const params = new URLSearchParams({
                watch_region: 'IN',
                with_watch_monetization_types: 'flatrate',
                'vote_count.gte': '10',
                sort_by: sort === 'newest'
                    ? (mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc')
                    : 'popularity.desc'
            });
            params.set('page', String(page));
            if (providerIds) params.set('with_watch_providers', providerIds);

            const genreIds = [...new Set(selectedGenres.flatMap(genreName => {
                const genreId = TRENDING_GENRE_IDS[genreName]?.[mediaType];
                return genreId ? [String(genreId)] : [];
            }))];
            if (genreIds.length) params.set('with_genres', genreIds.join('|'));
            if (languageCode !== 'All') params.set('with_original_language', languageCode);

            if (freshness === '6m') {
                if (mediaType === 'movie') {
                    params.set('region', 'IN');
                    params.set('with_release_type', '4');
                    params.set('release_date.gte', startDate);
                    params.set('release_date.lte', today);
                    params.set('primary_release_date.gte', twelveMonthStartDate);
                } else {
                    params.set('first_air_date.gte', startDate);
                    params.set('first_air_date.lte', today);
                }
            }

            const response = await fetch(buildTMDBUrl(`/discover/${mediaType}`, params));
            if (!response.ok) throw new Error(`TMDB ${mediaType} discover returned ${response.status}.`);
            const data = await response.json();
            return { languageCode, candidates: (data.results || []).map(result => mapTrendingResult(result, mediaType)) };
        }));

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
            candidates = [...new Map(candidates.map(candidate => [String(candidate.id), candidate])).values()];
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

// Hide a Discover title and offer a one-tap undo.
async function dismissRecommendation(tmdbId, title = 'Recommendation') {
    if (!currentUser || userProfileUid !== currentUser.uid || tmdbId == null) return;
    const id = String(tmdbId);
    userProfile.dismissedIds = [...new Set([...(userProfile.dismissedIds || []), id])];
    trendingCache.clear();
    document.querySelector(`#trendingShelf article[data-tmdb-id="${CSS.escape(id)}"]`)?.remove();
    displayedTrendingIds.delete(id);
    const count = document.getElementById('hiddenRecommendationsCount');
    if (count) count.textContent = String(userProfile.dismissedIds.length);
    await persistUserProfileSilently();
    showToast(`Hidden ${title}.`, 'success', { label: 'Undo', onClick: () => undoDismissRecommendation(id) });
}

// Restore a hidden Discover title and refresh recommendations.
async function undoDismissRecommendation(tmdbId) {
    const id = String(tmdbId);
    userProfile.dismissedIds = (userProfile.dismissedIds || []).filter(value => String(value) !== id);
    trendingCache.clear();
    await persistUserProfileSilently();
    resetTrendingDiscover();
}

// Clear all hidden recommendations and reload Discover.
async function resetDismissedRecommendations() {
    userProfile.dismissedIds = [];
    const count = document.getElementById('hiddenRecommendationsCount');
    if (count) count.textContent = '0';
    trendingCache.clear();
    await persistUserProfileSilently();
    resetTrendingDiscover();
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
                    showToast(`Added ${candidate.title}.`);
                    bulkReviewItems = bulkReviewItems.filter(item => item !== review);
                    bulkUploadCounts.added += 1;
                    renderBulkReviewContainer();
                } catch (error) {
                    choice.disabled = false;
                    choice.textContent = `+ ${candidate.title} (${candidate.year})`;
                    showToast(`Could not add title: ${error.message}`, 'error');
                }
            });
            choices.appendChild(choice);
        });
        row.appendChild(choices);
        container.appendChild(row);
    });
    updateBulkStatus();
}

// Filter and render the active list using the saved grouping choices.
function renderWatchlist() {
    const container = document.getElementById('watchlistDisplay');
    if (!container) return;

    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase().trim() || '';
    const filterTypes = getMultiFilterValues('library', 'type');
    const filterPlatforms = getMultiFilterValues('library', 'platform').map(normalizePlatformName);
    const filterGenres = getMultiFilterValues('library', 'genre');
    const filterLanguages = getMultiFilterValues('library', 'language');
    const sortBy = document.getElementById('sortBy')?.value || 'default';
    const groupBy = document.getElementById('groupBySelect')?.value || 'none';
    const tuckWatched = document.getElementById('tuckWatchedToggle')?.checked ?? true;

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
    if (filterTypes.length) items = items.filter(item => filterTypes.includes(item.type));
    if (filterPlatforms.length) items = items.filter(item => getItemPlatforms(item).map(normalizePlatformName).some(platform => filterPlatforms.includes(platform)));
    if (filterGenres.length) items = items.filter(item => filterGenres.includes(item.genre));
    if (filterLanguages.length) items = items.filter(item => filterLanguages.includes(getItemLanguage(item)));
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

    if (tuckWatched) {
        const toWatch = items.filter(item => !item.watched);
        const watched = items.filter(item => item.watched);
        if (toWatch.length) renderWatchStatusSection(container, 'To Watch', toWatch, true, groupBy);
        if (watched.length) renderWatchStatusSection(container, 'Watched', watched, false, groupBy);
    } else {
        if (groupBy === 'none') renderGroupCards(container, items);
        else renderGroupedCards(container, items, groupBy);
    }
    updateBatchActionUI();
}

// Render a To Watch or Watched section, grouping its titles when requested.
function renderWatchStatusSection(parentContainer, label, items, isOpen, groupBy) {
    const section = document.createElement('details');
    section.open = isOpen;
    section.className = 'mb-4';
    const heading = document.createElement('summary');
    heading.className = 'cursor-pointer select-none font-bold text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 mb-2';
    heading.textContent = label;
    section.appendChild(heading);
    if (groupBy === 'none') renderGroupCards(section, items);
    else renderGroupedCards(section, items, groupBy);
    parentContainer.appendChild(section);
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
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 my-2';

    items.forEach(item => {
        renderedDocIds.add(item.docId);
        const card = document.createElement('div');
        card.className = 'movie-card min-w-0';
        const hasFreeOnly = !(item.platforms || []).length && (item.freePlatforms || []).length > 0;
        const mainPlatform = hasFreeOnly ? `Free: ${item.freePlatforms[0]}` : normalizePlatformName((item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform);
        const badgeClass = hasFreeOnly ? 'bg-emerald-600' : getPlatformBadgeClass(mainPlatform);
        const posterFrame = document.createElement('div');
        posterFrame.className = 'relative overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800';
        const poster = item.poster ? document.createElement('img') : document.createElement('div');
        poster.className = `library-poster aspect-[2/3] w-full cursor-pointer object-cover ${item.poster ? '' : 'flex items-center justify-center text-3xl'}`;
        if (item.poster) {
            poster.src = item.poster;
            poster.alt = `Poster for ${item.title}`;
            poster.tabIndex = 0;
            poster.setAttribute('role', 'button');
        } else {
            poster.textContent = '🎬';
            poster.tabIndex = 0;
            poster.setAttribute('role', 'button');
        }
        posterFrame.appendChild(poster);
        const badge = document.createElement('span');
        badge.className = `absolute right-2 top-2 max-w-[80%] truncate rounded-full px-2 py-1 text-[9px] font-bold uppercase text-white shadow ${badgeClass}`;
        badge.textContent = hasFreeOnly ? `🆓 ${mainPlatform}` : mainPlatform;
        posterFrame.appendChild(badge);
        const rating = document.createElement('span');
        rating.className = 'absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-1.5 py-1 text-[10px] font-semibold text-amber-300';
        rating.textContent = `⭐ ${item.rating || 'N/A'}`;
        posterFrame.appendChild(rating);
        if (isManageMode) {
            const selector = document.createElement('input');
            selector.type = 'checkbox';
            selector.setAttribute('aria-label', `Select ${item.title}`);
            selector.checked = selectedDocIds.has(item.docId);
            selector.className = 'absolute left-2 top-2 h-5 w-5 accent-sky-500';
            selector.addEventListener('change', () => toggleItemSelection(item.docId, selector.checked));
            posterFrame.appendChild(selector);
        }
        card.appendChild(posterFrame);
        const title = document.createElement('button');
        title.type = 'button';
        title.className = `mt-2 block w-full truncate text-left text-sm font-semibold text-slate-900 dark:text-slate-100 ${item.watched ? 'text-slate-400 line-through' : ''}`;
        title.textContent = item.title || 'Untitled';
        title.addEventListener('click', () => openDetailPreview(item, true));
        card.appendChild(title);
        const bottom = document.createElement('div');
        bottom.className = 'mt-1 flex min-w-0 items-center justify-between gap-1 text-[10px]';
        const watched = document.createElement('button');
        watched.type = 'button';
        watched.className = item.watched ? 'truncate font-semibold text-amber-600' : 'truncate font-semibold text-emerald-600';
        watched.textContent = item.watched ? '↩️ Unwatch' : '✓ Watched';
        watched.addEventListener('click', () => toggleWatched(item.docId));
        bottom.appendChild(watched);
        if (activeListId !== 'personal') {
            const attribution = document.createElement('span');
            attribution.className = 'truncate text-slate-400';
            attribution.textContent = `By ${item.addedBy || 'Member'}`;
            bottom.appendChild(attribution);
        }
        card.appendChild(bottom);
        const posterTrigger = card.querySelector('.library-poster');
        posterTrigger?.addEventListener('click', () => openDetailPreview(item, true));
        posterTrigger?.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDetailPreview(item, true);
            }
        });
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
        showToast(metadata.error, 'error');
        return;
    }

    const { valid, ...updates } = metadata;
    await db.collection('watchlist').doc(docId).update(updates);
    showToast('Title details refreshed.');
}

// ==========================================
// 5. Data Mutations (Watched / Add / Delete)
// ==========================================
// Social text parser: clean pasted captions into a deduplicated title list.
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

// Social text action: replace the bulk field with extracted titles and a clear status.
function handleExtractSocialTitles() {
    const textarea = document.getElementById('bulkTitles');
    const progressContainer = document.getElementById('bulkProgressContainer');
    const progressBar = document.getElementById('bulkProgressBar');
    const statusText = document.getElementById('bulkStatusText');
    const rawText = textarea?.value || '';

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (!rawText.trim()) {
        if (statusText) statusText.textContent = 'Paste a caption or list first.';
        showToast('Paste a caption or list first.', 'info');
        return;
    }

    const titles = extractTitlesFromSocialText(rawText);
    if (titles.length === 0) {
        const containsLink = /http|instagram\.com|youtube\.com|youtu\.be/i.test(rawText);
        if (statusText) {
            statusText.textContent = containsLink
                ? "Links can't be read directly—copy & paste the caption, description, or comment text instead."
                : 'No titles found. Paste a caption or title list and try again.';
        }
        showToast(containsLink ? 'Copy and paste the caption text; links cannot be read directly.' : 'No titles found in that text.', 'info');
        return;
    }

    if (textarea) textarea.value = titles.join('\n');
    if (progressBar) progressBar.style.width = '0%';
    if (statusText) statusText.textContent = `Extracted ${titles.length} title(s). Review the list and click Upload Titles.`;
}

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
        showToast('Please sign in before uploading titles.', 'error');
        return;
    }

    if (titles.length === 0) {
        if (statusText) statusText.textContent = 'Enter at least one title to upload.';
        if (progressContainer) progressContainer.classList.remove('hidden');
        showToast('Enter at least one title to upload.', 'info');
        return;
    }
    if (!db) {
        if (statusText) statusText.textContent = 'Firestore is not available.';
        if (progressContainer) progressContainer.classList.remove('hidden');
        showToast('Firestore is not available.', 'error');
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
    if (activeListId !== 'personal' || !db || currentWatchlistItems.length === 0) return;
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
