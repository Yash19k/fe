# TaskFlow Pro — Hands-On Learning Plan (`HANDS_ON_LEARNING_PLAN.md`)

This 10-stage learning plan will guide you through the TaskFlow Pro codebase step by step. Each stage includes:
**Files to Read · Questions to Answer in Your Own Words · Safe Hands-On Exercise.**

---

## Stage 1: Running the Application & Exploring the UI Shell

### Files to Inspect:
- `package.json`
- `src/App.tsx` (lines 78–100: 3-column layout shell)
- `src/components/navigation/GlobalRail.tsx`

### Self-Check Questions:
1. Which command starts the local development server?
2. What are the three columns of the layout shell?
3. Where is the user-switching dropdown located in the DOM?

### Hands-On Exercise:
1. Start the app: `.\pnpm dev`.
2. Open `http://localhost:5173/` in your browser.
3. Click through the icons in the `GlobalRail`: Home $\to$ My Tasks $\to$ Projects $\to$ Settings.
4. Switch the active user from Sarah Connor (Admin) to Elena Rostova (Teammate) and observe how the workspace adapts.

---

## Stage 2: Tracing the Application Bootstrap & Hash Routing

### Files to Inspect:
- `index.html` (lines 13–16: root div & script tag)
- `src/main.tsx` (lines 6–15: createRoot & StrictMode)
- `src/App.tsx` (lines 198–204: AppProvider wrapping MainAppShell)
- `src/state/AppContext.tsx` (lines 42–74: activeRoute & hashchange listener)

### Self-Check Questions:
1. How does the application detect when the URL changes without making a server request?
2. What does `hash.match(/^\/project\/([^/]+)(?:\/([^/]+))?/)` extract from `#/project/proj-1/board`?
3. Why does the app use hash routing instead of HTML5 History API?

### Hands-On Exercise:
1. In the browser address bar, manually change the URL hash to `#/project/proj-2/board`.
2. Notice how the page immediately switches to Project Beta's Kanban board without a full page reload.

---

## Stage 3: Following a Task Creation Flow

### Files to Inspect:
- `src/components/tasks/CreateTaskModal.tsx` (lines 120–165: form state and submit handler)
- `src/domain/workItems.ts` (lines 32–102: `sanitizeWorkItemData`)
- `src/state/AppContext.tsx` (lines 450–520: `createTask` implementation)

### Self-Check Questions:
1. What are the default values for `assigneeId`, `priority`, `dueDate`, and `estimateHours` when creating a new task?
2. How does `sanitizeWorkItemData` prevent bug-specific fields (like `stepsToReproduce`) from being saved on an Epic or Task?
3. What version number does a newly created task start with?

### Hands-On Exercise:
1. Open the browser DevTools Console (`F12`).
2. In the app, click "+ Add Work Item" in the List view.
3. Create a new Bug named `"Login session timeout error"`. Set Severity to `High`.
4. In DevTools console, run:
   ```js
   JSON.parse(localStorage.getItem('taskflow_tasks_v2')).find(t => t.title.includes('Login session'))
   ```
5. Verify that the task exists in `localStorage` with `type: "Bug"` and `severity: "High"`.

---

## Stage 4: Tracing a Status Update & Role Guard

### Files to Inspect:
- `src/domain/permissions.ts` (lines 85–133: `canTransitionStatus`)
- `src/state/AppContext.tsx` (lines 650–700: `changeTaskStatus`)
- `src/features/project/ProjectBoardView.tsx` (Kanban drag-and-drop drop handler)

### Self-Check Questions:
1. What are the 7 approved default workflow statuses in exact order?
2. What rule prevents a Teammate from dragging a task from Backlog directly into Done?
3. What happens if a task marked Done has a recurrence rule configured?

### Hands-On Exercise:
1. Switch active user to Elena Rostova (Teammate) using the avatar at the bottom left.
2. In Project Alpha's Board view, drag a task from "Backlog" into "Done".
3. Verify that the app shows the permission warning toast and keeps the card in Backlog.
4. Drag it into "In Progress" instead; observe that this transition succeeds.

---

## Stage 5: Understanding Dual Persistence & Multi-Tab Sync

### Files to Inspect:
- `src/state/storage.ts` (lines 27–36: `STORAGE_KEYS`; lines 227–274: `loadInitialState`)
- `src/utils/mediaStorage.ts` (lines 15–65: IndexedDB `dayflow-media` store)
- `src/state/broadcast.ts` (lines 23–54: `broadcastEvent` & `subscribeToBroadcast`)

