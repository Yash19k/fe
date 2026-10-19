# TaskFlow Pro — Evaluation & Defense Guide (`EVALUATION_PREP.md`)

This guide is your primary preparation document for company evaluations, technical interviews, and architecture reviews. It contains scripted pitches, a structured live demonstration walk-through, 35+ code-grounded questions and answers, and defensive tactics for tricky follow-up questions.

---

## 1. The 60-Second Elevator Pitch

> *"TaskFlow Pro is a high-density, dark-themed team project and task management web application built with React 19, TypeScript, and Tailwind CSS v4. It models the core workflow of modern engineering tools like Linear and Asana—supporting 5 work-item types from Epics down to Subtasks, and 7 default workflow statuses.*
>
> *What sets it apart from typical prototypes is its real mathematical and algorithmic foundation: it features a Directed Acyclic Graph dependency engine with cycle detection, business-day auto-scheduling that automatically cascades downstream delays while skipping weekends, and a Critical Path Method engine using topological sorting and slack calculations to pinpoint bottlenecks.*
>
> *Everything runs entirely client-side using a dual-persistence strategy—localStorage for structured data and IndexedDB for media attachments—with multi-tab synchronization and optimistic concurrency conflict detection powered by the browser's native BroadcastChannel API."*

---

## 2. The 3-Minute Technical Architecture Overview

> *"From an architectural perspective, TaskFlow Pro is structured around three key design principles:*
>
> *First, **Pure Domain Decoupling:** All complex business rules—graph cycle detection, business-day date math, CPM slack calculations, hierarchy validation, recurrence rules, and project slug generation—are written as pure, framework-agnostic TypeScript functions in `src/domain/`. They have zero React dependencies, make no DOM or storage calls, and are 100% testable using Node.js's native test runner via `pnpm test`.*
>
> *Second, **Single Source of Truth with Dual Persistence:** Rather than scattering state across components or using third-party state libraries, we utilize a centralized React Context in `src/state/AppContext.tsx`. State is hydrated on startup through non-destructive schema migrations in `storage.ts`. To prevent exceeding the 5 MB localStorage limit, we engineered a dual-storage strategy: JSON entities are saved in localStorage, while binary attachments up to 25 MB are stored as raw Blobs in browser IndexedDB via `mediaStorage.ts`.*
>
> *Third, **Zero-Server Multi-Tab Coordination:** In a production setting, real-time collaboration requires WebSockets or CRDTs. Here, we simulate that enterprise environment natively in the browser: using the `BroadcastChannel` API, actions taken in one tab immediately synchronize across all other open tabs, and an optimistic concurrency engine detects version conflicts if two tabs edit the same work item simultaneously.*
>
> *The result is a production-grade frontend prototype that is fast, robust, and completely refresh-proof."*

---

## 3. The 5-Minute Live Demonstration Script

Follow this exact path during a live presentation:

### Step 1: Bootstrap & Workspace Home (0:00 – 1:00)
1. Open `http://localhost:5173/`.
2. Point out the dark, compact 3-column UI: `GlobalRail` (left), `WorkspaceSidebar` (middle), and main view area.
3. Show the Workspace Home: KPI summary cards, assigned tasks, and recent projects.
4. Demonstrate role switching via the avatar in the Global Rail: switch from **Sarah Connor (Admin)** to **Elena Rostova (Teammate)**. Point out that UI controls immediately adapt to RBAC rules. Switch back to Admin.

### Step 2: Project Creation & Unique ID Generation (1:00 – 1:45)
1. Click "+ New Project" in the sidebar.
2. Type `"Brand Redesign"` into the Project Name field.
3. Point out that the Project Key field automatically suggests `"BRAND-REDESIGN"`.
4. Type an existing key (e.g., `"ALPHA"`) to demonstrate inline collision validation: *"Project key 'ALPHA' already exists"*.
5. Show that Start Date and Target Date start completely empty (`null`), and verify that setting a target date earlier than the start date triggers an inline date range error.
6. Submit and observe the automatic redirect to the project overview.

### Step 3: Project Views & Kanban Workflow Restrictions (1:45 – 2:45)
1. Open Project Alpha and navigate through **List** and **Board** tabs.
2. In Board view, show the strict 7-status default column ordering:
   $$\text{Backlog} \to \text{In Progress} \to \text{In Review} \to \text{Testing / QA} \to \text{Done} \to \text{Blocked} \to \text{On Hold}$$
