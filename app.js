let activeGrouping = 'none';

document.addEventListener('DOMContentLoaded', renderWatchlist);

function getWatchlist() {
    const stored = localStorage.getItem('myWatchlist');
    return stored ? JSON.parse(stored) : [];
}

function saveWatchlist(watchlist) {
    localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
}

function setGrouping(mode) {
    activeGrouping = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${mode}`).classList.add('active');
    renderWatchlist();
}

function getPlatformBadgeClass(platform) {
    switch(platform) {
        case 'Netflix': return 'badge-netflix';
        case 'Prime Video': return 'badge-prime';
        case 'Disney+': return 'badge-disney';
        case 'Hotstar': return 'badge-hotstar';
        default: return '';
    }
}

// OMDb API Fetcher with Validation, Poster, and Primary Genre Extraction
async function fetchMovieDetails(title) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(title)}`);
        const data = await response.json();
        
        if (data.Response === "True") {
            // Extract primary genre (first item before comma)
            const primaryGenre = data.Genre ? data.Genre.split(',')[0].trim() : 'Other';
            const posterUrl = (data.Poster && data.Poster !== "N/A") ? data.Poster : null;

            return {
                valid: true,
                title: data.Title, // Use official API title formatting
                year: data.Year || 'N/A',
                genre: primaryGenre,
                fullGenre: data.Genre || 'N/A',
                poster: posterUrl
            };
        } else {
            return { valid: false, error: data.Error || 'Movie not found' };
        }
    } catch (error) {
        return { valid: false, error: 'Network error connecting to API' };
    }
}

function renderWatchlist() {
    const container = document.getElementById('watchlistDisplay');
    const sortBy = document.getElementById('sortBy').value;
    const searchQuery = document.getElementById('searchQuery').value.toLowerCase().trim();
    
    container.innerHTML = '';
    document.getElementById('selectAll').checked = false;

    let items = getWatchlist();

    if (searchQuery !== '') {
        items = items.filter(item => item.title.toLowerCase().includes(searchQuery));
    }

    if (sortBy === 'title-asc') {
        items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'title-desc') {
        items.sort((a, b) => b.title.localeCompare(a.title));
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state">No titles found in your watchlist.</div>`;
        return;
    }

    if (activeGrouping === 'none') {
        renderGroup(container, 'All Movies & Shows', items, 'all');
    } else if (activeGrouping === 'genre') {
        // Collect all unique API genres dynamically
        const genres = [...new Set(items.map(i => i.genre))];
        genres.sort().forEach(genre => {
            const groupItems = items.filter(i => i.genre === genre);
            if (groupItems.length > 0) {
                renderGroup(container, `${genre} Titles`, groupItems, genre);
            }
        });
    } else if (activeGrouping === 'platform') {
        const platforms = ['Netflix', 'Prime Video', 'Disney+', 'Hotstar'];
        platforms.forEach(platform => {
            const groupItems = items.filter(i => i.platform === platform);
            if (groupItems.length > 0) {
                renderGroup(container, platform, groupItems, platform);
            }
        });
    } else if (activeGrouping === 'status') {
        const toWatch = items.filter(i => !i.watched);
        const watched = items.filter(i => i.watched);
        
        if (toWatch.length > 0) renderGroup(container, '⏳ To Watch', toWatch, 'towatch');
        if (watched.length > 0) renderGroup(container, '✅ Watched History', watched, 'watched');
    }
}

