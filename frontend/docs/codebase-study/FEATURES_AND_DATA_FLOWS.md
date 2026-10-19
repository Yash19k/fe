# TaskFlow Pro — Features & Data Flows (`FEATURES_AND_DATA_FLOWS.md`)

This guide traces all **20 critical user journeys** through the TaskFlow Pro codebase. Each flow documents the exact execution path:
$$\text{User Click / Action} \longrightarrow \text{UI Component} \longrightarrow \text{Handler} \longrightarrow \text{Context Action} \longrightarrow \text{Domain Utility} \longrightarrow \text{State Mutation} \longrightarrow \text{Persistence} \longrightarrow \text{View Re-render}$$

---

### Journey 1: App Startup & Initial Data Hydration
- **User Action:** User navigates to the application URL in a web browser.
- **Component:** `src/main.tsx` mounts `<App>` in `src/App.tsx`.
- **Function/Handler:** `<AppProvider>` in `src/state/AppContext.tsx` executes `loadInitialState()` in `src/state/storage.ts` via `useMemo`.
- **Domain Utility Involved:** `migrateProjects()`, `migrateTasks()`, `migrateWorkflows()` in `src/state/storage.ts`.
- **Data Change:** Parses `localStorage` JSON strings or loads `src/data/seedData.ts`. Normalizes legacy statuses to `'Backlog'`, normalizes work-item types, elevates embedded subtasks to first-class records, sorts workflow statuses into the approved 7-status order.
- **Persistence:** In-memory initialization from browser `localStorage`.
- **Views Updating:** Renders `<MainAppShell>` with active project and task data populated.
- **Edge Cases:** If `localStorage` contains invalid JSON, the `try/catch` block catches the syntax error and gracefully falls back to seed data without crashing.

---

### Journey 2: User Switcher, Role Emulation & Company Onboarding
- **User Action:** User clicks on the avatar dropdown in `GlobalRail` or `Topbar` to switch between Sarah Connor (Admin), Alex Rivera (Manager), or Elena Rostova (Teammate).
- **Component:** `src/components/navigation/GlobalRail.tsx` or `src/features/auth/AuthView.tsx`.
- **Function/Handler:** Calls `switchUser(userId)` in `src/state/AppContext.tsx`.
- **Data Change:** Updates `currentUser` state slice in `AppContext`.
- **Persistence:** `useEffect` in `AppContext.tsx` invokes `saveStateToStorage('CURRENT_USER', currentUser)`.
- **Views Updating:** Immediate re-render across all views. Actions restricted by RBAC (e.g., deleting projects, moving tasks directly to 'Done', managing workflows) are instantly enabled or disabled according to `hasPermission(currentUser.role, permission)`.
- **Onboarding Guard:** If a newly registered user has `currentUser.onboardingCompleted === false`, `src/App.tsx` intercepts rendering and displays `src/features/onboarding/CompanySetupView.tsx` until the user completes the setup wizard.

---

### Journey 3: Project Creation with Unique Slugified ID & Date Validation
- **User Action:** User clicks "+ New Project" in `WorkspaceSidebar` or `ProjectsView`, fills out the form in `CreateProjectModal`, and clicks "Create Project".
- **Component:** `src/components/modals/CreateProjectModal.tsx`.
- **Function/Handler:** `handleSubmit(e: React.FormEvent)`.
- **Domain Utilities Involved:**
  - `generateSuggestedProjectId(name, projects)` in `src/domain/projects.ts` generates suggested uppercase slugs with collision suffixes (`-2`, `-3`).
  - `validateProjectId(projectId, projects)` validates uniqueness case-insensitively.
  - `validateProjectDates(startDate, dueDate)` validates that target delivery date does not precede start date.
- **Context Action:** `createProject(projectData)` in `src/state/AppContext.tsx`.
- **Data Change:** Appends a new `Project` record with default sections (`Planning`, `Development`, `Launch`), sets `currentProjectId` to the new ID, records an audit log entry, and emits a success toast.
- **Persistence:** Saved to `localStorage` under `taskflow_projects_v2`.
- **Views Updating:** Sidebar project tree updates, `navigate(`/project/${newProj.id}/overview`)` redirects to the new project.

