# Watchlist Studio

Watchlist Studio is a mobile-first web app for discovering movies and TV shows, tracking what you want to watch, and finding where titles are available in India.

**Live app:** https://shanalpersonal-afk.github.io/watchlist-manager/

## Features

- Search movies and TV shows with posters, ratings, languages, genres, and India streaming availability
- Build a personal watchlist and mark titles as watched
- Discover trending, personalized, and AI-curated recommendations
- Complete a Taste Wizard for language and genre preferences
- Filter by OTT platform, genre, language, freshness, and release type
- Use "Watchable Now" to find titles on your saved subscriptions
- Create private or shared watchlists
- Add titles in bulk or from social text
- Share title links, preview trailers, and use Pick Tonight
- Install as a standalone app on iPhone, Android, or desktop

## Technology

- Vanilla HTML, CSS, and browser JavaScript
- Tailwind CSS via CDN
- Firebase Authentication and Cloud Firestore
- TMDB discovery and streaming metadata
- Cloudflare Worker proxy for the TMDB API key
- GitHub Pages hosting

The app uses browser-compatible classic scripts only. It has no npm dependencies, bundler, Node.js build step, or module imports.

## Run Locally

Serve the repository with any static HTTP server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

Firebase, TMDB proxy, and deployment settings are configured in `config.js`. To use your own TMDB proxy, deploy `worker.js` and update `tmdbProxyUrl`.

## Main Files

- `index.html` - application interface and modals
- `config.js` - Firebase and Worker configuration
- `api.js` - TMDB searches and India provider lookups
- `store.js` - authentication, profiles, shared lists, and watchlist data
- `discover.js` - Discover feeds and Taste Wizard
- `tour.js` - guided tour and release notes
- `app.js` - application state and interface behavior
- `worker.js` - reference Cloudflare Worker for the TMDB proxy

## Data and Services

Google Sign-In and Firestore are used for account and watchlist storage. Local browser storage provides some preferences and fallbacks.

Movie and TV data and posters are provided by [TMDB](https://www.themoviedb.org/). Streaming availability is provided for India and includes subscription and free/ad-supported services where available.
