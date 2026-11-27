// Firebase setup, user profiles, shared lists, and watchlist changes.

// Firebase setup uses the compat scripts already loaded by the page.
const firebaseConfig = window.APP_CONFIG?.firebaseConfig;
if (typeof firebase !== 'undefined' && firebaseConfig && firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
const firebaseReady = typeof firebase !== 'undefined' && firebase.apps.length > 0;
const db = firebaseReady ? firebase.firestore() : null;
const auth = firebaseReady ? firebase.auth() : null;
let analytics = null;
let appErrorLogsThisSession = 0;
const APP_ERROR_SESSION_KEY = 'watchlist_app_error_count_v2';
try { appErrorLogsThisSession = Number(sessionStorage.getItem(APP_ERROR_SESSION_KEY)) || 0; } catch (error) { /* Keep the in-memory cap if session storage is blocked. */ }
try {
    if (firebaseReady && firebase.analytics && firebaseConfig?.measurementId) analytics = firebase.analytics();
} catch (error) {
    analytics = null;
}

// Send a browser analytics event without interrupting the app if analytics is unavailable.
function trackEvent(eventName, params = {}) {
    try { analytics?.logEvent(eventName, params); } catch (error) { /* Analytics is optional. */ }
}

// Save up to five signed-in browser errors per page session for troubleshooting.
function logAppError(source, error) {
    if (!currentUser || !db || appErrorLogsThisSession >= 5) return;
    appErrorLogsThisSession += 1;
    try { sessionStorage.setItem(APP_ERROR_SESSION_KEY, String(appErrorLogsThisSession)); } catch (storageError) { /* Keep the in-memory cap for this page. */ }
    const message = String(error?.message || error?.reason?.message || error?.reason || error || 'Unknown browser error');
    try {
        db.collection('errorLogs').add({
            message,
            source: String(source || 'unknown'),
            version: 'v2.21.4',
            userAgent: navigator.userAgent,
            uid: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => { /* Error logging must never interrupt the app. */ });
    } catch (loggingError) {
        /* Ignore logging failures so the original browser error stays primary. */
    }
}

window.addEventListener('error', event => logAppError('window.error', event.error || event.message));
window.addEventListener('unhandledrejection', event => logAppError('unhandledrejection', event.reason));

// Keep the existing Google sign-in gate and handle shared list and title links after sign-in.
function initializeAuthStateListener() {
    if (!auth) return;
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
            loadSharedLists();
            const params = new URLSearchParams(window.location.search);
            const addCode = params.get('add');
            if (addCode) {
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('add');
                window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
                openIncomingAddPreview(addCode);
            }
            const joinCode = new URLSearchParams(window.location.search).get('join');
            if (joinCode) {
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('join');
                window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
                joinSharedList(joinCode);
            }
        } else {
            currentUser = null;
            if (unsubscribeWatchlist) { unsubscribeWatchlist(); unsubscribeWatchlist = null; }
            if (unsubscribeSharedLists) { unsubscribeSharedLists(); unsubscribeSharedLists = null; }
            userSharedLists = [];
            activeListId = 'personal';
            renderSharedLists();
            updateActiveListControls();
            currentWatchlistItems = [];
            selectedDocIds.clear();
            renderWatchlist();
            if (splash) splash.classList.remove('hidden');
            if (dashboard) dashboard.classList.add('hidden');
        }
    });
}

// Resolve a shared title link and open the normal add-to-watchlist preview.
async function openIncomingAddPreview(value) {
    const match = /^(movie|tv):(\d+)$/.exec(String(value || ''));
    if (!match) { showToast('This shared title link is not valid.', 'error'); return; }
    try {
        const candidate = await fetchTMDBTitleById(match[1], match[2]);
        const providers = await fetchCandidateIndiaPlatforms(candidate.mediaType, candidate.id);
        candidate.platforms = providers.platforms;
        candidate.freePlatforms = providers.freePlatforms;
        candidate.platform = providers.platform;
        openDetailPreview(candidate, false);
    } catch (error) {
        showToast('Could not open the shared title.', 'error');
    }
}

function getUserProfileStorageKey(uid = currentUser?.uid) {
    return `watchlist_profile_${uid || 'guest'}`;
}

