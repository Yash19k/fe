# TaskFlow Pro — System Architecture Guide (`ARCHITECTURE_GUIDE.md`)

This document details the architectural foundation of **TaskFlow Pro**: how the code executes from the moment the browser requests the page, how routing and navigation operate without a backend server, how state is centralized and persisted, and how components interact.

---

## 1. Application Bootstrap Sequence

The diagram below illustrates the exact startup and bootstrap execution chain:

```
index.html
  │
  ▼  Loads Google Fonts ('Inter') & executes script tag:
src/main.tsx
  │
  ▼  Initializes React 19 root in #root with <StrictMode>:
src/App.tsx  (renders <AppProvider>)
  │
  ▼  Executes AppProvider startup logic:
src/state/AppContext.tsx
  │
  ├─ 1. Executes loadInitialState() in src/state/storage.ts
  │     ├─ Reads localStorage keys ('taskflow_*_v2')
  │     ├─ Falls back to seedData.ts if localStorage is empty or corrupted
  │     └─ Runs non-destructive data migrations (tasks, projects, workflows)
  │
  ├─ 2. Initializes local navigation state from window.location.hash
  │     └─ Attaches 'hashchange' window event listener
  │
  ├─ 3. Attaches BroadcastChannel listener for multi-tab synchronization
  │
  ▼  Renders Application Shell:
src/App.tsx  (<MainAppShell>)
  │
  ├─ Renders 3-Column Layout:
  │    ├─ GlobalRail (Far Left)
  │    ├─ WorkspaceSidebar (Collapsible Middle Column)
  │    └─ Main Content Area (Topbar + ProjectHeader + Route View)
  │
  └─ Mounts Global Drawers & Modals:
       ├─ TaskDetailsDrawer
       ├─ CreateTaskModal
       ├─ CreateProjectModal
       ├─ GlobalSearchModal
       ├─ ImpactPreviewModal
       ├─ ConflictModal
       └─ ToastContainer
```

### Detailed Step-by-Step Breakdown:

1. **`index.html`:**
   - Defines the HTML5 skeleton, page title (`TaskFlow Pro`), and preconnects to Google Fonts (`Inter` 400, 500, 600, 700).
   - Contains a single mounting container: `<div id="root"></div>`.
   - Imports the entry point: `<script type="module" src="/src/main.tsx"></script>`.

2. **`src/main.tsx`:**
   - Imports `./index.css` (Tailwind CSS v4 styling rules and CSS variables).
   - Uses `createRoot(document.getElementById('root')!)` to mount `<App />` wrapped in `<StrictMode>`.

3. **`src/App.tsx` (`App` and `MainAppShell`):**
   - The top-level export `App` wraps `MainAppShell` in `<AppProvider>` (`src/state/AppContext.tsx`).
   - Ensures all child components have immediate access to the global application state via the `useApp()` hook.

4. **`src/state/AppContext.tsx` (State Hydration & Listeners):**
   - On the very first render, `useMemo(() => loadInitialState(), [])` is executed synchronously.
   - It checks `localStorage` for 7 specific keys (`STORAGE_KEYS`).
   - If keys exist, it parses the JSON and runs schema migrations (`migrateTasks`, `migrateProjects`, `migrateWorkflows`).
   - If `localStorage` is empty or parsing fails, it safely falls back to rich default mock data from `src/data/seedData.ts`.
   - Sets up automatic synchronization: 7 dedicated `useEffect` hooks re-save state slices to `localStorage` whenever state changes.
   - Listens to the browser `hashchange` event to keep `activeRoute`, `currentProjectId`, and `projectTab` in sync with the URL.
   - Connects to the browser's native `BroadcastChannel` (`taskflow_pro_sync_channel`) for cross-tab event handling.

---

## 2. Client-Side Hash Routing Architecture

TaskFlow Pro uses **hash-based routing** (`window.location.hash`) instead of HTML5 History API pushState.

### Why Hash Routing?
- **Zero Server Configuration Required:** Because there is no backend server (like Nginx, Express, or Apache) to rewrite unknown paths back to `index.html`, standard path routing (`/project/1/board`) would result in a `404 Not Found` if a user refreshed the page.
- **Refresh-Proof:** Hash routes (`http://localhost:5173/#/project/proj-1/board`) are purely client-side; the browser never sends the hash fragment to the web server.

### Route Mapping Table:

