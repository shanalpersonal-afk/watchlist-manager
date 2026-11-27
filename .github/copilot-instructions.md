# Watchlist Studio Copilot Instructions

## Tech Stack

- Use 100% Vanilla HTML5, CSS3, and browser JavaScript in Browser Compat mode.
- Never use Node.js, npm, bundlers, React, or ES module `import` / `export` syntax.

## Architecture

- Keep the core browser files: `index.html`, `config.js`, `api.js`, `store.js`, `discover.js`, `tour.js`, and `app.js`.
- Load the classic scripts in their existing order.
- Use Firebase Authentication and Firestore Compat SDKs.
- Use the configured Cloudflare Worker proxy for TMDB and Gemini requests.
- Keep the TMDB API key server-side; never add it to browser configuration or requests.

## Coding Style

- Prefer explicit, descriptive function names.
- Use plain-English comments only where behavior or source filtering needs clarification.
- Make small, complete, non-breaking edits that preserve existing modal, sign-in, and listener behavior.
- Reuse existing helpers and browser APIs rather than introducing build-time tooling or dependencies.
- Guard against empty arrays, missing profile fields, and null DOM elements.

## Handoff Rule

- Update `PROJECT_CONTEXT.md` after completing any feature or fix.
- Record the root-cause diagnosis, changed behavior, current version/status, new functions or DOM IDs, known issues, and remaining next steps.