---

### Journey 4: Project Settings: Rename, Unique Key Edit, Visibility Toggle & Typed `DELETE`
- **User Action:** Manager/Admin navigates to Project Settings, edits the Project Key, toggles visibility between Global and Private, or enters the Danger Zone to delete the project.
- **Component:** `src/features/project/ProjectSettingsView.tsx`.
- **Function/Handler:**
  - Key Edit: `handleSaveKey()` calls `updateProjectKey(projectId, newKey)`.
  - Visibility: `handleVisibilityChange()` calls `updateProjectVisibility(projectId, newVisibility)`.
  - Delete: `handleConfirmDelete()` checks if confirmation text is strictly `'DELETE'` and calls `deleteProject(projectId)`.
- **Domain Utilities Involved:** `validateProjectId()` in `src/domain/projects.ts`, `hasPermission()` in `src/domain/permissions.ts`.
- **Data Change:**
  - Key/Visibility updates: Modifies `project.projectKey` and `project.visibility`, logs audit trail.
  - Delete: Removes project from `projects` array, cascades deletion across all tasks where `t.projectId === projectId`, detaches parent/child links and dependency IDs from other tasks, clears selected project.
- **Persistence:** Updated in `localStorage` under `taskflow_projects_v2` and `taskflow_tasks_v2`.
- **Views Updating:** `ProjectsView`, `WorkspaceSidebar`, and top-level navigation update immediately.

---

### Journey 5: Project Membership Management & Avatar Navigation
- **User Action:** User clicks on the member avatar group in `ProjectHeader` or `ProjectOverviewView`, then adds a member or changes their project role in `ProjectMembersView`.
- **Component:** `src/components/navigation/ProjectHeader.tsx` (avatar button) routes to `#/project/:id/members`; managed inside `src/features/project/ProjectMembersView.tsx`.
- **Function/Handler:** `addProjectMember(projectId, userId, role)` and `updateProjectMemberRole(projectId, userId, role)` in `src/state/AppContext.tsx`.
- **Data Change:** Appends `userId` to `project.memberIds`, sets `project.memberRoles[userId] = role`.
- **Task Preservation Guarantee:** Removing a member does **not** delete any tasks assigned to them; task history and assignments are safely preserved.
- **Persistence:** Saved in `taskflow_projects_v2`.
- **Views Updating:** `ProjectHeader` avatar stack, `ProjectOverviewView` roster summary, and task assignee selectors reflect updated membership.

---

### Journey 6: Work-Item Creation Across 5 Types with Type-Specific Fields
- **User Action:** User clicks "Add Task" / "New Item" from List, Board, or Calendar, selects work-item type (`Epic`, `Story`, `Task`, `Subtask`, `Bug`), fills optional fields, and submits.
- **Component:** `src/components/tasks/CreateTaskModal.tsx`.
- **Function/Handler:** `handleSubmit()` calls `createTask(taskData)` in `src/state/AppContext.tsx`.
- **Domain Utilities Involved:**
  - `validateHierarchy(taskData, tasks)` in `src/domain/hierarchy.ts` enforces parent/child rules.
  - `sanitizeWorkItemData(taskData)` in `src/domain/workItems.ts` strips incompatible fields (e.g., removing `stepsToReproduce` if type was changed from Bug to Task) and sets clean null defaults for unassigned fields.
- **Data Change:** Prepends new task record with version `1`, records creation audit event, triggers in-app notification if assigned to another user, broadcasts `TASK_CREATED` over `BroadcastChannel`.
- **Persistence:** Saved to `taskflow_tasks_v2`.
- **Views Updating:** List, Board, Timeline, Calendar, and Dashboard update in real time.

---

