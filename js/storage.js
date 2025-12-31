// ===========================================
// CONSTANTS
// ===========================================
const STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  DONE: 'done'
};

const STORAGE_KEYS = {
  ITEMS: 'taskManager_tasks',
  CONTAINERS: 'taskManager_containers',
  CURRENT_CONTAINER: 'taskManager_currentContainerId',
  CURRENT_VIEW: 'taskManager_currentView',
  LAST_SAVED: 'taskManager_lastSaved'
};

const VIEWS = {
  LIST: 'list',
  BOARD: 'kanban'
};

const COLUMN_NAMES = [STATUS.TODO, STATUS.IN_PROGRESS, STATUS.DONE];

// ===========================================
// SHARED STATE
// ===========================================
let tasks = [];
let containers = [];
let currentContainerId = null;
let currentView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW) || VIEWS.LIST;
let isServerMode = window.location.protocol !== 'file:';
let lastSavedTime = null;
let allListTags = new Set();
let activeTagFilters = new Set();
let searchQuery = '';

// Sync indicator fade timeout
let syncFadeTimeout = null;

// ===========================================
// SYNC STATUS
// ===========================================

function updateSyncStatus(status) {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;

  // Clear any pending fade timeout
  if (syncFadeTimeout) {
    clearTimeout(syncFadeTimeout);
    syncFadeTimeout = null;
  }

  indicator.className = 'sync-indicator';

  if (status === 'synced') {
    lastSavedTime = new Date();
    indicator.classList.add('synced', 'visible');
    indicator.textContent = `Saved`;
    localStorage.setItem(STORAGE_KEYS.LAST_SAVED, lastSavedTime.toISOString());

    // Fade out after 2 seconds
    syncFadeTimeout = setTimeout(() => {
      indicator.classList.remove('visible');
    }, 2000);
  } else if (status === 'error') {
    indicator.classList.add('error', 'visible');
    if (lastSavedTime) {
      indicator.textContent = `Local only`;
    } else {
      indicator.textContent = 'Not synced';
    }
    // Keep error visible longer
    syncFadeTimeout = setTimeout(() => {
      indicator.classList.remove('visible');
    }, 4000);
  }
}

function refreshSyncTimestamp() {
  if (lastSavedTime) {
    const indicator = document.getElementById('sync-indicator');
    if (indicator && indicator.classList.contains('synced')) {
      indicator.textContent = `Saved`;
    }
  }
}

// ===========================================
// PERSISTENCE FUNCTIONS
// ===========================================

// Load tasks from localStorage
function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
  if (saved) {
    tasks = JSON.parse(saved);
  }
}

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(tasks));
  updateSyncStatus('synced');

  // Also backup to server file when in server mode
  if (isServerMode) {
    saveTasksToServer();
  }
}

// Save tasks to server for local file backup
function saveTasksToServer() {
  fetch('/save-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tasks)
  }).catch(err => console.log('Backup to server failed:', err));
}

// Save containers to localStorage
function saveContainers() {
  localStorage.setItem(STORAGE_KEYS.CONTAINERS, JSON.stringify(containers));
  localStorage.setItem(STORAGE_KEYS.CURRENT_CONTAINER, currentContainerId);
}