| URL Hash Route | Condition / Guard | Rendered View Component | Description |
| :--- | :--- | :--- | :--- |
| `#/login` | Direct route | `AuthView (isSignup=false)` | Mock login screen with pre-filled demo accounts. |
| `#/signup` | Direct route | `AuthView (isSignup=true)` | Mock registration screen. |
| `#/onboarding/company` | `!currentUser.onboardingCompleted` | `CompanySetupView` | Workspace setup wizard for new users. |
| `#/` or `#/home` | Default root route | `HomeView` | Workspace overview, greeting, recent projects & tasks. |
| `#/my-tasks` | Direct route | `MyTasksView` | Work items assigned to the current logged-in user. |
| `#/projects` | Direct route | `ProjectsView` | Grid/card roster of all accessible projects. |
| `#/settings` | Direct route | `SettingsView` | Workspace, account, and demo data reset settings. |
| `#/project/:id/overview` | `isProjectRoute` & accessible | `ProjectOverviewView` | Key project stats, description, members, and milestones. |
| `#/project/:id/list` | `isProjectRoute` & accessible | `ProjectListView` | Status-grouped work items table. |
| `#/project/:id/board` | `isProjectRoute` & accessible | `ProjectBoardView` | Kanban columns with strict 7-status default order. |
| `#/project/:id/timeline` | `isProjectRoute` & accessible | `ProjectTimelineView` | Interactive Gantt-style schedule view. |
| `#/project/:id/calendar` | `isProjectRoute` & accessible | `ProjectCalendarView` | Monthly calendar grid with Day Details dialog. |
| `#/project/:id/dashboard` | `isProjectRoute` & accessible | `ProjectDashboardView` | Project health metrics, charts, and deliverables progress. |
| `#/project/:id/workflow` | `isProjectRoute` & accessible | `WorkflowBuilderView` | Status transition rules & role restriction manager. |
| `#/project/:id/dependencies` | `isProjectRoute` & accessible | `DependenciesView` | Finish-to-Start dependency graph & CPM critical path. |
| `#/project/:id/members` | `isProjectRoute` & accessible | `ProjectMembersView` | Project team roster and role assignments. |
| `#/project/:id/activity` | `isProjectRoute` & accessible | `ProjectActivityView` | Project-scoped immutable audit trail with Undo support. |
| `#/project/:id/settings` | `isProjectRoute` & accessible | `ProjectSettingsView` | Rename, unique Project Key edit, visibility, and delete. |

### Access Control Guard:
In `src/App.tsx` (lines 74-76, 119-136):
```tsx
const isProjectRoute = activeRoute.startsWith('/project/');
const hasProjectAccess = currentProject ? canUserAccessProject(currentProject, currentUser.id) : true;
```
If a project is marked `visibility: 'private'` and the logged-in user is neither the project owner nor an explicitly added member in `project.memberIds`, the app intercepts rendering and shows an access-restricted state with a lock icon instead of rendering project data.

---

## 3. UI Layout & Shell Hierarchy

The application shell implements a cohesive, compact 3-column architecture designed for maximum information density:

```
┌──────────┬──────────────────────┬────────────────────────────────────────────────────────┐
│ Global   │ Workspace Sidebar    │ Topbar (Search, Multi-Tab Sync, Notifications, Profile) │
│ Rail     ├──────────────────────┼────────────────────────────────────────────────────────┤
│ (60px)   │ Workspace Name       │ ProjectHeader (Tabs: Overview, List, Board, etc.)       │
│          │                      ├────────────────────────────────────────────────────────┤
│ • Home   │ • Projects Accordion │                                                        │
│ • Tasks  │   ├─ Project Alpha   │                                                        │
│ • Projs  │   └─ Project Beta    │                 Active View Content                    │
│ • Gear   │                      │        (Table, Kanban, Calendar, Dashboard, etc.)       │
│          │ • Starred Favorites  │                                                        │
│ • User   │                      │                                                        │
│   Avatar │ • Demo Reset Button  │                                                        │
└──────────┴──────────────────────┴────────────────────────────────────────────────────────┘
```

1. **`GlobalRail` (`src/components/navigation/GlobalRail.tsx`):**
   - Slim vertical left rail (fixed width `w-14` / 56px).
   - Contains high-level company branding icon, primary route icons (Home, My Tasks, Projects, Workspace Settings), and a live user-switching avatar at the bottom that allows testing Admin, Manager, and Teammate roles with one click.

2. **`WorkspaceSidebar` (`src/components/navigation/WorkspaceSidebar.tsx`):**
   - Collapsible middle navigation column (`w-60` / 240px).
   - Contains workspace name badge, "New Project" quick trigger, active project tree with colored status dots, and a "Reset Demo Data" action.

3. **`Topbar` (`src/components/navigation/Topbar.tsx`):**
   - Top horizontal bar across the main content area.
   - Hosts global search button (`Cmd+K` trigger), multi-tab synchronization pulse indicator, notifications bell with unread badge count, and user profile summary.

