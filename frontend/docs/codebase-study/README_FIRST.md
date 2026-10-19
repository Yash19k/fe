# TaskFlow Pro — Beginner-Friendly Starting Guide (`README_FIRST.md`)

Welcome to the comprehensive codebase study for **TaskFlow Pro**. This guide is designed to help you thoroughly understand every layer of this application—from startup and component architecture to complex graph algorithms, state management, and persistence—so you can confidently explain and defend your work during technical evaluations.

---

## 1. What Exactly is TaskFlow Pro?

**TaskFlow Pro** is an industrial-grade, dark-themed team project and task management single-page web application inspired by modern productivity workspaces like Asana and Linear.

### Key Architectural Truths to Know Right Away:
1. **Frontend-Only Architecture:** TaskFlow Pro is 100% client-side. There is **no Express, Node.js server, PostgreSQL, GraphQL, or REST API**.
2. **Framework & Language:** Built with **React 19** and **TypeScript**, bundled with **Vite v8**, and styled with **Tailwind CSS v4**.
3. **Dual Persistence Strategy:**
   - **`localStorage`:** Stores JSON state (Users, Projects, Workflows, Tasks, Notifications, Audit Log) using versioned keys (`taskflow_*_v2`).
   - **`IndexedDB`:** Stores binary media attachments (images/videos up to 25 MB) to avoid crashing or bloating `localStorage`.
4. **Simulated Real-Time Collaboration:** Multi-tab synchronization is achieved via the browser's native **`BroadcastChannel` API** (`taskflow_pro_sync_channel`). Opening two tabs allows you to see live updates and conflict detection without any server.
5. **Real Mathematical & Graph Algorithms:** The application includes real, pure-function domain implementations for:
   - **Directed Acyclic Graph (DAG) cycle detection** via Depth-First Search (DFS) path reconstruction.
   - **Critical Path Method (CPM)** with topological sorting (Kahn's algorithm), forward/backward passes, and slack calculations.
   - **Finish-to-Start (FS) auto-scheduling** that skips weekends (Saturdays and Sundays).
   - **Recurrence engine** supporting weekly Monday, 1st of the month, and last Friday of the month (including leap year arithmetic).

---

## 2. How to Run and Verify the Application

Always use the local **pnpm** wrapper declared in the repository (`pnpm@12.11.2` via `.\pnpm.cmd`):

### Available Scripts (from `package.json`):
```powershell
# 1. Start the local development server (Vite)
.\pnpm dev
# Runs locally at: http://localhost:5173/

# 2. Run the automated TypeScript unit tests (Node.js test runner via tsx)
.\pnpm test
# Executes 26 unit tests across 4 suites (Projects, Recurrence, Dependencies, Scheduling)

# 3. Run the strict static typechecker
.\pnpm typecheck
# Executes tsc --noEmit (verifies zero compile errors)

# 4. Run the high-performance linter
.\pnpm lint
# Executes oxlint (verifies zero lint errors or unused imports)

# 5. Build for production
.\pnpm build
# Runs vite build (generates optimized bundle in dist/)
```

---

## 3. Recommended Study Roadmap

To master this codebase without feeling overwhelmed, study the deliverables in this exact order:

```
Step 1: README_FIRST.md (You are here)
   │    └─ High-level identity, core facts, commands, glossary.
   ▼
Step 2: ARCHITECTURE_GUIDE.md
   │    └─ Bootstrap sequence, router, 3-column layout shell, Context architecture.
   ▼
Step 3: FEATURES_AND_DATA_FLOWS.md
   │    └─ 20 end-to-end user journeys traced click-by-click.
   ▼
Step 4: ALGORITHMS_EXPLAINED.md
   │    └─ The 8 mathematical & graph engines (DFS, CPM, FS business days, Recurrence, etc.).
   ▼
Step 5: FILE_BY_FILE_GUIDE.md
   │    └─ Complete inventory of every file in the codebase with evaluator Q&A.
   ▼
Step 6: KNOWN_LIMITATIONS_AND_EVIDENCE.md
   │    └─ Honest explanation of frontend-only boundaries vs. backend production systems.
   ▼
Step 7: EVALUATION_PREP.md
   │    └─ 60-second pitch, 3-minute tech breakdown, 5-minute demo script, and 35+ hard Q&As.
   ▼
Step 8: HANDS_ON_LEARNING_PLAN.md
        └─ 10 practical stages to test yourself in the browser and terminal.
```

---

## 4. Glossary of Essential Engineering Terms

- **Single-Page Application (SPA):** A web application that loads a single HTML page (`index.html`) and dynamically updates the DOM via JavaScript as the user interacts, without reloading the page from a server.
- **Client-Side Hash Routing:** A routing mechanism using the URL hash (`#/project/proj-1/board`). When the hash changes, the browser does not request a new page from a server; instead, a `hashchange` listener updates the React state to render the appropriate view.
- **Finish-to-Start (FS) Dependency:** A project management constraint where a successor task cannot begin until its predecessor task has finished.
- **Directed Acyclic Graph (DAG):** A network of nodes (tasks) connected by directional edges (dependencies) that contains no closed loops (cycles). A task cannot depend directly or indirectly on itself.
- **Kahn's Algorithm (Topological Sort):** An algorithm that orders graph nodes linearly such that for every directed edge $u \to v$, node $u$ comes before $v$. Used to determine the valid execution sequence of tasks.
- **Critical Path Method (CPM):** An analytical project scheduling technique that calculates Early Start/Finish and Late Start/Finish dates to find tasks with **Zero Slack (Float)**. Any delay in a critical task delays the entire project completion date.
- **Slack (Total Float):** The amount of time a task can be delayed from its early start without delaying the project finish date ($LS - ES$ or $LF - EF$).
- **Optimistic Concurrency:** A pattern where records maintain a `version` number or `updatedAt` timestamp. If another user/tab modifies the task while you have it open, the app detects the version mismatch and warns you before overwriting changes.
- **`BroadcastChannel`:** A browser Web API that allows bidirectional communication between open browser tabs or windows running on the same origin (domain and port).
- **IndexedDB:** A low-level, high-capacity client-side database built into the browser, ideal for storing large binary objects (`Blob` files like images and videos) that would otherwise exceed `localStorage` limits (~5 MB).
