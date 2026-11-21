# Project Context: Watchlist Studio

**Current version: v2.9.1**

## 1. Project Vision

Watchlist Studio is a personal media discovery and tracking app. It helps users collect movie and TV recommendations, find India streaming availability, and track ratings, genres, language, and watched status.

## 2. Current Stack and Files

- **Frontend:** Vanilla HTML, CSS, and browser JavaScript. No bundler or ES module imports.
- **UI:** Tailwind CSS via CDN with class-based dark mode and custom platform badge styles.
- **Backend:** Firebase Authentication and Cloud Firestore using the compat SDK.
- **Metadata and discovery:** TMDB `/search/multi`, `/discover`, `/trending`, and `/watch/providers` endpoints.
- **Hosting:** GitHub Pages.
- **Main files:** `index.html`, `config.js`, and `app.js`. `style.css` is legacy and currently unused.

`config.js` assigns `window.APP_CONFIG` with the Firebase web configuration and TMDB API key. `index.html` loads it immediately before `app.js`; app code reads the values from `window.APP_CONFIG`.

## 3. Completed Features Through v2.9.1

### Authentication and private libraries

- Google Sign-In gates the dashboard behind `#splashScreen` and `#appDashboard`.
- Watchlist documents are queried with `userId == currentUser.uid`. Listener cleanup prevents duplicate or stale Firestore listeners.
- New single-candidate and bulk-added documents include `userId`, `addedBy`, and watched state.

### Two-view dashboard

- **My Library** and **Add Titles** views switch through `switchView(viewName)` and synchronize `window.location.hash`.
- My Library has a compact Search / Filters / Manage / Watchable Now toolbar. Search, filters, and batch management are hidden until opened; card selection controls appear only in Manage mode.
- Default grouping is **Status → Platform**, remembered in local storage. “To Watch” appears before “Watched”; watched groups start collapsed.
- An empty library offers a shortcut to Add Titles.

### Candidate search and smart bulk upload

- Candidate lookup uses TMDB `/search/multi`, prioritizes exact case-insensitive title matches, and returns up to four candidates ordered by popularity.
- Candidate cards show poster, title, year, movie/TV type, language, rating, and duplicate status. Saving a candidate fetches its exact movie/TV India provider data and stores its TMDB ID.
- Smart Bulk Upload (Option A) searches each title sequentially. It auto-adds a clear winner (single result or at least 2.5 times the second result’s popularity), skips already-saved matches, reports titles not found, and queues ambiguous matches in a review panel.
- Review choices use the same candidate save flow and remove the review row after a successful add.

### India discovery and subscriptions

- Add Titles contains an on-demand **Trending & Discover in India** panel with type, genre, language, platform, freshness, and sort controls.
- Discovery always uses TMDB India `/discover/movie` and/or `/discover/tv` queries with flat-rate availability and a minimum vote count. The default **Last 6 Months** filter uses movie digital/OTT release dates (release type 4) and TV air dates; **All-Time Popular** removes the date window.
- Platform discovery fetches the India movie provider list once per browser session, normalizes provider names, and maps each service to pipe-separated TMDB provider IDs. Results from movie and TV queries merge by the selected popularity or newest-first sort.
- Results are capped at 12 and cached by all six filters. The dashboard footer credits TMDB and JustWatch for streaming availability.
- **My OTTs** stores each user’s selected services in local storage under `watchlist_subs_<uid>` (or `watchlist_subs_guest` when signed out).
- **Watchable Now** filters the library to subscribed normalized platforms; matching cards show an “On Your OTT” marker. If no subscriptions are saved, the subscription modal opens first.

### Other library features

- Live search, type/platform/genre/language filters, sorting, one- and two-level collapsible grouping, watched status, metadata refresh, per-card selection, and confirmed batch deletion.
- The guided tour covers Library navigation and filters, primary grouping, candidate search, and bulk upload. It opens the relevant view/panel and restores the starting view and any panel it opened.
- Light/dark theme toggle, responsive filter drawer, real-time Firestore updates, and India platform normalization.

## 4. Key Files and Functions

### Files

- `config.js` — `window.APP_CONFIG` Firebase and TMDB configuration.
- `index.html` — splash, dashboard views, controls, discovery panel, subscriptions modal, and script loading order.
- `app.js` — auth/listener lifecycle, candidate and discovery workflows, rendering, local preferences, and Firestore mutations.
- `style.css` — legacy stylesheet; not loaded or used by the current app.

### Key functions in `app.js`

- Views and tour: `switchView`, `startWatchlistTour`, `showWatchlistTourStep`, `endWatchlistTour`.
- User data: `setupFirebaseListener`, `getSubscriptionStorageKey`, `getUserSubscriptions`, `openSubscriptionsModal`, `saveSubscriptions`, `toggleWatchableNow`, `itemIsOnSubscribedOTT`.
- Library controls and rendering: `toggleSearchPanel`, `toggleFilterDrawer`, `toggleManageMode`, `saveGroupingPreferencesAndRender`, `getItemLanguage`, `getGroupKey`, `populateFilterDropdowns`, `renderWatchlist`, `renderGroupedCards`, `renderGroupCards`.
- TMDB candidate flow: `fetchTMDBDetails`, `searchTMDBCandidates`, `isAlreadyInWatchlist`, `saveCandidateToWatchlist`, `fetchIndiaProviders`, `renderCandidateResults`, `searchCandidateInput`.
- Discovery: `fetchIndiaWatchProviderMap`, `formatTrendingDate`, `loadTrendingDiscover`, `mapTrendingResult`, `renderTrendingShelf`.
- Bulk and batch actions: `bulkUploadItems`, `renderBulkReviewContainer`, `deleteSelected`, `deleteAll`.
- Metadata and item actions: `refreshMetadata`, `toggleWatched`, `deleteItem`.

## 5. Known Issues and v3.0.0 Roadmap

- Configure and verify **Firestore Security Rules in the Firebase Console** so reads and writes are enforced by authenticated UID, in addition to client-side scoping.
- Add a **Smart Social Text Parser** for pasted recommendations and links from social platforms.
- Add **JSON/CSV Export and Import** for backups and migration.
- Add an optional **Shared/Family Watchlist** toggle.
- Add a **Cloudflare Worker API proxy** so TMDB requests do not expose the API key in the browser.

## 6. Working Rules

- Keep the app in vanilla browser JavaScript with Firebase compat scripts and Tailwind CDN; do not introduce Node.js, npm build steps, React, or ES module imports.
- Work incrementally and keep changes easy to review.
- Preserve the splash screen and Google Sign-In flow unless a task explicitly requests a change.