function normalizeUserProfile(profile) {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
        subscriptions: Array.isArray(source.subscriptions) ? [...new Set(source.subscriptions.filter(value => OTT_SERVICES.includes(value)))] : [],
        languages: Array.isArray(source.languages) ? [...new Set(source.languages.filter(value => Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, value)))] : [],
        genres: Array.isArray(source.genres) ? [...new Set(source.genres.filter(value => Object.prototype.hasOwnProperty.call(TRENDING_GENRE_IDS, value)))] : [],
        dismissedIds: Array.isArray(source.dismissedIds) ? [...new Set(source.dismissedIds.map(String))] : [],
        dismissedTitles: Array.isArray(source.dismissedTitles) ? [...new Set(source.dismissedTitles.map(value => String(value || '').trim()).filter(Boolean))] : [],
        dismissedItems: Array.isArray(source.dismissedItems) ? source.dismissedItems
            .filter(item => item && item.id != null && (item.mediaType === 'movie' || item.mediaType === 'tv'))
            .map(item => ({
                id: String(item.id),
                mediaType: item.mediaType,
                title: String(item.title || '').trim(),
                year: String(item.year || 'N/A').split('-')[0]
            })) : [],
        hasCompletedTour: source.hasCompletedTour === true,
        hasCompletedTasteOnboarding: source.hasCompletedTasteOnboarding === true,
        tasteSeedMovies: Array.isArray(source.tasteSeedMovies) ? source.tasteSeedMovies.filter(seed => seed && seed.id && (seed.mediaType === 'movie' || seed.mediaType === 'tv')).map(seed => ({ id: seed.id, mediaType: seed.mediaType, title: String(seed.title || ''), poster: seed.poster || null })).slice(0, 20) : []
    };
}

function getUserSubscriptions() {
    return currentUser && userProfileUid === currentUser.uid ? userProfile.subscriptions : [];
}

async function loadUserProfile() {
    if (!currentUser) return;
    const uid = currentUser.uid;
    let localProfile = { subscriptions: [], languages: [], genres: [], dismissedIds: [], dismissedTitles: [], dismissedItems: [], hasCompletedTour: false, hasCompletedTasteOnboarding: false, tasteSeedMovies: [] };
    try {
        localProfile = normalizeUserProfile(JSON.parse(localStorage.getItem(getUserProfileStorageKey(uid)) || '{}'));
    } catch (error) {
        localProfile = normalizeUserProfile(null);
    }
    if (!currentUser || currentUser.uid !== uid) return;
    userProfile = localProfile;
    userProfileUid = uid;
    applyProfileDefaultsToDiscover();
    updateWatchableNowButton();
    renderWatchlist();

    try {
        if (db) {
            const snapshot = await db.collection('users').doc(uid).get();
            if (currentUser?.uid === uid && snapshot.exists) {
                userProfile = normalizeUserProfile({ ...userProfile, ...snapshot.data() });
                try { localStorage.setItem(getUserProfileStorageKey(uid), JSON.stringify(userProfile)); } catch (error) { /* Keep the Firestore profile in memory. */ }
            }
        }
    } catch (error) {
        // Profile reads may be blocked until Firestore rules are configured; local preferences still work.
    }
    if (currentUser?.uid === uid) {
        applyProfileDefaultsToDiscover();
        updateWatchableNowButton();
        renderWatchlist();
        const tourDoneLocally = localStorage.getItem(`watchlist_tour_done_${uid}`) === 'true';
        const tasteDoneLocally = localStorage.getItem(`watchlist_taste_done_${uid}`) === 'true';
        if (!userProfile.hasCompletedTour && !tourDoneLocally) {
            window.setTimeout(() => { if (currentUser?.uid === uid && !userProfile.hasCompletedTour) startWatchlistTour(); }, 600);
        } else {
            if (!userProfile.hasCompletedTour && tourDoneLocally) {
                userProfile.hasCompletedTour = true;
                persistUserProfileSilently();
            }
            if (!userProfile.hasCompletedTasteOnboarding && !tasteDoneLocally) {
                window.setTimeout(() => { if (currentUser?.uid === uid && userProfile.hasCompletedTour && !userProfile.hasCompletedTasteOnboarding) openTasteOnboardingModal(); }, 600);
            }
        }
    }
}