### Self-Check Questions:
1. Why does the app store media attachments in IndexedDB instead of localStorage?
2. How does `BroadcastChannel` know when another tab has updated a task?
3. What storage key is used to store project records?

### Hands-On Exercise:
1. Open two browser windows side-by-side at `http://localhost:5173/#/project/proj-1/board`.
2. In Window 1, rename a task title in the drawer.
3. Watch Window 2: without touching it, observe the title update in real time and see the synchronization toast appear.

---

## Stage 6: Studying the Work-Item Hierarchy Engine

### Files to Inspect:
- `src/domain/hierarchy.ts` (lines 22–45: `isDescendantOf`; lines 112–218: `validateHierarchy`)

### Self-Check Questions:
1. Why is an Epic never allowed to have a parent?
2. What types can be a valid parent of a Subtask?
3. How does `isDescendantOf` prevent an item from being parented to its own child?

### Hands-On Exercise:
1. In `CreateTaskModal`, select work-item type `Subtask`.
2. Notice how the Parent Work Item dropdown only shows Stories, Tasks, and Bugs (no Epics and no other Subtasks).
3. Select work-item type `Epic` and observe that the Parent Work Item dropdown disappears completely.

---

## Stage 7: Studying Graph Cycles & Finish-to-Start Auto-Scheduling

### Files to Inspect:
- `src/domain/dependencyGraph.ts` (lines 87–147: `validateNewDependency`)
- `src/domain/scheduling.ts` (lines 45–158: `calculateScheduleImpact`)
- `src/domain/businessDays.ts` (lines 42–56: `addBusinessDays`)
- `tests/scheduling.test.ts`

### Self-Check Questions:
1. In graph theory, how do we determine if adding directed edge $A \to B$ creates a cycle?
2. If a task due on Friday is delayed by 1 business day, what day does its successor move to?
3. Why does `calculateScheduleImpact` return a preview report instead of immediately mutating state?

### Hands-On Exercise:
1. In your terminal, run: `.\pnpm test`.
2. Read the output for `Dependency Graph & Cycle Detection Tests` and `Business Day & Auto-Scheduling Engine Tests`.
3. Notice how all 12 scheduling and cycle tests pass in ~5 milliseconds.

---

## Stage 8: Studying the Critical Path Method (CPM)

### Files to Inspect:
- `src/domain/criticalPath.ts` (lines 42–199: `calculateCriticalPath`)
- `src/features/project/DependenciesView.tsx`

### Self-Check Questions:
1. What algorithm is used to perform the topological sort of the project tasks?
2. What is the difference between Early Start (ES) and Late Start (LS)?
3. What mathematical condition defines a task as being on the Critical Path?

### Hands-On Exercise:
1. In the browser, navigate to `#/project/proj-1/dependencies`.
2. Look at the Critical Path badge and the list of critical tasks highlighted in red/amber.
3. Observe how tasks with 0 days of slack are marked critical.

---

## Stage 9: Studying Calendar Day Details & Recurrence

### Files to Inspect:
- `src/features/project/ProjectCalendarView.tsx` (Day Details dialog implementation)
- `src/domain/recurrence.ts` (lines 15–40: `getLastFridayOfMonth`; lines 120–165: `createNextRecurringTask`)
- `tests/recurrence.test.ts`

### Self-Check Questions:
1. How does the app ensure clicking "Today" returns to the real local calendar date?
2. What formula calculates the last Friday of a month?
3. How are tasks scheduled on a given date tagged in the Day Details modal?

### Hands-On Exercise:
1. Navigate to `#/project/proj-1/calendar`.
2. Click any calendar cell that has scheduled tasks.
3. Inspect the Day Details dialog: observe the date heading, task count, contextual tags (`Due today`, `Starts today`), and "+ Create task for this date" button.

---

## Stage 10: Practicing Evaluation Answers

### Files to Inspect:
- `docs/codebase-study/EVALUATION_PREP.md`

### Hands-On Exercise:
1. Close all guides and notes.
2. Set a 60-second timer on your phone and speak your elevator pitch out loud.
3. Pick 5 random questions from Section 4 of `EVALUATION_PREP.md` and answer them verbally.
4. If you stumble on any question, reopen the source code file cited in the answer and trace the implementation once more.
