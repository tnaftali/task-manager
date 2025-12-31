// ===========================================
// CONTAINER FUNCTIONS
// ===========================================

// Container drag state
let draggedContainerIndex = null;
let draggedContainerListId = null;

// Load containers from localStorage
function loadContainers() {
  const saved = localStorage.getItem(STORAGE_KEYS.CONTAINERS);
  if (saved) {
    containers = JSON.parse(saved);
  }
  // Ensure we have at least one default container
  if (containers.length === 0) {
    containers = [{ id: 'default', name: 'My Tasks' }];
    saveContainers();
  }
  // Load current container
  const savedCurrentId = localStorage.getItem(STORAGE_KEYS.CURRENT_CONTAINER);
  if (savedCurrentId && containers.find(c => c.id === savedCurrentId)) {
    currentContainerId = savedCurrentId;
  } else {
    currentContainerId = containers[0].id;
  }
  // Rebuild allListTags for current container (lowercase)
  allListTags.clear();
  getContainerItems().forEach(item => {
    if (item.tags) {
      item.tags.forEach(tag => allListTags.add(tag.toLowerCase()));
    }
  });
  updateContainerUI();
}

// Generate unique ID for containers
function generateContainerId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get current container
function getCurrentContainer() {
  return containers.find(c => c.id === currentContainerId) || containers[0];
}

// Get items for current container
function getContainerItems() {
  return tasks.filter(item => item.containerId === currentContainerId ||
    (!item.containerId && currentContainerId === 'default'));
}

// Update container UI
function updateContainerUI() {
  const container = getCurrentContainer();

  // Update Simple List header
  const nameEl = document.getElementById('current-container-name');
  if (nameEl && container) {
    nameEl.textContent = container.name;
  }

  // Update Kanban header
  const boardNameEl = document.getElementById('board-container-name');
  if (boardNameEl && container) {
    boardNameEl.textContent = container.name;
  }

  // Update board count
  updateBoardCount();

  renderContainerList();
  renderBoardContainerList();
}

// Update board task count
function updateBoardCount() {
  const countEl = document.getElementById('board-count');
  if (!countEl) return;

  const containerItems = getContainerItems();
  const doneCount = containerItems.filter(item => item.status === 'done').length;
  const totalCount = containerItems.length;
  countEl.textContent = `${doneCount}/${totalCount} done`;
}

// Toggle container dropdown
function toggleContainerDropdown() {
  const selector = document.getElementById('container-selector');
  selector.classList.toggle('open');
  if (selector.classList.contains('open')) {
    renderContainerList();
    // Hide the new input when opening
    document.getElementById('container-new-input').style.display = 'none';
    document.querySelector('.container-new-btn').style.display = 'flex';
  }
}

// Close container dropdown
function closeContainerDropdown() {
  const selector = document.getElementById('container-selector');
  selector.classList.remove('open');
}

// Toggle board container dropdown
function toggleBoardContainerDropdown() {
  const selector = document.getElementById('board-container-selector');
  selector.classList.toggle('open');
  if (selector.classList.contains('open')) {
    renderBoardContainerList();
  }
}

// Close board container dropdown
function closeBoardContainerDropdown() {
  const selector = document.getElementById('board-container-selector');
  if (selector) selector.classList.remove('open');
}

// Shared function to render container list items
function renderContainerListItems(listId, view) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;

  listEl.innerHTML = containers.map((container, index) => {
    const count = tasks.filter(item =>
      item.containerId === container.id ||
      (!item.containerId && container.id === 'default')
    ).length;
    const isActive = container.id === currentContainerId;
    const isDefault = container.id === 'default';

    return `
      <div class="container-item ${isActive ? 'active' : ''}" data-container-id="${container.id}" data-index="${index}" draggable="true">
        <span class="container-drag-handle" title="Drag to reorder">
          <span class="drag-handle-dot"></span><span class="drag-handle-dot"></span>
          <span class="drag-handle-dot"></span><span class="drag-handle-dot"></span>
          <span class="drag-handle-dot"></span><span class="drag-handle-dot"></span>
        </span>
        <span class="container-item-name" onclick="switchContainer('${container.id}')">${escapeHtml(container.name)}</span>
        <span class="container-item-count">${count}</span>
        <div class="container-item-actions">
          <button class="container-item-btn" onclick="event.stopPropagation(); editContainerName('${container.id}', '${view}')" title="Rename">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          ${!isDefault ? `
            <button class="container-item-btn delete" onclick="event.stopPropagation(); deleteContainer('${container.id}')" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  setupContainerDragAndDrop(listId);
}

// Setup drag and drop for container items
function setupContainerDragAndDrop(listId) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;

  const items = listEl.querySelectorAll('.container-item');

  items.forEach(item => {
    item.addEventListener('dragstart', handleContainerDragStart);
    item.addEventListener('dragend', handleContainerDragEnd);
    item.addEventListener('dragover', handleContainerDragOver);
    item.addEventListener('drop', handleContainerDrop);
    item.addEventListener('dragleave', handleContainerDragLeave);
  });
}

