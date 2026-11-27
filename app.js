// Browser UI state, shared view helpers, and page startup.

if (!window.APP_CONFIG) {
    console.error('Application configuration is missing. Make sure config.js loads before app.js.');
}


let unsubscribeWatchlist = null;
let activeListId = 'personal';
let userSharedLists = [];
let unsubscribeSharedLists = null;
let isCreatingList = false;
let currentWatchlistItems = [];
let currentUser = null;
let userProfile = { subscriptions: [], languages: [], genres: [], dismissedIds: [], dismissedTitles: [], hasCompletedTour: false, hasCompletedTasteOnboarding: false, tasteSeedMovies: [] };
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
let tasteSteps = [];
let tasteStepIndex = 0;
let tastePage = 1;
let tastePairItems = [];
let tastePairSeen = new Set();
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

// ==========================================
// Page startup binds controls and keeps the signed-in auth gate in place.
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
    document.getElementById('askAiBtn')?.addEventListener('click', () => loadAIPicksRecommendations(false));
    document.getElementById('refreshAiPicksBtn')?.addEventListener('click', () => loadAIPicksRecommendations(true));
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
        document.getElementById('tasteLoadMoreBtn')?.classList.toggle('hidden', Boolean(query));
        if (!query) { renderTasteTitleGrid(tastePairItems); return; }
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
    document.getElementById('tasteNextBtn')?.addEventListener('click', nextTasteStep);
    document.getElementById('tasteBackBtn')?.addEventListener('click', previousTasteStep);
    document.getElementById('tasteSkipStepBtn')?.addEventListener('click', skipTasteStep);
    document.getElementById('tasteLoadMoreBtn')?.addEventListener('click', () => loadTastePairPage(true));
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
    if (viewName === 'add' && document.getElementById('trendingPanel')?.open) {
        if (discoverMode === 'ai') loadAIPicksRecommendations();
        else resetTrendingDiscover();
    }
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
// Connect each Discover preset chip to its matching filter preset.
// Ask the Worker for AI ideas, then resolve each title through TMDB.
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
// Profile data: keep only the supported subscription, language, and genre choices.
// Watchable Now: expose subscriptions only when they belong to the active account.
// Discover defaults: apply saved services, languages, and genres to For Me.
// Open the preference step with saved choices and prepare language/genre poster steps.
// Build the selected language × genre combinations, with sensible defaults.
// Show preferences or the current pair screen and refresh its posters.
// Move from preferences into poster browsing.
// Return one screen in the taste wizard.
// Skip the current pair and finish when the last pair is reached.
// Fetch a popularity sorted page for the current exact language and genre pair.
// Draw selectable language and genre pills from the app's supported choices.
// Render the poster picker and its selected state.
// Keep the selected-title count and early-finish highlight in sync.
// Save selected taste chips and seed titles to the signed-in profile.
// Skip taste setup once and save that choice so it does not reopen automatically.
// Clear saved seeds and reopen the taste picker from Profile & OTTs.
// Profile sync: load this user's local preferences first, then merge Firestore data when available.
// Profile modal: show the currently loaded preferences in their checkbox groups.
// Profile modal: close the dialog and cancel any pending Watchable Now activation.
// Profile sync: save preferences locally and attempt to sync them to the signed-in user's document.
// Save profile fields locally and sync them without changing modal state.
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

// Listen for shared lists this signed-in user can access.
// Create a shared list with a short code that members can share.
// Join a shared list using its six-character invite code.
// Ask before leaving a shared list or deleting one you own.
// Carry out the confirmed shared-list action using the existing membership rules.
// Close the shared-list confirmation dialog without changing membership.
// Switch the library and add destination to the selected list.
// Keep the list picker, add badge, and bulk-delete safety in sync.
// Copy the active shared list's code or invite link.
// Show shared lists with invite codes and membership actions.
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

// Fetch subscription, free, and ad supported India services for one title.
// Provider lookup: fetch India service IDs once and combine normalized aliases.
// Date helper: format dates using the browser's local calendar for the India window.
// Discover pagination: restart results and identifiers after any filter changes.
// Recommend titles from watched items, then the user's saved taste seeds.
// Discover pagination: request the next TMDB page and append fresh titles.
// Hide a Discover title and offer a one-tap undo.
// Restore a hidden Discover title and refresh recommendations.
// Clear all hidden recommendations and reload Discover.
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

// ==========================================
// 5. Data Mutations (Watched / Add / Delete)
// ==========================================
// Social text parser: clean pasted captions into a deduplicated title list.
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

