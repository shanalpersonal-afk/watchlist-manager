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

const WATCHLIST_TOUR_STEPS = [
    { selector: '#title', title: 'Add a title', description: 'Search for a movie or TV show here, then add it to your watchlist.' },
    { selector: '#bulkUploadToggle', title: 'Bulk upload', description: 'Open this panel to add several titles from a list, one title per line.' },
    { selector: '#filterDrawer', title: 'Filter your watchlist', description: 'Use filters, grouping, and sorting to find titles. On a phone, this drawer opens for the tour.' },
    { selector: '#primaryGroupSelect', title: 'Group your titles', description: 'Choose a primary group to organize your watchlist into collapsible sections.' },
    { selector: '#watchlistDisplay', title: 'Your watchlist', description: 'Your titles appear here. Select a card to use the batch actions above.' }
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
    const bulkToggle = document.getElementById('bulkUploadToggle');
    const bulkPanel = bulkToggle?.closest('details');
    if (bulkPanel && !bulkPanel.open) {
        tourOpenedBulkPanel = true;
        bulkPanel.open = true;
    }
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

    if (step.selector === '#filterDrawer' && window.innerWidth < 768 && getComputedStyle(tourTarget).display === 'none') {
        tourOpenedFilterDrawer = true;
        tourTarget.classList.remove('hidden');
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
    if (tourOpenedFilterDrawer) document.getElementById('filterDrawer')?.classList.add('hidden');

    activeTourStep = -1;
    tourTarget = null;
    tourOriginalStyles = null;
    tourOpenedBulkPanel = false;
    tourOpenedFilterDrawer = false;
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

function toggleFilterDrawer() {
    const drawer = document.getElementById('filterDrawer');
    if (drawer) drawer.classList.toggle('hidden');
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
    let items = getWatchlist();

    if (searchQuery !== '') items = items.filter(i => i.title.toLowerCase().includes(searchQuery));
    if (filterType !== 'All') items = items.filter(i => i.type === filterType);
    if (filterPlatform !== 'All') items = items.filter(i => (i.platforms || [i.platform]).map(normalizePlatformName).includes(filterPlatform));
    if (filterGenre !== 'All') items = items.filter(i => i.genre === filterGenre);
    if (filterLanguage !== 'All') items = items.filter(i => getItemLanguage(i) === filterLanguage);

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
        return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    };

    const makeSection = (label, level) => {
        const section = document.createElement('details');
        section.open = true;
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
        card.innerHTML = `
            <div class="relative">
                ${posterHtml}
                <span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full text-white uppercase shadow-md ${badgeClass}">${mainPlatform}</span>
                <span class="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-950/80 text-amber-300 backdrop-blur-sm">⭐ ${item.rating || 'N/A'}</span>
                <label class="absolute top-2 left-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-slate-950/80" title="Select ${item.title}">
                    <input type="checkbox" aria-label="Select ${item.title}" ${selectedDocIds.has(item.docId) ? 'checked' : ''} onchange="toggleItemSelection('${item.docId}', this.checked)" class="accent-sky-500">
                </label>
                ${needsMetadata ? `<button title="Refresh metadata" aria-label="Refresh metadata for ${item.title}" class="absolute top-2 left-11 w-7 h-7 rounded-full bg-slate-950/80 text-white hover:bg-sky-600" onclick="refreshMetadata('${item.docId}')">↻</button>` : ''}
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 ${item.watched ? 'line-through text-slate-400' : ''}">${item.title}</h4>
                    <div class="text-xs text-slate-500 dark:text-slate-400 space-x-2 mt-1">
                        <span>🌐 ${item.language || 'Unknown Language'}</span>
                        <span>🗓️ ${item.year || 'N/A'}</span>
                    </div>
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
async function addItem() {
    if (!currentUser) {
        alert('Please sign in before adding titles.');
        return;
    }

    const titleInput = document.getElementById('title');
    const rawTitle = titleInput ? titleInput.value.trim() : '';

    if (rawTitle === '') {
        alert('Please enter a title!');
        return;
    }

    const apiResult = await fetchTMDBDetails(rawTitle);
    
    if (!apiResult.valid) {
        alert(`❌ ${apiResult.error}`);
        return;
    }

    const newItem = {
        title: apiResult.title,
        type: apiResult.type,
        typeLabel: apiResult.typeLabel,
        platform: apiResult.platform,
        platforms: apiResult.platforms,
        genre: apiResult.genre,
        rating: apiResult.rating,
        language: apiResult.language,
        year: apiResult.year,
        poster: apiResult.poster,
        watched: false,
        addedBy: currentUser.displayName || currentUser.email,
        userId: currentUser.uid
    };

    if (db) {
        await db.collection('watchlist').add(newItem);
    }

    if (titleInput) titleInput.value = '';
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

    let added = 0;
    const failures = [];
    try {
        for (let index = 0; index < titles.length; index += 1) {
            const title = titles[index];
            if (statusText) statusText.textContent = `Processing ${index + 1} of ${titles.length}: ${title}`;

            try {
                const metadata = await fetchTMDBDetails(title);
                if (!metadata.valid) {
                    failures.push(title);
                } else {
                    const { valid, ...item } = metadata;
                    await db.collection('watchlist').add({
                        ...item,
                        watched: false,
                        addedBy: currentUser.displayName || currentUser.email,
                        userId: currentUser.uid
                    });
                    added += 1;
                }
            } catch (error) {
                failures.push(title);
            }

            if (progressBar) progressBar.style.width = `${Math.round(((index + 1) / titles.length) * 100)}%`;
            if (index < titles.length - 1) await sleep(250);
        }
        if (textarea) textarea.value = failures.join('\n');
        if (statusText) {
            statusText.textContent = failures.length
                ? `Complete: added ${added} of ${titles.length}. Could not add: ${failures.join(', ')}.`
                : `Complete: added ${added} of ${titles.length} titles.`;
        }
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
