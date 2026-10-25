// ==========================================
// 1. Firebase Configuration & Initialization
// ==========================================
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZUG-4XfUscT_SQHfVsA3YC0DlfCSiCvI",
  authDomain: "watchlist-studio-14978.firebaseapp.com",
  projectId: "watchlist-studio-14978",
  storageBucket: "watchlist-studio-14978.firebasestorage.app",
  messagingSenderId: "519504217727",
  appId: "1:519504217727:web:390cbb7bff6baacd1aa14a"
};

// Initialize Firebase
//const app = initializeApp(firebaseConfig);

if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = (typeof firebase !== 'undefined') ? firebase.firestore() : null;
const auth = (typeof firebase !== 'undefined') ? firebase.auth() : null;

const TMDB_API_KEY = "15d16000751e5057088f1798720994a5";

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

let currentWatchlistItems = [];
let currentUser = null;

// ==========================================
// 2. Auth State & Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Bind Auth Buttons
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.addEventListener('click', loginWithGoogle);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', logoutUser);

    // Grouping Control Listeners
    const primarySelect = document.getElementById('primaryGroupSelect');
    const secondarySelect = document.getElementById('secondaryGroupSelect');
    if (primarySelect) primarySelect.addEventListener('change', renderWatchlist);
    if (secondarySelect) secondarySelect.addEventListener('change', renderWatchlist);

    // Monitor Authentication State
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
                if (splash) splash.classList.remove('hidden');
                if (dashboard) dashboard.classList.add('hidden');
            }
        });
    }
});

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
    if (db) {
        db.collection('watchlist').onSnapshot(snapshot => {
            currentWatchlistItems = [];
            snapshot.forEach(doc => {
                currentWatchlistItems.push({ docId: doc.id, ...doc.data() });
            });
            populateFilterDropdowns();
            renderWatchlist();
        });
    }
}

function getWatchlist() {
    return currentWatchlistItems;
}

// ==========================================
// 3. UI Helper Functions
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
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
    const genreSelect = document.getElementById('filterGenre');
    if (genreSelect) {
        const genres = [...new Set(items.map(i => i.genre).filter(Boolean))].sort();
        genreSelect.innerHTML = '<option value="All">All Genres</option>';
        genres.forEach(g => { genreSelect.innerHTML += `<option value="${g}">${g}</option>`; });
    }
    const langSelect = document.getElementById('filterLanguage');
    if (langSelect) {
        const languages = [...new Set(items.map(i => i.language).filter(Boolean))].sort();
        langSelect.innerHTML = '<option value="All">All Languages</option>';
        languages.forEach(l => { langSelect.innerHTML += `<option value="${l}">${l}</option>`; });
    }
    const platformSelect = document.getElementById('filterPlatform');
    if (platformSelect) {
        const allPlatforms = items.flatMap(i => i.platforms || [i.platform]).filter(Boolean);
        const uniquePlatforms = [...new Set(allPlatforms.map(normalizePlatformName))].sort();
        platformSelect.innerHTML = '<option value="All">All Platforms</option>';
        uniquePlatforms.forEach(p => { platformSelect.innerHTML += `<option value="${p}">${p}</option>`; });
    }
}

// ==========================================
// 4. TMDB Fetching & Render Engine
// ==========================================
async function fetchTMDBDetails(queryTitle) {
    const cleanTitle = queryTitle.trim();
    try {
        let tvRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        let tvData = await tvRes.json();
        let match = null;
        let mediaType = 'movie';

        if (tvData.results && tvData.results.length > 0) {
            match = tvData.results[0]; mediaType = 'tv';
        } else {
            let movieRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
            let movieData = await movieRes.json();
            if (movieData.results && movieData.results.length > 0) {
                match = movieData.results[0]; mediaType = 'movie';
            }
        }

        if (match) {
            const displayTitle = match.title || match.name;
            const releaseYear = (match.release_date || match.first_air_date || '').split('-')[0] || 'N/A';
            const posterUrl = match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null;
            const ratingVal = match.vote_average ? match.vote_average.toFixed(1) : 'N/A';
            const langCode = match.original_language || 'en';
            const languageName = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();
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
                valid: true, title: displayTitle, type: mediaType, typeLabel: mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie',
                year: releaseYear, genre: primaryGenre, rating: ratingVal, language: languageName,
                platform: indiaPlatforms[0] || 'Not Streaming in IN', platforms: indiaPlatforms, poster: posterUrl
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

    container.innerHTML = '';
    let items = getWatchlist();

    if (searchQuery !== '') items = items.filter(i => i.title.toLowerCase().includes(searchQuery));
    if (filterType !== 'All') items = items.filter(i => i.type === filterType);
    if (filterPlatform !== 'All') items = items.filter(i => (i.platforms || [i.platform]).map(normalizePlatformName).includes(filterPlatform));
    if (filterGenre !== 'All') items = items.filter(i => i.genre === filterGenre);
    if (filterLanguage !== 'All') items = items.filter(i => i.language === filterLanguage);

    if (sortBy === 'rating-desc') items.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400 font-medium">No matching titles found.</div>`;
        return;
    }

    renderGroupCards(container, items);
}

function renderGroupCards(parentContainer, items) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 my-2';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `movie-card bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-sky-400 ${item.watched ? 'opacity-50' : ''}`;
        
        const mainPlatform = normalizePlatformName((item.platforms && item.platforms.length > 0) ? item.platforms[0] : item.platform);
        const badgeClass = getPlatformBadgeClass(mainPlatform);
        const posterHtml = item.poster ? `<img src="${item.poster}" class="w-full h-44 object-cover">` : `<div class="w-full h-44 bg-slate-950 flex items-center justify-center text-3xl">🎬</div>`;

        card.innerHTML = `
            <div class="relative">
                ${posterHtml}
                <span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full text-white uppercase shadow-md ${badgeClass}">${mainPlatform}</span>
                <span class="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-950/80 text-amber-300 backdrop-blur-sm">⭐ ${item.rating || 'N/A'}</span>
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-sm text-slate-100 leading-snug line-clamp-2">${item.title}</h4>
                    <div class="text-xs text-slate-400 space-x-2 mt-1">
                        <span>🌐 ${item.language || 'EN'}</span>
                        <span>🗓️ ${item.year || 'N/A'}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-800 text-xs">
                    <button class="text-rose-400 hover:text-rose-300 font-semibold" onclick="deleteItem('${item.docId}')">Delete</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    parentContainer.appendChild(grid);
}

async function deleteItem(id) {
    if (db && id) {
        await db.collection('watchlist').doc(id).delete();
    }
}