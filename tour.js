// Guided tour steps and release notes.

function getRecentUpdates(days = 7) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Math.max(0, Number(days) || 0));
    const recent = APP_UPDATES.filter(update => new Date(`${update.date}T00:00:00`) >= cutoff);
    return recent.length ? recent : APP_UPDATES.slice(0, 1);
}

function openWhatsNewModal() {
    const body = document.getElementById('whatsNewBody');
    if (body) {
        body.replaceChildren();
        getRecentUpdates(7).forEach(update => {
            const section = document.createElement('section');
            section.className = 'mb-5 last:mb-0';
            const heading = document.createElement('div');
            heading.className = 'flex items-baseline justify-between gap-3';
            const title = document.createElement('h3');
            title.className = 'font-bold';
            title.textContent = `${update.version} · ${update.title}`;
            const date = document.createElement('time');
            date.className = 'shrink-0 text-xs text-slate-500';
            date.dateTime = update.date;
            date.textContent = update.date;
            heading.append(title, date);
            const list = document.createElement('ul');
            list.className = 'mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300';
            update.items.forEach(item => { const li = document.createElement('li'); li.textContent = item; list.appendChild(li); });
            section.append(heading, list);
            body.appendChild(section);
        });
    }
    const latest = APP_UPDATES[0];
    try { localStorage.setItem('watchlist_last_seen_update', latest.date); } catch (error) { /* The modal can still be read this session. */ }
    updateWhatsNewDot();
    showModal('whatsNewModal');
}

function updateWhatsNewDot() {
    const dot = document.getElementById('whatsNewDot');
    if (!dot || !APP_UPDATES.length) return;
    let seen = '';
    try { seen = localStorage.getItem('watchlist_last_seen_update') || ''; } catch (error) { /* Treat unavailable storage as unread. */ }
    dot.classList.toggle('hidden', seen >= APP_UPDATES[0].date);
}

