# Tobi's Task Manager

A beautiful, modern task management application built with vanilla HTML, CSS, and JavaScript. Features a clean beige/cream theme, drag-and-drop functionality, and comprehensive keyboard navigation.

## ✨ Features

- **Personalizable app name**: Edit the title to personalize it for yourself
- **Three-column Kanban board**: To Do, In Progress, Done
- **Drag & drop**: Reorder tasks within columns and move between columns
- **Smart paste**: Paste any URL to auto-create tasks with fetched page titles
- **Rich task details**: Add titles, URLs, tags, notes, and start timestamps to tasks
- **Time tracking**: Track when tasks are started and calculate completion duration
- **Task hold/resume**: Pause tasks with a hold feature for better organization
- **Date grouping**: Done tasks are automatically grouped by completion date
- **Keyboard navigation**: Full arrow key navigation with task movement shortcuts
- **Collapsible columns**: Click column headers to expand/collapse
- **Tag autocomplete**: Smart tag suggestions based on existing tags
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
  - **URL**: Optional link (will be clickable in the task, shows domain name)
  - **Tags**: Type and press Enter to add multiple tags (autocomplete suggestions appear)
  - **Notes**: Additional details or context
  - **Started At**: Optional datetime when work began (click to edit later)

### Method 2: Smart URL Paste
- Copy any URL to your clipboard
- Press `Cmd+V` (Mac) or `Ctrl+V` (PC) anywhere in the app
- The app will automatically fetch the page title and create a new task
- Edit the title if needed before saving

### Personalizing the App Name
- Click the **"Edit"** button next to the app title
- Type your personalized name and press Enter (or Escape to cancel)
- Your custom name is saved and persists across sessions

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

### Putting Tasks on Hold
- **Click** the hold button (⏸) on task hover to pause a task
- **Click** the resume button (▶️) to resume a paused task
- Hold status is visually indicated on the task card

### Time Tracking
- **Start time**: Set an optional "Started At" timestamp when creating or editing tasks
- **Edit start time**: Click on the start time display (📅 Started: ...) to modify or remove it
- **Completion duration**: Completed tasks automatically show how long they took (from start to completion)

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

### Title Editing
- Click "Edit" button next to title to enter edit mode
- `Enter` - Save personalized app name
- `Escape` - Cancel editing and restore previous name

## 🏷️ Tags System

- Type tag names in the tags field and press `Enter` to add
- **Autocomplete suggestions**: Existing tags appear as suggestions while typing
- Use `Backspace` when the field is empty to remove the last tag
- Click the `×` button on any tag to remove it
- Tags are displayed as colored chips on tasks
- All tags across all tasks are collected for consistent suggestions

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

All your data is automatically saved to your browser's local storage:
- **Task details**: Title, URL, tags, notes, completion status, start timestamps, hold status
- **Task order**: Order within columns
- **Column states**: Collapsed/expanded states
- **Completion timestamps**: Automatic timestamps when tasks are moved to Done
- **App name**: Your personalized app name

**Note**: Data is stored locally in your browser. It won't sync across devices, but it will persist even after closing the browser.

## 🎨 Design & Theming

The app uses a modern **beige/cream color scheme**:
- **Background**: Warm beige and cream tones (`#f0ebe3`)
- **Surface colors**: Subtle elevation with light surfaces
- **Accent colors**: Earth tones for different states (browns, muted greens)
- **Column differentiation**: Each column has its own subtle accent color
  - To Do: Warm brown accents
  - In Progress: Muted blue-gray accents
  - Done: Muted green accents
- **Typography**:
  - **Fraunces** (serif) for the main title and headings
  - **Inter** (sans-serif) for all UI elements and body text
- **Icons**: Emoji-based action buttons for an intuitive, friendly interface

## 🔧 Technical Details

- **Built with**: Vanilla HTML, CSS, and JavaScript
- **No dependencies**: Works offline, no external JavaScript libraries
- **Font loading**: Google Fonts (Inter and Fraunces) loaded via CDN
- **Browser compatibility**: Modern browsers with ES6+ support
- **Storage**: Uses localStorage for data persistence
- **PWA support**: Service worker included for offline functionality

## 💡 Tips & Tricks

1. **Quick task creation**: Keep URLs in your clipboard and paste them quickly
2. **Bulk organization**: Use keyboard shortcuts to rapidly move multiple tasks
3. **Focus mode**: Collapse unused columns to focus on current work
4. **Review history**: Check the Done column to see your daily accomplishments and time spent
5. **Tag organization**: Use consistent tags to categorize related tasks (autocomplete helps)
6. **Note details**: Add context in notes for complex tasks
7. **Time tracking**: Set start times when beginning work to track how long tasks take
8. **Hold feature**: Use the hold button to temporarily pause tasks without losing context
9. **Personalization**: Change the app name to make it your own

## 🛠️ Customization

The app is built with CSS custom properties (variables) making it easy to customize:
- Colors are defined in the `:root` section with semantic names
- Font families can be changed by updating the `font-family` properties (currently Google Fonts via CDN)
- Layout spacing and sizing use consistent variable naming

## 📱 Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 79+

Features used:
- CSS Grid & Flexbox for layout
- ES6+ JavaScript (arrow functions, template literals, destructuring, async/await)
- HTML5 Drag and Drop API
- localStorage API
- Fetch API for URL title fetching
- Service Worker API for PWA support
- CSS Custom Properties (variables) for theming

---

**Enjoy organizing your tasks!** 🎉