async function openProfileModal() {
    if (currentUser && userProfileUid !== currentUser.uid) {
        userProfileLoadPromise = loadUserProfile();
        await userProfileLoadPromise;
    } else {
        await userProfileLoadPromise;
    }
    const profile = userProfileUid === currentUser?.uid ? userProfile : normalizeUserProfile(null);
    const hiddenCount = document.getElementById('hiddenRecommendationsCount');
    if (hiddenCount) hiddenCount.textContent = String(profile.dismissedIds.length);
    document.querySelectorAll('#profileModal [data-profile-group]').forEach(input => {
        input.checked = profile[input.dataset.profileGroup]?.includes(input.dataset.profileValue) || false;
    });
    showModal('profileModal');
}

function closeProfileModal() {
    hideModal('profileModal');
    pendingWatchableActivation = false;
}

async function saveUserProfile() {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const profile = { ...userProfile, subscriptions: [], languages: [], genres: [] };
    document.querySelectorAll('#profileModal [data-profile-group]:checked').forEach(input => {
        profile[input.dataset.profileGroup].push(input.dataset.profileValue);
    });
    userProfile = normalizeUserProfile(profile);
    userProfileUid = uid;
    try { localStorage.setItem(getUserProfileStorageKey(uid), JSON.stringify(userProfile)); } catch (error) { console.warn('Could not save profile preferences in local storage.', error); }
    const shouldEnableWatchableNow = pendingWatchableActivation;
    hideModal('profileModal');
    trendingCache.clear();
    if (shouldEnableWatchableNow) onlyWatchableNow = userProfile.subscriptions.length > 0;
    else if (userProfile.subscriptions.length === 0) onlyWatchableNow = false;
    pendingWatchableActivation = false;
    applyProfileDefaultsToDiscover();
    updateWatchableNowButton();
    renderWatchlist();
    if (document.getElementById('trendingPanel')?.open) resetTrendingDiscover();
    await persistUserProfileSilently();
}

