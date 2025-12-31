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
// STATE
// ===========================================
// Unified state - tasks is the single source of truth for both views
let tasks = [];
let selectedTaskId = null;
let currentEditingTask = null;
let currentColumn = STATUS.TODO;
let currentTags = [];
let selectedColumn = 0; // 0=todo, 1=in-progress, 2=done
let allTags = new Set();
let tagSuggestions = [];
let isServerMode = window.location.protocol !== 'file:';
let lastSavedTime = null;

// Simple List state
let selectedListItemId = null;
let currentEditingListItem = null;
let currentView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW) || VIEWS.LIST;
let currentListTags = [];
let allListTags = new Set();
let activeTagFilters = new Set();

// Container state
let containers = [];
let currentContainerId = null;

// Migrate data to unified model with status field
function migrateToUnifiedModel() {
  let migrated = false;

  // Migrate old tasks (completed boolean -> status field)
  tasks.forEach(item => {
    if (item.status === undefined) {
      if (item.completed) {
        item.status = STATUS.DONE;
      } else {
        item.status = STATUS.TODO;
      }
      delete item.completed;
      migrated = true;
    }
  });

  // Migrate old Kanban tasks into tasks
  const oldTasks = localStorage.getItem('taskManager_tasks');
  if (oldTasks) {
    try {
      const tasks = JSON.parse(oldTasks);
      if (tasks.length > 0) {
        tasks.forEach(task => {
          // Map column to status
          const status = task.column || STATUS.TODO;

          // Create listItem from task
          const newItem = {
            id: task.id,
            title: task.title,
            url: task.url || '',
            notes: task.notes || '',
            tags: task.tags || [],
            order: task.order || 0,
            containerId: currentContainerId || 'default',
            createdAt: task.createdAt || new Date().toISOString(),
            status: status,
            onHold: task.onHold || false
          };

          if (task.completedAt) {
            newItem.completedAt = task.completedAt;
          }

          // Only add if not already exists
          if (!tasks.find(i => i.id === task.id)) {
            tasks.push(newItem);
          }
        });
        migrated = true;
      }
    } catch (e) {
      console.log('Could not migrate old tasks:', e);
    }
    // Remove old tasks storage after migration
    localStorage.removeItem('taskManager_tasks');
  }

  if (migrated) {
    saveTasks();
  }
}

// Collect all unique tags from current container's items
function collectAllTags() {
  allTags.clear();
  getContainerItems().forEach(item => {
    if (item.tags) {
      item.tags.forEach(tag => allTags.add(tag));
    }
  });
}

