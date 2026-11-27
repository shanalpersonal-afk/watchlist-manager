# Project Context: Watchlist Studio

**Current version: v2.21.3**

### v2.21.3 Repository Instructions and Pick Tonight Metadata

- Added [.github/copilot-instructions.md](.github/copilot-instructions.md) to document the strict Vanilla JS Browser Compat architecture and feature handoff rule.
- **Root cause:** Fresh For Your Taste cards could receive raw TMDB discover objects whose fields use `name`, `release_date`, `first_air_date`, `vote_average`, `poster_path`, `media_type`, and `id`.
- **Fix:** added `normalizeTonightCandidate()` in `app.js` and normalize results before filtering and rendering. Cards now derive title, year, rating, poster, media type, and TMDB ID consistently.
- The normalized `mediaType` and `id` are reused by `fetchTMDBTrailerUrl`, `fetchCandidateIndiaPlatforms`, and `saveCandidateToWatchlist`, keeping Trailer and Add actions functional.
- Current version: **v2.21.3**.

### v2.21.2 Pick Tonight

- **Root cause:** the previous Surprise Me control was a small, unlabeled 40px `🎲` icon inside the Library toolbar, making the feature easy to miss and limiting discoverability on mobile.
- **Fix:** replaced it with a prominent labeled gradient `#pickTonightBtn` in `#libraryView` and added a hybrid `#pickTonightModal` bottom sheet.
- Section A uses up to two random unwatched active-watchlist titles, prioritizing subscription and free platform matches. It is hidden when there are no unwatched titles.
- Section B queries TMDB using the user's taste languages and genres, excludes watchlist and dismissed titles, and falls back to broad Discover results so fresh picks remain available.
- Fresh cards include poster, title, year, rating, India OTT badge, trailer, and one-tap add controls. `#rerollTonightBtn` refreshes both sections and analytics is tracked for open and re-roll actions.
- Current version: **v2.21.2**.

## 1. Project Vision

Watchlist Studio is a personal media discovery and tracking app. It helps users collect movie and TV recommendations, find India streaming availability, and track ratings, genres, language, and watched status.

## 2. Current Stack and Files

