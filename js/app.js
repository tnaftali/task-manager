// ===========================================
// APP STATE (UI-specific state, storage state is in storage.js)
// ===========================================
let selectedTaskId = null;
let currentEditingTask = null;
let currentColumn = STATUS.TODO;
let currentTags = [];
let selectedColumn = 0; // 0=todo, 1=in-progress, 2=done
let allTags = new Set();
let tagSuggestions = [];

// List view state
let selectedListItemId = null;
let currentEditingListItem = null;
let currentListTags = [];

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

  // Apply filters (shared with list view)
  containerItems = filterBySearch(containerItems);
  containerItems = filterByTags(containerItems);

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

  // Render tag filters
  renderTagFilters();

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
  const hasFilters = activeTagFilters.size > 0 || searchQuery;

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
    const message = searchQuery && activeTagFilters.size > 0
      ? 'No tasks match your search and filters'
      : searchQuery
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

// Close filter dropdowns when clicking outside
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

// Initialize pomodoro timer (defined in pomodoro.js)
initPomodoro();
