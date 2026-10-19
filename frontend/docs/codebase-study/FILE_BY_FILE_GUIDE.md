# TaskFlow Pro — File-by-File Codebase Inventory (`FILE_BY_FILE_GUIDE.md`)

This guide provides a comprehensive inventory of all authored source, configuration, and test files in **TaskFlow Pro**. For each key module, it details:
**Purpose · Ownership · Key Exports · Inputs · Outputs & Side Effects · Dependencies · Execution Flow · Concrete Example · Potential Evaluator Questions.**

---

## Table of Contents
1. [Configuration & Root Files](#1-configuration--root-files)
2. [Application Bootstrap & Layout Shell](#2-application-bootstrap--layout-shell)
3. [State Management & Persistence Layer](#3-state-management--persistence-layer)
4. [Domain Engines & Pure Business Logic](#4-domain-engines--pure-business-logic)
5. [Navigation Components](#5-navigation-components)
6. [Work-Item & Task Components](#6-work-item--task-components)
7. [Global Modals & Drawers](#7-global-modals--drawers)
8. [Shared UI Primitives](#8-shared-ui-primitives)
9. [Feature Views](#9-feature-views)
10. [Seed Data & Test Suites](#10-seed-data--test-suites)

---

## 1. Configuration & Root Files

### `package.json` & `pnpm.cmd`
- **Purpose:** Declares project metadata, dependencies (React 19, Tailwind CSS v4, Lucide icons), development dependencies (Vite 8, TypeScript 7, Oxlint, TSX), and execution scripts.
- **Ownership:** Package and command configuration.
- **Key Scripts:** `dev`, `build`, `lint` (oxlint), `typecheck` (`tsc --noEmit`), `test` (`tsx --test tests/**/*.test.ts`).
- **Evaluator Question:** *"Why is pnpm declared as the package manager and how are tests run?"*
  - **Answer:** The repo enforces `pnpm@12.11.2` for strict, reproducible dependency isolation and supply-chain safety. Tests are executed directly via `tsx --test` using Node.js's built-in high-performance test runner without heavyweight frameworks like Jest.

### `vite.config.ts`
- **Purpose:** Configures the Vite development and build pipeline with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- **Ownership:** Bundler configuration.

### `tsconfig.json`
- **Purpose:** Defines TypeScript compiler settings (`target: ES2022`, `moduleResolution: bundler`, `strict: true`, JSX: `react-jsx`).
- **Ownership:** Static type system configuration.

### `.oxlintrc.json`
- **Purpose:** Configures the Rust-based Oxlint linter for instantaneous lint checking.

---

## 2. Application Bootstrap & Layout Shell

### `src/main.tsx`
- **Purpose:** Entry point for the client-side JavaScript bundle.
- **Key Exports:** None (root execution).
- **Execution Flow:** Locates `document.getElementById('root')` and invokes `createRoot().render(<StrictMode><App /></StrictMode>)`.
- **Evaluator Question:** *"What does `<StrictMode>` do here?"*
  - **Answer:** In development mode, React's `<StrictMode>` intentionally double-invokes components, effects, and reducers to help developers catch unintentional side-effects, outdated lifecycle patterns, and resource leaks (like uncleaned subscriptions or timers).

### `src/App.tsx`
- **Purpose:** Defines the top-level application component and layout router shell (`MainAppShell`).
- **Ownership:** Layout structure, global modal mounting, and hash-based route view resolution.
- **Key Components:**
  - `App`: Wraps `MainAppShell` in `<AppProvider>`.
  - `MainAppShell`: Inspects `activeRoute`, verifies project access policies (`canUserAccessProject`), and renders the 3-column navigation shell along with the appropriate active view.
- **Inputs:** State consumed from `useApp()` (`activeRoute`, `projectTab`, `currentUser`, `currentProject`).
- **Evaluator Question:** *"Where does routing happen in this app?"*
  - **Answer:** Routing is managed directly inside `MainAppShell` in `src/App.tsx` by inspecting `activeRoute` from `AppContext`. When the route matches `/project/:id/*`, it dynamically switches between the 11 project views based on `projectTab`.

### `src/index.css`
- **Purpose:** Global stylesheet importing Tailwind CSS v4 (`@import "tailwindcss";`) and defining custom CSS variables for dark theme tokens (`--color-canvas: #090A0F`, `--color-surface: #12141C`, `--color-brand-primary: #6366F1`, etc.).

---

## 3. State Management & Persistence Layer

### `src/state/AppContext.tsx`
- **Purpose:** Centralized state provider for the entire application.
- **Ownership:** Holds in-memory state for Users, Projects, Tasks, Workflows, Notifications, and Audit Log. Implements atomic state mutators.
- **Key Exports:** `AppProvider`, `AppContext`.
- **Inputs:** Consumes `loadInitialState()` from `src/state/storage.ts`.
- **Outputs / Side Effects:** Exposes `AppContextValue` via React Context; synchronizes mutations to `localStorage` via `useEffect`; broadcasts mutations across browser tabs via `broadcastEvent()`.
- **Key Methods:**
  - `createTask()`, `updateTask()`, `deleteTask()`, `changeTaskStatus()`
  - `createProject()`, `renameProject()`, `updateProjectKey()`, `updateProjectVisibility()`, `deleteProject()`
  - `addDependency()`, `removeDependency()`, `requestReschedule()`, `confirmRescheduleImpact()`
  - `addProjectMember()`, `removeProjectMember()`, `updateProjectMemberRole()`
  - `switchUser()`, `recordAudit()`, `undoAuditEntry()`.
- **Evaluator Question:** *"What happens when a task status is changed to 'Done'?"*
  - **Answer:** `changeTaskStatus()` checks status transition permissions (`canTransitionStatus`), updates the task's status to `'Done'`, checks if the task has a recurrence rule, and if so, invokes `createNextRecurringTask()` to automatically schedule the next occurrence. It then records an audit log entry and broadcasts the change to other open browser tabs.

### `src/state/storage.ts`
- **Purpose:** Safe persistence adapter between React state and the browser's `localStorage`.
- **Key Exports:** `loadInitialState()`, `saveStateToStorage()`, `resetAllStorage()`, `migrateTasks()`, `migrateProjects()`, `migrateWorkflows()`, `STORAGE_KEYS`.
- **Evaluator Question:** *"How does the app prevent old stored drafts from breaking the UI?"*
  - **Answer:** Through non-destructive migration pipelines in `storage.ts`. For example, `migrateTasks()` automatically maps legacy `'To Do'` strings to `'Backlog'`, normalizes work-item types, and safely elevates embedded subtasks to first-class records without losing data.

### `src/state/broadcast.ts`
- **Purpose:** Real-time multi-tab synchronization using the browser's native `BroadcastChannel` API.
- **Key Exports:** `broadcastEvent(type, payload)`, `subscribeToBroadcast(callback)`.
- **Channel Name:** `taskflow_pro_sync_channel`.

### `src/utils/mediaStorage.ts`
- **Purpose:** High-capacity binary file storage for image and video attachments using browser `IndexedDB`.
- **Key Exports:** `saveMediaBlob(key, blob)`, `getMediaBlob(key)`, `deleteMediaBlob(key)`, `formatFileSize(bytes)`.
- **Evaluator Question:** *"Why not store attachments as base64 in localStorage?"*
  - **Answer:** `localStorage` has a strict ~5 MB browser quota. Converting a 10 MB video or image to base64 increases its size by 33% and immediately throws a `QuotaExceededError`. Storing binary `Blob` objects in IndexedDB allows storing hundreds of megabytes safely with zero impact on `localStorage`.

### `src/hooks/useApp.ts`
- **Purpose:** Ergonomic consumer hook for `AppContext`.
- **Key Exports:** `useApp()`.
- **Safety Guard:** Throws an explicit error if called outside an `<AppProvider>`.

---

## 4. Domain Engines & Pure Business Logic

### `src/domain/projects.ts`
- **Purpose:** Pure functions for Project ID slugification, collision resolution, and date validation.
- **Key Exports:**
  - `normalizeProjectId(raw)`: Trims and converts input into clean uppercase alphanumeric slugs (e.g., `'Marketing Campaign'` $\to$ `'MARKETING-CAMPAIGN'`).
  - `generateSuggestedProjectId(name, existingProjects)`: Generates sensible project keys and increments suffix upon collision (`ALPHA` $\to$ `ALPHA-2` $\to$ `ALPHA-3`).
  - `validateProjectId(id, existingProjects, currentProjectId)`: Validates format and case-insensitive uniqueness.
  - `validateProjectDates(startDate, dueDate)`: Validates date ranges.

### `src/domain/dependencyGraph.ts`
- **Purpose:** Directed Acyclic Graph (DAG) dependency engine.
- **Key Exports:**
  - `buildAdjacencyList(tasks)`: Builds forward ($A \to B$) and reverse ($B \to A$) dependency maps.
  - `findPath(fromId, toId, forwardAdj)`: Depth-First Search (DFS) path reconstruction.
  - `validateNewDependency(predId, succId, tasks)`: Rejects self-dependencies, duplicate edges, and circular dependencies with the exact cycle path (e.g., $A \to B \to C \to A$).
  - `isTaskBlocked(task, allTasks)`: Determines if a task has incomplete predecessors.

### `src/domain/scheduling.ts`
- **Purpose:** Finish-to-Start (FS) auto-scheduling engine with weekend skipping and cascade impact preview.
- **Key Exports:**
  - `calculateScheduleImpact(taskId, newDueDateStr, tasks)`: Computes downstream schedule impact without mutating state; pushes successors forward while preserving task duration.
  - `applyScheduleChanges(impactReport, allTasks)`: Immutably applies the previewed changes to task state.

### `src/domain/businessDays.ts`
- **Purpose:** Business-day date arithmetic avoiding timezone drift by working strictly with `YYYY-MM-DD` strings.
- **Key Exports:**
  - `isWeekend(date)`: Returns `true` for Saturday (6) and Sunday (0).
  - `snapToBusinessDay(dateStr)`: Moves weekend dates to the next Monday.
  - `addBusinessDays(dateStr, days)`: Adds business days while skipping weekends.
  - `diffBusinessDays(startStr, endStr)`: Computes working days between two dates.
  - `getRelativeDateLabel(dateStr)`: Generates relative tags (`Today`, `Tomorrow`, `2d left`, `3d overdue`).

### `src/domain/criticalPath.ts`
- **Purpose:** Critical Path Method (CPM) project analytics engine.
- **Key Exports:** `calculateCriticalPath(tasks)`.
- **Implementation:** Kahn's topological sort $\to$ Forward Pass (Early Start/Finish) $\to$ Backward Pass (Late Start/Finish) $\to$ Total Float (Slack = $LS - ES$). Returns tasks with `Slack === 0`.

### `src/domain/recurrence.ts`
- **Purpose:** Recurring task calculation and next-occurrence generation.
- **Key Exports:**
  - `getLastFridayOfMonth(year, monthIndex)`: Pure calendar math for the last Friday of any month, handling leap years and 28/29/30/31-day lengths.
  - `computeNextOccurrenceDate(currentDate, rule)`: Calculates next date for `weekly_monday`, `monthly_first_day`, `monthly_last_friday`.
  - `generateNextOccurrences(task, count)`: Generates bounded preview dates (default 3).
  - `createNextRecurringTask(completedTask)`: Clones task with reset `'Backlog'` status upon completion.

### `src/domain/hierarchy.ts`
- **Purpose:** Work-item hierarchy rules and cycle prevention.
- **Key Exports:** `validateHierarchy(itemData, allTasks)`, `getEligibleParents(type, itemId, allTasks, projectId)`, `getChildWorkItems(parentId, allTasks)`.
- **Rules Enforced:** Epic has no parent; Story/Task/Bug may belong to Epic; Subtask must belong to Story/Task/Bug; Subtask cannot contain children; circular ancestry is strictly rejected.

### `src/domain/permissions.ts`
- **Purpose:** Role-Based Access Control (RBAC) and workflow transition validation.
- **Key Exports:** `hasPermission(role, permission)`, `canUserAccessProject(project, userId)`, `canTransitionStatus(role, fromStatus, toStatus, workflow)`.

### `src/domain/sla.ts`
- **Purpose:** SLA policy evaluation and escalation risk detection.
- **Key Exports:** `evaluateTaskSla(task, policy)`, `DEFAULT_SLA_POLICY`.
- **Thresholds:** High priority (24h), Medium (48h), Low (96h); Warning threshold (8h remaining).

### `src/domain/concurrency.ts`
- **Purpose:** Optimistic concurrency and conflict detection.
- **Key Exports:** `detectConflict(initialSnapshot, currentTask)`.

### `src/domain/workItems.ts`
- **Purpose:** Constants and data sanitization for the 5 work-item types.
- **Key Exports:** `WORK_ITEM_TYPES`, `WORK_ITEM_TYPE_LIST`, `BUG_SEVERITIES`, `sanitizeWorkItemData(data)`.

---

## 5. Navigation Components

- **`GlobalRail.tsx`:** Left-most navigation bar containing app logo, primary route buttons, and quick user-switcher avatar.
- **`WorkspaceSidebar.tsx`:** Collapsible navigation panel showing active workspace projects, favorites, and "+ New Project" modal trigger.
- **`Topbar.tsx`:** Top header bar with `Cmd+K` global search button, multi-tab sync pulse indicator, notifications popover trigger, and user profile summary.
- **`ProjectHeader.tsx`:** Persistent project view header displaying project color, name, editable key, member avatar stack, and navigation tabs (Overview, List, Board, Timeline, Calendar, Dashboard, Workflow, Dependencies, Members, Activity, Settings).
- **`NotificationPopover.tsx`:** Dropdown showing categorized in-app notifications (mentions, assignments, SLA alerts) with "Mark all as read".

---

## 6. Work-Item & Task Components

- **`CreateTaskModal.tsx`:** Modal dialog for creating any of the 5 work-item types. Features dynamic type-specific fields, recurrence selectors, media attachment uploader, and parent selector.
- **`TaskDetailsDrawer.tsx`:** Sliding right-side drawer for inspecting and editing task details, description, status, priority, subtasks, dependencies, time logs, recurrence, and comments.
- **`TaskCard.tsx`:** Kanban card component rendering work-item type icon, priority badge, SLA indicator, due date tag, and subtask completion progress.
- **`TaskRow.tsx`:** Dense table row component for List view with inline status selector, assignee avatar, and date tags.
- **`TaskAttachments.tsx`:** Media selector component supporting images and videos up to 25 MB with live previews and IndexedDB persistence.

---

## 7. Global Modals & Drawers

- **`CreateProjectModal.tsx`:** Form modal for creating projects with automatic slug suggestion, collision resolution, and date range checks.
- **`GlobalSearchModal.tsx`:** `Cmd+K` spotlight modal filtering tasks and projects with instant keyboard navigation.
- **`ImpactPreviewModal.tsx`:** Modal displaying downstream schedule shifts caused by dependency delay propagation with "Apply Reschedule" and "Cancel" actions.
- **`ConflictModal.tsx`:** Diff dialog showing field-by-field concurrency conflicts with "Overwrite" or "Discard" options.

---

## 8. Shared UI Primitives

- **`Avatar.tsx`:** Renders user avatar image or deterministic colored initials badge (`size="xs" | "sm" | "md" | "lg"`).
- **`Badge.tsx`:** Standardized status badges, SLA indicators, priority badges, and work-item type chips.
- **`Button.tsx`:** Reusable button with variants (`primary`, `secondary`, `danger`, `ghost`) and loading states.
- **`Dialog.tsx`:** Accessible modal backdrop with focus trapping and `Esc` key dismissal.
- **`Input.tsx`:** Form input with label, error message, and helper text.
- **`EmptyState.tsx`:** Consistent empty state illustration with title, description, and primary action button.
- **`ToastContainer.tsx`:** Fixed viewport container rendering stacked auto-dismissing toast messages.

---

## 9. Feature Views

- **`HomeView.tsx`:** Workspace home dashboard with personalized greeting, assigned tasks summary, recent projects, and quick actions.
- **`MyTasksView.tsx`:** Filtered view showing only tasks assigned to the current logged-in user.
- **`ProjectsView.tsx`:** Grid of all accessible workspace projects with progress bars and member avatars.
- **`ProjectOverviewView.tsx`:** Project summary view with description, milestones, member list, and key stats.
- **`ProjectListView.tsx`:** Status-grouped task table view with search, filter, and sorting controls.
- **`ProjectBoardView.tsx`:** 7-column Kanban board with drag-and-drop status transitions.
- **`ProjectTimelineView.tsx`:** Interactive Gantt-style timeline bar view mapped to business calendar dates.
- **`ProjectCalendarView.tsx`:** Monthly calendar view with Day Details dialog and date-contextual task creation.
- **`ProjectDashboardView.tsx`:** Project KPI metrics, deliverable completion progress, and workload distribution charts.
- **`WorkflowBuilderView.tsx`:** Status configuration editor allowing customization of allowed transitions and role restrictions.
- **`DependenciesView.tsx`:** Interactive dependency graph view showing predecessor/successor relationships and the CPM Critical Path.
- **`ProjectMembersView.tsx`:** Project roster management interface allowing adding members, changing project roles, and removing members.
- **`ProjectActivityView.tsx`:** Project-scoped immutable audit trail with one-click Undo capability.
- **`ProjectSettingsView.tsx`:** Project settings interface for renaming, unique key editing, visibility toggling, and typed `DELETE` confirmation.
- **`SettingsView.tsx`:** Global workspace settings, account profile details, and "Reset Demo Data" trigger.
- **`AuthView.tsx`:** Simulated authentication screen with quick-switch demo accounts.
- **`CompanySetupView.tsx`:** Onboarding wizard for newly created workspace organizations.

---

## 10. Seed Data & Test Suites

- **`src/data/seedData.ts`:** Realistic initial data containing 3 users, 3 projects, 11 tasks across all 5 work-item types, 2 workflows, notifications, and company profile.
- **`tests/projects.test.ts`:** 5 unit tests for project slug normalization, collision incrementation (`-2`, `-3`), and date validation.
- **`tests/recurrence.test.ts`:** 9 unit tests for weekly Monday, monthly 1st day, and monthly last Friday (including leap years and month ends).
- **`tests/scheduling.test.ts`:** 12 unit tests for graph cycle detection, Finish-to-Start business day propagation, and CPM calculations.