- **Frontend:** Vanilla HTML, CSS, and browser JavaScript. No bundler or ES module imports.
- **UI:** Tailwind CSS via CDN with class-based dark mode and custom platform badge styles.
- **Backend:** Firebase Authentication and Cloud Firestore using the compat SDK.
- **Metadata and discovery:** TMDB `/search/multi`, `/discover`, `/trending`, and `/watch/providers` endpoints.
- **Hosting:** [GitHub Pages](https://shanalpersonal-afk.github.io/watchlist-manager/).
- **Main files:** `index.html`, `config.js`, `api.js`, `store.js`, `discover.js`, `tour.js`, `app.js`, and the Cloudflare Worker reference `worker.js`. `style.css` is legacy and currently unused.
- **Installable web app:** `manifest.json` and Apple web app metadata support standalone installation. The splash screen and dashboard footer show Save as App steps for iPhone, Android, and desktop.

`config.js` assigns `window.APP_CONFIG` with the Firebase web configuration and Cloudflare Worker URL. The page loads classic scripts in this order: `config.js` → `api.js` → `store.js` → `discover.js` → `tour.js` → `app.js`. The code stays in vanilla browser JavaScript with no modules, Node.js, or bundler; the TMDB API key is a Worker secret.

## 3. Completed Features Through v2.21.0

### v2.19.0 AI Curator

- Added `POST /ai/recommend` to `worker.js`, which calls Gemini 3.8 Flash with the user's liked titles, languages, genres, subscriptions, exclusions, and optional mood.
- Added the **🤖 AI Picks** chip and optional mood prompt to Discover. AI suggestions are matched through TMDB for poster, streaming, quick add, hide, and preview behavior; preview sheets include the AI pitch.

### v2.19.1 Taste Wizard and Gemini curator

- Reworked `#tasteOnboardingModal` into a language and genre preference step followed by one poster screen per selected pair, with search, pagination, and early finish.
- Added persisted `dismissedTitles` as negative curator signals alongside separate loved and saved-to-watch buckets.
- Upgraded the Gemini prompt to return 12 picks across direct matches, recent releases, and hidden gems / cross-language discoveries.
- This release set the current version to **v2.19.1**.

### v2.20.0 Plain-JS modules, cached AI Picks, and India freshness

- Split browser code into `api.js` for TMDB, `store.js` for Firebase and data actions, `discover.js` for discovery and taste onboarding, `tour.js` for tour and release notes, and `app.js` for UI state and startup.
- AI Picks are cached in memory using mood, loved titles, and dismissed titles as the cache signature. The refresh button clears the cache and requests fresh Gemini picks.
- India Discover uses lower vote thresholds for Hindi and regional Indian languages, date windows without the theatrical release filter, and widens sparse six-month queries to twelve months.
- Current version is **v2.20.0**.
- At v2.20.0, the next planned items were **🎲 Pick For Me Tonight**, **▶ Watch Trailer**, **📤 1-Tap Share (`?add=...`)**, and **4-Friend Watch Circle**.

### Updated file structure

- `index.html`: page markup and ordered classic script tags.
- `config.js`: browser configuration; unchanged.
- `api.js`: TMDB requests, provider lookup, platform names, and social text parsing.
- `store.js`: Firebase setup, profiles, shared lists, watchlist listener, and data mutations.
- `discover.js`: Discover, AI Picks caching, and taste onboarding.
- `tour.js`: guided tour and What's New release notes.
- `app.js`: shared browser state, UI helpers, filtering, rendering, and DOM startup.
- `worker.js`: Cloudflare Worker reference, including TMDB transient-error retries.

### v2.21.0 Reliability, analytics, Surprise Me, and sharing

- Added one retry after 250 ms for transient TMDB Worker network and gateway failures. Video endpoints support movie and TV trailer lookups.
- Discover movie and TV query results settle independently so one transient failure does not drop results from the other media type.
- Added optional Firebase Analytics events and signed-in `errorLogs` capture, capped at five entries per browser session.
- Added 🎲 Surprise Me for filtered To Watch items, trailer and share actions in title previews, and sign-in handling for `?add=movie:ID` / `?add=tv:ID` links.
- Added the account menu feedback link and deleted unused `style.css`.
- Current version is **v2.21.0**.
- Remaining roadmap: **v2.22.0 US + India Region Switcher** and **v2.23.0 4-Friend Watch Circle**.

### New functions

- `fetchWithRetry()` retries transient TMDB Worker failures once.
- `fetchTMDBTrailerUrl()` and `fetchTMDBTitleById()` support trailers and shared title links.
- `trackEvent()` and `logAppError()` wrap analytics and browser error logging.
- `initializeAuthStateListener()` and `openIncomingAddPreview()` preserve the sign-in gate and resolve shared title links.
- `getFilteredLibraryItems()` and `surpriseMe()` choose a random filtered To Watch title.
- `loadPreviewTrailer()`, `shareActivePreview()`, and `copyShareUrl()` power trailer and share actions.

## Previous release notes

### v2.18.0 taste based discovery and free India OTTs

- India provider lookups now include free and ad supported services. Free only titles show a green 🆓 badge, and title previews list subscription and free / ad supported services separately.
- Added Spotify style `#tasteOnboardingModal` for language and genre preferences plus favorite title seeds. It follows the first walkthrough, appears once for existing users who have not completed it, and can be reset from Profile & OTTs.
- **Because You Watched** recommendations use watched titles first, then titles to watch, then taste seeds. The For Me action falls back to profile based Discover when there are no seeds.

### v2.17.3 combined release

- Discover recommendations can be hidden from poster cards or title previews. Hidden TMDB IDs are saved in the user profile, Undo is available from a toast, and Profile & OTTs can reset the hidden list.
- First-time signed-in users automatically see the guided tour after the dashboard loads. Tour completion is saved in the user profile and local storage.
- Added a seven-day **What's New (Last 7 Days)** modal backed by `APP_UPDATES`, with an unread dot in the account menu.

### v2.17.1 mobile modal ergonomics and Discover state

- Standardized mobile sheets with a 75vh height cap, fixed headers and footers, an independently scrolling body, compact filter pills, and 44×44 px close targets. Background scrolling locks while a modal is open and restores after the final modal closes.
- Discover mode chips now show a clear active state. Custom filters show their count and a one-line active summary with a Clear action that returns to Trending.

### v2.17.0 mobile-first minimalist redesign

- Replaced the crowded header with a single-line Watchlist header, centered desktop navigation, and one avatar button that opens the `#accountMenuModal` bottom sheet/popover for Profile & OTTs, theme, tour, and sign out.
- Simplified the Library controls to one list/search/filter row, removed the quick-filter strip, and moved Watchable Now, grouping, sorting, filter pills, and Manage / Batch Delete into the filter sheet.
- Redesigned Library cards around a 2:3 poster, compact OTT and rating badges, one-line title, and watched state; metadata refresh, delete, language, year, all OTTs, and synopsis now live in `#detailPreviewModal`.
- Reduced Discover to Trending, For Me, and Filter chips with a responsive two-column mobile poster grid. The mobile bottom navigation remains in place.
- Updated the guided tour to four steps: active list, Library filters, title search, and the avatar account menu.
- New modal/helper: `#accountMenuModal` and `toggleAccountMenu()`.

### v2.16.3 mobile preview and faster Discover

- Restyled `#detailPreviewModal` as a mobile bottom sheet with a compact poster and stacked synopsis/action, while retaining a centered desktop modal and backdrop dismissal.
- Added six animated poster skeletons for Discover and a compact candidate search loading row.
- Discover now renders posters immediately after `/discover` returns and fills OTT badges progressively as India provider lookups resolve.

### v2.16.1 Discover initialization fix

- Defined `initDiscoverPresets()` and use it to connect each Discover preset chip to `applyDiscoverPreset()`, preventing the DOMContentLoaded ReferenceError and restoring the 1-tap preset actions.

### v2.16.0 Modern Mobile & Web UX Polish

- Library quick-filter pills cover movie/TV type, popular India platforms, and Hindi, English, and Korean. Filters open in a responsive bottom sheet on phones and centered modal on desktop, with tappable chips and Clear All / Done actions.
- Group By defaults to **No Grouping**; **Tuck Watched at bottom** remains checked by default.
- Candidate search runs after 450 ms of typing, includes inline clear and loading affordances, and still supports Enter. Add Titles now opens bulk list/caption import in `#bulkUploadModal`.
- Replaced non-destructive browser alerts with floating `showToast` messages.
- Discover now offers one-tap Fresh on OTT, My Profile, Hindi Movies, Korean, Netflix, Prime Video, and Comedy presets, plus a custom filter sheet.
- Search, Discover, and Library posters open `#detailPreviewModal` with TMDB overview and India OTT details. Discover uses poster-first 2:3 cards with a circular add control.
- Added the fixed mobile Library / Add / Shared bottom navigation and extra dashboard bottom padding.
- New helpers and UI names: `showToast`, `openDetailPreview`, `#bulkUploadModal`, and `#detailPreviewModal`.

### v2.15.1 usability fixes

- Prevented duplicate shared-list creation with an in-progress guard and button disable; shared-list snapshots rebuild a deduplicated list picker and list panel.
- Added candidate-search and library-search clear controls. Closing the library search panel also clears its query.
- Replaced primary/secondary grouping controls with `#groupBySelect` and `#tuckWatchedToggle`, saved as `watchlist_group_by` and `watchlist_tuck_watched`. Watched titles can stay grouped at the bottom, collapsed by default.
- Added `#sharedListBanner` with the active list's invite code and copy-code/copy-link actions.

### v2.15.0 Shared/Family Watchlists — Iteration 1

- Added a `lists` collection for shared lists, each with an owner, member UIDs, and a six-character uppercase alphanumeric invite code.
- Users can create a list, join by code, copy a `?join=` invite link, leave a list, or delete a list they own. Invite links are handled after sign-in and cleaned from the address bar.
- The active-list picker switches between the private list and joined shared lists. Watchlist reads use `userId` for private items and `listId` for shared items; private reads filter out records with a `listId` field.
- New shared-list items include `listId` and show their `addedBy` attribution. Delete All is hidden and guarded while a shared list is active; deleting an owned list removes its shared titles.
- New shared-list functions: `loadSharedLists`, `createSharedList`, `joinSharedList`, `leaveOrDeleteSharedList`, and `switchActiveList`.

### v2.14.0 installable web app

- Added `manifest.json` with Watchlist Studio app identity, standalone display mode, and theme/background colors.
- Added manifest and Apple web app metadata to `index.html`; updated the page title and dashboard version badge to v2.14.0.
- Added collapsible Save as App instructions below Google Sign-In on the splash screen and in the dashboard footer beside the TMDB/JustWatch credit.

### Authentication and private libraries

- Google Sign-In gates the dashboard behind `#splashScreen` and `#appDashboard`.
- Watchlist documents are queried with `userId == currentUser.uid`. Listener cleanup prevents duplicate or stale Firestore listeners.
- New single-candidate and bulk-added documents include `userId`, `addedBy`, and watched state.

### Two-view dashboard

- **My Library** and **Add Titles** views switch through `switchView(viewName)` and synchronize `window.location.hash`.
- My Library has a compact Search / Filters / Manage / Watchable Now toolbar. Search, filters, and batch management are hidden until opened; card selection controls appear only in Manage mode.
- Grouping choices are remembered in local storage. Group By defaults to **No Grouping**, with **Tuck Watched at bottom** enabled so unwatched titles appear first.
- An empty library offers a shortcut to Add Titles.

### Candidate search and smart bulk upload

- Candidate lookup uses TMDB `/search/multi`, prioritizes exact case-insensitive title matches, and returns up to four candidates ordered by popularity.
- Candidate cards show poster, title, year, movie/TV type, language, rating, and duplicate status. Saving a candidate fetches its exact movie/TV India provider data and stores its TMDB ID.
- Smart Bulk Upload (Option A) searches each title sequentially. It auto-adds a clear winner (single result or at least 2.5 times the second result’s popularity), skips already-saved matches, reports titles not found, and queues ambiguous matches in a review panel.
- Review choices use the same candidate save flow and remove the review row after a successful add.
- The **Smart Social Text Parser** cleans messy Instagram, YouTube, WhatsApp, and Reddit captions/lists into ordered, deduplicated titles. It strips links, hashtags, emojis, bullets, common CTA lines, and trailing platform/year/language tags before users review and upload the extracted list.

### India discovery and profile preferences

- Add Titles contains an on-demand **Trending & Discover in India** panel with type, genre, language, platform, freshness, and sort controls.
- Discovery always uses TMDB India `/discover/movie` and/or `/discover/tv` queries with flat-rate availability and a minimum vote count. The default **Last 6 Months** filter uses movie digital/OTT release dates (release type 4) and TV air dates; **All-Time Popular** removes the date window.
- Platform discovery fetches the India movie provider list once per browser session, normalizes provider names, and maps each service to pipe-separated TMDB provider IDs. Results from movie and TV queries merge by the selected popularity or newest-first sort.
- Results are capped at 12 and cached by all six filters. The dashboard footer credits TMDB and JustWatch for streaming availability.
- A clickable avatar and name open **Profile & Preferences**, with checkbox groups for OTT subscriptions, preferred languages, and preferred genres.
- Profile preferences load from `users/{uid}` in Firestore and fall back to `watchlist_profile_<uid>` in local storage. Firestore permission failures leave local preferences available.
- Discover can default to **My Subscriptions** and **My Languages**. It combines provider IDs for all selected services and queries each preferred language, then interleaves and deduplicates results for balanced recommendations.
- **Watchable Now** filters the library to subscribed normalized platforms; matching cards show an “On Your OTT” marker. If no subscriptions are saved, the profile modal opens first.

### TMDB API proxy

- Browser requests to TMDB use `buildTMDBUrl(endpointPath, queryParams)` and the configured `tmdbProxyUrl`; the TMDB API key is no longer stored in `config.js` or sent by browser code.
- `worker.js` is the Cloudflare Worker reference. It restricts allowed origins and TMDB paths, reads the secret `TMDB_API_KEY` Worker variable, and forwards TMDB JSON responses with CORS headers.
- Set the Worker secret `TMDB_API_KEY` in Cloudflare so the proxy can authenticate its upstream TMDB requests.
- The configured proxy URL is `https://tmdb-proxy.shanalgr8.workers.dev`; the Worker allows the GitHub Pages origin `https://shanalpersonal-afk.github.io` and localhost/127.0.0.1 origins on any port for Live Server.

### Discover freshness and platform badges

- Six-month Discover freshness applies to every movie/TV and `my_subs`/`my_langs` query: movies use a six-month India digital release window plus a twelve-month primary-release cutoff, and TV uses a six-month first-air-date window. Queries use India availability, flat-rate streaming, popularity/newest sorting, and at least 10 votes.
- Discover tiles show India streaming platform badges. Provider results are normalized and cached on each candidate; `my_subs` prioritizes an available service from the user's subscriptions.

### v2.13.0 mobile and discovery updates

- The header wraps on narrow screens, keeps its action buttons on one line, and hides the profile name on extra-small screens while preserving the profile avatar trigger.
- Discover removes already-saved titles before display.
- Library Type, Platform, Genre, and Language filters and Discover Platform, Genre, and Language filters use compact checkbox dropdowns. Library selections survive Firestore snapshot refreshes; Discover supports multiple provider IDs, genres, and interleaved language queries.
- Discover pagination adds a **Load More** control, fetches subsequent TMDB pages, and omits titles already saved or already shown.

### Other library features

- Live search, type/platform/genre/language filters, sorting, one- and two-level collapsible grouping, watched status, metadata refresh, per-card selection, and confirmed batch deletion.
- The guided tour covers Library navigation and filters, primary grouping, candidate search, and bulk upload. It opens the relevant view/panel and restores the starting view and any panel it opened.
- Light/dark theme toggle, responsive filter drawer, real-time Firestore updates, and India platform normalization.

## 4. Key Files and Functions

### Files

- `config.js` — `window.APP_CONFIG` Firebase configuration and the Cloudflare Worker URL; it contains no TMDB API key.
- `worker.js` — Cloudflare Worker source; keeps the TMDB API key server-side and retries transient TMDB failures.
- `manifest.json` — installable web app name, launch URL, standalone display mode, and colors.
- `index.html` — splash, dashboard views, controls, modals, feedback link, and ordered classic scripts.
- `api.js` — TMDB URL and details helpers, title searches, trailers, platform aliases, and India provider lookups.
- `store.js` — Firebase initialization, auth listener, user profile, shared lists, analytics, errors, and watchlist mutations.
- `discover.js` — India discovery, taste wizard, and in-memory AI Picks cache.
- `tour.js` — guided tour and What's New release history.
- `app.js` — global UI state, event wiring, filters, modal previews, Library rendering, and bulk import.
- `style.css` — removed in v2.21.0 because the app does not use it.

### Key functions by file

- API: `buildTMDBUrl`, `searchTMDBCandidates`, `fetchTMDBDetails`, `fetchTMDBTrailerUrl`, `fetchTMDBTitleById`, `fetchIndiaWatchProviderMap`, `fetchCandidateIndiaPlatforms`.
- Store: `initializeAuthStateListener`, `setupFirebaseListener`, `loadUserProfile`, `saveUserProfile`, `saveCandidateToWatchlist`, `joinSharedList`, `trackEvent`, `logAppError`, `openIncomingAddPreview`.
- Discover: `loadTrendingDiscover`, `loadPersonalizedRecommendations`, `loadAIPicksRecommendations`, `openTasteOnboardingModal`, `loadTastePairPage`, `resetTrendingDiscover`.
- Tour: `startWatchlistTour`, `showWatchlistTourStep`, `endWatchlistTour`, `APP_UPDATES`, `getRecentUpdates`, `openWhatsNewModal`.
- UI and library: `switchView`, `showToast`, `openDetailPreview`, `shareActivePreview`, `surpriseMe`, `getFilteredLibraryItems`, `populateFilterDropdowns`, `renderWatchlist`, `renderGroupedCards`, `renderGroupCards`, `bulkUploadItems`.
- Pick Tonight: `openPickTonightModal`, `generateTonightPicks`, `generateTonightFreshPicks`, `rerollTonightPicks`, `renderTonightWatchlistPicks`, `renderTonightFreshPicks`, `normalizeTonightCandidate`.
- Pick Tonight DOM IDs: `#pickTonightBtn`, `#pickTonightModal`, `#pickTonightBody`, `#tonightWatchlistSection`, `#tonightWatchlistResults`, `#tonightFreshResults`, `#rerollTonightBtn`, `#closePickTonightBtn`, `#closePickTonightBackdrop`.

## 5. Remaining Next Steps

- **Known issues:** Taste Profile queries may be sparse for uncommon language/genre combinations, so Pick Tonight uses a broad TMDB Discover fallback and should continue to be tested with very small watchlists.
- **v2.22.0 US + India Region Switcher.**
- **v2.23.0 4-Friend Watch Circle.**


## 6. Working Rules

- Keep the app in vanilla browser JavaScript with Firebase compat scripts and Tailwind CDN; do not introduce Node.js, npm build steps, React, or ES module imports.
- Work incrementally and keep changes easy to review.
- Preserve the splash screen and Google Sign-In flow unless a task explicitly requests a change.
