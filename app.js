// ==========================================
// 1. Firebase Configuration & Initialization
// ==========================================
const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY", // Make sure your real API key is pasted here
  authDomain: "watchlist-studio-14978.firebaseapp.com",
  projectId: "watchlist-studio-14978",
  storageBucket: "watchlist-studio-14978.firebasestorage.app",
  messagingSenderId: "519504217727",
  appId: "1:519504217727:web:390cbb7bff6baacd1aa14a"
};

// Initialize Firebase App & Cloud Firestore
if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = (typeof firebase !== 'undefined') ? firebase.firestore() : null;

const TMDB_API_KEY = "15d16000751e5057088f1798720994a5";
const OMDB_API_KEY = "trilogy";

// TMDB Genre Dictionary
const TMDB_GENRES = {
    10759: "Action & Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 10762: "Kids", 
    9648: "Mystery", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
    10766: "Soap", 10767: "Talk", 10768: "War & Politics", 37: "Western",
    28: "Action", 12: "Adventure", 14: "Fantasy", 36: "History", 
    27: "Horror", 10402: "Music", 10749: "Romance", 878: "Sci-Fi", 
    10770: "TV Movie", 53: "Thriller", 10752: "War"
};

// Spoken Language Map
const LANGUAGE_NAMES = {
    en: "English", hi: "Hindi", ko: "Korean", ta: "Tamil", te: "Telugu",
    ml: "Malayalam", kn: "Kannada", es: "Spanish", fr: "French", ja: "Japanese"
};

let currentWatchlistItems = [];

// ==========================================
// 2. Lifecycle & Real-Time Firebase Listener
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupFirebaseListener();
    
    // Add event listeners for dynamic controls if elements exist
    const primarySelect = document.getElementById('primaryGroupSelect');
    const secondarySelect = document.getElementById('secondaryGroupSelect');
    if (primarySelect) primarySelect.addEventListener('change', renderWatchlist);
    if (secondarySelect) secondarySelect.addEventListener('change', renderWatchlist);
});

function setupFirebaseListener() {
    if (db) {
        db.collection('watchlist').onSnapshot(snapshot => {
            currentWatchlistItems = [];
            snapshot.forEach(doc => {
                currentWatchlistItems.push({ docId: doc.id, ...doc.data() });
            });
            populateFilterDropdowns();
            renderWatchlist();
        }, err => {
            console.warn("Firestore listener failed, using local storage fallback:", err);
            loadLocalFallback();
        });
    } else {
        loadLocalFallback();
    }
}

function loadLocalFallback() {
    const stored = localStorage.getItem('myWatchlist');
    currentWatchlistItems = stored ? JSON.parse(stored) : [];
    populateFilterDropdowns();
    renderWatchlist();
}

function getWatchlist() {
    return currentWatchlistItems;
}

// ==========================================
// 3. Theme Toggle & Mobile Drawer Logic
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
    const btn = document.getElementById('toggleFilterDrawerBtn');
    
    if (drawer) {
        drawer.classList.toggle('hidden');
        const isHidden = drawer.classList.contains('hidden');
        if (btn) {
            btn.innerHTML = isHidden ? '🎛️ Show Filters & Views' : '🎛️ Hide Filters';
        }
    }
}

function updateFilterBadge() {
    const filterGenre = document.getElementById('filterGenre')?.value || 'All';
    const filterPlatform = document.getElementById('filterPlatform')?.value || 'All';
    const filterLanguage = document.getElementById('filterLanguage')?.value || 'All';
    const filterStatus = document.getElementById('filterStatus')?.value || 'All';
    const filterType = document.getElementById('filterType')?.value || 'All';

    let activeCount = 0;
    if (filterGenre !== 'All') activeCount++;
    if (filterPlatform !== 'All') activeCount++;
    if (filterLanguage !== 'All') activeCount++;
    if (filterStatus !== 'All') activeCount++;
    if (filterType !== 'All') activeCount++;

    const badge = document.getElementById('activeFilterBadge');
    const btn = document.getElementById('toggleFilterDrawerBtn');

    if (btn) {
        if (activeCount > 0) {
            if (!badge) {
                const newBadge = document.createElement('span');
                newBadge.id = 'activeFilterBadge';
                newBadge.className = 'ml-2 bg-sky-500 text-slate-950 px-2 py-0.5 rounded-full text-xs font-bold';
                newBadge.textContent = activeCount;
                btn.appendChild(newBadge);
            } else {
                badge.textContent = activeCount;
            }
        } else if (badge) {
            badge.remove();
        }
    }
}

