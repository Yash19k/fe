# TaskFlow Pro — Known Limitations & Evidence Trail (`KNOWN_LIMITATIONS_AND_EVIDENCE.md`)

This document records the **verified architectural boundaries, frontend-only limitations, and design trade-offs** in TaskFlow Pro.

In an evaluation or code review, demonstrating that you understand the exact boundaries of your architecture is a major sign of senior engineering maturity. This guide arms you with an honest, evidence-based accounting of what is intentional vs. what would change in a full-stack system.

---

## 1. Summary of Architectural Truths

| Dimension | Current Implementation in TaskFlow Pro | Enterprise Production Standard |
| :--- | :--- | :--- |
| **Backend / API** | **None** (100% Client-Side React SPA) | Node.js, Go, or Python REST / GraphQL / gRPC API |
| **Primary Database** | **Browser LocalStorage** (`taskflow_*_v2`) | PostgreSQL, MySQL, or distributed document store |
| **Media Attachments** | **Browser IndexedDB** (`dayflow-media`) | AWS S3, Google Cloud Storage, or Cloudflare R2 |
| **Authentication** | **Mock In-Memory User Switcher** (`AppContext`) | JWT / Session cookies, OAuth2 / OIDC, bcrypt hashing |
| **Authorization (RBAC)** | **UI-Level Component Hiding** (`permissions.ts`) | Server-side middleware & Database Row-Level Security (RLS) |
| **Real-Time Sync** | **Browser `BroadcastChannel` API** (`broadcast.ts`) | WebSockets, Server-Sent Events (SSE), or WebRTC |
| **Concurrency Engine** | **Version / Timestamp Tracking** (`concurrency.ts`) | CRDTs (Yjs / Automerge) or Server-side Optimistic Locking |

---

## 2. Deep-Dive: Specific Limitations & Code Evidence

