Project Context: Watchlist Studio (Current Version: v2.6.0)
1. Project Vision & Purpose
Watchlist Studio is a centralized media discovery and tracking web application designed to solve recommendation fragmentation (titles saved across Instagram Reels, YouTube Shorts, Reddit, and word-of-mouth) and answer three key questions:
Where was that recommendation saved?
Which streaming platform hosts it in India (region=IN)?
What are its ratings, genre, and original spoken language?
2. Current Tech Stack & Architecture
Frontend: Vanilla HTML5, CSS3, JavaScript (ES6+ Browser Compat Mode — NO bundlers, NO Node.js, NO ES module import statements).
UI Framework: Tailwind CSS via CDN (darkMode: 'class') with custom CSS platform badges.
Backend / Database: Firebase Cloud Firestore (watchlist collection) for real-time multi-device syncing (onSnapshot).
Authentication: Firebase Authentication (GoogleAuthProvider via popup sign-in).
External Data API: The Movie Database (TMDB API) using /search/tv, /search/movie, and /watch/providers (filtered strictly for India results.IN.flatrate).
Hosting & Deployment: GitHub Pages (https://erson-afk.github.io/watchlist-manager/), auto-deployed via git push to main.
Files in Repository: index.html, style.css (optional/legacy), app.js.
3. Git Commit & Version History (Completed Milestones)
v1.0.0: Initial single-file MVP (index.html) with single item entry, localStorage persistence, individual delete, genre filter, and alphabetical sorting.
v1.1.0: Added multi-line bulk upload, master "Select All" checkbox, selective deletion, color-coded platform badges, and real-time keyword search.
v2.0.0: Modularized codebase into index.html, style.css, and app.js. Integrated OMDb API for title validation, release year, genre extraction, and poster thumbnails. Added collapsible group board views.
v2.1.0: Implemented multi-attribute intersectional filtering (Type + Platform + Genre + Status + Search) and Content Type differentiation (movie vs tv).
v2.2.0: Migrated API engine from OMDb to TMDB API for automated India (region=IN) streaming availability detection, removed manual platform dropdowns, mapped TMDB genre IDs to readable names, deduplicated Prime Video provider variants, and added a live Bulk Upload progress bar.
v2.3.0: Replaced localStorage with Firebase Cloud Firestore for live real-time syncing across devices and added addedBy profile tagging.
v2.4.0 – v2.5.0: Integrated Tailwind CSS CDN, added TMDB vote average ratings (rating-desc sort), extracted original spoken languages (LANGUAGE_NAMES map), built a two-tier dynamic grouping engine (primaryGroupSelect + secondaryGroupSelect), added a Light/Dark theme toggle, and introduced a mobile collapsible filter drawer.
v2.6.0 (Current State): Implemented a logged-out Splash Cover Screen (#splashScreen), Firebase Google Sign-In authentication, and gated dashboard access (#appDashboard).
4. Current State & Known Issues to Resolve Next
Working Features:
Google Sign-In & Sign-Out flow via Firebase Auth.
Splash cover screen and dashboard visibility toggle.
Light/Dark theme toggle button (toggleTheme()).
Mark Watched / Unwatch toggle (toggleWatched(docId)).
TMDB search, poster display, ratings, and India streaming badge normalization.
Active Bugs / Missing Pieces in v2.6.x:
Language Filter & Legacy Data: Older Firestore documents created before v2.5.0 lack a language property. They need an explicit "Unknown Language" fallback (never defaulting falsely to "English"), and #filterLanguage needs reliable population.
Primary & Secondary Grouping Listeners: Ensure #primaryGroupSelect and #secondaryGroupSelect reliably trigger renderWatchlist() and render nested group headers cleanly.
Batch Management & Bulk Upload Restoration: Restore the Bulk Upload panel (with live progress bar) and "Delete Selected" / "Delete All" buttons into the v2.6.0 Tailwind UI layout.
Interactive Guided Tour: Planned for v2.6.0 (#startTourBtn) to walk new users through adding titles, filtering, and multi-grouping—not yet implemented.
5. Planned Future Roadmap (Next Iterations)
v2.7.0 (Data Integrity & UI Completeness):
Fix language filter & two-tier grouping stability.
Restore Bulk Upload with progress bar, checkbox selection, "Delete Selected", and "Delete All".
Add an auto-healing / "Refresh Metadata" button on older cards to backfill missing TMDB language/rating/provider data.
Implement the interactive step-by-step Guided Onboarding Tour.
v2.8.0 (User-Specific Watchlists & Sharing):
Scope Firestore queries by user.uid so each Google account has a private watchlist, plus an optional "Shared / Family List" toggle so friends can collaborate.
Add a "My Subscriptions" settings modal so users can highlight titles available on the platforms they actually pay for.
v3.0.0 (Smart Social Import & Offline Backup):
Smart Link / Text Parser: Paste text or links from Instagram Reels, YouTube Shorts, or Reddit threads to automatically extract movie/show titles.
JSON / CSV Export & Import for local backups.
Multi-source ratings (combining TMDB, IMDb, and Rotten Tomatoes scores).
6. Working Rules for AI Assistant
I am a beginner/novice developer using "vibe coding" on a MacBook Air M1 with VS Code, Git, and GitHub.
Do NOT introduce Node.js, npm build steps, React, or ES module import statements—keep everything in plain vanilla HTML/JS/Tailwind CDN (Firebase Compat mode).
Work incrementally in small, reversible steps (Understand → Plan → Build → Test → Commit).
Always tell me which files change, what could break, and how to test before making big edits.