// ==========================================
// 4. API Normalization & Fetching
// ==========================================
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
    
    // Dynamic Genres
    const genreSelect = document.getElementById('filterGenre');
    if (genreSelect) {
        const genres = [...new Set(items.map(i => i.genre).filter(Boolean))].sort();
        genreSelect.innerHTML = '<option value="All">All Genres</option>';
        genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g; opt.textContent = g;
            genreSelect.appendChild(opt);
        });
    }

    // Dynamic Languages
    const langSelect = document.getElementById('filterLanguage');
    if (langSelect) {
        const languages = [...new Set(items.map(i => i.language).filter(Boolean))].sort();
        langSelect.innerHTML = '<option value="All">All Languages</option>';
        languages.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l; opt.textContent = l;
            langSelect.appendChild(opt);
        });
    }

    // Dynamic Platforms
    const platformSelect = document.getElementById('filterPlatform');
    if (platformSelect) {
        const allPlatforms = items.flatMap(i => i.platforms || [i.platform]).filter(Boolean);
        const uniquePlatforms = [...new Set(allPlatforms.map(normalizePlatformName))].sort();
        platformSelect.innerHTML = '<option value="All">All Platforms</option>';
        uniquePlatforms.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            platformSelect.appendChild(opt);
        });
    }
}

async function fetchTMDBDetails(queryTitle) {
    const cleanTitle = queryTitle.trim();

    try {
        let tvRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        let tvData = await tvRes.json();
        
        let match = null;
        let mediaType = 'movie';

        if (tvData.results && tvData.results.length > 0) {
            match = tvData.results[0];
            mediaType = 'tv';
        } else {
            let movieRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
            let movieData = await movieRes.json();
            if (movieData.results && movieData.results.length > 0) {
                match = movieData.results[0];
                mediaType = 'movie';
            }
        }

        if (match) {
            const displayTitle = match.title || match.name;
            const releaseYear = (match.release_date || match.first_air_date || '').split('-')[0] || 'N/A';
            const posterUrl = match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null;
            const ratingVal = match.vote_average ? match.vote_average.toFixed(1) : 'N/A';
            const langCode = match.original_language || 'en';
            const languageName = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();

            let primaryGenre = 'General';
            if (match.genre_ids && match.genre_ids.length > 0) {
                primaryGenre = TMDB_GENRES[match.genre_ids[0]] || 'General';
            }

            let indiaPlatforms = [];
            try {
                const providerRes = await fetch(
                    `https://api.themoviedb.org/3/${mediaType}/${match.id}/watch/providers?api_key=${TMDB_API_KEY}`
                );
                const providerData = await providerRes.json();
                
                if (providerData.results && providerData.results.IN && providerData.results.IN.flatrate) {
                    const rawPlatforms = providerData.results.IN.flatrate.map(p => p.provider_name);
                    indiaPlatforms = [...new Set(rawPlatforms.map(normalizePlatformName))];
                }
            } catch (pErr) {
                console.warn("Watch provider lookup skipped:", pErr);
            }

            const primaryPlatform = indiaPlatforms.length > 0 ? indiaPlatforms[0] : 'Not Streaming in IN';

            return {
                valid: true,
                title: displayTitle,
                type: mediaType,
                typeLabel: mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie',
                year: releaseYear,
                genre: primaryGenre,
                rating: ratingVal,
                language: languageName,
                platform: primaryPlatform,
                platforms: indiaPlatforms.length > 0 ? indiaPlatforms : ['Not Streaming in IN'],
                poster: posterUrl
            };
        }
    } catch (tmdbErr) {
        console.warn("TMDB Search failed:", tmdbErr);
    }

    return { valid: false, error: `Could not find "${cleanTitle}".` };
}

