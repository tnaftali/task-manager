# Tobi's Task Manager

A beautiful, modern task management application built with vanilla HTML, CSS, and JavaScript. Features a clean Catppuccin Mocha dark theme, drag-and-drop functionality, and comprehensive keyboard navigation.

## ✨ Features

- **Three-column Kanban board**: To Do, In Progress, Done
- **Drag & drop**: Reorder tasks within columns and move between columns
- **Smart paste**: Paste any URL to auto-create tasks with fetched page titles
- **Rich task details**: Add titles, URLs, tags, and notes to tasks
- **Date grouping**: Done tasks are automatically grouped by completion date
- **Keyboard navigation**: Full arrow key navigation with task movement shortcuts
- **Collapsible columns**: Click column headers to expand/collapse
- **Local storage**: All data persists between sessions
- **Custom fonts**: DM Serif Text for titles, IBM Plex Sans for UI
- **Responsive design**: Works on different screen sizes

## 🚀 Getting Started

1. Open `index.html` in your web browser
2. Start adding tasks by clicking "+ Add Task" or pasting URLs
3. Organize your workflow using the three columns

## 📝 Adding Tasks

### Method 1: Manual Creation
- Click the "+ Add Task" button in any column
- Fill in the task details:
  - **Title**: Required task name
  - **URL**: Optional link (will be clickable in the task)
  - **Tags**: Type and press Enter to add multiple tags
  - **Notes**: Additional details or context

### Method 2: Smart URL Paste
- Copy any URL to your clipboard
- Press `Cmd+V` (Mac) or `Ctrl+V` (PC) anywhere in the app
- The app will automatically fetch the page title and create a new task
- Edit the title if needed before saving

## 🎯 Managing Tasks

### Moving Tasks Between Columns
- **Drag & drop**: Grab any task and drag it to a different column
- **Keyboard**: Select a task and use `Shift + ←/→` to move between columns

### Reordering Within Columns
- **Drag & drop**: Drag tasks up/down within To Do or In Progress columns
- **Keyboard**: Use `Shift + ↑/↓` to move tasks within the current column
- **Note**: Done column tasks cannot be reordered (they're sorted by completion date)

### Editing Tasks
- **Double-click** any task to edit
- **Click** the edit button (✏️) on task hover
- **Keyboard**: Select a task and press `Enter`

### Deleting Tasks
- **Click** the delete button (🗑️) on task hover
- **Keyboard**: Select a task and press `Delete` or `Backspace`

## ⌨️ Keyboard Navigation

### Basic Navigation
- `↑/↓` - Move selection up/down within current column
- `←/→` - Switch between columns and select first task
- `Enter` - Edit selected task
- `Delete/Backspace` - Delete selected task
- `N` - Create new task in current column
- `Escape` - Close modal/cancel editing

### Task Movement (with Shift)
- `Shift + ↑/↓` - Move task up/down within column (To Do/In Progress only)
- `Shift + ←/→` - Move task between columns (works from any column including Done)

### Quick Actions
- `Cmd+V` / `Ctrl+V` - Paste URL to create new task with auto-fetched title
- `Double-click` - Edit any task
- Click column header - Collapse/expand column

### Modal Controls
- `Enter` - Save task (except in notes/tags textarea where it creates new lines)
- `Cmd+Enter` / `Ctrl+Enter` - Save task (works anywhere in modal)
- `Escape` - Cancel and close modal
- Click outside modal - Close modal
- `Enter` in tags field - Add new tag
- `Backspace` in empty tags field - Remove last tag

## 🏷️ Tags System

- Type tag names in the tags field and press `Enter` to add
- Use `Backspace` when the field is empty to remove the last tag
- Click the `×` button on any tag to remove it
- Tags are displayed as colored chips on tasks

## 📅 Done Column Behavior

- Tasks moved to "Done" automatically get a completion timestamp
- Completed tasks are grouped by date (Today, Yesterday, or specific dates)
- Within each date group, tasks are sorted by completion time (newest first)
- **Done tasks cannot be reordered** within the Done column (preserves chronological history)
- **Done tasks can be moved back** to To Do or In Progress columns (drag & drop or Shift+arrows)
- **Done tasks can still be edited** (double-click, edit button, or keyboard selection + Enter)
- Completion timestamps are automatically removed when moving tasks out of Done

## 🎨 Column Management

- **Collapse/Expand**: Click any column header to hide/show its contents
- **Column state**: Collapsed state is saved and persists between sessions
- **Visual indicator**: Arrow in header shows collapse state

## 💾 Data Persistence

All your tasks, settings, and column states are automatically saved to your browser's local storage:
- Task details (title, URL, tags, notes, completion status)
- Task order within columns
- Column collapsed/expanded states
- Completion timestamps for done tasks

**Note**: Data is stored locally in your browser. It won't sync across devices, but it will persist even after closing the browser.

## 🎨 Design & Theming

The app uses the **Catppuccin Mocha** color scheme:
- **Background**: Rich dark blues and grays
- **Accent colors**: Soft pastels for different states
- **Typography**:
  - DM Serif Text for the main title
  - IBM Plex Sans for all UI elements

## 🔧 Technical Details

- **Built with**: Vanilla HTML, CSS, and JavaScript
- **No dependencies**: Works offline, no external libraries
- **Browser compatibility**: Modern browsers with ES6+ support
- **Font requirements**: Fonts are included in the `fonts/` directory
- **Storage**: Uses localStorage for data persistence

## 💡 Tips & Tricks

1. **Quick task creation**: Keep URLs in your clipboard and paste them quickly
2. **Bulk organization**: Use keyboard shortcuts to rapidly move multiple tasks
3. **Focus mode**: Collapse unused columns to focus on current work
4. **Review history**: Check the Done column to see your daily accomplishments
5. **Tag organization**: Use consistent tags to categorize related tasks
6. **Note details**: Add context in notes for complex tasks

## 🛠️ Customization

The app is built with CSS custom properties (variables) making it easy to customize:
- Colors are defined in the `:root` section
- Font families can be changed by updating the `@font-face` declarations
- Layout spacing and sizing use consistent variable naming

## 📱 Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 79+

Features used:
- CSS Grid & Flexbox
- ES6+ JavaScript (arrow functions, template literals, destructuring)
- HTML5 Drag and Drop API
- localStorage API
- Fetch API for URL title fetching

---

**Enjoy organizing your tasks!** 🎉