### Journey 7: Task Details Drawer & Live Editing
- **User Action:** User clicks on any task card or row to open the details drawer, modifies title, description, or custom fields on blur.
- **Component:** `src/components/tasks/TaskDetailsDrawer.tsx`.
- **Function/Handler:** `updateTask(taskId, updates, snapshotVersion)` in `src/state/AppContext.tsx`.
- **Domain Utilities Involved:** `detectConflict(initialSnapshot, currentTask)` in `src/domain/concurrency.ts`.
- **Data Change:** Applies partial updates, increments `task.version`, updates `task.updatedAt` timestamp, records audit log entry, and broadcasts `TASK_UPDATED`.
- **Persistence:** Saved to `taskflow_tasks_v2`.
- **Views Updating:** Closes or updates drawer; table rows, Kanban cards, and Gantt bars reflect edits immediately.

---

### Journey 8: Parent-Child Hierarchy Enforcement & Cycle Prevention
- **User Action:** User attempts to assign a parent to a work item in `CreateTaskModal` or `TaskDetailsDrawer`.
- **Component:** `CreateTaskModal` or `TaskDetailsDrawer` parent select dropdown.
- **Domain Utilities Involved:**
  - `getEligibleParents(type, itemId, tasks, projectId)` in `src/domain/hierarchy.ts` filters the select options so only valid parent candidates are rendered.
  - `validateHierarchy(itemData, tasks)` checks:
    1. Epic cannot have a parent.
    2. Subtask must belong to a Story, Task, or Bug.
    3. Subtask cannot have another Subtask as parent.
    4. Circular hierarchy check via `isDescendantOf()` prevents an item from being parented to its own descendant.
- **Result:** Invalid relationships are blocked with an explicit, user-friendly error message before state mutation.

---

### Journey 9: Kanban Board Drag-and-Drop & Strict Column Ordering
- **User Action:** User drags a task card from "In Progress" and drops it into "In Review" on the Kanban board.
- **Component:** `src/features/project/ProjectBoardView.tsx`.
- **Function/Handler:** `handleDrop(targetStatus)` invokes `changeTaskStatus(taskId, targetStatus)` in `src/state/AppContext.tsx`.
- **Domain Utilities Involved:** `canTransitionStatus(currentUser.role, task.status, targetStatus, currentWorkflow)` in `src/domain/permissions.ts`.
- **Data Change:** If allowed, updates `task.status`. If moving to `'Done'`, checks if task has a recurrence rule and spawns the next occurrence via `createNextRecurringTask()`.
- **Role Guard:** If a Teammate attempts to move a task directly from Backlog to Done without testing/review, the transition is rejected with: *"Teammates must submit tasks for 'In Review' or 'Testing / QA' before marking 'Done'"*.
- **Persistence:** Saved to `taskflow_tasks_v2`.
- **Views Updating:** Board columns, List grouping, Dashboard progress percentages, and Calendar day indicators reflect the new status.

---

### Journey 10: Comments, Subtasks, Time Tracking & Media Attachments
- **User Action:** In `TaskDetailsDrawer`, user writes a comment, adds a subtask, logs hours, or attaches an image/video.
- **Component:** `src/components/tasks/TaskDetailsDrawer.tsx` and `src/components/tasks/TaskAttachments.tsx`.
- **Handlers:**
  - Comment: `addComment(taskId, text)` appends to `task.comments`.
  - Subtask: `addSubtask(taskId, title)` creates a first-class `Subtask` work item linked by `parentId`.
  - Time Tracking: `logTimeEntry(taskId, hours, note)` increments `task.actualHours` and appends to `task.timeEntries`.
  - Attachments: `saveMediaBlob(blobKey, file)` saves binary file in IndexedDB (`dayflow-media`), appends metadata to `task.attachments`.
- **Persistence:** Task metadata in `taskflow_tasks_v2`; binary media in browser IndexedDB.
- **Views Updating:** Drawer tabs update immediately, List and Board progress badges increment.

---