// ==========================================
// 5. Intersectional Multi-Filter & Render
// ==========================================
function renderWatchlist() {
    updateFilterBadge();

    const container = document.getElementById('watchlistDisplay');
    if (!container) return;
    
    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase().trim() || '';
    const filterType = document.getElementById('filterType')?.value || 'All';
    const filterPlatform = document.getElementById('filterPlatform')?.value || 'All';
    const filterGenre = document.getElementById('filterGenre')?.value || 'All';
    const filterLanguage = document.getElementById('filterLanguage')?.value || 'All';
    const filterStatus = document.getElementById('filterStatus')?.value || 'All';
    const sortBy = document.getElementById('sortBy')?.value || 'default';

    const primaryGroup = document.getElementById('primaryGroupSelect')?.value || 'none';
    const secondaryGroup = document.getElementById('secondaryGroupSelect')?.value || 'none';
    
    container.innerHTML = '';
    const selectAllCb = document.getElementById('selectAll');
    if (selectAllCb) selectAllCb.checked = false;

    let items = getWatchlist();

    // 1. Multi-Filter Chain
    if (searchQuery !== '') {
        items = items.filter(i => i.title.toLowerCase().includes(searchQuery));
    }
    if (filterType !== 'All') {
        items = items.filter(i => i.type === filterType);
    }
    if (filterPlatform !== 'All') {
        items = items.filter(i => (i.platforms || [i.platform]).map(normalizePlatformName).includes(filterPlatform));
    }
    if (filterGenre !== 'All') {
        items = items.filter(i => i.genre === filterGenre);
    }
    if (filterLanguage !== 'All') {
        items = items.filter(i => i.language === filterLanguage);
    }
    if (filterStatus === 'watched') {
        items = items.filter(i => i.watched);
    } else if (filterStatus === 'towatch') {
        items = items.filter(i => !i.watched);
    }

    // 2. Sorting
    if (sortBy === 'title-asc') {
        items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'title-desc') {
        items.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'rating-desc') {
        items.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400 font-medium">No matching titles found.</div>`;
        return;
    }

    // 3. Dynamic Grouping Engine
    if (primaryGroup === 'none') {
        renderGroup(container, 'Filtered Results', items, 'all');
    } else {
        const primaryGroups = groupItemsBy(items, primaryGroup);
        
        Object.keys(primaryGroups).sort().forEach(pKey => {
            const pItems = primaryGroups[pKey];
            
            const groupSection = document.createElement('div');
            groupSection.className = 'mb-8 bg-slate-900 border border-slate-800 rounded-xl p-4';
            
            const groupHeader = document.createElement('h3');
            groupHeader.className = 'text-lg font-bold text-sky-400 mb-4 flex items-center justify-between border-b border-slate-800 pb-2';
            groupHeader.innerHTML = `<span>${getGroupTitle(primaryGroup, pKey)}</span> <span class="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">${pItems.length}</span>`;
            groupSection.appendChild(groupHeader);

            if (secondaryGroup === 'none' || secondaryGroup === primaryGroup) {
                renderGroupCards(groupSection, pItems);
            } else {
                const secondaryGroups = groupItemsBy(pItems, secondaryGroup);
                Object.keys(secondaryGroups).sort().forEach(sKey => {
                    const sItems = secondaryGroups[sKey];
                    
                    const subHeader = document.createElement('h4');
                    subHeader.className = 'text-sm font-semibold text-indigo-300 my-3 pl-2 border-l-2 border-indigo-500';
                    subHeader.textContent = `${getGroupTitle(secondaryGroup, sKey)} (${sItems.length})`;
                    groupSection.appendChild(subHeader);
                    
                    renderGroupCards(groupSection, sItems);
                });
            }
            container.appendChild(groupSection);
        });
    }
}