4. **`ProjectHeader` (`src/components/navigation/ProjectHeader.tsx`):**
   - Persistently rendered whenever the user is inside a `/project/:id/*` route.
   - Shows project color tag, project name, editable/copyable project key, visibility badge (`Global` vs `Private`), interactive member avatar stack (which navigates to `/members` when clicked), and tab navigation for all 11 project views.

---

## 4. State Management: The React Context Model

TaskFlow Pro uses a centralized React Context architecture.

### Why React Context instead of Redux or Zustand?
1. **Cohesive Single Source of Truth:** The domain state (users, projects, tasks, workflows, audit logs) is tightly coupled. Having a centralized store allows atomic mutations: for instance, moving a task can simultaneously update the task record, record an audit event, trigger a notification, and broadcast to other open tabs.
2. **Zero Extra Dependencies:** Using React's built-in `createContext`, `useState`, `useCallback`, and `useMemo` avoids adding megabytes of state management libraries for a frontend application.
3. **Optimized Selectors & Convenience Hook:** Components consume state exclusively through `useApp()` (`src/hooks/useApp.ts`), which validates that the hook is called inside `<AppProvider>`.

### State Slices in `AppContext.tsx`:
- **`currentUser`:** Currently active logged-in user object (`id`, `name`, `email`, `role`, `companyId`, `avatar`).
- **`currentCompany`:** Workspace/organization metadata.
- **`projects`:** Array of all project records (`Project[]`).
- **`tasks`:** Array of all work-item records (`Task[]`).
- **`workflows`:** Array of project workflows and status transition matrices (`Workflow[]`).
- **`notifications`:** In-app notification queue (`Notification[]`).
- **`auditLog`:** Immutable chronological event log (`AuditLogEntry[]`).
- **UI State:** `activeRoute`, `currentProjectId`, `projectTab`, `activeDrawerTaskId`, `searchQuery`, `impactModalData`, `conflictModalData`, `toasts`.

---

## 5. Persistence & Multi-Tab Synchronization Architecture

TaskFlow Pro implements a **Dual-Storage** persistence model:

```
┌─────────────────────────────────────────────────────────────┐
│                       TaskFlow Pro State                    │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       JSON Data Records              Binary Files (Images/Videos)
               │                              │
               ▼                              ▼
      Browser LocalStorage                   Browser IndexedDB
      Key: 'taskflow_*_v2'                  DB: 'dayflow-media'
      Quota: ~5 MB                          Store: 'blobs'
      Slices: Tasks, Projects,              Quota: Hundreds of MBs
              Users, Audit Log              Zero LocalStorage Bloat!
```

### 1. `localStorage` Architecture (`src/state/storage.ts`):
- Keys are versioned with the suffix `_v2` (e.g., `taskflow_tasks_v2`) to prevent data corruption from older schema drafts.
- Every state change triggers debounced `setItem()` calls.
- On initialization, `loadInitialState()` runs safe schema migrations:
  - Missing work-item `type` fields default to `'Task'`.
  - Legacy `'To Do'` statuses are migrated to `'Backlog'`.
  - Embedded subtasks from older drafts are elevated into first-class `Task` records with `type: 'Subtask'` and `parentId`.
  - The 7 approved default statuses are enforced in exact required order.

### 2. `IndexedDB` Architecture (`src/utils/mediaStorage.ts`):
- Large file attachments (images, screen recordings up to 25 MB) are **never converted to base64 strings** in `localStorage`, which would crash the browser's 5 MB quota.
- Instead, files are saved directly as binary `Blob` objects in IndexedDB under `dayflow-media`.
- Tasks only store lightweight attachment metadata:
  ```ts
  { id: 'att-123', name: 'screenshot.png', size: 1048576, type: 'image/png', blobKey: 'att-123' }
  ```
- When viewed, object URLs (`URL.createObjectURL(blob)`) are generated on the fly and deterministically cleaned up (`URL.revokeObjectURL`) on unmount.

### 3. Multi-Tab Real-Time Sync (`src/state/broadcast.ts`):
- Native browser `BroadcastChannel` (`taskflow_pro_sync_channel`) enables real-time message passing between open tabs.
- When Tab A edits a task, Tab A broadcasts:
  ```json
  { "type": "TASK_UPDATED", "payload": { "id": "task-1", "title": "Updated Title" } }
  ```
- Tab B receives the message, updates its in-memory task state, and shows a subtle toast notification: `"Real-time update: Task 'Updated Title' synchronized"`.
