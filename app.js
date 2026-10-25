// High-Reliability API Configuration
const TMDB_API_KEY = "9a748cbbbaad6f4346328823556773cc";
const OMDB_API_KEY = "trilogy";

// Firebase Configuration for Watchlist Studio
const firebaseConfig = {
  apiKey: "AIzaSyDZUG-4XfUscT_SQHfVsA3YC0DlfCSiCvI",
  authDomain: "watchlist-studio-14978.firebaseapp.com",
  projectId: "watchlist-studio-14978",
  storageBucket: "watchlist-studio-14978.firebasestorage.app",
  messagingSenderId: "519504217727",
  appId: "1:519504217727:web:390cbb7bff6baacd1aa14a"
};

// Initialize Firebase App & Cloud Firestore Database
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let cachedWatchlist = [];

const TMDB_GENRE_MAP = {
    // Movie genres
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
    // TV genres
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics"
};

const LANGUAGE_MAP = {
    'en': 'English',
    'hi': 'Hindi',
    'ko': 'Korean',
    'ta': 'Tamil',
    'te': 'Telugu',
    'ml': 'Malayalam',
    'kn': 'Kannada',
    'mr': 'Marathi',
    'bn': 'Bengali',
    'pa': 'Punjabi',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'zh': 'Chinese',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'tr': 'Turkish',
    'ar': 'Arabic'
};

function formatLanguage(code) {
    if (!code) return 'Unknown';
    const cleanCode = code.toLowerCase().trim();
    return LANGUAGE_MAP[cleanCode] || cleanCode.toUpperCase();
}

let activeGrouping = 'none';

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeIcon();
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        const isDark = document.documentElement.classList.contains('dark');
        themeIcon.textContent = isDark ? '🌙' : '☀️';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Restore username if previously saved locally
    const savedName = localStorage.getItem('watchlist_username');
    const nameInput = document.getElementById('userName') || document.getElementById('userNameInput');
    if (savedName && nameInput) {
        nameInput.value = savedName;
    }
    if (nameInput) {
        nameInput.addEventListener('change', () => {
            localStorage.setItem('watchlist_username', nameInput.value.trim());
        });
    }

    const primarySelect = document.getElementById('primaryGroupSelect');
    if (primarySelect) {
        primarySelect.addEventListener('change', renderWatchlist);
    }
    const secondarySelect = document.getElementById('secondaryGroupSelect');
    if (secondarySelect) {
        secondarySelect.addEventListener('change', renderWatchlist);
    }

    // Live real-time Firestore sync listener across all devices
    db.collection('watchlist').onSnapshot((snapshot) => {
        cachedWatchlist = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: data.id || doc.id,
                docId: doc.id
            };
        });
        populateFilterDropdowns();
        renderWatchlist();
    }, (error) => {
        console.error("Firestore onSnapshot error:", error);
    });
});

function getWatchlist() {
    return cachedWatchlist;
}