function groupItemsBy(items, criteria) {
    const groups = {};
    items.forEach(item => {
        let val = 'Other';
        if (criteria === 'platform') val = normalizePlatformName((item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform);
        else if (criteria === 'genre') val = item.genre || 'General';
        else if (criteria === 'language') val = item.language || 'English';
        else if (criteria === 'type') val = item.typeLabel || 'Movie';
        else if (criteria === 'status') val = item.watched ? 'Watched' : 'To Watch';
        
        if (!groups[val]) groups[val] = [];
        groups[val].push(item);
    });
    return groups;
}

function getGroupTitle(criteria, val) {
    return `${criteria.toUpperCase()}: ${val}`;
}

function renderGroup(parentContainer, groupTitle, items, groupKey) {
    const section = document.createElement('div');
    section.className = 'mb-6';

    const titleHeader = document.createElement('h3');
    titleHeader.className = 'text-base font-bold text-sky-400 mb-3 flex items-center justify-between bg-slate-900 px-4 py-2 rounded-lg border border-slate-800';
    titleHeader.innerHTML = `<span>${groupTitle}</span> <span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">${items.length}</span>`;
    section.appendChild(titleHeader);

    renderGroupCards(section, items);
    parentContainer.appendChild(section);
}

function renderGroupCards(parentContainer, items) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 my-2';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `movie-card bg-slate-800 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg ${item.watched ? 'opacity-50' : ''}`;
        
        const mainPlatform = normalizePlatformName((item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform);
        const badgeClass = getPlatformBadgeClass(mainPlatform);

        const posterHtml = item.poster 
            ? `<img src="${item.poster}" class="w-full h-44 object-cover" alt="${item.title}">` 
            : `<div class="w-full h-44 bg-slate-900 flex items-center justify-center text-3xl">🎬</div>`;

        card.innerHTML = `
            <div class="relative">
                ${posterHtml}
                <span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full text-white uppercase shadow-md ${badgeClass}">${mainPlatform}</span>
                <span class="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-900/80 text-amber-300 backdrop-blur-sm">⭐ ${item.rating || 'N/A'}</span>
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                    <div class="flex items-start gap-2 mb-1">
                        <input type="checkbox" class="item-checkbox mt-1 rounded border-slate-600" data-id="${item.docId || item.id}">
                        <h4 class="font-bold text-sm text-slate-100 leading-snug line-clamp-2">${item.title}</h4>
                    </div>
                    <div class="text-xs text-slate-400 space-x-2 mt-1">
                        <span>🌐 ${item.language || 'EN'}</span>
                        <span>🗓️ ${item.year || 'N/A'}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-700/50 text-xs">
                    <button class="text-emerald-400 hover:text-emerald-300 font-semibold" onclick="toggleWatched('${item.docId || item.id}')">
                        ${item.watched ? '↩️ Unwatch' : '✓ Watched'}
                    </button>
                    <button class="text-rose-400 hover:text-rose-300 font-semibold" onclick="deleteItem('${item.docId || item.id}')">Delete</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    parentContainer.appendChild(grid);
}

// ==========================================
// 6. Data Mutations (Add / Delete / Watched)
// ==========================================
async function addItem() {
    const titleInput = document.getElementById('title');
    const userNameInput = document.getElementById('userName');
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
        id: Date.now(),
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
        addedBy: userNameInput ? userNameInput.value : 'Guest'
    };

    if (db) {
        await db.collection('watchlist').add(newItem);
    } else {
        const items = getWatchlist();
        items.push(newItem);
        localStorage.setItem('myWatchlist', JSON.stringify(items));
        loadLocalFallback();
    }

    if (titleInput) titleInput.value = '';
}

async function bulkUpload() {
    const bulkText = document.getElementById('bulkTitles')?.value || '';
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l !== '');

    if (lines.length === 0) {
        alert('Please paste at least one title!');
        return;
    }

    for (let i = 0; i < lines.length; i++) {
        const apiResult = await fetchTMDBDetails(lines[i]);
        if (apiResult.valid) {
            const newItem = {
                id: Date.now() + i,
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
                watched: false
            };
            if (db) {
                await db.collection('watchlist').add(newItem);
            } else {
                currentWatchlistItems.push(newItem);
            }
        }
    }

    if (!db) {
        localStorage.setItem('myWatchlist', JSON.stringify(currentWatchlistItems));
        loadLocalFallback();
    }

    if (document.getElementById('bulkTitles')) document.getElementById('bulkTitles').value = '';
}

async function toggleWatched(id) {
    if (db && typeof id === 'string' && id.length > 10) {
        const docRef = db.collection('watchlist').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
            await docRef.update({ watched: !doc.data().watched });
        }
    } else {
        let items = getWatchlist();
        items = items.map(item => (item.id == id || item.docId == id) ? { ...item, watched: !item.watched } : item);
        localStorage.setItem('myWatchlist', JSON.stringify(items));
        loadLocalFallback();
    }
}

async function deleteItem(id) {
    if (db && typeof id === 'string' && id.length > 10) {
        await db.collection('watchlist').doc(id).delete();
    } else {
        let items = getWatchlist().filter(item => item.id != id && item.docId != id);
        localStorage.setItem('myWatchlist', JSON.stringify(items));
        loadLocalFallback();
    }
}

function toggleSelectAll(masterCheckbox) {
    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = masterCheckbox.checked);
}

async function deleteSelectedItems() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select at least one item to delete.');
        return;
    }

    if (confirm(`Delete ${checkboxes.length} selected item(s)?`)) {
        for (let cb of checkboxes) {
            await deleteItem(cb.dataset.id);
        }
    }
}

async function clearAllItems() {
    if (confirm('Delete your entire watchlist?')) {
        if (db) {
            const snapshot = await db.collection('watchlist').get();
            snapshot.forEach(doc => doc.ref.delete());
        } else {
            localStorage.removeItem('myWatchlist');
            loadLocalFallback();
        }
    }
}