### Journey 11: Real-Time Global Search & Filter
- **User Action:** User presses `Cmd+K` or clicks the Topbar search input to open `GlobalSearchModal`, types a keyword, or applies status/assignee filters in List/Board view.
- **Component:** `src/components/modals/GlobalSearchModal.tsx`, `src/features/project/ProjectListView.tsx`.
- **Function/Handler:** Filter pipeline executes over `tasks` array using memoized string matching across `title`, `description`, `projectKey`, `tags`, and assignee names.
- **Data Change:** Zero state mutation; pure derived UI filtering.
- **Views Updating:** Search modal displays categorized instant results (Tasks, Projects) with direct navigation links.

---

### Journey 12: Project Dashboard Health & Metrics Computation
- **User Action:** User switches to the "Dashboard" tab in a project.
- **Component:** `src/features/project/ProjectDashboardView.tsx`.
- **Calculation Logic (`useMemo` in lines 12-35):**
  - **Deliverable Progress:** Evaluates deliverables (`Epic`, `Story`, `Task`, `Bug`) while excluding subtasks to avoid double-counting parent-child completion:
    $$\text{Deliverable Progress} = \left(\frac{\text{Completed Deliverables}}{\text{Total Deliverables}}\right) \times 100$$
  - **Overdue Work:** Counts non-Done tasks where `getRelativeDateLabel(task.dueDate).isOverdue === true`.
  - **Status Breakdown:** Groups tasks across the 7 approved default statuses (`Backlog`, `In Progress`, `In Review`, `Testing / QA`, `Done`, `Blocked`, `On Hold`).
  - **Assignee Workload:** Groups task distribution per team member.
- **Result:** Renders 4 KPI cards and responsive visual distribution bars.

---

### Journey 13: Dependency Graph, Cycle Detection & Finish-to-Start Auto-Scheduling
- **User Action:** User links Task A as predecessor to Task B. Later, Task A is delayed from Thursday to Monday.
- **Components:** `src/features/project/DependenciesView.tsx`, `src/components/modals/ImpactPreviewModal.tsx`.
- **Handlers & Domain Functions:**
  1. `validateNewDependency(predId, succId, tasks)` in `src/domain/dependencyGraph.ts` executes DFS path traversal. If B can reach A, rejects with circular path: `Build API → Connect Frontend → Build API`.
  2. If legal, `addDependency()` creates edge.
  3. When Task A's due date moves to Monday, `calculateScheduleImpact(taskId, newDate, tasks)` in `src/domain/scheduling.ts` calculates downstream impact:
     - Applies Finish-to-Start constraint: earliest allowed start = predecessor due date + 1 business day.
     - Friday predecessor delayed to Monday causes Friday successor to shift to Tuesday (skipping Saturday & Sunday).
  4. Opens `ImpactPreviewModal` showing old vs. new dates and affected tasks.
  5. User clicks "Apply Reschedule" $\to$ `confirmRescheduleImpact()` updates all downstream task dates and records audit logs.

---

### Journey 14: Recurring Tasks & Automatic Next Occurrence Spawning
- **User Action:** User creates a task with recurrence set to `weekly_monday`, `monthly_first_day`, or `monthly_last_friday`.
- **Components:** `src/components/tasks/CreateTaskModal.tsx`, `src/components/tasks/TaskDetailsDrawer.tsx`.
- **Domain Utilities:** `formatRecurrenceRule()`, `generateNextOccurrences()`, `createNextRecurringTask()` in `src/domain/recurrence.ts`.
- **Execution Flow:**
  - Drawer displays upcoming projected dates (bounded to 3 occurrences).
  - When the user marks the recurring task `'Done'`, `changeTaskStatus` in `src/state/AppContext.tsx` automatically invokes `createNextRecurringTask(completedTask)`.
  - Next instance is cloned with a new ID, reset status (`'Backlog'`), uncompleted subtasks, cleared dependencies, and scheduled date calculated via `computeNextOccurrenceDate()`.
- **Persistence:** Next task record appended to `taskflow_tasks_v2`.

---