// Format timestamp for display
function formatLastSaved(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  // Show actual time for older saves
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Time tracking utility functions
function formatTime(milliseconds) {
  if (!milliseconds || milliseconds < 0) return '0m';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

function calculateTaskDuration(task) {
  // Only calculate duration for tasks that have both start and completion time
  if (!task.startedAt || !task.completedAt) return 0;

  const start = new Date(task.startedAt).getTime();
  const end = new Date(task.completedAt).getTime();

  return end - start;
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Sync indicator fade timeout
let syncFadeTimeout = null;

// Update sync status indicator
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

// Update the "time ago" text periodically
function refreshSyncTimestamp() {
  if (lastSavedTime) {
    const indicator = document.getElementById('sync-indicator');
    if (indicator && indicator.classList.contains('synced')) {
      indicator.textContent = `✓ Saved ${formatLastSaved(lastSavedTime)}`;
    }
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Render all tasks (uses tasks as source of truth)
function renderBoardView() {
  const columns = ['todo', 'in-progress', 'done'];
  let containerItems = getContainerItems();

  // Apply board filters
  containerItems = filterBoardBySearch(containerItems);
  containerItems = filterBoardByTags(containerItems);

  columns.forEach(column => {
    const container = document.getElementById(`${column}-tasks`);
    container.innerHTML = '';

    let columnItems = containerItems.filter(item => item.status === column);

    if (column === 'done') {
      // Group done items by completion date
      const itemsByDate = groupTasksByDate(columnItems);

      Object.keys(itemsByDate)
        .sort((a, b) => new Date(b) - new Date(a))
        .forEach(date => {
          const dateGroup = document.createElement('div');
          dateGroup.className = 'date-group';

          const dateHeader = document.createElement('div');
          dateHeader.className = 'date-header';
          dateHeader.textContent = formatDateHeader(date);
          dateGroup.appendChild(dateHeader);

          itemsByDate[date]
            .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
            .forEach(item => {
              const taskElement = createTaskElement(item);
              dateGroup.appendChild(taskElement);
            });

          container.appendChild(dateGroup);
        });
    } else {
      columnItems.sort((a, b) => (a.order || 0) - (b.order || 0));
      columnItems.forEach(item => {
        const taskElement = createTaskElement(item);
        container.appendChild(taskElement);
      });
    }
  });

  collectAllTags();
  updateBoardCount();
  renderBoardTagFilters();
}

// Update task order within column based on DOM order
function updateTaskOrder(container, column) {
  const taskElements = [...container.querySelectorAll('.task')];
  taskElements.forEach((element, index) => {
    const elementTaskId = element.dataset.taskId;
    const item = tasks.find(i => i.id === elementTaskId);
    if (item) {
      item.order = index;
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Group tasks by date
function groupTasksByDate(tasks) {
  const groups = {};
  tasks.forEach(task => {
    const date = task.completedAt ?
      new Date(task.completedAt).toDateString() :
      new Date(task.createdAt).toDateString();

    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(task);
  });
  return groups;
}

// Format date header
function formatDateHeader(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Create task element (matches Simple List style)
function createTaskElement(item) {
  const taskDiv = document.createElement('div');
  taskDiv.className = 'task';
  taskDiv.draggable = true;
  taskDiv.dataset.taskId = item.id;

  const isDone = item.status === 'done';
  const hasUrl = item.url && item.url.trim();

  // Build tags HTML inline with title (matching Simple List exactly)
  const tagsHtml = item.tags && item.tags.length > 0
    ? `<span class="task-tags-inline">${item.tags.map(tag =>
        `<span class="task-tag-inline">${escapeHtml(tag)}</span>`
      ).join('')}</span>`
    : '';

  // Build favicon HTML
  const faviconHtml = hasUrl
    ? `<img src="${getFaviconUrl(item.url)}" class="task-favicon-inline" onerror="this.style.display='none'" alt="">`
    : '';

  // Build notes HTML inline (matching Simple List)
  const notesHtml = item.notes
    ? `<span class="task-notes-inline">${escapeHtml(item.notes)}</span>`
    : '';

  taskDiv.innerHTML = `
    <div class="task-actions">
      <button class="action-btn hold" onclick="toggleHold('${item.id}')" title="${item.onHold ? 'Resume' : 'Put on Hold'}">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${item.onHold
            ? '<polygon points="5 3 19 12 5 21 5 3"/>'
            : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'}
        </svg>
      </button>
      <button class="action-btn edit" onclick="editTaskByIdFromButton('${item.id}')" title="Edit">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="action-btn delete" onclick="deleteTaskByIdFromButton('${item.id}')" title="Delete">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    <div class="task-content">
      ${faviconHtml}
      <div class="task-title-row">
        <span class="task-title-text">${hasUrl ? `<a href="${item.url}" target="_blank">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</span>${tagsHtml}${notesHtml}
      </div>
    </div>
  `;

  // Add on-hold class if item is on hold
  if (item.onHold) {
    taskDiv.classList.add('on-hold');
  }

  // Drag events
  taskDiv.addEventListener('dragstart', handleDragStart);
  taskDiv.addEventListener('dragend', handleDragEnd);

  // Click events
  taskDiv.addEventListener('click', () => selectTask(item.id));
  taskDiv.addEventListener('dblclick', () => editTaskByIdFromButton(item.id));

  return taskDiv;
}

// Drag and drop functionality
function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
  e.target.classList.add('dragging');
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

// Set up drop zones after DOM is loaded
function setupDropZones() {
  document.querySelectorAll('.tasks-container').forEach(container => {
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
  });
}

function handleDragOver(e) {
  e.preventDefault();

  const dragging = document.querySelector('.dragging');
  if (!dragging) return;

  const container = e.currentTarget;
  const newStatus = container.id.replace('-tasks', '');
  const draggingItemId = dragging.dataset.taskId;
  const draggingItem = tasks.find(i => i.id === draggingItemId);

  if (!draggingItem) return;

  // If dragging within the same column and it's not Done, allow reordering
  if (draggingItem.status === newStatus && newStatus !== 'done') {
    const afterElement = getDragAfterElement(container, e.clientY);
    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  }
}

function handleDragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const itemId = e.dataTransfer.getData('text/plain');
  const newStatus = e.currentTarget.id.replace('-tasks', '');

  const item = tasks.find(i => i.id === itemId);
  if (item) {
    const oldStatus = item.status;

    if (oldStatus !== newStatus) {
      // Moving between columns
      item.status = newStatus;

      // If moving to done, set completion timestamp
      if (newStatus === 'done' && oldStatus !== 'done') {
        item.completedAt = new Date().toISOString();
      } else if (oldStatus === 'done' && newStatus !== 'done') {
        // If moving out of done, remove completion timestamp
        delete item.completedAt;
      }

      // Reset order when moving between columns
      const columnItems = getContainerItems().filter(i => i.status === newStatus && i.id !== itemId);
      item.order = columnItems.length;
    } else {
      // Reordering within same column (only allowed for todo and in-progress)
      if (newStatus !== 'done') {
        updateTaskOrder(e.currentTarget, newStatus);
      }
    }

    saveTasks();
    renderBoardView();
  }
}

// Task modal functions
function openTaskModal(column = 'todo') {
  currentColumn = column;
  currentEditingTask = null;
  currentTags = [];
  document.getElementById('modal-title').textContent = 'Add Task';
  document.getElementById('task-title').value = '';
  document.getElementById('task-url').value = '';
  document.getElementById('task-notes').value = '';
  renderTagsInput();
  document.getElementById('task-modal').style.display = 'block';
  document.getElementById('task-title').focus();
}

function closeTaskModal() {
  document.getElementById('task-modal').style.display = 'none';
}

// Instructions modal functions
function openInstructionsModal() {
  // Show the appropriate instructions based on current view
  const kanbanInstructions = document.getElementById('kanban-instructions');
  const listInstructions = document.getElementById('list-instructions');

  if (currentView === 'list') {
    kanbanInstructions.style.display = 'none';
    listInstructions.style.display = 'block';
  } else {
    kanbanInstructions.style.display = 'block';
    listInstructions.style.display = 'none';
  }

  document.getElementById('instructions-modal').style.display = 'block';
}

function closeInstructionsModal() {
  document.getElementById('instructions-modal').style.display = 'none';
}

function editTaskById(itemId) {
  const item = tasks.find(i => i.id === itemId);
  if (!item) return;

  currentEditingTask = itemId;
  currentColumn = item.status;
  currentTags = item.tags ? [...item.tags] : [];
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('task-title').value = item.title;
  document.getElementById('task-url').value = item.url || '';
  document.getElementById('task-notes').value = item.notes || '';

  renderTagsInput();
  document.getElementById('task-modal').style.display = 'block';
  document.getElementById('task-title').focus();
}

function deleteTaskById(itemId) {
  if (confirm('Are you sure you want to delete this task?')) {
    const index = tasks.findIndex(i => i.id === itemId);
    if (index >= 0) {
      tasks.splice(index, 1);
      saveTasks();
      renderBoardView();
    }
  }
}

// Helper functions for button clicks
function editTaskByIdFromButton(itemId) {
  editTaskById(itemId);
}

function deleteTaskByIdFromButton(itemId) {
  if (selectedTaskId === itemId) {
    selectedTaskId = null;
  }
  deleteTaskById(itemId);
}

function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  const url = document.getElementById('task-url').value.trim();
  const notes = document.getElementById('task-notes').value.trim();

  if (!title) {
    alert('Please enter a task title');
    return;
  }

  if (currentEditingTask !== null) {
    // Edit existing item
    const item = tasks.find(i => i.id === currentEditingTask);
    if (item) {
      item.title = title;
      item.url = url;
      item.notes = notes;
      item.tags = currentTags;
    }
  } else {
    // Create new item at the top (order 0)
    const containerItems = getContainerItems();
    containerItems.forEach(item => {
      if (item.status === currentColumn) {
        item.order = (item.order || 0) + 1;
      }
    });

    const newItem = {
      id: generateId(),
      title: title,
      url: url,
      notes: notes,
      tags: currentTags,
      status: currentColumn,
      order: 0,
      containerId: currentContainerId,
      createdAt: new Date().toISOString()
    };

    tasks.push(newItem);
  }

  saveTasks();
  renderBoardView();
  closeTaskModal();
}

// Task selection for navigation
function selectTask(itemId) {
  document.querySelectorAll('.task.selected').forEach(el => {
    el.classList.remove('selected');
  });

  selectedTaskId = itemId;
  const taskElement = document.querySelector(`[data-task-id="${itemId}"]`);
  if (taskElement) {
    taskElement.classList.add('selected');
    taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const item = tasks.find(i => i.id === itemId);
    if (item) {
      selectedColumn = COLUMN_NAMES.indexOf(item.status);
    }
  }
}

function clearSelection() {
  document.querySelectorAll('.task.selected').forEach(task => {
    task.classList.remove('selected');
  });
  selectedTaskId = null;
}

function getSelectedTask() {
  return selectedTaskId ? tasks.find(i => i.id === selectedTaskId) : null;
}

// Get items in visual order for a column
function getColumnTasksInOrder(columnName) {
  const container = document.getElementById(`${columnName}-tasks`);
  if (!container) return [];

  const taskElements = container.querySelectorAll('.task');
  return Array.from(taskElements).map(element => {
    const itemId = element.dataset.taskId;
    return tasks.find(i => i.id === itemId);
  }).filter(item => item);
}

// Navigation functions
function navigateUp() {
  const columnName = COLUMN_NAMES[selectedColumn];
  const columnTasks = getColumnTasksInOrder(columnName);
  if (columnTasks.length === 0) return;

  if (!selectedTaskId) {
    selectTask(columnTasks[0].id);
    return;
  }

  const currentIndex = columnTasks.findIndex(t => t.id === selectedTaskId);
  if (currentIndex > 0) {
    selectTask(columnTasks[currentIndex - 1].id);
  } else {
    selectTask(columnTasks[columnTasks.length - 1].id);
  }
}

function navigateDown() {
  const columnName = COLUMN_NAMES[selectedColumn];
  const columnTasks = getColumnTasksInOrder(columnName);
  if (columnTasks.length === 0) return;

  if (!selectedTaskId) {
    selectTask(columnTasks[0].id);
    return;
  }

  const currentIndex = columnTasks.findIndex(t => t.id === selectedTaskId);
  if (currentIndex < columnTasks.length - 1) {
    selectTask(columnTasks[currentIndex + 1].id);
  } else {
    selectTask(columnTasks[0].id);
  }
}

function navigateLeft() {
  selectedColumn = selectedColumn > 0 ? selectedColumn - 1 : COLUMN_NAMES.length - 1;
  const columnTasks = getColumnTasksInOrder(COLUMN_NAMES[selectedColumn]);
  if (columnTasks.length > 0) {
    selectTask(columnTasks[0].id);
  } else {
    clearSelection();
  }
}

function navigateRight() {
  selectedColumn = selectedColumn < COLUMN_NAMES.length - 1 ? selectedColumn + 1 : 0;
  const columnTasks = getColumnTasksInOrder(COLUMN_NAMES[selectedColumn]);
  if (columnTasks.length > 0) {
    selectTask(columnTasks[0].id);
  } else {
    clearSelection();
  }
}

// Move task functions
function moveTaskUp() {
  const task = getSelectedTask();
  if (!task || task.column === 'done') return;

  const columnTasks = getColumnTasksInOrder(task.column);
  const currentIndex = columnTasks.findIndex(t => t.id === task.id);

  if (currentIndex > 0) {
    const targetTask = columnTasks[currentIndex - 1];
    const tempOrder = task.order;
    task.order = targetTask.order;
    targetTask.order = tempOrder;

    saveTasks();
    renderBoardView();
    selectTask(task.id);
  }
}

function moveTaskDown() {
  const task = getSelectedTask();
  if (!task || task.column === 'done') return;

  const columnTasks = getColumnTasksInOrder(task.column);
  const currentIndex = columnTasks.findIndex(t => t.id === task.id);

  if (currentIndex < columnTasks.length - 1) {
    const targetTask = columnTasks[currentIndex + 1];
    const tempOrder = task.order;
    task.order = targetTask.order;
    targetTask.order = tempOrder;

    saveTasks();
    renderBoardView();
    selectTask(task.id);
  }
}

function moveTaskLeft() {
  const item = getSelectedTask();
  if (!item) return;

  const newColumnIndex = selectedColumn > 0 ? selectedColumn - 1 : COLUMN_NAMES.length - 1;
  const newStatus = COLUMN_NAMES[newColumnIndex];
  const oldStatus = item.status;

  item.status = newStatus;

  if (newStatus === 'done' && oldStatus !== 'done') {
    item.completedAt = new Date().toISOString();
  } else if (oldStatus === 'done' && newStatus !== 'done') {
    delete item.completedAt;
  }

  const newColumnItems = getContainerItems().filter(i => i.status === newStatus && i.id !== item.id);
  item.order = newColumnItems.length;

  selectedColumn = newColumnIndex;
  saveTasks();
  renderBoardView();
  selectTask(item.id);
}

function moveTaskRight() {
  const item = getSelectedTask();
  if (!item) return;

  const newColumnIndex = selectedColumn < COLUMN_NAMES.length - 1 ? selectedColumn + 1 : 0;
  const newStatus = COLUMN_NAMES[newColumnIndex];
  const oldStatus = item.status;

  item.status = newStatus;

  if (newStatus === 'done' && oldStatus !== 'done') {
    item.completedAt = new Date().toISOString();
  } else if (oldStatus === 'done' && newStatus !== 'done') {
    delete item.completedAt;
  }

  const newColumnItems = getContainerItems().filter(i => i.status === newStatus && i.id !== item.id);
  item.order = newColumnItems.length;

  selectedColumn = newColumnIndex;
  saveTasks();
  renderBoardView();
  selectTask(item.id);
}

// URL detection and title fetching
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Get favicon URL for a given website URL
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).origin;
    return `${domain}/favicon.ico`;
  } catch (_) {
    return '';
  }
}

async function fetchPageTitle(url) {
  try {
    const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, 'text/html');
    const title = doc.querySelector('title');
    return title ? title.textContent.trim() : new URL(url).hostname;
  } catch (error) {
    console.error('Error fetching page title:', error);
    return new URL(url).hostname;
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC closes any open modal
  if (e.key === 'Escape') {
    const taskModal = document.getElementById('task-modal');
    const listModal = document.getElementById('list-modal');
    const instructionsModal = document.getElementById('instructions-modal');

    if (instructionsModal.style.display === 'block') {
      closeInstructionsModal();
      e.preventDefault();
      return;
    }
    if (taskModal.style.display === 'block') {
      closeTaskModal();
      e.preventDefault();
      return;
    }
    if (listModal.style.display === 'block') {
      closeListModal();
      e.preventDefault();
      return;
    }
    // Close container dropdown if open
    closeContainerDropdown();
    return;
  }

  // Prevent other shortcuts when modal is open or in input fields
  if (document.getElementById('task-modal').style.display === 'block' ||
    document.getElementById('list-modal').style.display === 'block' ||
    e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Handle list view keyboard shortcuts
  if (currentView === 'list') {
    switch (e.key) {
      case 'ArrowUp':
        navigateListUp();
        e.preventDefault();
        break;
      case 'ArrowDown':
        navigateListDown();
        e.preventDefault();
        break;
      case 'Enter':
        if (selectedListItemId) {
          openSelectedListItemUrl();
        }
        e.preventDefault();
        break;
      case 'e':
      case 'E':
        if (selectedListItemId) {
          editListItem(selectedListItemId);
        }
        e.preventDefault();
        break;
      case 'Delete':
      case 'Backspace':
        if (selectedListItemId) {
          deleteListItem(selectedListItemId);
        }
        e.preventDefault();
        break;
      case 'n':
      case 'N':
        openListModal();
        e.preventDefault();
        break;
    }
    return;
  }

  // Handle Kanban view keyboard shortcuts
  if (e.shiftKey) {
    // Shift + Arrow = Move task
    switch (e.key) {
      case 'ArrowUp':
        moveTaskUp();
        e.preventDefault();
        break;
      case 'ArrowDown':
        moveTaskDown();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        moveTaskLeft();
        e.preventDefault();
        break;
      case 'ArrowRight':
        moveTaskRight();
        e.preventDefault();
        break;
    }
  } else {
    // Regular navigation and actions
    switch (e.key) {
      case 'ArrowUp':
        navigateUp();
        e.preventDefault();
        break;
      case 'ArrowDown':
        navigateDown();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        navigateLeft();
        e.preventDefault();
        break;
      case 'ArrowRight':
        navigateRight();
        e.preventDefault();
        break;
      case 'Enter':
        if (selectedTaskId) {
          editTaskById(selectedTaskId);
        }
        e.preventDefault();
        break;
      case 'Delete':
      case 'Backspace':
        if (selectedTaskId) {
          deleteTaskById(selectedTaskId);
        }
        e.preventDefault();
        break;
      case 'n':
      case 'N':
        // Always add new tasks to the "todo" column when pressing 'n'
        openTaskModal('todo');
        e.preventDefault();
        break;
    }
  }
});

// Paste functionality
document.addEventListener('paste', async (e) => {
  // Only handle paste when not in input fields or modals
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
    document.getElementById('task-modal').style.display === 'block' ||
    document.getElementById('list-modal').style.display === 'block') {
    return;
  }

  const pastedText = e.clipboardData.getData('text').trim();

  if (isValidUrl(pastedText)) {
    e.preventDefault();

    if (currentView === 'list') {
      // Open list modal with URL pre-filled
      currentEditingListItem = null;
      document.getElementById('list-modal-title').textContent = 'Add Task';
      document.getElementById('list-item-title').value = '';
      document.getElementById('list-item-url').value = pastedText;
      document.getElementById('list-modal').style.display = 'block';
      document.getElementById('list-item-title').focus();
    } else {
      // Open kanban modal with URL pre-filled
      currentColumn = 'todo';
      currentEditingTask = null;
      document.getElementById('modal-title').textContent = 'Add Task';
      currentTags = [];
      document.getElementById('task-title').value = '';
      document.getElementById('task-url').value = pastedText;
      document.getElementById('task-notes').value = '';
      renderTagsInput();
      document.getElementById('task-modal').style.display = 'block';
      document.getElementById('task-title').focus();
    }
  }
});

// Modal keyboard shortcuts and click outside to close
document.getElementById('task-modal').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTaskModal();
  } else if (e.key === 'Enter' && e.target.id !== 'task-notes' && e.target.id !== 'tag-input') {
    saveTask();
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    saveTask();
  }
});

// Close modal when clicking outside of it
document.getElementById('task-modal').addEventListener('click', (e) => {
  if (e.target.id === 'task-modal') {
    closeTaskModal();
  }
});

// Instructions modal keyboard shortcuts and click outside to close
document.getElementById('instructions-modal').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeInstructionsModal();
  }
});

document.getElementById('instructions-modal').addEventListener('click', (e) => {
  if (e.target.id === 'instructions-modal') {
    closeInstructionsModal();
  }
});

// Tags functionality
function renderTagsInput() {
  const container = document.getElementById('tags-input');
  container.innerHTML = '';

  currentTags.forEach((tag, index) => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-item';
    tagElement.innerHTML = `
                <span>${tag}</span>
                <button class="tag-remove" onclick="removeTag(${index})" type="button">×</button>
            `;
    container.appendChild(tagElement);
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-input';
  input.id = 'tag-input';
  input.placeholder = currentTags.length === 0 ? 'Type and press Enter to add tags' : '';
  input.addEventListener('keydown', handleTagInput);
  input.addEventListener('input', handleTagInputChange);
  input.addEventListener('blur', hideSuggestions);
  container.appendChild(input);

  const suggestionsDiv = document.createElement('div');
  suggestionsDiv.className = 'tag-suggestions';
  suggestionsDiv.id = 'tag-suggestions';
  container.appendChild(suggestionsDiv);
}

function handleTagInput(e) {
  const suggestions = document.getElementById('tag-suggestions');
  const selectedSuggestion = suggestions.querySelector('.tag-suggestion.selected');

  if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedSuggestion) {
      addTag(selectedSuggestion.textContent);
      e.target.value = '';
      hideSuggestions();
    } else if (e.target.value.trim()) {
      addTag(e.target.value.trim());
      e.target.value = '';
      hideSuggestions();
    }
  } else if (e.key === 'Backspace' && e.target.value === '' && currentTags.length > 0) {
    removeTag(currentTags.length - 1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectNextSuggestion();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectPrevSuggestion();
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

function handleTagInputChange(e) {
  const query = e.target.value.trim().toLowerCase();
  if (query.length > 0) {
    showSuggestions(query);
  } else {
    hideSuggestions();
  }
}

function showSuggestions(query) {
  const suggestions = document.getElementById('tag-suggestions');
  const filteredTags = Array.from(allTags)
    .filter(tag =>
      tag.toLowerCase().includes(query) &&
      !currentTags.includes(tag)
    )
    .slice(0, 5);

  if (filteredTags.length > 0) {
    suggestions.innerHTML = filteredTags
      .map(tag => `<div class="tag-suggestion" onclick="selectSuggestion('${tag}')">${tag}</div>`)
      .join('');
    suggestions.style.display = 'block';
  } else {
    hideSuggestions();
  }
}

function hideSuggestions() {
  setTimeout(() => {
    const suggestions = document.getElementById('tag-suggestions');
    if (suggestions) {
      suggestions.style.display = 'none';
    }
  }, 150);
}

function selectSuggestion(tag) {
  addTag(tag);
  document.getElementById('tag-input').value = '';
  hideSuggestions();
  document.getElementById('tag-input').focus();
}

function selectNextSuggestion() {
  const suggestions = document.querySelectorAll('.tag-suggestion');
  const current = document.querySelector('.tag-suggestion.selected');

  if (suggestions.length === 0) return;

  if (!current) {
    suggestions[0].classList.add('selected');
  } else {
    current.classList.remove('selected');
    const nextIndex = Array.from(suggestions).indexOf(current) + 1;
    if (nextIndex < suggestions.length) {
      suggestions[nextIndex].classList.add('selected');
    } else {
      suggestions[0].classList.add('selected');
    }
  }
}

function selectPrevSuggestion() {
  const suggestions = document.querySelectorAll('.tag-suggestion');
  const current = document.querySelector('.tag-suggestion.selected');

  if (suggestions.length === 0) return;

  if (!current) {
    suggestions[suggestions.length - 1].classList.add('selected');
  } else {
    current.classList.remove('selected');
    const prevIndex = Array.from(suggestions).indexOf(current) - 1;
    if (prevIndex >= 0) {
      suggestions[prevIndex].classList.add('selected');
    } else {
      suggestions[suggestions.length - 1].classList.add('selected');
    }
  }
}

function addTag(tagText) {
  if (tagText && !currentTags.includes(tagText)) {
    currentTags.push(tagText);
    renderTagsInput();
    document.getElementById('tag-input').focus();
  }
}

function removeTag(index) {
  currentTags.splice(index, 1);
  renderTagsInput();
  document.getElementById('tag-input').focus();
}

// Focus timer helper functions
function getCurrentFocusTime(task) {
  if (!task) return 0;

  let totalTime = task.accumulatedFocusTime || 0;

  // If currently active, add the time since focus started
  if (task.isActive && task.focusStartTime) {
    const elapsed = Date.now() - new Date(task.focusStartTime).getTime();
    totalTime += elapsed;
  }

  return totalTime;
}

function formatFocusTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

function getTomatoCount(milliseconds) {
  const POMODORO_DURATION = 25 * 60 * 1000; // 25 minutes in milliseconds
  return Math.floor(milliseconds / POMODORO_DURATION);
}

function formatTomatoes(count) {
  if (count === 0) return '';
  if (count <= 4) {
    return '🍅'.repeat(count);
  }
  return `🍅 x${count}`;
}

// Toggle on hold status
function toggleHold(itemId) {
  const item = tasks.find(i => i.id === itemId);
  if (item) {
    item.onHold = !item.onHold;
    saveTasks();
    renderBoardView();
    if (selectedTaskId === itemId) {
      selectTask(itemId);
    }
  }
}

// ==========================================
// SIMPLE LIST FUNCTIONS
// ==========================================

// Load tasks from localStorage
function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
  if (saved) {
    tasks = JSON.parse(saved);
  }
  // Migrate old data to unified model
  migrateToUnifiedModel();
  // Note: allListTags is rebuilt per container in loadContainers()
}

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(tasks));
  updateSyncStatus('synced');
}

// ==========================================
// CONTAINER FUNCTIONS
// ==========================================

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

// Save containers to localStorage
function saveContainers() {
  localStorage.setItem(STORAGE_KEYS.CONTAINERS, JSON.stringify(containers));
  localStorage.setItem(STORAGE_KEYS.CURRENT_CONTAINER, currentContainerId);
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

// Render board container list in dropdown
function renderBoardContainerList() {
  const listEl = document.getElementById('board-container-list');
  if (!listEl) return;

  listEl.innerHTML = containers.map((container, index) => {
    const count = tasks.filter(item =>
      item.containerId === container.id ||
      (!item.containerId && container.id === 'default')
    ).length;
    const isActive = container.id === currentContainerId;
    const isDefault = container.id === 'default';

    return `
      <div class="container-item ${isActive ? 'active' : ''}" data-container-id="${container.id}">
        <span class="container-item-name" onclick="switchContainer('${container.id}')">${escapeHtml(container.name)}</span>
        <span class="container-item-count">${count}</span>
      </div>
    `;
  }).join('');
}

// Render container list in dropdown
function renderContainerList() {
  const listEl = document.getElementById('container-list');
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
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </span>
        <span class="container-item-name" onclick="switchContainer('${container.id}')">${escapeHtml(container.name)}</span>
        <span class="container-item-count">${count}</span>
        <div class="container-item-actions">
          <button class="container-item-btn" onclick="event.stopPropagation(); editContainerName('${container.id}')" title="Rename">
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

  // Setup drag and drop for containers
  setupContainerDragAndDrop();
}

// Container drag state
let draggedContainerIndex = null;

// Setup drag and drop for container items
function setupContainerDragAndDrop() {
  const listEl = document.getElementById('container-list');
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
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleContainerDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.container-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedContainerIndex = null;
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
  updateContainerUI();
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
  listSearchQuery = '';
  const searchInput = document.getElementById('list-search-input');
  if (searchInput) searchInput.value = '';
  document.getElementById('list-search-clear').style.display = 'none';
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
function showNewContainerInput() {
  document.querySelector('.container-new-btn').style.display = 'none';
  const inputDiv = document.getElementById('container-new-input');
  inputDiv.style.display = 'flex';
  const input = document.getElementById('new-container-name');
  input.value = '';
  input.focus();
}

// Handle keydown in new container input
function handleNewContainerKeydown(event) {
  if (event.key === 'Enter') {
    createNewContainer();
  } else if (event.key === 'Escape') {
    document.getElementById('container-new-input').style.display = 'none';
    document.querySelector('.container-new-btn').style.display = 'flex';
  }
}

// Create new container
function createNewContainer() {
  const input = document.getElementById('new-container-name');
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
function editContainerName(containerId) {
  const container = containers.find(c => c.id === containerId);
  if (!container) return;

  const itemEl = document.querySelector(`.container-item[data-container-id="${containerId}"]`);
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
  };

  input.onblur = saveName;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      saveName();
    } else if (e.key === 'Escape') {
      renderContainerList();
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

// Generate unique ID for list items
function generateTaskId() {
  return 'li_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Switch between Board and List views
function switchView(view) {
  currentView = view;
  localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW, view);

  // Toggle visibility
  const board = document.getElementById('board');
  const listView = document.getElementById('list-view');

  if (view === VIEWS.BOARD) {
    board.style.display = 'block';
    listView.style.display = 'none';
    renderBoardView();
  } else {
    board.style.display = 'none';
    listView.style.display = 'block';
    renderListView();
  }

  // Update nav buttons
  document.querySelectorAll('.view-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Clear selections when switching views
  clearSelection();
  selectedListItemId = null;
}

// Initialize view on page load
function initializeView() {
  switchView(currentView);
}

// State for collapsed completed section
let listCompletedCollapsed = localStorage.getItem('taskManager_listCompletedCollapsed') === 'true';

// Render all list items
function renderListView() {
  const container = document.getElementById('list-items');
  const emptyState = document.getElementById('list-empty');
  const countBadge = document.getElementById('list-count');

  container.innerHTML = '';

  // Render tag filter bar
  renderTagFilterBar();

  // Get items for current container
  const containerItems = getContainerItems();

  // Separate active and completed items (status !== 'done' means active)
  let activeItems = containerItems.filter(i => i.status !== 'done').sort((a, b) => (a.order || 0) - (b.order || 0));
  let completedItems = containerItems.filter(i => i.status === 'done').sort((a, b) => {
    // Sort by completedAt descending (most recent first)
    return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
  });

  // Apply search filter
  activeItems = filterBySearch(activeItems);
  completedItems = filterBySearch(completedItems);

  // Apply tag filter
  activeItems = filterByTags(activeItems);
  completedItems = filterByTags(completedItems);

  const totalFiltered = activeItems.length + completedItems.length;
  const hasFilters = activeTagFilters.size > 0 || listSearchQuery;

  // Update count badge
  if (containerItems.length > 0) {
    if (hasFilters) {
      countBadge.textContent = `${totalFiltered} of ${containerItems.length} shown`;
    } else if (completedItems.length > 0) {
      countBadge.textContent = `${completedItems.length}/${containerItems.length} done`;
    } else {
      countBadge.textContent = `${containerItems.length} task${containerItems.length !== 1 ? 's' : ''}`;
    }
  } else {
    countBadge.textContent = '';
  }

  if (containerItems.length === 0) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'block';

  // Show message if filter has no results
  if (totalFiltered === 0 && hasFilters) {
    const noResults = document.createElement('div');
    noResults.className = 'list-no-results';
    const message = listSearchQuery && activeTagFilters.size > 0
      ? 'No tasks match your search and filters'
      : listSearchQuery
        ? 'No tasks match your search'
        : 'No tasks match the selected tags';
    noResults.innerHTML = `
      <div class="list-no-results-text">${message}</div>
      <button class="list-no-results-clear" onclick="clearAllListFilters()">Clear filters</button>
    `;
    container.appendChild(noResults);
    return;
  }

  // Render active items
  activeItems.forEach(item => {
    const element = createListItemElement(item);
    container.appendChild(element);
  });

  // Render completed section if there are completed items
  if (completedItems.length > 0) {
    const completedSection = document.createElement('div');
    completedSection.className = 'list-completed-section';

    const completedHeader = document.createElement('div');
    completedHeader.className = `list-completed-header ${listCompletedCollapsed ? 'collapsed' : ''}`;
    completedHeader.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      Completed
      <span class="list-completed-count">(${completedItems.length})</span>
    `;
    completedHeader.onclick = toggleListCompletedSection;

    const completedContainer = document.createElement('div');
    completedContainer.className = `list-completed-items ${listCompletedCollapsed ? 'collapsed' : ''}`;
    completedContainer.id = 'list-completed-items';

    // Group completed items by date
    const groupOrder = ['today', 'yesterday', 'last7days', 'last30days', 'older'];
    const groupedItems = {};

    completedItems.forEach(item => {
      const group = getDateGroup(item.completedAt);
      if (!groupedItems[group]) groupedItems[group] = [];
      groupedItems[group].push(item);
    });

    // Render grouped items
    groupOrder.forEach(group => {
      if (groupedItems[group] && groupedItems[group].length > 0) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'list-date-group-header';
        groupHeader.textContent = getDateGroupLabel(group);
        completedContainer.appendChild(groupHeader);

        groupedItems[group].forEach(item => {
          const element = createListItemElement(item);
          completedContainer.appendChild(element);
        });
      }
    });

    // Set max-height for animation
    if (!listCompletedCollapsed) {
      setTimeout(() => {
        completedContainer.style.maxHeight = completedContainer.scrollHeight + 'px';
      }, 0);
    }

    completedSection.appendChild(completedHeader);
    completedSection.appendChild(completedContainer);
    container.appendChild(completedSection);
  }

  // Set up drag and drop for list
  setupListDragAndDrop();
}

// Toggle completed section collapse
function toggleListCompletedSection() {
  listCompletedCollapsed = !listCompletedCollapsed;
  localStorage.setItem('taskManager_listCompletedCollapsed', listCompletedCollapsed);

  const header = document.querySelector('.list-completed-header');
  const items = document.getElementById('list-completed-items');

  if (header) header.classList.toggle('collapsed', listCompletedCollapsed);
  if (items) {
    if (listCompletedCollapsed) {
      items.classList.add('collapsed');
    } else {
      items.classList.remove('collapsed');
      items.style.maxHeight = items.scrollHeight + 'px';
    }
  }
}

// Get date group for completed task
function getDateGroup(dateString) {
  if (!dateString) return 'older';

  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastMonthStart = new Date(today);
  lastMonthStart.setDate(lastMonthStart.getDate() - 30);

  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (taskDate >= today) {
    return 'today';
  } else if (taskDate >= yesterday) {
    return 'yesterday';
  } else if (taskDate >= lastWeekStart) {
    return 'last7days';
  } else if (taskDate >= lastMonthStart) {
    return 'last30days';
  } else {
    return 'older';
  }
}

function getDateGroupLabel(group) {
  const labels = {
    'today': 'Today',
    'yesterday': 'Yesterday',
    'last7days': 'Last 7 days',
    'last30days': 'Last 30 days',
    'older': 'Older'
  };
  return labels[group] || group;
}

// Render tag filter bar
function renderTagFilterBar() {
  const filterBar = document.getElementById('list-filter-bar');
  const selectedContainer = document.getElementById('list-filter-selected');
  const optionsContainer = document.getElementById('list-filter-options');
  const placeholder = document.getElementById('list-filter-placeholder');
  const clearBtn = document.getElementById('list-filter-clear');

  // Always show filter bar (for search), but hide tag multiselect if no tags
  filterBar.style.display = 'flex';
  const multiselect = document.getElementById('list-filter-multiselect');
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

  // Render all tags in dropdown
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

// Clear all tag filters
function clearAllTagFilters() {
  activeTagFilters.clear();
  renderTagFilterBar();
  renderListView();
}

// Toggle filter dropdown open/close
function toggleFilterDropdown() {
  const multiselect = document.getElementById('list-filter-multiselect');
  multiselect.classList.toggle('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const multiselect = document.getElementById('list-filter-multiselect');
  if (multiselect && !multiselect.contains(e.target)) {
    multiselect.classList.remove('open');
  }

  const boardMultiselect = document.getElementById('board-filter-multiselect');
  if (boardMultiselect && !boardMultiselect.contains(e.target)) {
    boardMultiselect.classList.remove('open');
  }
});

// Toggle a tag filter
function toggleTagFilter(tag) {
  if (activeTagFilters.has(tag)) {
    activeTagFilters.delete(tag);
  } else {
    activeTagFilters.add(tag);
  }
  renderTagFilterBar();
  renderListView();
}

// Clear all tag filters
function clearTagFilters() {
  activeTagFilters.clear();
  renderTagFilterBar();
  renderListView();
}

// List search state
let listSearchQuery = '';

function filterListTasks() {
  const searchInput = document.getElementById('list-search-input');
  const clearBtn = document.getElementById('list-search-clear');

  listSearchQuery = searchInput.value.toLowerCase().trim();
  clearBtn.style.display = listSearchQuery ? 'flex' : 'none';

  renderListView();
}

function clearListSearch() {
  const searchInput = document.getElementById('list-search-input');
  searchInput.value = '';
  listSearchQuery = '';
  document.getElementById('list-search-clear').style.display = 'none';
  renderListView();
}

function clearAllListFilters() {
  // Clear search
  const searchInput = document.getElementById('list-search-input');
  if (searchInput) {
    searchInput.value = '';
    listSearchQuery = '';
    document.getElementById('list-search-clear').style.display = 'none';
  }
  // Clear tag filters
  activeTagFilters.clear();
  renderListView();
}

// ===========================================
// SHARED FILTER FUNCTIONS
// ===========================================

// Filter items by search query (shared between views)
function filterItemsBySearch(items, query) {
  if (!query) return items;

  return items.filter(item => {
    const titleMatch = item.title && item.title.toLowerCase().includes(query);
    const notesMatch = item.notes && item.notes.toLowerCase().includes(query);
    return titleMatch || notesMatch;
  });
}

// Filter items by active tags - OR logic (shared between views)
function filterItemsByTags(items, activeFilters) {
  if (activeFilters.size === 0) return items;

  return items.filter(item => {
    if (!item.tags || item.tags.length === 0) return false;
    return item.tags.some(tag => activeFilters.has(tag.toLowerCase()));
  });
}

// List filter wrappers
function filterBySearch(items) {
  return filterItemsBySearch(items, listSearchQuery);
}

function filterByTags(items) {
  return filterItemsByTags(items, activeTagFilters);
}

// Board search/filter state
let boardSearchQuery = '';
let activeBoardTagFilters = new Set();

function filterBoardTasks() {
  const searchInput = document.getElementById('board-search-input');
  const clearBtn = document.getElementById('board-search-clear');

  boardSearchQuery = searchInput.value.toLowerCase().trim();
  clearBtn.style.display = boardSearchQuery ? 'flex' : 'none';

  renderBoardView();
}

function clearBoardSearch() {
  const searchInput = document.getElementById('board-search-input');
  searchInput.value = '';
  boardSearchQuery = '';
  document.getElementById('board-search-clear').style.display = 'none';
  renderBoardView();
}

// Board filter wrappers
function filterBoardBySearch(items) {
  return filterItemsBySearch(items, boardSearchQuery);
}

function filterBoardByTags(items) {
  return filterItemsByTags(items, activeBoardTagFilters);
}

function toggleBoardFilterDropdown() {
  const multiselect = document.getElementById('board-filter-multiselect');
  multiselect.classList.toggle('open');
}

function toggleBoardTagFilter(tag) {
  if (activeBoardTagFilters.has(tag)) {
    activeBoardTagFilters.delete(tag);
  } else {
    activeBoardTagFilters.add(tag);
  }
  renderBoardTagFilters();
  renderBoardView();
}

function clearAllBoardTagFilters() {
  activeBoardTagFilters.clear();
  renderBoardTagFilters();
  renderBoardView();
}

function renderBoardTagFilters() {
  const multiselect = document.getElementById('board-filter-multiselect');
  const placeholder = document.getElementById('board-filter-placeholder');
  const selectedContainer = document.getElementById('board-filter-selected');
  const optionsContainer = document.getElementById('board-filter-options');
  const clearBtn = document.getElementById('board-filter-clear');

  if (!multiselect) return;

  // Hide if no tags
  multiselect.style.display = allListTags.size === 0 ? 'none' : 'block';

  // Render selected tags in trigger
  selectedContainer.innerHTML = '';
  activeBoardTagFilters.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'list-filter-tag';
    tagEl.style.background = getTagColor(tag);
    tagEl.innerHTML = `${escapeHtml(tag)}<button onclick="event.stopPropagation(); toggleBoardTagFilter('${escapeHtml(tag)}')">&times;</button>`;
    selectedContainer.appendChild(tagEl);
  });

  // Show/hide placeholder and clear button
  placeholder.style.display = activeBoardTagFilters.size > 0 ? 'none' : 'block';
  clearBtn.style.display = activeBoardTagFilters.size > 0 ? 'block' : 'none';

  // Render options (alphabetically sorted)
  const sortedTags = [...allListTags].sort();
  optionsContainer.innerHTML = '';
  sortedTags.forEach(tag => {
    const isSelected = activeBoardTagFilters.has(tag);
    const optionEl = document.createElement('div');
    optionEl.className = `list-filter-option ${isSelected ? 'selected' : ''}`;
    optionEl.onclick = (e) => {
      e.stopPropagation();
      toggleBoardTagFilter(tag);
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

// Create a list item element
function createListItemElement(item) {
  const div = document.createElement('div');
  div.className = 'list-item';
  const isCompleted = item.status === 'done';
  if (isCompleted) div.classList.add('completed');
  if (item.onHold) div.classList.add('on-hold');
  div.draggable = true;
  div.dataset.itemId = item.id;

  if (selectedListItemId === item.id) {
    div.classList.add('selected');
  }

  const hasUrl = item.url && item.url.trim();
  const faviconUrl = hasUrl ? getFaviconUrl(item.url) : '';

  // Build title content
  let titleContent;
  const completedTimeHtml = isCompleted && item.completedAt
    ? `<div class="completed-time">Completed ${formatCompletedTime(item.completedAt)}</div>`
    : '';

  // Build tags HTML
  const tagsHtml = item.tags && item.tags.length > 0
    ? `<div class="list-item-tags">${item.tags.map(tag => `<span class="list-item-tag" style="background: ${getTagColor(tag)}">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  // Build notes HTML (inline)
  const notesHtml = item.notes && item.notes.trim()
    ? `<span class="list-item-notes">${escapeHtml(item.notes)}</span>`
    : '';

  if (hasUrl) {
    titleContent = `
      <div class="title-text">
        <a href="${escapeHtml(item.url)}" target="_blank" draggable="false">${escapeHtml(item.title)}</a>${tagsHtml}${notesHtml}
      </div>
      ${completedTimeHtml}
    `;
  } else {
    titleContent = `
      <div class="title-text">
        ${escapeHtml(item.title)}${tagsHtml}${notesHtml}
      </div>
      ${completedTimeHtml}
    `;
  }

  // Build favicon/placeholder
  let faviconContent;
  if (hasUrl) {
    faviconContent = `
      <div class="list-favicon-wrapper" draggable="false">
        <img src="${faviconUrl}" class="list-favicon" draggable="false" onerror="this.parentElement.innerHTML='<svg class=\\'list-favicon-placeholder\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><path d=\\'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71\\'/><path d=\\'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71\\'/></svg>'" alt="">
      </div>
    `;
  } else {
    faviconContent = '';
  }

  div.innerHTML = `
    <div class="drag-handle">
      <span class="drag-handle-dot"></span>
      <span class="drag-handle-dot"></span>
      <span class="drag-handle-dot"></span>
      <span class="drag-handle-dot"></span>
      <span class="drag-handle-dot"></span>
      <span class="drag-handle-dot"></span>
    </div>
    <div class="list-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleListItemComplete('${item.id}')">
      <svg viewBox="0 0 12 12">
        <polyline points="2,6 5,9 10,3"/>
      </svg>
    </div>
    ${faviconContent}
    <div class="list-item-title">
      ${titleContent}
    </div>
    <div class="list-item-actions">
      <button class="list-item-btn hold ${item.onHold ? 'active' : ''}" onclick="toggleListItemOnHold('${item.id}')" title="${item.onHold ? 'Resume' : 'Put on hold'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
      <button class="list-item-btn edit" onclick="editListItem('${item.id}')" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="list-item-btn delete" onclick="deleteListItem('${item.id}')" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  `;

  // Click to select
  div.addEventListener('click', (e) => {
    if (!e.target.closest('a') && !e.target.closest('button') && !e.target.closest('.list-checkbox')) {
      selectListItem(item.id);
    }
  });

  // Double-click to edit
  div.addEventListener('dblclick', (e) => {
    if (!e.target.closest('a') && !e.target.closest('.list-checkbox')) {
      editListItem(item.id);
    }
  });

  return div;
}

// Toggle list item completion
function toggleListItemComplete(itemId) {
  const item = tasks.find(i => i.id === itemId);
  if (item) {
    if (item.status === 'done') {
      item.status = 'todo';
      delete item.completedAt;
    } else {
      item.status = 'done';
      item.completedAt = new Date().toISOString();
    }
    saveTasks();
    renderListView();
  }
}

// Format completion time for display
function formatCompletedTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Extract domain from URL for display
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (_) {
    return url;
  }
}

// Select a list item
function selectListItem(itemId) {
  document.querySelectorAll('.list-item.selected').forEach(el => {
    el.classList.remove('selected');
  });

  selectedListItemId = itemId;
  const element = document.querySelector(`[data-item-id="${itemId}"]`);
  if (element) {
    element.classList.add('selected');
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Get tag color (single muted orange for all tags)
function getTagColor(tagName) {
  return 'var(--tag-color)';
}

// Render list tags input
function renderListTagsInput() {
  const container = document.getElementById('list-tags-input');
  const input = document.getElementById('list-tag-input');

  // Remove existing tags (keep input)
  const existingTags = container.querySelectorAll('.tag');
  existingTags.forEach(tag => tag.remove());

  // Add current tags before input
  currentListTags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.style.background = getTagColor(tag);
    tagElement.innerHTML = `
      ${escapeHtml(tag)}
      <button type="button" onclick="removeListTag('${escapeHtml(tag)}')">&times;</button>
    `;
    container.insertBefore(tagElement, input);
  });
}

// Add a tag to list item
function addListTag(tag) {
  const trimmedTag = tag.trim().toLowerCase();
  if (trimmedTag && !currentListTags.includes(trimmedTag)) {
    currentListTags.push(trimmedTag);
    allListTags.add(trimmedTag);
    renderListTagsInput();
  }
  document.getElementById('list-tag-input').value = '';
  hideListTagSuggestions();
}

// Remove a tag from list item
function removeListTag(tag) {
  currentListTags = currentListTags.filter(t => t !== tag);
  renderListTagsInput();
}

// Show list tag suggestions
function showListTagSuggestions(filter) {
  const suggestionsContainer = document.getElementById('list-tag-suggestions');
  const matchingTags = [...allListTags].filter(tag =>
    tag.includes(filter.toLowerCase()) && !currentListTags.includes(tag)
  );

  if (matchingTags.length === 0 || !filter) {
    suggestionsContainer.style.display = 'none';
    return;
  }

  suggestionsContainer.innerHTML = matchingTags.map(tag =>
    `<div class="tag-suggestion" onclick="addListTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</div>`
  ).join('');
  suggestionsContainer.style.display = 'block';
}

// Hide list tag suggestions
function hideListTagSuggestions() {
  document.getElementById('list-tag-suggestions').style.display = 'none';
}

// Open list modal for adding
function openListModal() {
  currentEditingListItem = null;
  currentListTags = [];
  document.getElementById('list-modal-title').textContent = 'Add Task';
  document.getElementById('list-item-title').value = '';
  document.getElementById('list-item-url').value = '';
  document.getElementById('list-item-notes').value = '';
  document.getElementById('list-tag-input').value = '';
  renderListTagsInput();
  document.getElementById('list-modal').style.display = 'block';
  document.getElementById('list-item-title').focus();
}

// Close list modal
function closeListModal() {
  document.getElementById('list-modal').style.display = 'none';
  currentEditingListItem = null;
  currentListTags = [];
  hideListTagSuggestions();
}

// Edit a list item
function editListItem(itemId) {
  const item = tasks.find(i => i.id === itemId);
  if (!item) return;

  currentEditingListItem = itemId;
  currentListTags = item.tags ? [...item.tags] : [];
  document.getElementById('list-modal-title').textContent = 'Edit Task';
  document.getElementById('list-item-title').value = item.title || '';
  document.getElementById('list-item-url').value = item.url || '';
  document.getElementById('list-item-notes').value = item.notes || '';
  document.getElementById('list-tag-input').value = '';
  renderListTagsInput();
  document.getElementById('list-modal').style.display = 'block';
  document.getElementById('list-item-title').focus();
}

// Delete a list item
function deleteListItem(itemId) {
  if (confirm('Are you sure you want to delete this task?')) {
    tasks = tasks.filter(i => i.id !== itemId);
    if (selectedListItemId === itemId) {
      selectedListItemId = null;
    }
    saveTasks();
    renderListView();
  }
}

// Toggle on-hold status
function toggleListItemOnHold(itemId) {
  const item = tasks.find(i => i.id === itemId);
  if (item) {
    item.onHold = !item.onHold;
    saveTasks();
    renderListView();
  }
}

// Save list item (add or edit)
function saveListItem() {
  const title = document.getElementById('list-item-title').value.trim();
  const url = document.getElementById('list-item-url').value.trim();
  const notes = document.getElementById('list-item-notes').value.trim();

  if (!title) {
    alert('Please enter a title');
    return;
  }

  if (url && !isValidUrl(url)) {
    alert('Please enter a valid URL');
    return;
  }

  if (currentEditingListItem) {
    // Edit existing item
    const item = tasks.find(i => i.id === currentEditingListItem);
    if (item) {
      item.title = title;
      item.url = url;
      item.notes = notes;
      item.tags = [...currentListTags];
    }
  } else {
    // Add new item at the top (only adjust order for items in same container)
    tasks.forEach(item => {
      if (item.containerId === currentContainerId || (!item.containerId && currentContainerId === 'default')) {
        item.order = (item.order || 0) + 1;
      }
    });

    const newItem = {
      id: generateTaskId(),
      title: title,
      url: url,
      notes: notes,
      tags: [...currentListTags],
      order: 0,
      containerId: currentContainerId,
      createdAt: new Date().toISOString(),
      status: 'todo'
    };
    tasks.push(newItem);
  }

  saveTasks();
  renderListView();
  closeListModal();
}

// Set up drag and drop for list items
function setupListDragAndDrop() {
  const container = document.getElementById('list-items');
  const items = container.querySelectorAll('.list-item');

  items.forEach(item => {
    item.addEventListener('dragstart', handleListDragStart);
    item.addEventListener('dragend', handleListDragEnd);
  });

  container.addEventListener('dragover', handleListDragOver);
  container.addEventListener('drop', handleListDrop);
}

function handleListDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.itemId);
  e.target.classList.add('dragging');
}

function handleListDragEnd(e) {
  e.target.classList.remove('dragging');
}

function handleListDragOver(e) {
  e.preventDefault();
  const dragging = document.querySelector('.list-item.dragging');
  if (!dragging) return;

  const container = document.getElementById('list-items');
  const afterElement = getListDragAfterElement(container, e.clientY);

  if (afterElement == null) {
    container.appendChild(dragging);
  } else {
    container.insertBefore(dragging, afterElement);
  }
}

function getListDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.list-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleListDrop(e) {
  e.preventDefault();

  // Update order based on DOM order
  const container = document.getElementById('list-items');
  const items = container.querySelectorAll('.list-item');

  items.forEach((element, index) => {
    const itemId = element.dataset.itemId;
    const item = tasks.find(i => i.id === itemId);
    if (item) {
      item.order = index;
    }
  });

  saveTasks();
}

// Navigate list items with keyboard
function navigateListUp() {
  const sortedItems = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  if (sortedItems.length === 0) return;

  if (!selectedListItemId) {
    selectListItem(sortedItems[0].id);
    return;
  }

  const currentIndex = sortedItems.findIndex(i => i.id === selectedListItemId);
  if (currentIndex > 0) {
    selectListItem(sortedItems[currentIndex - 1].id);
  } else {
    selectListItem(sortedItems[sortedItems.length - 1].id);
  }
}

function navigateListDown() {
  const sortedItems = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  if (sortedItems.length === 0) return;

  if (!selectedListItemId) {
    selectListItem(sortedItems[0].id);
    return;
  }

  const currentIndex = sortedItems.findIndex(i => i.id === selectedListItemId);
  if (currentIndex < sortedItems.length - 1) {
    selectListItem(sortedItems[currentIndex + 1].id);
  } else {
    selectListItem(sortedItems[0].id);
  }
}

// Open selected list item's URL
function openSelectedListItemUrl() {
  if (!selectedListItemId) return;
  const item = tasks.find(i => i.id === selectedListItemId);
  if (item && item.url && item.url.trim()) {
    window.open(item.url, '_blank');
  }
}

// List modal event handlers
document.getElementById('list-modal').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeListModal();
  } else if (e.key === 'Enter' && !e.shiftKey && e.target.id !== 'list-tag-input') {
    e.preventDefault();
    saveListItem();
  }
});

document.getElementById('list-modal').addEventListener('click', (e) => {
  if (e.target.id === 'list-modal') {
    closeListModal();
  }
});

// List tag input event handlers
document.getElementById('list-tag-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const value = e.target.value.trim();
    if (value) {
      addListTag(value);
    }
  } else if (e.key === 'Backspace' && e.target.value === '' && currentListTags.length > 0) {
    removeListTag(currentListTags[currentListTags.length - 1]);
  }
});

document.getElementById('list-tag-input').addEventListener('input', (e) => {
  showListTagSuggestions(e.target.value);
});

document.getElementById('list-tag-input').addEventListener('blur', () => {
  setTimeout(hideListTagSuggestions, 200);
});

// Initialize the app
loadTasks();
loadContainers();
setupDropZones();
initializeView();

// Load last saved time from localStorage (indicator hidden by default, shows on save)
const savedTime = localStorage.getItem(STORAGE_KEYS.LAST_SAVED);
if (savedTime) {
  lastSavedTime = new Date(savedTime);
}

// Update timestamp display every minute
setInterval(refreshSyncTimestamp, 60000);

// Set initial column focus
setTimeout(() => {
  if (!selectedTaskId && getContainerItems().length > 0) {
    // Find first column with items
    for (let i = 0; i < COLUMN_NAMES.length; i++) {
      const columnTasks = getColumnTasksInOrder(COLUMN_NAMES[i]);
      if (columnTasks.length > 0) {
        selectedColumn = i;
        break;
      }
    }
  }
}, 100);

// Pomodoro Timer
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroRunning = false;
let pomodoroSelectedMinutes = 25;
let pomodoroStartedAt = null; // Timestamp when timer was started

// Pomodoro State Persistence
function savePomodoroState() {
  const state = {
    selectedMinutes: pomodoroSelectedMinutes,
    running: pomodoroRunning,
    startedAt: pomodoroStartedAt,
    pausedSecondsRemaining: pomodoroRunning ? null : pomodoroSeconds
  };
  localStorage.setItem('pomodoroState', JSON.stringify(state));
}

function loadPomodoroState() {
  try {
    const state = JSON.parse(localStorage.getItem('pomodoroState'));
    if (!state) return;

    pomodoroSelectedMinutes = state.selectedMinutes || 25;

    if (state.running && state.startedAt) {
      // Timer was running - calculate remaining time
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);

      if (pomodoroSeconds > 0) {
        // Resume running
        pomodoroStartedAt = state.startedAt;
        pomodoroRunning = true;
        startPomodoroInterval();
        const widget = document.getElementById('pomodoro-widget');
        widget.classList.add('running');
        updateStartButton(true);
      } else {
        // Timer completed while away - award tomato and reset
        if (pomodoroSelectedMinutes === 25) {
          incrementTomato();
        }
        pomodoroComplete();
        pomodoroSeconds = pomodoroSelectedMinutes * 60;
        pomodoroRunning = false;
        pomodoroStartedAt = null;
      }
    } else if (state.pausedSecondsRemaining !== null) {
      // Timer was paused
      pomodoroSeconds = state.pausedSecondsRemaining;
      pomodoroRunning = false;
      if (pomodoroSeconds < pomodoroSelectedMinutes * 60) {
        const widget = document.getElementById('pomodoro-widget');
        widget.classList.add('paused');
      }
    }

    // Update preset button UI
    document.querySelectorAll('.pomodoro-preset').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.minutes) === pomodoroSelectedMinutes);
    });

    // Update display with restored state
    updatePomodoroDisplay();
  } catch (e) {
    console.log('Could not load pomodoro state:', e);
  }
}

