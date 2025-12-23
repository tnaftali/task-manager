# Google Calendar Sidebar Integration Plan

## Overview
Add a toggleable sidebar to the task manager that displays Google Calendar events in an agenda-style list view.

**Simplified MVP Approach:**
- Single Google account support
- No caching (always fetch fresh)
- No account management UI (just sign in/out)
- Simple chronological list (no fancy grouping)
- Client-side implementation using Google JavaScript library

---

## Architecture

### Tech Stack
- **Google Identity Services** (OAuth 2.0)
- **Google Calendar API v3**
- **Client-side only** (no backend changes initially)
- **localStorage** for token storage

### Data Flow
```
User clicks "Sign in with Google"
  → OAuth popup
  → Get access token
  → Store in localStorage
  → Fetch calendar events
  → Display in sidebar
```

---

## Implementation Phases

### Phase 1: Google API Setup & Authentication

#### 1.1 Prerequisites (Done before coding)
- [x] Create Google Cloud project
- [x] Enable Google Calendar API
- [x] Configure OAuth consent screen
- [x] Create OAuth Client ID
- [x] Add authorized JavaScript origins

#### 1.2 Load Google Libraries
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://apis.google.com/js/api.js"></script>
```

#### 1.3 Authentication Implementation
- Initialize Google Identity Services
- "Sign in with Google" button
- Handle OAuth callback
- Store access token in localStorage
- Handle token expiration/refresh
- "Sign out" functionality

**Data Structure:**
```javascript
{
  email: 'user@gmail.com',
  accessToken: '...',
  expiresAt: timestamp
}
```

---

### Phase 2: UI Structure (Sidebar Layout)

#### 2.1 HTML Structure
```
.container
  └── .content-wrapper (new wrapper)
       ├── .board (existing task columns)
       └── .calendar-sidebar
            ├── .sidebar-header
            │    ├── Title
            │    ├── Toggle collapse button
            │    └── Sign in/out button
            └── .sidebar-events
                 └── Event list (scrollable)
```

#### 2.2 CSS Styling Requirements
- **Width**: ~320-360px when open
- **Collapsed**: Thin strip with toggle button
- **Colors**: Match existing beige/cream theme
  - Background: `var(--surface)` or similar
  - Borders: `var(--border)`
  - Text: `var(--text-primary)`, `var(--text-secondary)`
- **Transitions**: Smooth slide in/out
- **Scrolling**: Events list scrollable independently
- **Responsive**:
  - Desktop: Side-by-side with board
  - Mobile: Full overlay when open

#### 2.3 Toggle Functionality
- Button to show/hide sidebar
- State saved to localStorage: `calendarSidebarOpen`
- Smooth animation
- Optional keyboard shortcut (e.g., `Ctrl/Cmd + K`)

---

### Phase 3: Calendar Integration

#### 3.1 Fetch Events Function
```javascript
async function fetchCalendarEvents(accessToken) {
  // Google Calendar API v3
  // GET https://www.googleapis.com/calendar/v3/calendars/primary/events
  // Parameters:
  //   - timeMin: now (ISO 8601)
  //   - timeMax: 30 days from now
  //   - orderBy: startTime
  //   - singleEvents: true (expand recurring)
  //   - maxResults: 50
  // Returns: Array of event objects
}
```

#### 3.2 Event Data Structure
Each event has:
- `summary` (title)
- `start.dateTime` or `start.date` (for all-day)
- `end.dateTime` or `end.date`
- `location` (optional)
- `htmlLink` (link to Google Calendar)
- `description` (optional)

#### 3.3 Refresh Strategy
- Manual refresh button
- No automatic refresh (keep it simple)
- Show loading state while fetching

---

### Phase 4: Event Display (Agenda View)

#### 4.1 Simple List Display
- Events sorted chronologically
- Show next 30 days
- Simple date headers when day changes

#### 4.2 Event Card Design
```
┌─────────────────────────┐
│ Monday, Jan 15          │  ← Date header (when day changes)
├─────────────────────────┤
│ 9:00 AM - 10:00 AM     │  ← Time range
│ Team Standup            │  ← Event title
│ 📍 Conference Room A    │  ← Location (if present)
│ [View in Calendar →]    │  ← Link to Google Calendar
└─────────────────────────┘
```

#### 4.3 Visual Elements
- **Time formatting**:
  - Today: "9:00 AM - 10:00 AM"
  - Other days: Include date
  - All-day events: "All day"
- **Styling**:
  - Card per event
  - Match task card styling
  - Border, rounded corners, hover effects
  - Icon for location if present
- **Empty state**: "No upcoming events" message
- **Error state**: Friendly error message

---

### Phase 5: Polish & Details

#### 5.1 Error Handling
- **Token expired**: Show "Sign in again" message
- **API errors**: Show user-friendly error
- **Network errors**: Show retry option
- **No permissions**: Guide user to grant access

#### 5.2 Loading States
- Spinner/skeleton while fetching events
- Disable buttons during operations
- Visual feedback for all actions

#### 5.3 Sign Out
- Clear localStorage
- Clear displayed events
- Show sign-in screen

#### 5.4 Responsive Design
- **Desktop (>1024px)**: Sidebar alongside board
- **Tablet (768-1024px)**: Narrower sidebar or overlay
- **Mobile (<768px)**: Full-screen overlay when open

---

## File Structure

All changes in `index.html`:
1. Add `<script>` tags for Google libraries
2. Add sidebar HTML structure
3. Add CSS for sidebar (within existing `<style>` tag)
4. Add JavaScript functions (within existing `<script>` tag):
   - Google Auth initialization
   - Sign in/out handlers
   - Fetch events function
   - Render events function
   - Sidebar toggle function

---

## Implementation Order

### Step 1: Basic Sidebar UI (Empty)
- Add HTML structure
- Add CSS styling
- Implement toggle open/close
- Test responsive behavior

### Step 2: Google Sign-In
- Add Google libraries
- Initialize Google Identity Services
- Implement sign-in button
- Store token in localStorage
- Implement sign-out

### Step 3: Fetch & Display Events
- Implement fetch function
- Parse event data
- Create event card rendering
- Display in sidebar
- Handle loading/error states

### Step 4: Polish
- Improve styling to match design
- Add icons and visual touches
- Test edge cases
- Mobile responsive testing

---

## Estimated Effort

- **Google setup**: 30 min (done before coding)
- **Sidebar UI**: 1 hour
- **Auth implementation**: 2 hours
- **Event fetching/display**: 2 hours
- **Polish & testing**: 1 hour

**Total: ~6 hours**

---

## Future Enhancements (Not in MVP)

- Multi-account support
- Event caching
- Account management UI
- Fancy grouping (Today, Tomorrow, This Week)
- Create events from task manager
- Sync tasks with calendar events
- Filter by calendar
- Color-coding by calendar
- Week/month view toggle

---

## Prerequisites Checklist

Before starting implementation:
- [ ] Google Cloud project created
- [ ] Google Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth Client ID created
- [ ] Client ID copied and ready
- [ ] Authorized JavaScript origins added (localhost:3000, etc.)

---

## Notes

- Client ID is safe to include in client-side code (it's public)
- App will be in "Testing" mode initially (limited to test users)
- Can publish later for broader access
- No backend changes required for MVP
- All sensitive data (tokens) stored in localStorage only