async function saveWatchlist(watchlist) {
    // Replaced localStorage with Firestore batch updates
    try {
        const batch = db.batch();
        watchlist.forEach(item => {
            const docRef = db.collection('watchlist').doc(String(item.id));
            batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
    } catch (err) {
        console.error("Error saving watchlist to Firestore:", err);
    }
}

function setGrouping(mode) {
    activeGrouping = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${mode}`).classList.add('active');
    renderWatchlist();
}

function getUserName() {
    const input = document.getElementById('userName') || document.getElementById('userNameInput');
    return (input && input.value.trim()) ? input.value.trim() : 'Anonymous';
}

function getPlatformBadgeClass(platform) {
    if (!platform) return 'badge-default';
    const p = platform.toLowerCase();
    if (p.includes('netflix')) return 'badge-netflix';
    if (p.includes('prime') || p.includes('amazon')) return 'badge-prime';
    if (p.includes('hotstar') || p.includes('disney')) return 'badge-hotstar';
    if (p.includes('jio')) return 'badge-jiocinema';
    return 'badge-default';
}

function normalizePlatformName(name) {
    if (!name) return '';
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();

    // Disney / Hotstar variations (e.g., "Disney+ Hotstar", "Hotstar", "Disney Plus", "JioHotstar")
    if (lower.includes('hotstar') || lower.includes('disney')) {
        return 'Disney+ Hotstar';
    }

    // Amazon / Prime Video variations (e.g., "Amazon Prime Video", "Amazon Prime Video with Ads", "Prime Video Channels")
    if (lower.includes('prime video') || lower.includes('amazon prime') || lower.includes('amazon video') || lower.endsWith('amazon channel')) {
        return 'Prime Video';
    }

    return trimmed;
}

function populateFilterDropdowns() {
    const items = getWatchlist();
    
    // Dynamic Genres
    const genreSelect = document.getElementById('filterGenre');
    const genres = [...new Set(items.map(i => i.genre).filter(Boolean))].sort();
    genreSelect.innerHTML = '<option value="All">All Genres</option>';
    genres.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        genreSelect.appendChild(opt);
    });

    // Dynamic Platforms
    const platformSelect = document.getElementById('filterPlatform');
    const allPlatforms = items.flatMap(i => {
        const rawList = (i.platforms && i.platforms.length > 0) ? i.platforms : (i.platform ? [i.platform] : []);
        return rawList.map(p => normalizePlatformName(p));
    }).filter(Boolean);
    const uniquePlatforms = [...new Set(allPlatforms)].sort();
    platformSelect.innerHTML = '<option value="All">All Platforms</option>';
    uniquePlatforms.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        platformSelect.appendChild(opt);
    });

    // Dynamic Languages
    const languageSelect = document.getElementById('filterLanguage');
    if (languageSelect) {
        const languages = [...new Set(items.map(i => i.language).filter(Boolean))].sort();
        languageSelect.innerHTML = '<option value="All">All Languages</option>';
        languages.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l; opt.textContent = l;
            languageSelect.appendChild(opt);
        });
    }
}

// Multi-Tier Search Engine: TMDB (TV/Movie endpoints + IN Watch Providers) with OMDb Fallback
async function fetchTMDBDetails(queryTitle) {
    const cleanTitle = queryTitle.trim();

    try {
        // 1. Try TMDB TV Show Search First
        let tvRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        let tvData = await tvRes.json();
        
        let match = null;
        let mediaType = 'movie';

        if (tvData.results && tvData.results.length > 0) {
            match = tvData.results[0];
            mediaType = 'tv';
        } else {
            // 2. Try TMDB Movie Search if TV search returned nothing
            let movieRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
            let movieData = await movieRes.json();
            if (movieData.results && movieData.results.length > 0) {
                match = movieData.results[0];
                mediaType = 'movie';
            }
        }

        // If TMDB found a match, query India Watch Providers (region=IN)
        if (match) {
            const displayTitle = match.title || match.name;
            const releaseYear = (match.release_date || match.first_air_date || '').split('-')[0] || 'N/A';
            const posterUrl = match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null;

            let indiaPlatforms = [];
            try {
                const providerRes = await fetch(
                    `https://api.themoviedb.org/3/${mediaType}/${match.id}/watch/providers?api_key=${TMDB_API_KEY}`
                );
                const providerData = await providerRes.json();
                
                if (providerData.results && providerData.results.IN && providerData.results.IN.flatrate) {
                    const normalizedList = providerData.results.IN.flatrate
                        .map(p => normalizePlatformName(p.provider_name))
                        .filter(Boolean);
                    indiaPlatforms = [...new Set(normalizedList)];
                }
            } catch (pErr) {
                console.warn("Watch provider lookup skipped for IN:", pErr);
            }

            const primaryPlatform = indiaPlatforms.length > 0 ? indiaPlatforms[0] : 'Not Streaming in IN';
            const firstGenreId = (match.genre_ids && match.genre_ids.length > 0) ? match.genre_ids[0] : null;
            const resolvedGenre = (firstGenreId && TMDB_GENRE_MAP[firstGenreId]) ? TMDB_GENRE_MAP[firstGenreId] : (mediaType === 'tv' ? 'TV Series' : 'Cinema');
            const rating = (match.vote_average !== undefined && match.vote_average !== null && match.vote_average > 0) 
                ? match.vote_average.toFixed(1) 
                : 'N/A';
            const language = formatLanguage(match.original_language);

            return {
                valid: true,
                title: displayTitle,
                type: mediaType,
                typeLabel: mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie',
                year: releaseYear,
                genre: resolvedGenre,
                rating: rating,
                language: language,
                platform: primaryPlatform,
                platforms: indiaPlatforms.length > 0 ? indiaPlatforms : ['Not Streaming in IN'],
                poster: posterUrl
            };
        }
    } catch (tmdbErr) {
        console.warn("TMDB Search failed, falling back to OMDb:", tmdbErr);
    }

    // 3. Fallback to OMDb API if TMDB search misses
    try {
        const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(cleanTitle)}`);
        const omdbData = await omdbRes.json();

        if (omdbData.Response === "True") {
            const isSeries = omdbData.Type === 'series';
            const primaryGenre = omdbData.Genre ? omdbData.Genre.split(',')[0].trim() : 'General';
            const posterUrl = (omdbData.Poster && omdbData.Poster !== "N/A") ? omdbData.Poster : null;
            const omdbRating = (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') ? omdbData.imdbRating : 'N/A';
            const omdbLanguage = omdbData.Language ? omdbData.Language.split(',')[0].trim() : 'English';

            return {
                valid: true,
                title: omdbData.Title,
                type: isSeries ? 'tv' : 'movie',
                typeLabel: isSeries ? '📺 TV Show' : '🎬 Movie',
                year: omdbData.Year || 'N/A',
                genre: primaryGenre,
                rating: omdbRating,
                language: omdbLanguage,
                platform: 'Check Local Apps',
                platforms: ['Check Local Apps'],
                poster: posterUrl
            };
        }
    } catch (omdbErr) {
        console.error("OMDb Fallback failed:", omdbErr);
    }

    return { valid: false, error: `Could not find "${cleanTitle}". Check spelling.` };
}

function renderWatchlist() {
    const container = document.getElementById('watchlistDisplay');
    
    const searchQuery = document.getElementById('searchQuery').value.toLowerCase().trim();
    const filterType = document.getElementById('filterType').value;
    const filterPlatform = document.getElementById('filterPlatform').value;
    const filterGenre = document.getElementById('filterGenre').value;
    const filterLanguage = document.getElementById('filterLanguage') ? document.getElementById('filterLanguage').value : 'All';
    const filterStatus = document.getElementById('filterStatus').value;
    const sortBy = document.getElementById('sortBy').value;
    
    container.innerHTML = '';
    document.getElementById('selectAll').checked = false;

    let items = getWatchlist();

    if (searchQuery !== '') {
        items = items.filter(i => i.title.toLowerCase().includes(searchQuery));
    }
    if (filterType !== 'All') {
        items = items.filter(i => i.type === filterType);
    }
    if (filterPlatform !== 'All') {
        items = items.filter(i => {
            const platforms = (i.platforms && i.platforms.length > 0) ? i.platforms : (i.platform ? [i.platform] : []);
            return platforms.map(p => normalizePlatformName(p)).includes(filterPlatform);
        });
    }
    if (filterGenre !== 'All') {
        items = items.filter(i => i.genre === filterGenre);
    }
    if (filterLanguage !== 'All') {
        items = items.filter(i => (i.language || 'Unknown') === filterLanguage);
    }
    if (filterStatus === 'watched') {
        items = items.filter(i => i.watched);
    } else if (filterStatus === 'towatch') {
        items = items.filter(i => !i.watched);
    }

    if (sortBy === 'title-asc') {
        items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'title-desc') {
        items.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'rating-desc') {
        items.sort((a, b) => {
            const rA = (a.rating && a.rating !== 'N/A') ? parseFloat(a.rating) : -1;
            const rB = (b.rating && b.rating !== 'N/A') ? parseFloat(b.rating) : -1;
            return rB - rA;
        });
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state">No matching titles found for the selected filter combination.</div>`;
        return;
    }

    // Read Group Builder settings
    const primarySelect = document.getElementById('primaryGroupSelect');
    const secondarySelect = document.getElementById('secondaryGroupSelect');
    const primaryMode = (primarySelect && primarySelect.value !== 'none') ? primarySelect.value : (activeGrouping !== 'none' ? activeGrouping : 'none');
    const secondaryMode = (secondarySelect && secondarySelect.value !== 'none') ? secondarySelect.value : 'none';

    // Helper: extract grouping keys from an item
    const getGroupValues = (item, mode) => {
        if (mode === 'platform') {
            const plats = (item.platforms && item.platforms.length > 0) ? item.platforms : (item.platform ? [item.platform] : []);
            const normalized = [...new Set(plats.map(p => normalizePlatformName(p)).filter(Boolean))];
            return normalized.length > 0 ? normalized : ['Other Platforms'];
        }
        if (mode === 'genre') {
            return [item.genre || 'General'];
        }
        if (mode === 'type') {
            return [item.type === 'tv' ? '📺 TV Shows' : '🎬 Movies'];
        }
        if (mode === 'status') {
            return [item.watched ? '✅ Watched History' : '⏳ To Watch'];
        }
        if (mode === 'language') {
            return [item.language ? `🌐 ${item.language}` : '🌐 Unknown'];
        }
        return ['All'];
    };

    if (primaryMode === 'none') {
        renderGroup(container, 'Filtered Results', items, 'all');
        return;
    }

    // Extract all unique primary group keys
    const primaryKeys = [...new Set(items.flatMap(i => getGroupValues(i, primaryMode)))].sort();

    primaryKeys.forEach((pKey, pIdx) => {
        const pItems = items.filter(i => getGroupValues(i, primaryMode).includes(pKey));
        if (pItems.length === 0) return;

        // If secondary grouping is active and different from primary
        if (secondaryMode !== 'none' && secondaryMode !== primaryMode) {
            const pSection = document.createElement('div');
            pSection.className = 'group-section mb-6';
            pSection.id = `primary-${pIdx}`;

            const pHeader = document.createElement('div');
            pHeader.className = 'group-header cursor-pointer select-none flex items-center justify-between p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl mb-3 hover:border-sky-500/50 transition';
            pHeader.onclick = () => pSection.classList.toggle('collapsed');
            pHeader.innerHTML = `
                <div class="group-title-left flex items-center gap-2.5">
                    <span class="chevron text-xs text-sky-400">▼</span>
                    <span class="text-sm font-bold text-sky-400">${pKey}</span>
                    <span class="group-count text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${pItems.length}</span>
                </div>
            `;
            pSection.appendChild(pHeader);

            const pContainer = document.createElement('div');
            pContainer.className = 'card-grid-container space-y-4 pl-2 sm:pl-4 border-l-2 border-slate-800/80 ml-2';

            const secondaryKeys = [...new Set(pItems.flatMap(i => getGroupValues(i, secondaryMode)))].sort();
            secondaryKeys.forEach((sKey, sIdx) => {
                const sItems = pItems.filter(i => getGroupValues(i, secondaryMode).includes(sKey));
                if (sItems.length > 0) {
                    renderGroup(pContainer, `${pKey} › ${sKey}`, sItems, `${pIdx}-${sIdx}`, true);
                }
            });

            pSection.appendChild(pContainer);
            container.appendChild(pSection);
        } else {
            renderGroup(container, pKey, pItems, `p-${pIdx}`);
        }
    });
}