function clearPomodoroState() {
  localStorage.removeItem('pomodoroState');
}

// Daily Tomatoes Tracking
function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // "2025-12-29"
}

function loadDailyTomatoes() {
  try {
    const data = JSON.parse(localStorage.getItem('dailyTomatoes') || '{}');
    return data[getTodayKey()] || 0;
  } catch (e) {
    return 0;
  }
}

function saveDailyTomatoes(count) {
  try {
    const data = JSON.parse(localStorage.getItem('dailyTomatoes') || '{}');
    const today = getTodayKey();
    data[today] = count;
    // Clean up old entries (keep last 30 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    Object.keys(data).forEach(key => {
      if (new Date(key) < cutoff) delete data[key];
    });
    localStorage.setItem('dailyTomatoes', JSON.stringify(data));
  } catch (e) {
    console.log('Could not save tomatoes:', e);
  }
}

function incrementTomato() {
  const count = loadDailyTomatoes() + 1;
  saveDailyTomatoes(count);
  updateTomatoDisplay(true);
}

function updateTomatoDisplay(isNew = false) {
  const container = document.getElementById('pomodoro-tomatoes');
  if (!container) return;

  const count = loadDailyTomatoes();

  if (count === 0) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
    // Show up to 8 tomato icons, then show count
    const maxIcons = 8;
    const iconsToShow = Math.min(count, maxIcons);
    let html = '<span class="pomodoro-tomatoes-label">Today:</span><span class="pomodoro-tomatoes-icons">';
    for (let i = 0; i < iconsToShow; i++) {
      const isLastAndNew = isNew && i === iconsToShow - 1;
      html += `<span class="pomodoro-tomato${isLastAndNew ? ' new' : ''}">🍅</span>`;
    }
    html += '</span>';
    if (count > maxIcons) {
      html += `<span class="pomodoro-tomatoes-count">+${count - maxIcons}</span>`;
    }
    container.innerHTML = html;
  }
}