async function persistUserProfileSilently() {
    if (!currentUser || userProfileUid !== currentUser.uid) return;
    const uid = currentUser.uid;
    userProfile = normalizeUserProfile(userProfile);
    try { localStorage.setItem(getUserProfileStorageKey(uid), JSON.stringify(userProfile)); } catch (error) { /* Keep the current profile in memory. */ }
    try { if (db) await db.collection('users').doc(uid).set(userProfile, { merge: true }); } catch (error) { /* Local storage remains available. */ }
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

function loadSharedLists() {
    if (unsubscribeSharedLists) {
        unsubscribeSharedLists();
        unsubscribeSharedLists = null;
    }
    if (!db || !currentUser) return;
    unsubscribeSharedLists = db.collection('lists')
        .where('members', 'array-contains', currentUser.uid)
        .onSnapshot(snapshot => {
            userSharedLists = [];
            const seenListIds = new Set();
            snapshot.docs.forEach(doc => {
                if (seenListIds.has(doc.id)) return;
                seenListIds.add(doc.id);
                userSharedLists.push({ id: doc.id, ...doc.data() });
            });
            if (activeListId !== 'personal' && !userSharedLists.some(list => list.id === activeListId)) {
                activeListId = 'personal';
                setupFirebaseListener();
            }
            updateActiveListControls();
            renderSharedLists();
        }, error => {
            console.error('Could not load shared lists.', error);
            const status = document.getElementById('sharedListsStatus');
            if (status) status.textContent = 'Shared lists could not be loaded. Check your Firestore access rules.';
        });
}

async function createSharedList() {
    const nameInput = document.getElementById('newSharedListName');
    const createButton = document.getElementById('createSharedListBtn');
    const status = document.getElementById('sharedListsStatus');
    const name = nameInput?.value.trim();
    if (isCreatingList || !currentUser || !db) return;
    if (!name) {
        if (status) status.textContent = 'Enter a name for your shared list.';
        return;
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let inviteCode = '';
    if (window.crypto?.getRandomValues) {
        const randomValues = new Uint32Array(6);
        window.crypto.getRandomValues(randomValues);
        inviteCode = [...randomValues].map(value => alphabet[value % alphabet.length]).join('');
    } else {
        inviteCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    }
    isCreatingList = true;
    if (createButton) createButton.disabled = true;
    try {
        const listRef = await db.collection('lists').add({
            name,
            ownerId: currentUser.uid,
            inviteCode,
            members: [currentUser.uid]
        });
        if (!userSharedLists.some(list => list.id === listRef.id)) {
            userSharedLists.push({ id: listRef.id, name, ownerId: currentUser.uid, inviteCode, members: [currentUser.uid] });
        }
        updateActiveListControls();
        renderSharedLists();
        nameInput.value = '';
        if (status) status.textContent = 'Shared list created.';
        switchActiveList(listRef.id);
    } catch (error) {
        console.error('Could not create shared list.', error);
        if (status) status.textContent = 'Could not create the list. Check your Firestore access rules.';
    } finally {
        isCreatingList = false;
        if (createButton) createButton.disabled = false;
    }
}

async function joinSharedList(code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    const status = document.getElementById('sharedListsStatus');
    if (!currentUser || !db) return;
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
        if (status) status.textContent = 'Enter a valid six-character invite code.';
        return;
    }
    try {
        const snapshot = await db.collection('lists').where('inviteCode', '==', cleanCode).limit(1).get();
        if (snapshot.empty) {
            if (status) status.textContent = 'No shared list was found for that code.';
            return;
        }
        const listDoc = snapshot.docs[0];
        await listDoc.ref.update({ members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        const joinedList = { id: listDoc.id, ...listDoc.data(), members: [...new Set([...(listDoc.data().members || []), currentUser.uid])] };
        userSharedLists = [...userSharedLists.filter(list => list.id !== listDoc.id), joinedList];
        updateActiveListControls();
        renderSharedLists();
        document.getElementById('joinInviteCodeInput').value = '';
        if (status) status.textContent = `Joined ${listDoc.data().name || 'shared list'}.`;
        trackEvent('shared_list_joined', { list_id: listDoc.id });
        switchActiveList(listDoc.id);
    } catch (error) {
        console.error('Could not join shared list.', error);
        if (status) status.textContent = 'Could not join the list. Check your Firestore access rules.';
    }
}

function leaveOrDeleteSharedList(listId) {
    const list = userSharedLists.find(item => item.id === listId);
    if (!db || !currentUser || !list) return;
    const isOwner = list.ownerId === currentUser.uid;
    pendingSharedListActionId = listId;
    document.getElementById('sharedListConfirmTitle').textContent = isOwner ? 'Delete shared list?' : 'Leave shared list?';
    document.getElementById('sharedListConfirmMessage').textContent = isOwner
        ? 'This removes the list and all its titles. This cannot be undone.'
        : 'You will no longer see this shared list. You can join again with its invite code.';
    document.getElementById('confirmSharedListActionBtn').textContent = isOwner ? 'Delete List' : 'Leave List';
    showModal('sharedListConfirmModal');
}

async function confirmLeaveOrDeleteSharedList() {
    const listId = pendingSharedListActionId;
    const list = userSharedLists.find(item => item.id === listId);
    if (!db || !currentUser || !list) return closeSharedListConfirmModal();
    const isOwner = list.ownerId === currentUser.uid;
    closeSharedListConfirmModal();
    try {
        if (isOwner) {
            const snapshot = await db.collection('watchlist').where('listId', '==', listId).get();
            for (let start = 0; start < snapshot.docs.length; start += 500) {
                const batch = db.batch();
                snapshot.docs.slice(start, start + 500).forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            await db.collection('lists').doc(listId).delete();
        } else {
            await db.collection('lists').doc(listId).update({
                members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
        }
        if (activeListId === listId) switchActiveList('personal');
    } catch (error) {
        console.error('Could not update shared list membership.', error);
        const status = document.getElementById('sharedListsStatus');
        if (status) status.textContent = 'Could not update this list. Check your Firestore access rules.';
    }
}

function closeSharedListConfirmModal() {
    pendingSharedListActionId = null;
    hideModal('sharedListConfirmModal');
}

function closeSharedListsModal() {
    hideModal('sharedListModal');
}

function switchActiveList(listId) {
    const isAvailable = listId === 'personal' || userSharedLists.some(list => list.id === listId);
    activeListId = isAvailable ? listId : 'personal';
    updateActiveListControls();
    selectedDocIds.clear();
    setupFirebaseListener();
}

function updateActiveListControls() {
    const picker = document.getElementById('activeListSelect');
    if (picker) {
        picker.replaceChildren();
        const personalOption = document.createElement('option');
        personalOption.value = 'personal';
        personalOption.textContent = '👤 My Private List';
        picker.appendChild(personalOption);
        userSharedLists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = `👨‍👩‍👧‍👦 ${list.name || 'Shared List'}`;
            picker.appendChild(option);
        });
        picker.value = activeListId;
    }
    const activeList = userSharedLists.find(list => list.id === activeListId);
    const badge = document.getElementById('addingTargetBadge');
    if (badge) badge.textContent = activeList ? `Adding to: 👨‍👩‍👧‍👦 ${activeList.name || 'Shared List'}` : 'Adding to: 👤 My Private List';
    const banner = document.getElementById('sharedListBanner');
    const bannerText = document.getElementById('sharedListBannerText');
    if (banner) banner.classList.toggle('hidden', !activeList);
    if (bannerText && activeList) bannerText.textContent = `Code: ${activeList.inviteCode || 'Unavailable'}`;
    document.getElementById('deleteAllBtn')?.classList.toggle('hidden', activeListId !== 'personal');
}

async function copyActiveSharedListValue(kind) {
    const list = userSharedLists.find(item => item.id === activeListId);
    if (!list) return;
    const value = kind === 'link'
        ? `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(list.inviteCode || '')}`
        : list.inviteCode || '';
    try {
        await navigator.clipboard.writeText(value);
        showToast(kind === 'link' ? 'Invite link copied.' : 'Invite code copied.');
    } catch (error) {
        showToast('Clipboard access is unavailable in this browser.', 'error');
    }
}

function renderSharedLists() {
    const container = document.getElementById('sharedListsContainer');
    if (!container) return;
    container.replaceChildren();
    if (!userSharedLists.length) {
        const empty = document.createElement('p');
        empty.className = 'rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-500 dark:text-slate-400';
        empty.textContent = 'You have not joined any shared lists yet.';
        container.appendChild(empty);
        return;
    }
    userSharedLists.forEach(list => {
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3';
        const details = document.createElement('div');
        details.className = 'min-w-0';
        const name = document.createElement('p');
        name.className = 'truncate text-sm font-semibold';
        name.textContent = list.name || 'Shared List';
        const code = document.createElement('p');
        code.className = 'text-[10px] text-slate-500 dark:text-slate-400';
        code.textContent = `Invite code: ${list.inviteCode || 'Unavailable'}`;
        details.append(name, code);
        const actions = document.createElement('div');
        actions.className = 'flex gap-2';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-[10px] font-semibold hover:border-sky-400';
        copy.textContent = 'Copy Link';
        copy.addEventListener('click', async () => {
            const link = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(list.inviteCode || '')}`;
            try {
                await navigator.clipboard.writeText(link);
                showToast('Invite link copied.');
            } catch (error) {
                showToast('Clipboard access is unavailable in this browser.', 'error');
            }
        });
        const leave = document.createElement('button');
        leave.type = 'button';
        leave.className = 'rounded border border-rose-300 dark:border-rose-800 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400';
        leave.textContent = list.ownerId === currentUser?.uid ? 'Delete' : 'Leave';
        leave.addEventListener('click', () => leaveOrDeleteSharedList(list.id));
        actions.append(copy, leave);
        row.append(details, actions);
        container.appendChild(row);
    });
}

function setupFirebaseListener() {
    if (currentUser) userProfileLoadPromise = loadUserProfile();
    if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
    }
    if (db && currentUser) {
        const listeningListId = activeListId;
        const listeningUserId = currentUser.uid;
        const query = listeningListId === 'personal'
            ? db.collection('watchlist').where('userId', '==', currentUser.uid)
            : db.collection('watchlist').where('listId', '==', listeningListId);
        unsubscribeWatchlist = query.onSnapshot(snapshot => {
                if (activeListId !== listeningListId || currentUser?.uid !== listeningUserId) return;
                currentWatchlistItems = [];
                snapshot.forEach(doc => {
                    const item = doc.data();
                    if (listeningListId !== 'personal' || !item.listId) {
                        currentWatchlistItems.push({ docId: doc.id, ...item });
                    }
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

async function saveCandidateToWatchlist(candidate, button = null) {
    const user = currentUser;
    if (!user || !db) {
        throw new Error('Please sign in before adding titles.');
    }
    if (isAlreadyInWatchlist(candidate)) return false;
    if (button) {
        button.disabled = true;
        button.textContent = 'Adding...';
    }

    try {
        const providers = await fetchIndiaProviders(candidate.mediaType, candidate.id);
        if (currentUser?.uid !== user.uid) throw new Error('Your sign-in changed. Please search again.');
        await db.collection('watchlist').add({
            tmdbId: candidate.id,
            type: candidate.mediaType,
            typeLabel: candidate.mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie',
            title: candidate.title,
            year: candidate.year,
            genre: candidate.genre,
            rating: candidate.rating,
            language: candidate.language,
            poster: candidate.poster,
            overview: candidate.overview || '',
            platform: providers.platform,
            platforms: providers.platforms,
            freePlatforms: providers.freePlatforms,
            watched: false,
            addedBy: user.displayName || user.email,
            userId: user.uid,
            ...(activeListId !== 'personal' ? { listId: activeListId } : {})
        });
        trackEvent('title_added', { media_type: candidate.mediaType });
        if (button) button.textContent = '✓ Added';
        return true;
    } catch (error) {
        if (button) {
            button.disabled = false;
            button.textContent = '+ Add to Watchlist';
        }
        throw error;
    }
}

async function refreshMetadata(docId) {
    const item = currentWatchlistItems.find(i => i.docId === docId);
    if (!db || !item) return;

    const metadata = await fetchTMDBDetails(item.title);
    if (!metadata.valid) {
        showToast(metadata.error, 'error');
        return;
    }

    const { valid, ...updates } = metadata;
    await db.collection('watchlist').doc(docId).update(updates);
    showToast('Title details refreshed.');
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
    if (activeListId !== 'personal' || !db || currentWatchlistItems.length === 0) return;
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

async function dismissRecommendation(tmdbId, title = 'Recommendation', mediaType = '', year = 'N/A') {
    if (!currentUser || userProfileUid !== currentUser.uid || tmdbId == null) return;
    const id = String(tmdbId);
    userProfile.dismissedIds = [...new Set([...(userProfile.dismissedIds || []), id])];
    const cleanTitle = String(title || '').trim();
    if (cleanTitle) userProfile.dismissedTitles = [...new Set([...(userProfile.dismissedTitles || []), cleanTitle])];
    if (mediaType === 'movie' || mediaType === 'tv') {
        const dismissedItems = Array.isArray(userProfile.dismissedItems) ? userProfile.dismissedItems : [];
        userProfile.dismissedItems = [
            ...dismissedItems.filter(item => !(String(item.id) === id && item.mediaType === mediaType)),
            { id, mediaType, title: cleanTitle, year: String(year || 'N/A').split('-')[0] }
        ];
    }
    trendingCache.clear();
    document.querySelector(`#trendingShelf article[data-tmdb-id="${CSS.escape(id)}"]`)?.remove();
    displayedTrendingIds.delete(id);
    const count = document.getElementById('hiddenRecommendationsCount');
    if (count) count.textContent = String(userProfile.dismissedIds.length);
    await persistUserProfileSilently();
    showToast(`Hidden ${title}.`, 'success', { label: 'Undo', onClick: () => undoDismissRecommendation(id, cleanTitle, mediaType) });
}

async function undoDismissRecommendation(tmdbId, title = '', mediaType = '') {
    const id = String(tmdbId);
    const dismissedItems = Array.isArray(userProfile.dismissedItems) ? userProfile.dismissedItems : [];
    userProfile.dismissedItems = dismissedItems.filter(item =>
        !(String(item.id) === id && (!mediaType || item.mediaType === mediaType))
    );
    if (!userProfile.dismissedItems.some(item => String(item.id) === id)) {
        userProfile.dismissedIds = (userProfile.dismissedIds || []).filter(value => String(value) !== id);
    }
    if (title && !userProfile.dismissedItems.some(item => item.title === title)) {
        userProfile.dismissedTitles = (userProfile.dismissedTitles || []).filter(value => value !== title);
    }
    trendingCache.clear();
    await persistUserProfileSilently();
    resetTrendingDiscover();
}

async function resetDismissedRecommendations() {
    userProfile.dismissedIds = [];
    userProfile.dismissedTitles = [];
    userProfile.dismissedItems = [];
    const count = document.getElementById('hiddenRecommendationsCount');
    if (count) count.textContent = '0';
    trendingCache.clear();
    await persistUserProfileSilently();
    resetTrendingDiscover();
}

async function resetTasteOnboarding() {
    if (!currentUser) return;
    userProfile.tasteSeedMovies = [];
    userProfile.hasCompletedTasteOnboarding = false;
    tasteSelectedSeeds.clear();
    try { localStorage.removeItem(`watchlist_taste_done_${currentUser.uid}`); } catch (error) { /* The profile still records the reset. */ }
    await persistUserProfileSilently();
    closeProfileModal();
    openTasteOnboardingModal();
}