function renderGroup(parentContainer, groupTitle, items, groupKey, isSubgroup = false) {
    const section = document.createElement('div');
    section.className = isSubgroup ? 'group-section subgroup-section mb-4' : 'group-section mb-6';
    section.id = `group-${groupKey}`;

    const titleHeader = document.createElement('div');
    titleHeader.className = isSubgroup
        ? 'group-header cursor-pointer select-none flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-lg mb-2.5 hover:border-sky-400/40 transition'
        : 'group-header cursor-pointer select-none flex items-center justify-between p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl mb-3 hover:border-sky-500/50 transition';
    titleHeader.onclick = () => section.classList.toggle('collapsed');
    
    titleHeader.innerHTML = `
        <div class="group-title-left flex items-center gap-2.5">
            <span class="chevron text-xs ${isSubgroup ? 'text-indigo-400' : 'text-sky-400'}">▼</span>
            <span class="${isSubgroup ? 'text-xs font-semibold text-slate-300' : 'text-sm font-bold text-sky-400'}">${groupTitle}</span>
            <span class="group-count text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${items.length}</span>
        </div>
    `;
    section.appendChild(titleHeader);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `movie-card ${item.watched ? 'watched' : ''}`;
        
        const rawPlatform = (item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform;
        const mainPlatform = normalizePlatformName(rawPlatform);
        const badgeClass = getPlatformBadgeClass(mainPlatform);

        const posterHtml = item.poster 
            ? `<img src="${item.poster}" class="poster-img" alt="${item.title}">` 
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:20px;">🎬</div>`;

        const ratingBadge = (item.rating && item.rating !== 'N/A')
            ? `<div class="absolute top-1.5 right-1.5 bg-slate-950/90 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-yellow-400/40 shadow-[0_0_10px_rgba(250,204,21,0.45)] backdrop-blur-sm flex items-center gap-1 z-10">
                <span>⭐</span><span>${item.rating}</span>
               </div>`
            : '';

        const languageBadge = item.language
            ? `<span class="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 rounded">🌐 ${item.language}</span>`
            : '';

        card.innerHTML = `
            <div class="poster-box relative">
                ${posterHtml}
                ${ratingBadge}
            </div>
            <div class="card-body">
                <div>
                    <div class="card-header">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="checkbox" class="item-checkbox" data-id="${item.id}">
                            <div class="card-title">${item.title}</div>
                        </div>
                        <span class="badge ${badgeClass}">${mainPlatform}</span>
                    </div>
                    <div class="card-meta">
                        <span class="type-badge">${item.typeLabel || '🎬 Movie'}</span>
                        ${item.genre ? `<span class="type-badge">${item.genre}</span>` : ''}
                        ${languageBadge}
                        <span>Release: <strong>${item.year}</strong></span>
                        ${item.addedBy ? `<span style="margin-left: 6px; color: var(--accent-blue);">👤 ${item.addedBy}</span>` : ''}
                    </div>
                </div>
                <div class="card-footer">
                    <button class="tab-btn btn-small" onclick="toggleWatched(${item.id})">
                        ${item.watched ? '↩️ Unwatch' : '✓ Watched'}
                    </button>
                    <button class="btn-danger btn-small" onclick="deleteItem(${item.id})">Delete</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    section.appendChild(grid);
    parentContainer.appendChild(section);
}

async function addItem() {
    const titleInput = document.getElementById('title');
    const rawTitle = titleInput.value.trim();

    if (rawTitle === '') {
        alert('Please enter a title!');
        return;
    }

    const apiResult = await fetchTMDBDetails(rawTitle);
    
    if (!apiResult.valid) {
        alert(`❌ ${apiResult.error}`);
        return;
    }

    const addedBy = getUserName();

    const newItem = {
        id: Date.now(),
        title: apiResult.title,
        type: apiResult.type,
        typeLabel: apiResult.typeLabel,
        platform: apiResult.platform,
        platforms: apiResult.platforms,
        genre: apiResult.genre,
        rating: apiResult.rating || 'N/A',
        language: apiResult.language || 'English',
        year: apiResult.year,
        poster: apiResult.poster,
        watched: false,
        addedBy: addedBy
    };

    try {
        await db.collection('watchlist').doc(String(newItem.id)).set(newItem);
        titleInput.value = '';
    } catch (err) {
        console.error("Error adding item to Firestore:", err);
        alert("Failed to save item to Firestore. Check console/Firebase config.");
    }
}

async function bulkUpload() {
    const bulkText = document.getElementById('bulkTitles').value;

    if (bulkText.trim() === '') {
        alert('Please paste at least one title!');
        return;
    }

    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) {
        alert('Please paste at least one valid title!');
        return;
    }

    const progressContainer = document.getElementById('bulkProgressContainer');
    const progressStatus = document.getElementById('bulkProgressStatus');
    const progressBar = document.getElementById('bulkProgressBar');
    const bulkButton = document.getElementById('btnBulkUpload') || document.querySelector('button[onclick="bulkUpload()"]');

    if (progressContainer) progressContainer.style.display = 'block';
    if (bulkButton) bulkButton.disabled = true;

    const addedBy = getUserName();

    let addedCount = 0;
    let failedTitles = [];
    const itemsToAdd = [];

    try {
        for (let index = 0; index < lines.length; index++) {
            const title = lines[index];
            const currentStep = index + 1;
            const percent = Math.round((currentStep / lines.length) * 100);

            if (progressStatus) {
                progressStatus.textContent = `Processing ${currentStep} / ${lines.length}: "${title}"...`;
            }
            if (progressBar) {
                progressBar.style.width = `${percent}%`;
            }

            const apiResult = await fetchTMDBDetails(title);
            if (apiResult.valid) {
                itemsToAdd.push({
                    id: Date.now() + index,
                    title: apiResult.title,
                    type: apiResult.type,
                    typeLabel: apiResult.typeLabel,
                    platform: apiResult.platform,
                    platforms: apiResult.platforms,
                    genre: apiResult.genre,
                    rating: apiResult.rating || 'N/A',
                    language: apiResult.language || 'English',
                    year: apiResult.year,
                    poster: apiResult.poster,
                    watched: false,
                    addedBy: addedBy
                });
                addedCount++;
            } else {
                failedTitles.push(title);
            }
        }

        if (itemsToAdd.length > 0) {
            const batch = db.batch();
            itemsToAdd.forEach(item => {
                const docRef = db.collection('watchlist').doc(String(item.id));
                batch.set(docRef, item);
            });
            await batch.commit();
            document.getElementById('bulkTitles').value = '';
        }
    } catch (err) {
        console.error("Error bulk uploading items to Firestore:", err);
    } finally {
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        if (progressStatus) progressStatus.textContent = 'Ready';
        if (bulkButton) bulkButton.disabled = false;
    }

    let msg = `Added ${addedCount} titles successfully!`;
    if (failedTitles.length > 0) {
        msg += `\n\n⚠️ Could not find ${failedTitles.length} title(s):\n- ` + failedTitles.join('\n- ');
    }
    alert(msg);
}

async function toggleWatched(id) {
    const item = cachedWatchlist.find(i => String(i.id) === String(id));
    if (!item) return;
    try {
        await db.collection('watchlist').doc(String(item.id)).update({
            watched: !item.watched
        });
    } catch (err) {
        console.error("Error updating watched status in Firestore:", err);
    }
}

async function deleteItem(id) {
    try {
        await db.collection('watchlist').doc(String(id)).delete();
    } catch (err) {
        console.error("Error deleting item from Firestore:", err);
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
        const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
        try {
            const batch = db.batch();
            selectedIds.forEach(id => {
                const docRef = db.collection('watchlist').doc(String(id));
                batch.delete(docRef);
            });
            await batch.commit();
        } catch (err) {
            console.error("Error batch deleting items from Firestore:", err);
        }
    }
}

async function clearAllItems() {
    if (confirm('Delete your entire watchlist?')) {
        try {
            const batch = db.batch();
            cachedWatchlist.forEach(item => {
                const docRef = db.collection('watchlist').doc(String(item.id));
                batch.delete(docRef);
            });
            await batch.commit();
        } catch (err) {
            console.error("Error clearing watchlist from Firestore:", err);
        }
    }
}