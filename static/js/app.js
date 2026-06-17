// Global state
let releasesData = [];
let selectedUpdateId = null;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const listContainer = document.getElementById('releases-list');
const emptyState = document.getElementById('empty-tweet-state');
const composerPanel = document.getElementById('composer-panel');
const composerDate = document.getElementById('composer-date');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const progressCircle = document.getElementById('progress-circle');
const charCountContainer = document.getElementById('char-count-container');
const tweetBtn = document.getElementById('tweet-btn');

// Progress ring constants (radius: 9)
const CIRCUMFERENCE = 2 * Math.PI * 9;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set up progress circle initial stroke
  progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
  progressCircle.style.strokeDashoffset = CIRCUMFERENCE;

  // Load releases
  loadReleases(false);

  // Event Listeners
  refreshBtn.addEventListener('click', () => loadReleases(true));
  searchInput.addEventListener('input', handleSearchAndFilter);
  categoryFilter.addEventListener('change', handleSearchAndFilter);
  tweetTextarea.addEventListener('input', updateCharCount);
  tweetBtn.addEventListener('click', handleTweetSubmit);
});

// Load releases from Python API
async function loadReleases(forceRefresh = false) {
  try {
    setMainLoadingState(true);
    if (forceRefresh) {
      refreshBtn.classList.add('loading');
      refreshBtn.disabled = true;
    }

    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch release notes.');
    
    const data = await response.json();
    releasesData = data.entries || [];
    
    renderReleases(releasesData);
    resetComposer();
  } catch (error) {
    renderErrorState(error.message);
  } finally {
    setMainLoadingState(false);
    refreshBtn.classList.remove('loading');
    refreshBtn.disabled = false;
  }
}

// Set loading UI on list
function setMainLoadingState(isLoading) {
  if (isLoading && listContainer.innerHTML === '') {
    listContainer.innerHTML = `
      <div class="state-container" id="list-loading-state">
        <div class="spinner"></div>
        <p style="color: var(--text-secondary)">Fetching BigQuery release notes...</p>
      </div>
    `;
  } else if (!isLoading) {
    const loadingState = document.getElementById('list-loading-state');
    if (loadingState) loadingState.remove();
  }
}

// Render error state on list
function renderErrorState(message) {
  listContainer.innerHTML = `
    <div class="state-container">
      <svg style="color: var(--badge-deprecation-text); width: 48px; height: 48px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <h3 style="font-family: var(--font-heading); font-size: 1.1rem;">Error Loading Feed</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 300px;">${message}</p>
      <button class="btn btn-secondary" onclick="loadReleases(true)" style="margin-top: 0.5rem;">Try Again</button>
    </div>
  `;
}

