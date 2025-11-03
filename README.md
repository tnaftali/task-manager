# Tobi's Task Manager

A beautiful, modern task management application built with vanilla HTML, CSS, and JavaScript. Features a clean beige/cream theme, drag-and-drop functionality, and comprehensive keyboard navigation.

## ✨ Features

- Three-column Kanban board (To Do, In Progress, Done)
- Drag & drop task management
- Smart URL paste (auto-fetches page titles)
- Rich task details (URLs, tags, notes, timestamps)
- Time tracking and completion duration
- Task hold/resume functionality
- Keyboard navigation and shortcuts
- Collapsible columns
- Tag autocomplete
- Personalizable app name

## 🚀 Getting Started

### Recommended: Server Mode (with file persistence)

1. Run the Python server:
   ```bash
   python3 server.py
   ```
   Or: `python server.py`

2. Open `http://localhost:8765` in your web browser

3. Start adding tasks! All data is saved to `tasks.json` on disk

The server provides real file-based persistence, allowing data to be saved and loaded from disk instead of just browser storage.

### Alternative: File Mode (browser-only)

1. Open `index.html` directly in your web browser
2. Data is stored in browser's localStorage (not synced across devices)

**Note**: Server mode is recommended as it provides proper file persistence.

## 📝 Adding Tasks

**Manual creation**: Click "+ Add Task" in any column and fill in the details (title, URL, tags, notes, start time).

**Quick paste**: Copy any URL and paste (`Cmd+V` / `Ctrl+V`) anywhere in the app to auto-create a task with the page title.

**Personalize name**: Click "Edit" next to the app title to customize it.

## ⌨️ Keyboard Shortcuts

- `↑/↓` - Navigate tasks
- `←/→` - Switch columns
- `Shift + ↑/↓` - Move task within column
- `Shift + ←/→` - Move task between columns
- `Enter` - Edit selected task
- `N` - New task
- `Delete/Backspace` - Delete task
- `Escape` - Close modal/cancel
- `Cmd+V` / `Ctrl+V` - Paste URL to create task

## 🎯 Task Management

- **Edit**: Double-click or press `Enter` on selected task
- **Delete**: Click delete button (🗑️) or press `Delete/Backspace`
- **Hold/Resume**: Click hold button (⏸/▶️) to pause tasks
- **Time tracking**: Set start time when creating/editing tasks; completed tasks show duration
- **Tags**: Type and press `Enter` to add; autocomplete suggestions appear

## 📅 Done Column

Tasks moved to "Done" get completion timestamps and are grouped by date. Done tasks can be moved back to other columns or edited, but cannot be reordered (preserves chronological history).

## 💾 Data Persistence

**Server mode** (recommended): All data is saved to `tasks.json` on disk, providing real file persistence. Data persists even if you clear browser storage.

**File mode**: Data is saved to your browser's local storage and persists between sessions, but won't sync across devices.

All data (tasks, order, column states, app name) is automatically saved.

## 🎨 Design

Modern beige/cream color scheme with subtle column differentiation. Uses Fraunces serif for titles and Inter sans-serif for UI elements.

## 🔧 Technical

- Vanilla HTML, CSS, JavaScript (no dependencies)
- Google Fonts (Inter, Fraunces) via CDN
- Python 3 server for file persistence (optional, recommended)
- localStorage fallback for browser-only mode
- PWA support with service worker
- Modern browsers with ES6+ support

---

**Enjoy organizing your tasks!** 🎉
