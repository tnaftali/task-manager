// ===========================================
// UNIFIED SEARCH & FILTER (shared between views)
// ===========================================

// Handle search input from either view
function handleSearchInput(view) {
  const inputId = view === 'board' ? 'board-search-input' : 'list-search-input';
  const input = document.getElementById(inputId);
  searchQuery = input.value.toLowerCase().trim();
  syncSearchUI();
  renderCurrentView();
}

// Clear search from either view
function clearSearch() {
  searchQuery = '';
  syncSearchUI();
  renderCurrentView();
}

// Sync search inputs and clear buttons between views
function syncSearchUI() {
  const listInput = document.getElementById('list-search-input');
  const boardInput = document.getElementById('board-search-input');
  const listClear = document.getElementById('list-search-clear');
  const boardClear = document.getElementById('board-search-clear');

  if (listInput) listInput.value = searchQuery ? listInput.value || searchQuery : '';
  if (boardInput) boardInput.value = searchQuery ? boardInput.value || searchQuery : '';

  // Sync the actual value
  if (listInput && listInput !== document.activeElement) listInput.value = searchQuery;
  if (boardInput && boardInput !== document.activeElement) boardInput.value = searchQuery;

  const showClear = searchQuery ? 'flex' : 'none';
  if (listClear) listClear.style.display = showClear;
  if (boardClear) boardClear.style.display = showClear;
}

// Toggle tag filter
function toggleTagFilter(tag) {
  if (activeTagFilters.has(tag)) {
    activeTagFilters.delete(tag);
  } else {
    activeTagFilters.add(tag);
  }
  renderTagFilters();
  renderCurrentView();
}

// Clear all tag filters
function clearAllTagFilters() {
  activeTagFilters.clear();
  renderTagFilters();
  renderCurrentView();
}

// Toggle filter dropdown
function toggleFilterDropdown(view) {
  const id = view === 'board' ? 'board-filter-multiselect' : 'list-filter-multiselect';
  const multiselect = document.getElementById(id);
  if (multiselect) multiselect.classList.toggle('open');
}

// Render tag filters for both views
function renderTagFilters() {
  renderTagFilterUI('list');
  renderTagFilterUI('board');
}

function renderTagFilterUI(view) {
  const prefix = view === 'board' ? 'board-' : 'list-';
  const multiselect = document.getElementById(`${prefix}filter-multiselect`);
  const placeholder = document.getElementById(`${prefix}filter-placeholder`);
  const selectedContainer = document.getElementById(`${prefix}filter-selected`);
  const optionsContainer = document.getElementById(`${prefix}filter-options`);
  const clearBtn = document.getElementById(`${prefix}filter-clear`);

  if (!multiselect) return;

  // Hide if no tags
  multiselect.style.display = allListTags.size === 0 ? 'none' : 'block';

  // Render selected tags in trigger
  selectedContainer.innerHTML = '';
  activeTagFilters.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'list-filter-tag';
    tagEl.style.background = getTagColor(tag);
    tagEl.innerHTML = `${escapeHtml(tag)}<button onclick="event.stopPropagation(); toggleTagFilter('${escapeHtml(tag)}')">&times;</button>`;
    selectedContainer.appendChild(tagEl);
  });

  // Show/hide placeholder and clear button
  placeholder.style.display = activeTagFilters.size > 0 ? 'none' : 'block';
  clearBtn.style.display = activeTagFilters.size > 0 ? 'block' : 'none';

  // Render options (alphabetically sorted)
  const sortedTags = [...allListTags].sort();
  optionsContainer.innerHTML = '';
  sortedTags.forEach(tag => {
    const isSelected = activeTagFilters.has(tag);
    const optionEl = document.createElement('div');
    optionEl.className = `list-filter-option ${isSelected ? 'selected' : ''}`;
    optionEl.onclick = (e) => {
      e.stopPropagation();
      toggleTagFilter(tag);
    };
    optionEl.innerHTML = `
      <span class="list-filter-option-color" style="background: ${getTagColor(tag)}"></span>
      <span>${escapeHtml(tag)}</span>
      <svg class="list-filter-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;
    optionsContainer.appendChild(optionEl);
  });
}

// Render current view based on currentView state
function renderCurrentView() {
  if (currentView === VIEWS.BOARD) {
    renderBoardView();
  } else {
    renderListView();
  }
}

// Filter items by search query
function filterBySearch(items) {
  if (!searchQuery) return items;
  return items.filter(item => {
    const titleMatch = item.title && item.title.toLowerCase().includes(searchQuery);
    const notesMatch = item.notes && item.notes.toLowerCase().includes(searchQuery);
    return titleMatch || notesMatch;
  });
}

// Filter items by active tags - OR logic
function filterByTags(items) {
  if (activeTagFilters.size === 0) return items;
  return items.filter(item => {
    if (!item.tags || item.tags.length === 0) return false;
    return item.tags.some(tag => activeTagFilters.has(tag.toLowerCase()));
  });
}

// Get tag color (single muted color for all tags)
function getTagColor(tagName) {
  return 'var(--tag-color)';
}

// Legacy function names for compatibility
function filterListTasks() { handleSearchInput('list'); }
function filterBoardTasks() { handleSearchInput('board'); }
function clearListSearch() { clearSearch(); }
function clearBoardSearch() { clearSearch(); }
function clearAllBoardTagFilters() { clearAllTagFilters(); }
function toggleBoardFilterDropdown() { toggleFilterDropdown('board'); }
function toggleBoardTagFilter(tag) { toggleTagFilter(tag); }
function renderBoardTagFilters() { renderTagFilters(); }