3. Switch user to **Elena Rostova (Teammate)**. Try dragging a card directly from "Backlog" to "Done".
4. Show the rejected transition notification: *"Teammates must submit tasks for 'In Review' or 'Testing / QA' before marking 'Done'"*. Switch back to Admin.

### Step 4: Graph Cycle Detection & Auto-Scheduling Cascade (2:45 – 3:45)
1. Navigate to the **Dependencies** tab.
2. Demonstrate cycle detection: try to make a predecessor task depend on its own successor.
3. Show the error modal displaying the reconstructed circular cycle path: `Build API → Connect Frontend → Build API`.
4. Demonstrate auto-scheduling: edit the predecessor task's due date from Thursday to Monday.
5. Point out the `ImpactPreviewModal`: the Friday successor task is pushed to Tuesday, skipping Saturday and Sunday. Click "Apply Reschedule".

### Step 5: Calendar Day Details & Recurring Tasks (3:45 – 4:30)
1. Switch to the **Calendar** tab. Point out that current month and day are dynamic and real.
2. Click any calendar date cell. Show the focused **Day Details** dialog with categorized tasks (`Starts today`, `Due today`, `Recurring occurrence`).
3. Click "+ Create task for this date" to demonstrate contextual creation pre-filling the selected date.
4. Open a recurring task in the drawer, show the recurrence projection rules (e.g., Last Friday of the month), mark it "Done", and show that the next instance is immediately scheduled in Backlog.

### Step 6: Multi-Tab Sync & Typed Project Deletion (4:30 – 5:00)
1. Open a second browser tab side-by-side.
2. Edit a task title in Tab A; show that Tab B immediately flashes the green sync indicator and updates in real time via `BroadcastChannel`.
3. In Project Settings, navigate to the Danger Zone.
4. Try clicking "Delete Project" $\to$ disabled. Type `delete` (lowercase) $\to$ disabled.
5. Type `DELETE` (uppercase) $\to$ button enables. Confirm deletion and verify clean cascading removal.

---

## 4. 35+ Evaluator Questions & Code-Grounded Answers

### Category A: Architecture & Tooling

#### Q1: "Why did you build this as a frontend-only app instead of adding a Node/Express backend?"
> **Answer:** *"The project mission was to build an industrial-quality frontend engineering prototype demonstrating advanced interaction design, complex client-side domain algorithms (graph cycle detection, CPM, scheduling math), state management, and accessibility. Adding a rudimentary Express or SQLite backend would have diluted effort away from client-side rigor without adding architectural value for a frontend demonstration."*

#### Q2: "Why Vite instead of Next.js or Create React App?"
> **Answer:** *"Create React App is officially deprecated. Next.js is designed for server-rendered or full-stack architectures. Because TaskFlow Pro is a rich, stateful Single-Page Application with heavy local interactivity and zero server endpoints, Vite is the industry standard: it provides lightning-fast Hot Module Replacement (HMR) via native ES modules and builds in under 700ms."*

#### Q3: "Why did you use pnpm instead of npm or yarn?"
> **Answer:** *"The repository enforces `pnpm@12.11.2` via `pnpm.cmd` and `pnpm-lock.yaml`. pnpm uses hard links and content-addressable storage to save disk space, prevents phantom dependency leakage (importing packages not declared in `package.json`), and guarantees reproducible installs."*

#### Q4: "Why use hash routing instead of HTML5 History API (BrowserRouter)?"
> **Answer:** *"In a client-only single-page application without an active server or Nginx rewrite rules (`try_files $uri /index.html`), refreshing a standard path route like `localhost:5173/project/proj-1/board` causes a server 404 error. Hash routing (`#/project/proj-1/board`) ensures the URL remains entirely client-side, making the app 100% refresh-proof on any static file server."*

---

### Category B: State Management & Persistence

#### Q5: "Why not use Redux Toolkit or Zustand?"
> **Answer:** *"State libraries like Redux introduce boilerplate and bundle weight. In TaskFlow Pro, state is cohesive: tasks, projects, workflows, and audit logs are mutated together atomically. A single React Context (`AppContext.tsx`) combined with pure domain functions gives us complete centralization, zero external dependencies, and simple testing."*