function updatePomodoroDisplay() {
  const display = document.getElementById('pomodoro-display');
  const minutes = Math.floor(pomodoroSeconds / 60);
  const seconds = pomodoroSeconds % 60;
  display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function togglePomodoroExpand() {
  const widget = document.getElementById('pomodoro-widget');
  widget.classList.toggle('collapsed');
  localStorage.setItem('pomodoroCollapsed', widget.classList.contains('collapsed'));
}

function loadPomodoroCollapsedState() {
  const collapsed = localStorage.getItem('pomodoroCollapsed') === 'true';
  if (collapsed) {
    document.getElementById('pomodoro-widget').classList.add('collapsed');
  }
}

function setPomodoroTime(minutes) {
  pomodoroSelectedMinutes = minutes;
  pomodoroSeconds = minutes * 60;
  pomodoroRunning = false;
  pomodoroStartedAt = null;
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;

  // Update UI
  const widget = document.getElementById('pomodoro-widget');
  widget.classList.remove('running', 'paused');

  // Update preset buttons
  document.querySelectorAll('.pomodoro-preset').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
  });

  // Update start button to play icon
  updateStartButton(false);
  updatePomodoroDisplay();
  savePomodoroState();
}

function updateStartButton(isRunning) {
  const btn = document.getElementById('pomodoro-start-btn');
  if (isRunning) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>`;
  }
}

function playPomodoroSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'start') {
      // Rising tone for start
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.15);
    } else {
      // Falling tone for pause
      oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(350, audioContext.currentTime + 0.15);
    }

    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.log('Audio not supported');
  }
}

function startPomodoroInterval() {
  if (pomodoroInterval) clearInterval(pomodoroInterval);

  pomodoroInterval = setInterval(() => {
    // Calculate remaining time from timestamp (handles background tabs)
    if (pomodoroStartedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroStartedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);
    }

    updatePomodoroDisplay();

    if (pomodoroSeconds <= 0) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroRunning = false;
      pomodoroStartedAt = null;
      const widget = document.getElementById('pomodoro-widget');
      widget.classList.remove('running');
      updateStartButton(false);
      savePomodoroState();
      pomodoroComplete();
    }
  }, 1000);
}

function togglePomodoro() {
  const widget = document.getElementById('pomodoro-widget');

  if (pomodoroRunning) {
    // Pause - calculate remaining seconds first
    if (pomodoroStartedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroStartedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);
    }
    pomodoroRunning = false;
    pomodoroStartedAt = null;
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    widget.classList.remove('running');
    widget.classList.add('paused');
    updateStartButton(false);
    playPomodoroSound('pause');
    savePomodoroState();
  } else {
    // Start
    if (pomodoroSeconds <= 0) {
      pomodoroSeconds = pomodoroSelectedMinutes * 60;
    }
    // Calculate startedAt based on remaining seconds
    pomodoroStartedAt = Date.now() - ((pomodoroSelectedMinutes * 60 - pomodoroSeconds) * 1000);
    pomodoroRunning = true;
    widget.classList.remove('paused');
    widget.classList.add('running');
    updateStartButton(true);
    playPomodoroSound('start');
    savePomodoroState();
    startPomodoroInterval();
  }
}

function resetPomodoro() {
  pomodoroRunning = false;
  pomodoroStartedAt = null;
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroSeconds = pomodoroSelectedMinutes * 60;

  const widget = document.getElementById('pomodoro-widget');
  widget.classList.remove('running', 'paused');
  updateStartButton(false);
  updatePomodoroDisplay();
  savePomodoroState();
}

function pomodoroComplete() {
  // Award tomato only for 25-minute pomodoros
  if (pomodoroSelectedMinutes === 25) {
    incrementTomato();
  }

  // Play notification sound
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 800;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.5);
    }, 600);
  } catch (e) {
    console.log('Audio not supported');
  }

  // Show notification if permitted
  const tomatoCount = loadDailyTomatoes();
  const notifBody = pomodoroSelectedMinutes === 25
    ? `Time for a break! 🍅 ${tomatoCount} today`
    : 'Break complete!';

  if (Notification.permission === 'granted') {
    new Notification('Pomodoro Complete!', {
      body: notifBody,
      icon: 'icons/icon-192.png'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Initialize pomodoro after widget is in DOM
(function initPomodoro() {
  updatePomodoroDisplay();
  updateTomatoDisplay();
  loadPomodoroState();
  loadPomodoroCollapsedState();

  // Update display after state is loaded
  updatePomodoroDisplay();

  // Update timer immediately when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pomodoroRunning && pomodoroStartedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroStartedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);
      updatePomodoroDisplay();

      if (pomodoroSeconds <= 0) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroRunning = false;
        pomodoroStartedAt = null;
        const widget = document.getElementById('pomodoro-widget');
        widget.classList.remove('running');
        updateStartButton(false);
        savePomodoroState();
        pomodoroComplete();
      }
    }
  });
})();