### Journey 15: SLA Policy Evaluation & Escalation
- **User Action:** A High-priority task remains unresolved for > 24 hours, or a Manager manually clicks "Escalate".
- **Component:** `src/domain/sla.ts` and `src/components/tasks/TaskDetailsDrawer.tsx`.
- **Evaluation Logic:**
  - High priority threshold: 24h; Medium: 48h; Low: 96h; Warning threshold: 8h remaining.
  - Compares elapsed hours since `task.createdAt` against threshold.
  - Returns `isBreached`, `isApproaching`, `isEscalated`, and formatted badge styling.
- **Manual Escalation:** Manager clicks "Escalate" $\to$ `escalateTask(taskId)` sets `task.sla.isEscalated = true`, records audit event, and creates high-priority notification.

---

### Journey 16: Concurrency Conflict Detection & Resolution Simulation
- **User Action:** User opens a task drawer, and simultaneously clicks "Simulate External Edit" (simulating a teammate editing the same task in another browser tab). User then attempts to save their edits.
- **Components:** `src/components/tasks/TaskDetailsDrawer.tsx`, `src/components/modals/ConflictModal.tsx`.
- **Domain Utility:** `detectConflict(initialSnapshot, currentTask)` in `src/domain/concurrency.ts`.
- **Execution Flow:**
  - Drawer captured `snapshotVersion` (e.g., version 1) on mount.
  - External simulation incremented version to 2.
  - On save, `updateTask` detects version mismatch ($1 \neq 2$).
  - Prevents overwrite and opens `ConflictModal` showing field-by-field differences (Title, Due Date, Status).
  - User can choose "Overwrite External Changes" or "Discard & Accept Latest".

---

### Journey 17: Project-Scoped Audit Log & One-Click Undo
- **User Action:** User opens "Activity & Audit" tab in Project Alpha, reviews past actions, and clicks "Undo" on a recent task rename.
- **Component:** `src/features/project/ProjectActivityView.tsx`.
- **Function/Handler:** `undoAuditEntry(entryId)` in `src/state/AppContext.tsx`.
- **Scoping Filter:** Audit entries are strictly filtered: `auditLog.filter(e => e.projectId === currentProjectId)`. No cross-project log pollution.
- **Execution Flow:**
  - Finds audit entry containing `previousValue` and `newValue`.
  - Reverts task property to `previousValue`.
  - Records a new audit entry: `"Undid: Renamed task to..."`.
  - Emits toast confirmation.

---

### Journey 18: In-App Notifications & Multi-Tab Synchronization
- **User Action:** User opens TaskFlow Pro in Tab A and Tab B. In Tab A, user creates a task.
- **Components:** `src/components/navigation/Topbar.tsx`, `src/state/broadcast.ts`.
- **Execution Flow:**
  - Tab A executes `createTask()`, posts message to `BroadcastChannel`.
  - Tab B receives `TASK_CREATED` event in `subscribeToBroadcast()`.
  - Tab B updates local `tasks` state slice, briefly flashes green sync pulse indicator in `Topbar`, and displays info toast.

---

### Journey 19: Calendar Navigation & Focused Day Details
- **User Action:** User switches to Calendar view, navigates months, clicks "Today", or clicks a specific date cell.
- **Component:** `src/features/project/ProjectCalendarView.tsx`.
- **Execution Flow:**
  - Real local dates are used (`new Date()`).
  - Clicking "Today" resets viewed year and month to current local date.
  - Clicking any date cell opens Day Details dialog.
  - Tasks scheduled on that day are filtered and deduplicated (`getTaskDateContext` tags each item as `Starts today`, `Due today`, `Starts & Due today`, or `Recurring occurrence`).
  - Includes "+ Create task for this date" button that pre-fills the clicked date into `CreateTaskModal`.

---

### Journey 20: Page Refresh & Persistence Integrity
- **User Action:** User presses `F5` / Refresh at any point in time.
- **Execution Flow:**
  - Browser reloads `index.html`.
  - `AppContext.tsx` runs `loadInitialState()`.
  - Reads `localStorage` keys (`taskflow_*_v2`).
  - Restores exact current user, projects, tasks, workflows, notifications, and audit log.
  - Active route restored from `window.location.hash`.
  - Binary attachments remain accessible from IndexedDB without data loss.