function handleContainerDragStart(e) {
  draggedContainerIndex = parseInt(this.dataset.index);
  draggedContainerListId = this.closest('.container-list').id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleContainerDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.container-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedContainerIndex = null;
  draggedContainerListId = null;
}

function handleContainerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const targetIndex = parseInt(this.dataset.index);
  if (targetIndex !== draggedContainerIndex) {
    this.classList.add('drag-over');
  }
}

function handleContainerDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleContainerDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  const targetIndex = parseInt(this.dataset.index);
  if (draggedContainerIndex === null || targetIndex === draggedContainerIndex) return;

  // Reorder containers array
  const [movedContainer] = containers.splice(draggedContainerIndex, 1);
  containers.splice(targetIndex, 0, movedContainer);

  saveContainers();
  renderContainerList();
  renderBoardContainerList();
  updateContainerUI();
}

// Render board container list in dropdown
function renderBoardContainerList() {
  renderContainerListItems('board-container-list', 'board');
}

// Render container list in dropdown
function renderContainerList() {
  renderContainerListItems('container-list', 'list');
}

// Switch to a different container
function switchContainer(containerId) {
  currentContainerId = containerId;
  saveContainers();
  updateContainerUI();
  closeContainerDropdown();
  closeBoardContainerDropdown();
  // Reset filters and search when switching containers
  activeTagFilters.clear();
  searchQuery = '';
  syncSearchUI();
  // Rebuild allListTags for the new container (lowercase)
  allListTags.clear();
  getContainerItems().forEach(item => {
    if (item.tags) {
      item.tags.forEach(tag => allListTags.add(tag.toLowerCase()));
    }
  });
  renderListView();
  renderBoardView();
}

// Show new container input
function showNewContainerInput(view = 'list') {
  const prefix = view === 'board' ? 'board-' : '';
  const dropdown = view === 'board' ? document.getElementById('board-container-dropdown') : document.querySelector('.container-dropdown:not(.board-dropdown)');
  const btn = dropdown.querySelector('.container-new-btn');
  const inputDiv = document.getElementById(`${prefix}container-new-input`);
  const input = document.getElementById(`${prefix}new-container-name`);

  btn.style.display = 'none';
  inputDiv.style.display = 'flex';
  input.value = '';
  input.focus();
}

// Handle keydown in new container input
function handleNewContainerKeydown(event, view = 'list') {
  if (event.key === 'Enter') {
    createNewContainer(view);
  } else if (event.key === 'Escape') {
    const prefix = view === 'board' ? 'board-' : '';
    const dropdown = view === 'board' ? document.getElementById('board-container-dropdown') : document.querySelector('.container-dropdown:not(.board-dropdown)');
    document.getElementById(`${prefix}container-new-input`).style.display = 'none';
    dropdown.querySelector('.container-new-btn').style.display = 'flex';
  }
}

// Create new container
function createNewContainer(view = 'list') {
  const prefix = view === 'board' ? 'board-' : '';
  const input = document.getElementById(`${prefix}new-container-name`);
  const name = input.value.trim();
  if (!name) return;

  const newContainer = {
    id: generateContainerId(),
    name: name
  };
  containers.push(newContainer);
  saveContainers();

  // Switch to the new container
  switchContainer(newContainer.id);
}

// Edit container name
function editContainerName(containerId, view = 'list') {
  const container = containers.find(c => c.id === containerId);
  if (!container) return;

  const listId = view === 'board' ? 'board-container-list' : 'container-list';
  const listEl = document.getElementById(listId);
  const itemEl = listEl.querySelector(`.container-item[data-container-id="${containerId}"]`);
  if (!itemEl) return;

  const nameEl = itemEl.querySelector('.container-item-name');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'container-item-edit';
  input.value = container.name;

  const saveName = () => {
    const newName = input.value.trim();
    if (newName && newName !== container.name) {
      container.name = newName;
      saveContainers();
      updateContainerUI();
    }
    renderContainerList();
    renderBoardContainerList();
  };

  input.onblur = saveName;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    } else if (e.key === 'Escape') {
      renderContainerList();
      renderBoardContainerList();
    }
  };

  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

// Delete container
function deleteContainer(containerId) {
  const container = containers.find(c => c.id === containerId);
  if (!container || containerId === 'default') return;

  const itemCount = tasks.filter(item => item.containerId === containerId).length;
  const message = itemCount > 0
    ? `Delete "${container.name}" and its ${itemCount} task${itemCount > 1 ? 's' : ''}?`
    : `Delete "${container.name}"?`;

  if (confirm(message)) {
    // Remove all items in this container
    tasks = tasks.filter(item => item.containerId !== containerId);
    saveTasks();

    // Remove container
    containers = containers.filter(c => c.id !== containerId);
    saveContainers();

    // Switch to default if we deleted the current container
    if (currentContainerId === containerId) {
      switchContainer('default');
    } else {
      renderContainerList();
      renderBoardContainerList();
    }
  }
}

// Close container dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const selector = document.getElementById('container-selector');
  if (selector && !selector.contains(e.target)) {
    closeContainerDropdown();
  }

  const boardSelector = document.getElementById('board-container-selector');
  if (boardSelector && !boardSelector.contains(e.target)) {
    closeBoardContainerDropdown();
  }
});