#### Q6: "How do you avoid the React Context re-render performance problem?"
> **Answer:** *"In `AppContext.tsx`, all mutator functions are wrapped in `useCallback` with stable dependency arrays. In high-traffic views like the List and Board, derived data (like filtering, grouping, and metrics) is memoized with `useMemo`. For extreme scale (e.g., 50,000 tasks), we would introduce selector-based state slices via Zustand or Jotai."*

#### Q7: "How is data persisted and what happens on refresh?"
> **Answer:** *"Persistence is dual-layered: structured JSON records are serialized to localStorage under versioned keys (`taskflow_*_v2`) on every state change via debounced `useEffect` hooks. On refresh, `loadInitialState()` runs non-destructive schema migrations in `storage.ts`. Media attachments are saved in browser IndexedDB via `mediaStorage.ts`."*

#### Q8: "Why not store images and videos as base64 in localStorage?"
> **Answer:** *"localStorage has a hard browser ceiling of approximately 5 MB. A single 4 MB image encoded in base64 expands by 33% to ~5.3 MB, which immediately crashes localStorage with a `QuotaExceededError`. Storing binary `Blob` objects in IndexedDB allows hundreds of megabytes of media with zero risk to structured JSON data."*

#### Q9: "How does cross-tab synchronization work without a backend server?"
> **Answer:** *"We use the browser's native `BroadcastChannel` API (`taskflow_pro_sync_channel`) in `src/state/broadcast.ts`. When a task is created or updated in Tab A, it posts a message to the channel. Tab B listens via `subscribeToBroadcast()` and updates its in-memory React state, providing real-time synchronization between tabs."*

---

### Category C: Algorithms & Domain Logic

#### Q10: "Explain how your dependency cycle detection works."
> **Answer:** *"It's in `src/domain/dependencyGraph.ts`. To check if adding a directed edge $A \to B$ creates a cycle, the algorithm tests whether $B$ can already reach $A$ in the existing graph! We build an adjacency list and run Depth-First Search (`findPath`) starting from $B$ looking for $A$. If a path exists (e.g., $B \to C \to A$), adding $A \to B$ would close the loop. If found, we reconstruct and report the full cycle path: $A \to B \to C \to A$."*

#### Q11: "How does auto-scheduling skip weekends?"
> **Answer:** *"In `src/domain/businessDays.ts`, date math operates on pure `YYYY-MM-DD` strings to prevent UTC timezone drift. `addBusinessDays(dateStr, days)` advances day-by-day; if `d.getDay()` is Saturday (6) or Sunday (0), the remaining counter is not decremented. In `src/domain/scheduling.ts`, a delayed predecessor triggers a BFS cascade pushing successors forward while preserving their duration."*

#### Q12: "How does the Critical Path Method (CPM) calculate slack?"
> **Answer:** *"In `src/domain/criticalPath.ts`, we first sort tasks topologically using Kahn's algorithm. Then we run a Forward Pass to compute Early Start (ES) and Early Finish (EF) based on predecessor durations. Next, we run a Backward Pass from the project finish date to compute Late Finish (LF) and Late Start (LS). Total Float (Slack) is $LS - ES$. Any task with Slack = 0 is on the Critical Path."*

#### Q13: "How does your recurrence engine calculate the last Friday of a month?"
> **Answer:** *"In `src/domain/recurrence.ts`, `getLastFridayOfMonth(year, monthIndex)` uses a pure constant-time calendar formula: `new Date(year, monthIndex + 1, 0)` gets the last calendar day of the month. We compute `offset = (lastDay.getDay() - 5 + 7) % 7` and subtract `offset` from the date. This accurately handles all 28, 29, 30, and 31-day months and leap years without while-loops."*

#### Q14: "How does the app prevent infinite task spawning with recurring tasks?"
> **Answer:** *"We use bounded, event-driven generation. We do not pre-generate infinite task records into the database. Instead, the task stores the recurrence rule, and the UI displays up to 3 projected future dates using `generateNextOccurrences()`. When the user marks the task `'Done'`, `createNextRecurringTask()` spawns exactly one next instance in `'Backlog'`."*

#### Q15: "How do you enforce parent-child hierarchy rules?"
> **Answer:** *"In `src/domain/hierarchy.ts`, `validateHierarchy()` validates: Epics cannot have parents; Subtasks must belong to a Story, Task, or Bug; Subtasks cannot have children; and `isDescendantOf()` traverses upward to prevent an item from being parented to its own descendant."*