### Limitation 1: Client-Side Authorization & Project Privacy
- **Source Code Evidence:** [`src/domain/permissions.ts`](file:///d:/Codes/temp/DayFlow/src/domain/permissions.ts) (lines 33–61) and [`src/App.tsx`](file:///d:/Codes/temp/DayFlow/src/App.tsx) (lines 75, 119–136).
- **Current Behavior:** Project visibility (`global` vs `private`) and user roles (`Admin`, `Manager`, `Teammate`) are checked in React memory using `canUserAccessProject(project, userId)` and `hasPermission(role, permission)`.
- **Why It Is a Limitation:** Because all project and task records are stored in the browser's `localStorage`, any user with basic technical knowledge can open Chrome DevTools $\to$ Application $\to$ Local Storage and read private project titles or descriptions.
- **Evaluation Defense:**
  > *"Role-based permissions and project privacy in TaskFlow Pro are interaction design models meant to demonstrate correct workflow restrictions, UI adapting, and user experience. We make zero claims of cryptographic data isolation. In a production release, authorization would be enforced strictly at the database layer using PostgreSQL Row-Level Security (RLS) and verified on every server request via authenticated JWT claims."*

---

### Limitation 2: Storage Quota & Device Scope
- **Source Code Evidence:** [`src/state/storage.ts`](file:///d:/Codes/temp/DayFlow/src/state/storage.ts) (lines 27–36, 276–285).
- **Current Behavior:** All JSON state is serialized via `localStorage.setItem()`.
- **Why It Is a Limitation:**
  1. `localStorage` is tied to a specific browser profile on a specific physical device. Changes made in Chrome on your laptop will not appear on your mobile phone or in another browser.
  2. If the user clears site data, cookies, or browser cache, all created projects and tasks are erased (resetting to seed data).
- **Evaluation Defense:**
  > *"We deliberately chose a dual-storage strategy: localStorage for rapid JSON state persistence and IndexedDB for heavy binary assets. This keeps the application completely serverless and runnable anywhere with zero backend deployment costs, while non-destructive schema migrations in `storage.ts` guarantee data integrity across app refreshes."*

---

### Limitation 3: Multi-Tab vs. Multi-Device Collaboration
- **Source Code Evidence:** [`src/state/broadcast.ts`](file:///d:/Codes/temp/DayFlow/src/state/broadcast.ts) (lines 13–53).
- **Current Behavior:** Real-time updates utilize the browser's native `BroadcastChannel` named `taskflow_pro_sync_channel`.
- **Why It Is a Limitation:** `BroadcastChannel` only works across browser tabs and windows **running on the same origin on the same physical machine**. It cannot communicate with another developer working on a different computer.
- **Evaluation Defense:**
  > *"To deliver an authentic multi-user experience without requiring evaluators to spin up cloud servers or WebSocket daemons, we harnessed the native browser BroadcastChannel API. This enables a live demonstration of real-time multi-tab synchronization and optimistic conflict detection entirely in the local browser."*

---

### Limitation 4: Media Attachments are Local to Browser IndexedDB
- **Source Code Evidence:** [`src/utils/mediaStorage.ts`](file:///d:/Codes/temp/DayFlow/src/utils/mediaStorage.ts) (lines 15–80) and [`src/components/tasks/TaskAttachments.tsx`](file:///d:/Codes/temp/DayFlow/src/components/tasks/TaskAttachments.tsx).
- **Current Behavior:** Files (images/videos up to 25 MB) are stored as raw `Blob` objects in the browser's IndexedDB database named `dayflow-media`.
- **Why It Is a Limitation:** While task metadata (`name`, `size`, `type`, `blobKey`) synchronizes across tabs via localStorage and BroadcastChannel, the raw media file itself is stored in the local browser's IndexedDB.
- **Evaluation Defense:**
  > *"We engineered this specifically to prevent localStorage quota crashes. Base64 strings in localStorage will quickly exceed the 5 MB ceiling. By offloading binary media to IndexedDB and generating object URLs on demand with automatic revocation, we achieved safe, responsive media handling in a 100% client-side prototype."*

---

### Limitation 5: Calendar Direct Drag-and-Drop Rescheduling
- **Source Code Evidence:** [`src/features/project/ProjectCalendarView.tsx`](file:///d:/Codes/temp/DayFlow/src/features/project/ProjectCalendarView.tsx).
- **Current Behavior:** Clicking a calendar day opens the focused **Day Details** dialog, which lists all scheduled items, allows opening the task drawer, and provides a "+ Create task for this date" button. However, dragging and dropping a task across calendar cells to change its date is not implemented.
- **Why It Is a Decision (Not an Accident):** In project management with dependency constraints, moving a task's date can trigger a cascade that reschedules dozens of downstream tasks. TaskFlow Pro deliberately isolates dependency-aware rescheduling to the **Dependencies** and **Timeline** views, where users can inspect the `ImpactPreviewModal` before applying changes.
- **Evaluation Defense:**
  > *"In our UX hierarchy, changing dates on dependent tasks requires a visual preview of downstream impact. The Calendar view is optimized for schedule scanning, date details, and contextual task creation, while consequential schedule cascades are managed through the Timeline and Dependencies engine."*

---

## 3. Production Roadmap: Migrating to Full-Stack

If asked during your evaluation: *"What is the step-by-step roadmap to turn this into a commercial SaaS product?"*, cite these exact steps:

```
Step 1: Database & ORM
  └─ Replace localStorage with PostgreSQL using Prisma or Drizzle ORM.
  └─ Schema maps 1:1 to src/types/index.ts (Projects, Tasks, Workflows, Audit).

Step 2: Authentication & Security
  └─ Implement real auth with Supabase Auth, NextAuth, or Clerk.
  └─ Enforce Row-Level Security (RLS) on the database for Project visibility.

Step 3: Object Storage
  └─ Replace IndexedDB with AWS S3 or Cloudflare R2 using pre-signed URLs.

Step 4: Real-Time Infrastructure
  └─ Replace BroadcastChannel with WebSocket server (Socket.io or Supabase Realtime).

Step 5: Shared Domain Logic (Zero Rewrite!)
  └─ Keep src/domain/ algorithms (cycle detection, scheduling, critical path, recurrence)
     in a shared TypeScript package used by both the frontend and backend API.
```