// Render releases grouped by date
function renderReleases(entries) {
  if (entries.length === 0) {
    listContainer.innerHTML = `
      <div class="state-container">
        <svg style="color: var(--text-muted); width: 48px; height: 48px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 style="font-family: var(--font-heading); font-size: 1.1rem;">No Updates Found</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Try searching for something else or refresh the feed.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = '';

  entries.forEach((day, dayIdx) => {
    const dayGroup = document.createElement('div');
    dayGroup.className = 'release-day-group';
    
    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';
    dayHeader.textContent = day.date;
    dayGroup.appendChild(dayHeader);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'update-cards';

    day.updates.forEach((update, updateIdx) => {
      const cardId = `update-${dayIdx}-${updateIdx}`;
      const card = document.createElement('div');
      card.className = 'update-card';
      if (selectedUpdateId === cardId) {
        card.className += ' selected';
      }
      card.id = cardId;

      const badgeClass = getBadgeClass(update.type);
      
      card.innerHTML = `
        <div class="card-header">
          <span class="update-badge ${badgeClass}">${update.type}</span>
          <span class="select-indicator">
            <svg style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 10.742l2.253 2.253 6.378-6.378M5.8 20.8h12.4a2 2 0 002-2V5.2a2 2 0 00-2-2H5.8a2 2 0 00-2 2v13.6a2 2 0 002 2z"/>
            </svg>
            Select to Tweet
          </span>
        </div>
        <div class="card-body">
          ${update.html}
        </div>
      `;

      card.addEventListener('click', () => {
        handleCardSelection(cardId, update, day.date, day.link);
      });

      cardsContainer.appendChild(card);
    });

    dayGroup.appendChild(cardsContainer);
    listContainer.appendChild(dayGroup);
  });
}

// Helper to match badging classes
function getBadgeClass(type) {
  const t = type.toLowerCase();
  if (t.includes('feature')) return 'feature';
  if (t.includes('deprecation') || t.includes('security')) return 'deprecation';
  if (t.includes('change')) return 'change';
  if (t.includes('announcement')) return 'announcement';
  return 'general';
}

// Handle update selection
function handleCardSelection(cardId, update, dateStr, link) {
  // Clear previous selected card styling
  if (selectedUpdateId) {
    const prevSelected = document.getElementById(selectedUpdateId);
    if (prevSelected) prevSelected.classList.remove('selected');
  }

  selectedUpdateId = cardId;
  const currentCard = document.getElementById(cardId);
  if (currentCard) currentCard.classList.add('selected');

  // Setup composer panel
  emptyState.style.display = 'none';
  composerPanel.classList.add('active');
  composerDate.textContent = `Update from ${dateStr}`;

  // Generate Tweet content
  const tweetText = generateTweetText(update, dateStr, link);
  tweetTextarea.value = tweetText;
  
  updateCharCount();
}

// Strip HTML tags for clean tweet text representation
function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// Generate premium pre-filled tweet text
function generateTweetText(update, dateStr, link) {
  const typeStr = update.type.toUpperCase();
  // Strip html, collapse spaces
  const cleanText = stripHtml(update.html).trim().replace(/\s+/g, ' ');
  
  const prefix = `BigQuery ${typeStr} (${dateStr}): `;
  const suffix = `\n\nRead details: ${link} #GoogleCloud #BigQuery`;
  
  // Calculate remaining characters for description
  const maxTextLen = 280 - prefix.length - suffix.length;
  let text = cleanText;
  
  if (text.length > maxTextLen) {
    text = text.substring(0, maxTextLen - 3).trim() + '...';
  }
  
  return `${prefix}${text}${suffix}`;
}

// Update character counter UI elements
function updateCharCount() {
  const length = tweetTextarea.value.length;
  const remaining = 280 - length;
  
  charCounter.textContent = remaining;

  // Progress ring logic
  const percent = Math.min(length / 280, 1);
  const offset = CIRCUMFERENCE - (percent * CIRCUMFERENCE);
  progressCircle.style.strokeDashoffset = offset;

  // Alert colors & disabled state
  charCountContainer.className = 'char-counter-container';
  
  if (remaining < 0) {
    charCountContainer.classList.add('char-error');
    tweetBtn.disabled = true;
  } else if (remaining <= 20) {
    charCountContainer.classList.add('char-warning');
    tweetBtn.disabled = false;
  } else {
    tweetBtn.disabled = false;
  }
}

// Reset Composer Panel
function resetComposer() {
  selectedUpdateId = null;
  composerPanel.classList.remove('active');
  emptyState.style.display = 'flex';
  tweetTextarea.value = '';
}

// Handle Search and Filter criteria
function handleSearchAndFilter() {
  const searchVal = searchInput.value.toLowerCase().trim();
  const filterVal = categoryFilter.value.toLowerCase();

  const filtered = [];

  releasesData.forEach(day => {
    // Filter updates in this day
    const matchingUpdates = day.updates.filter(update => {
      const matchSearch = update.html.toLowerCase().includes(searchVal) || 
                          update.type.toLowerCase().includes(searchVal) || 
                          day.date.toLowerCase().includes(searchVal);
                          
      const matchCategory = filterVal === 'all' || getBadgeClass(update.type) === filterVal;
      
      return matchSearch && matchCategory;
    });

    if (matchingUpdates.length > 0) {
      // Recreate day object with filtered updates
      filtered.push({
        ...day,
        updates: matchingUpdates
      });
    }
  });

  renderReleases(filtered);
}

// Submit tweet (open Twitter Intent link)
function handleTweetSubmit() {
  const tweetContent = tweetTextarea.value;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetContent)}`;
  window.open(url, '_blank');
}