---

### Category D: Testing, Quality & Code Integrity

#### Q16: "What automated tests exist in this repository?"
> **Answer:** *"We have 26 automated unit tests across 4 suites in `tests/`: `projects.test.ts` (slug normalization, collision resolution, date ranges), `recurrence.test.ts` (weekly Monday, 1st of month, last Friday leap year math, completion cloning), and `scheduling.test.ts` (graph cycle rejection, 2-node and multi-node cycles, business-day cascades). All 26 pass via `pnpm test`."*

#### Q17: "How do you ensure type safety?"
> **Answer:** *"The codebase has zero TypeScript compile errors (`pnpm typecheck` runs `tsc --noEmit`). We maintain comprehensive interfaces in `src/types/index.ts` with strict unions for work-item types, workflow statuses, priorities, and permissions, avoiding unsafe `any` casts in domain code."*

#### Q18: "What linter do you use?"
> **Answer:** *"We use Oxlint (`pnpm lint`), a high-performance Rust-based linter that scans all 72 source files in ~120ms with zero errors and zero warnings."*

---

### Category E: Security & Production Trade-Offs

#### Q19: "Is role-based access control (RBAC) secure in this app?"
> **Answer:** *"No, and we are completely transparent about that. In a frontend-only application, RBAC and project visibility (`Global` vs `Private`) are interaction design models, not a secure security boundary. Any user can open DevTools and view or edit localStorage. In a real production system, authorization and row-level security must be enforced by an API server and database (e.g., PostgreSQL RLS)."*

#### Q20: "What would you change if migrating this to a full-stack production architecture?"
> **Answer:**
> 1. *"Replace localStorage with a PostgreSQL database managed via Prisma or Drizzle ORM."*
> 2. *"Implement real JWT authentication with server-side HTTP-only cookies and bcrypt password hashing."*
> 3. *"Replace BroadcastChannel with a WebSocket server (using Socket.io or Supabase Realtime) for cross-device synchronization."*
> 4. *"Upload media attachments to AWS S3 or Cloudflare R2 using pre-signed URLs instead of IndexedDB."*
> 5. *"Keep the pure domain utilities (`dependencyGraph.ts`, `scheduling.ts`, `criticalPath.ts`) unchanged on the backend or shared in a monorepo package."*

---

## 5. How to Answer Tricky Questions Without Bluffing

| If the Evaluator Asks: | DO NOT Say: | DO Say (Honest & Professional): |
| :--- | :--- | :--- |
| *"Is this enterprise-ready for 10,000 users?"* | *"Yes, it's fully enterprise-grade."* | *"As a client-side architecture, it is designed for a single user/device with simulated multi-user collaboration. For 10,000 real concurrent users, we would back the pure domain logic with a distributed database and WebSocket infrastructure."* |
| *"Why didn't you use Tailwind v3 instead of v4?"* | *"I don't know, Vite installed it."* | *"Tailwind v4 is the modern standard, utilizing native CSS variables and `@import 'tailwindcss'` via `@tailwindcss/vite` for faster build times and unified theme tokens."* |
| *"Did you write all this code manually?"* | *"Yes, every line."* | *"I designed and built the system using AI-assisted pair programming, but I have audited and verified every module, data structure, and graph algorithm. I can explain any line of code in the repository."* |
| *"Why doesn't the calendar have drag-and-drop task rescheduling?"* | *"It does, let me click it."* | *"In this version, Calendar focuses on dynamic monthly alignment, Day Details inspection, and contextual date creation. Downstream scheduling cascades are managed in the Dependencies and Gantt Timeline views to ensure impact preview before changes."* |

---

## 6. Common Presentation Mistakes to Avoid

1. **Don't Claim Backend Features:** Never refer to localStorage as a "database" or client-side role switching as "server-side authentication".
2. **Don't Skip the Algorithm Depth:** When showing dependencies, don't just say *"it links tasks"*; explain that it executes DFS cycle detection and Kahn's topological sort.
3. **Don't Forget the pnpm Command:** Remember to use `.\pnpm dev` or `.\pnpm test` (not `npm`).
4. **Don't Panic on Edge Cases:** If an unexpected state occurs, demonstrate the "Reset Demo Data" button in Settings to instantly restore clean seed data.