function renderGroup(parentContainer, groupTitle, items, groupKey) {
    const section = document.createElement('div');
    section.className = 'group-section';
    section.id = `group-${groupKey}`;

    const titleHeader = document.createElement('div');
    titleHeader.className = 'group-header';
    titleHeader.onclick = () => section.classList.toggle('collapsed');
    
    titleHeader.innerHTML = `
        <div class="group-title-left">
            <span class="chevron">▼</span>
            <span>${groupTitle}</span>
            <span class="group-count">${items.length}</span>
        </div>
    `;
    section.appendChild(titleHeader);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `movie-card ${item.watched ? 'watched' : ''}`;
        const badgeClass = getPlatformBadgeClass(item.platform);

        const posterHtml = item.poster 
            ? `<img src="${item.poster}" class="poster-img" alt="${item.title}">` 
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:20px;">🎬</div>`;

        card.innerHTML = `
            <div class="poster-box">
                ${posterHtml}
            </div>
            <div class="card-body">
                <div>
                    <div class="card-header">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="checkbox" class="item-checkbox" data-id="${item.id}">
                            <div class="card-title">${item.title}</div>
                        </div>
                        <span class="badge ${badgeClass}">${item.platform}</span>
                    </div>
                    <div class="card-meta">Genre: <strong>${item.genre}</strong></div>
                    <div class="api-details">🗓️ ${item.year || 'N/A'}</div>
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
    const platformSelect = document.getElementById('platform');

    const rawTitle = titleInput.value.trim();
    if (rawTitle === '') {
        alert('Please enter a title!');
        return;
    }

    // 1. Validate title via API
    const apiResult = await fetchMovieDetails(rawTitle);
    
    if (!apiResult.valid) {
        alert(`❌ Error: Could not find movie "${rawTitle}". Please check the spelling.`);
        return;
    }

    // 2. Build item using official API details
    const newItem = {
        id: Date.now(),
        title: apiResult.title,
        platform: platformSelect.value,
        genre: apiResult.genre,
        fullGenre: apiResult.fullGenre,
        year: apiResult.year,
        poster: apiResult.poster,
        watched: false
    };

    const items = getWatchlist();
    items.push(newItem);
    saveWatchlist(items);

    renderWatchlist();
    titleInput.value = '';
}

async function bulkUpload() {
    const bulkText = document.getElementById('bulkTitles').value;
    const platformSelect = document.getElementById('bulkPlatform');

    if (bulkText.trim() === '') {
        alert('Please paste at least one title!');
        return;
    }

    const lines = bulkText.split('\n');
    let items = getWatchlist();
    let addedCount = 0;
    let failedTitles = [];

    for (let index = 0; index < lines.length; index++) {
        const title = lines[index].trim();
        if (title !== '') {
            const apiResult = await fetchMovieDetails(title);
            if (apiResult.valid) {
                items.push({
                    id: Date.now() + index,
                    title: apiResult.title,
                    platform: platformSelect.value,
                    genre: apiResult.genre,
                    fullGenre: apiResult.fullGenre,
                    year: apiResult.year,
                    poster: apiResult.poster,
                    watched: false
                });
                addedCount++;
            } else {
                failedTitles.push(title);
            }
        }
    }

    if (addedCount > 0) {
        saveWatchlist(items);
        renderWatchlist();
        document.getElementById('bulkTitles').value = '';
    }

    // Provide detailed feedback on added vs failed titles
    let msg = `Added ${addedCount} titles successfully!`;
    if (failedTitles.length > 0) {
        msg += `\n\n⚠️ Could not find ${failedTitles.length} title(s):\n- ` + failedTitles.join('\n- ');
    }
    alert(msg);
}

function toggleWatched(id) {
    let items = getWatchlist();
    items = items.map(item => item.id === id ? { ...item, watched: !item.watched } : item);
    saveWatchlist(items);
    renderWatchlist();
}

function deleteItem(id) {
    let items = getWatchlist();
    items = items.filter(item => item.id !== id);
    saveWatchlist(items);
    renderWatchlist();
}

function toggleSelectAll(masterCheckbox) {
    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = masterCheckbox.checked);
}

function deleteSelectedItems() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select at least one item to delete.');
        return;
    }

    if (confirm(`Delete ${checkboxes.length} selected item(s)?`)) {
        const selectedIds = Array.from(checkboxes).map(cb => Number(cb.dataset.id));
        let items = getWatchlist().filter(item => !selectedIds.includes(item.id));
        saveWatchlist(items);
        renderWatchlist();
    }
}

function clearAllItems() {
    if (confirm('Delete your entire watchlist?')) {
        localStorage.removeItem('myWatchlist');
        renderWatchlist();
    }
}