function startWatchlistTour() {
    endWatchlistTour(false);
    tourStartingView = currentViewName;
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

    const targetView = tourTarget.closest('#libraryView, #addView');
    if (tourTarget.id === 'navLibraryBtn') switchView('library');
    else if (tourTarget.id === 'navAddBtn') switchView('add');
    else if (targetView) switchView(targetView.id === 'addView' ? 'add' : 'library');

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

    const filterDrawer = document.getElementById('filterDrawer');
    if ((step.selector === '#filterDrawer' || tourTarget.id === 'groupByOptions') && filterDrawer?.classList.contains('hidden')) {
        tourOpenedFilterDrawer = true;
        filterDrawer.classList.remove('hidden');
        filterDrawer.classList.add('flex');
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

async function endWatchlistTour(markCompleted = true, wasSkipped = false) {
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
        document.getElementById('bulkUploadModal')?.classList.add('hidden');
    }
    if (tourOpenedFilterDrawer) {
        const drawer = document.getElementById('filterDrawer');
        drawer?.classList.add('hidden');
    }
    if (tourStartingView) switchView(tourStartingView);

    activeTourStep = -1;
    tourTarget = null;
    tourOriginalStyles = null;
    tourOpenedBulkPanel = false;
    tourOpenedFilterDrawer = false;
    tourStartingView = null;
    if (markCompleted) trackEvent(wasSkipped ? 'tour_skipped' : 'tour_completed');
    if (markCompleted && currentUser && userProfileUid === currentUser.uid) {
        userProfile.hasCompletedTour = true;
        try { localStorage.setItem(`watchlist_tour_done_${currentUser.uid}`, 'true'); } catch (error) { /* Keep tour completion in the profile. */ }
        await persistUserProfileSilently();
        if (!userProfile.hasCompletedTasteOnboarding && localStorage.getItem(`watchlist_taste_done_${currentUser.uid}`) !== 'true') window.setTimeout(() => {
            if (currentUser && !userProfile.hasCompletedTasteOnboarding) openTasteOnboardingModal();
        }, 350);
    }
}

const APP_UPDATES = [
    { version: 'v2.21.5', date: '2026-11-27', title: 'Pick Tonight India streaming filters', items: ['Fresh picks now require India streaming availability.', 'When subscriptions are set, picks are limited to those OTTs or free and ad-supported sources.', 'Watchlist picks prioritize titles available on your OTTs or free sources.'] },
    { version: 'v2.21.3', date: '2026-11-27', title: 'Pick Tonight metadata fix', items: ['Normalized TMDB title, year, rating, poster, media type, and ID fields.', 'Kept Trailer and Add actions working with every Fresh For Your Taste card.', 'Added strict repository instructions for future browser-compatible changes.'] },
    { version: 'v2.21.2', date: '2026-11-27', title: 'Pick Tonight hybrid recommendations', items: ['Added a prominent labeled Pick Tonight button in the Library toolbar.', 'Combined saved watchlist picks with fresh Taste Profile recommendations.', 'Added re-roll, trailers, India OTT badges, and one-tap add actions.'] },
    { version: 'v2.21.0', date: '2026-11-27', title: 'Surprise, trailers, and sharing', items: ['Pick a random title from your To Watch list.', 'Open trailers and share add-to-watchlist links from previews.', 'Track browser errors and key app events.'] },
    { version: 'v2.20.0', date: '2026-11-27', title: 'Modular browser app and Discover refresh', items: ['Split the plain JavaScript app into focused browser files.', 'Keep AI Picks cached across views and refresh them on demand.', 'Show more Hindi and regional language titles in fresh India Discover.'] },
    { version: 'v2.19.1', date: '2026-11-27', title: 'Taste Wizard and smarter AI picks', items: ['Choose language and genre poster steps with more titles and Load More.', 'Gemini weighs loved, saved, and dismissed titles separately.'] },
    { version: 'v2.19.0', date: '2026-11-27', title: 'AI Picks', items: ['Ask Gemini for movie and TV recommendations based on your taste, subscriptions, and optional mood.', 'AI titles are matched through TMDB so India OTT details and quick add actions remain available.'] },
    { version: 'v2.18.0', date: '2026-11-27', title: 'Taste based picks and free streaming', items: ['Find free and ad supported India streaming options for titles.', 'Get recommendations based on titles you have watched or loved.', 'Set your taste profile with a guided movie and show picker.'] },
    { version: 'v2.17.3', date: '2026-11-27', title: 'Discover and onboarding', items: ['Hide Discover recommendations and undo the action; reset hidden titles from your profile.', 'New users are guided through the app automatically.', 'See recent changes in the new What’s New sheet.'] },
    { version: 'v2.17.2', date: '2026-11-26', title: 'Discover controls', items: ['Improved recommendation controls and account preferences.'] },
    { version: 'v2.17.1', date: '2026-11-20', title: 'Mobile modal improvements', items: ['Standardized mobile sheets and improved Discover filter state.'] },
    { version: 'v2.17.0', date: '2026-11-18', title: 'A simpler mobile Watchlist', items: ['Updated navigation, Library controls, Discover cards, and guided tour.'] },
    { version: 'v2.16.0', date: '2026-10-30', title: 'Mobile and discovery polish', items: ['Added discovery presets, title previews, and mobile navigation.'] }
];

const WATCHLIST_TOUR_STEPS = [
    { selector: '#activeListSelect', title: 'Your Lists', description: 'Switch between your private list and shared watchlists.' },
    { selector: '#toggleFilterDrawerBtn', title: 'Library Filters', description: 'Find titles by platform, type, genre, or language.' },
    { selector: '#candidateSearchInput', title: 'Find a Title', description: 'Search for a movie or show, then add it to your list.' },
    { selector: '#accountMenuBtn', title: 'Your Account', description: 'Manage your profile, theme, tour, and sign-in.' }
];
