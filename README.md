# Flow

A minimal, beautiful task management app with List and Board views. Built with vanilla HTML, CSS, and JavaScript.

## Features

**Two Views**
- **List** - Simple checklist with active/completed sections
- **Board** - Kanban-style with To Do, In Progress, and Done columns

**Task Management**
- Create tasks with title, URL, tags, and notes
- Drag and drop to reorder or change status
- Put tasks on hold (visual indicator)
- Smart URL paste (auto-fetches page titles)
- Tag filtering and search

**Containers**
- Organize tasks into separate containers
- Switch between containers in either view
- Drag to reorder containers

**Pomodoro Timer**
- Built-in focus timer (25/5/15 minute presets)
- Daily tomato count tracking
- Desktop notifications on completion

**Keyboard Shortcuts**
| Key | Action |
|-----|--------|
| `N` | New task |
| `↑` `↓` | Navigate tasks |
| `←` `→` | Switch columns (Board) |
| `Shift + ↑` `↓` | Reorder task |
| `Shift + ←` `→` | Move between columns (Board) |
| `Enter` | Edit task / Open URL (List) |
| `E` | Edit task (List) |
| `Delete` | Delete task |
| `Esc` | Close modal |
| `Cmd/Ctrl + V` | Paste URL to create task |

## Getting Started

**Option 1: Direct file access**
```
Open index.html in your browser
```

**Option 2: Local server (recommended for PWA features)**
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Data is stored in browser localStorage.

## Project Structure

```
flow/
├── index.html          # App markup
├── css/styles.css      # All styles
├── js/app.js           # Application logic
├── manifest.json       # PWA manifest
└── service-worker.js   # Offline support
```

## Tech

- Vanilla HTML, CSS, JavaScript (no dependencies)
- CSS custom properties for theming
- Fraunces font for headings
- PWA with service worker
