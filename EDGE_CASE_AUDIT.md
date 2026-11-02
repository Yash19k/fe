# 🛡️ Project Edge-Case & Vulnerability Audit Report

## Executive Summary

The source review found **0 Critical, 2 High, 9 Medium, and 4 Low** severity issues. The highest-risk findings are sensitive user fields serialized through chat conversation relations and asynchronous whiteboard socket handlers that can reject outside their error boundaries. The remaining findings concern authentication/session consistency, unbounded or incomplete data loading, input validation, and operational limits.

The chat conversation response was also checked with a read-only request: its nested user objects included `passwordHash`, `inviteTokenHash`, and `inviteExpiresAt` keys. No database writes or application-code fixes were performed for this audit.

## Identified Edge Cases & Issues

### CHAT-001: Chat responses expose sensitive user entity fields
- **Severity**: High
- **Affected File(s)**: `backend/services/chat.service.ts:181,268`
- **Component/Feature**: Chat conversation list and detail serialization
- **The Edge Case / Problem**: Both conversation detail and list queries load the complete related `User` entity. The resulting conversation objects are returned with nested user properties rather than an explicit public DTO.
- **Impact**: Any authorized conversation member can receive password hashes and invitation-token metadata for other members. The live read-only response confirmed these property names are present.
- **Recommended Fix**:
  ```typescript
  const publicUser = (user: User) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  });
  ```
  Select only public fields in the relation query and serialize conversation members through a response DTO.

### WHITEBOARD-001: Async socket event failures can escape error handling
- **Severity**: High
- **Affected File(s)**: `backend/websocket/whiteboard.gateway.ts:169-179,204-210,264-268`
- **Component/Feature**: Whiteboard Socket.IO event handlers
- **The Edge Case / Problem**: Async handlers perform database checks before entering their `try` blocks, and the cursor handler has no catch boundary. A database rejection from `isActiveActor` (or a failed recovery lookup in the scene-update catch block) can reject the listener promise without being handled by Socket.IO.
- **Impact**: Transient database failures can produce unhandled promise rejections, omit acknowledgements, and—in Node configurations that promote unhandled rejections—terminate the server process.
- **Recommended Fix**:
  ```typescript
  socket.on("whiteboard:cursor-move", (payload) => {
    void handleCursorMove(socket, payload).catch((error) => {
      logger.error({ error, socketId: socket.id }, "Whiteboard cursor handler failed");
    });
  });
  ```
  Apply a catch boundary to the complete asynchronous body of each handler and return a failure acknowledgement where one is supported.

### AUTH-001: Established real-time connections outlive token/session validity
- **Severity**: Medium
- **Affected File(s)**: `backend/websocket/chat.gateway.ts:48-62, authenticateUpgrade`; `backend/websocket/whiteboard.gateway.ts:94-103,118-124`
- **Component/Feature**: Chat and whiteboard WebSocket authentication
- **The Edge Case / Problem**: JWT validity is checked when a socket connects. Later event checks only verify that the user is still active; they do not check token expiry or whether the associated refresh session has been revoked.
- **Impact**: A socket can continue sending events after its access token expires or after logout revokes its session, until the connection is otherwise closed.
- **Recommended Fix**:
  ```typescript
  if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
    socket.disconnect(true);
    return;
  }
  ```
  Also bind sockets to the authenticated session and disconnect/reject them when that session is revoked.

### AUTH-002: Public organization registration has no rate limit
- **Severity**: Medium
- **Affected File(s)**: `backend/routes/user.routes.ts:18-26`
- **Component/Feature**: Public account and organization registration
- **The Edge Case / Problem**: Both public registration routes invoke `registerOrganization` directly. The login route has a limiter, but registration does not.
- **Impact**: Automated clients can repeatedly trigger password hashing and organization/user database writes, consuming resources and creating unwanted accounts.
- **Recommended Fix**:
  ```typescript
  const registrationLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 5,
    code: "REGISTRATION_RATE_LIMIT_EXCEEDED",
  });
  router.post("/register", registrationLimiter, asyncHandler(registerOrganization));
  ```
  Apply equivalent protection to both registration paths, preferably with a shared/distributed limiter in multi-instance deployments.

### AUTH-003: Registration can commit an account before session creation fails
- **Severity**: Medium
- **Affected File(s)**: `backend/controllers/user.controller.ts:88-119`
- **Component/Feature**: Organization onboarding
- **The Edge Case / Problem**: The organization, admin user, and SLA are committed in one transaction. Auth-session creation happens afterward.
- **Impact**: If session persistence fails after the transaction commits, the request fails while leaving a registered account. Retrying signup then encounters an existing email, even though the original request never completed successfully.
- **Recommended Fix**:
  ```typescript
  const result = await AppDataSource.transaction(async (manager) => {
    const account = await createOrganizationAndAdmin(manager, input);
    const session = await createAuthSession(manager, account.user);
    return { ...account, session };
  });
  ```
  Create the session in the same transaction when the session service supports the transaction manager.

### AUTH-004: Failed reset email invalidates a previously usable token
- **Severity**: Medium
- **Affected File(s)**: `backend/services/password-reset.service.ts:28-44,60-71`
- **Component/Feature**: Password reset
- **The Edge Case / Problem**: Issuing a token deletes prior tokens before the new email is sent. Delivery errors are logged and swallowed, so the endpoint can appear successful although the new token was never delivered.
- **Impact**: A user with a valid earlier reset link can lose it after requesting another reset whose email fails, leaving no usable link until another request succeeds.
- **Recommended Fix**:
  ```typescript
  const token = await createPendingResetToken(user.id);
  await sendPasswordResetEmail({ email: user.email, resetLink: buildResetLink(token) });
  await activateResetToken(token.id);
  ```
  Avoid invalidating the prior usable token until delivery has succeeded; preserve the neutral public response to prevent account enumeration.

### WHITEBOARD-002: Revision listing can return very large scene snapshots
- **Severity**: Medium
- **Affected File(s)**: `backend/websocket/whiteboard.gateway.ts:33,40-48`; `backend/services/whiteboard.service.ts:196-204`; `backend/validations/whiteboard.validation.ts:52-56`
- **Component/Feature**: Whiteboard revision history
- **The Edge Case / Problem**: Scene data may approach 900,000 bytes, and the revision query returns full revision entities, including each `sceneSnapshot`. The request limit accepts up to 100 rows.
- **Impact**: A single history request can load and serialize tens of megabytes of JSON, causing high database, memory, and network load.
- **Recommended Fix**:
  ```typescript
  const [items, total] = await repository.findAndCount({
    select: { id: true, revisionNumber: true, createdAt: true, changeSummary: true },
    // Load sceneSnapshot only from the single-revision endpoint.
    take: Math.min(limit, 25),
  });
  ```
  Return lightweight revision summaries and retrieve a snapshot only when the user requests that revision.

### WORK-001: Comments and time-entry history are unpaginated
- **Severity**: Medium
- **Affected File(s)**: `backend/controllers/work-item-collaboration.controller.ts:108-112,193-197`
- **Component/Feature**: Work-item collaboration history
- **The Edge Case / Problem**: Both endpoints load every matching record and related author/user rows into memory for each request.
- **Impact**: Long-lived work items can create slow responses and substantial database and application memory usage; response size grows without a bound.
- **Recommended Fix**:
  ```typescript
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
  const [items, total] = await repository.findAndCount({
    where: { workItemId },
    order: { createdAt: "DESC", id: "DESC" },
    skip: (page - 1) * limit,
    take: limit,
  });
  ```
  Validate pagination inputs and return pagination metadata.

### WORK-002: Invalid time-entry dates reach persistence unchecked
- **Severity**: Medium
- **Affected File(s)**: `backend/controllers/work-item-collaboration.controller.ts:143-168`
- **Component/Feature**: Time-entry creation
- **The Edge Case / Problem**: A supplied `startTime`/`date` is passed to `new Date()` without checking validity.
- **Impact**: Invalid values can cause database-driver errors and a 500 response instead of a clear client validation error.
- **Recommended Fix**:
  ```typescript
  const parsedStartTime = startTime ? new Date(startTime) : new Date();
  if (Number.isNaN(parsedStartTime.getTime())) {
    throw new AppError("Start time must be a valid date.", 400, "VALIDATION_ERROR");
  }
  ```

### FRONTEND-001: Projects with more than 100 work items load incompletely
- **Severity**: Medium
- **Affected File(s)**: `frontend/src/state/AppContext.tsx:245-246,794-799`
- **Component/Feature**: Project and cross-project work-item state
- **The Edge Case / Problem**: Both project loading paths request only page 1 with a limit of 100 and do not request subsequent pages.
- **Impact**: Work items after the first 100 are absent from client state, affecting views, counts, filters, and cross-project task operations.
- **Recommended Fix**:
  ```typescript
  const allItems = [];
  for (let page = 1; ; page += 1) {
    const response = await getProjectWorkItemsApi(projectId, page, 100);
    allItems.push(...response.data.workItems);
    if (page >= response.data.pagination.pages) break;
  }
  ```
  Use the API's pagination metadata and ensure project changes cancel or ignore stale page requests.

### WB-LOW-001: Whiteboard update dedupe key is not board-scoped
- **Severity**: Low
- **Affected File(s)**: `backend/websocket/whiteboard.gateway.ts:214-221`
- **Component/Feature**: Whiteboard scene-update deduplication
- **The Edge Case / Problem**: The key is `${userId}:${updateId}`, omitting the whiteboard ID, and is recorded before persistence. Reuse of an update ID on another board, or retry after a failed save, can be acknowledged as a duplicate without applying the update.
- **Impact**: A valid update may be silently dropped under client ID reuse or a retry with a previously failed ID.
- **Recommended Fix**:
  ```typescript
  const updateKey = `${payload.whiteboardId}:${socket.actor.id}:${payload.updateId}`;
  ```
  Scope the key to the board and record successful IDs only after persistence; coordinate in-flight duplicates separately.

### API-LOW-001: Internal database error codes can be returned to clients
- **Severity**: Low
- **Affected File(s)**: `backend/middleware/error.handler.ts:55-69`
- **Component/Feature**: Centralized error responses
- **The Edge Case / Problem**: For a 500 error, the handler replaces the message but still serializes `err.code` when present. Database/driver codes can therefore escape through the public `code` field.
- **Impact**: Responses reveal internal implementation details and may aid error fingerprinting; clients may also incorrectly depend on driver-specific codes.
- **Recommended Fix**:
  ```typescript
  const code =
    statusCode >= 500 && !safeUpstreamErrorCodes.has(err.code)
      ? "INTERNAL_SERVER_ERROR"
      : err.code;
  ```
  Return stable application-level error codes and keep driver details in server logs.

### WB-LOW-002: Whiteboard pagination permits arbitrarily large page numbers
- **Severity**: Low
- **Affected File(s)**: `backend/validations/whiteboard.validation.ts:52-56`
- **Component/Feature**: Whiteboard and revision list pagination
- **The Edge Case / Problem**: `page` has a lower bound but no upper bound, while the service computes an offset from it.
- **Impact**: Very large offsets can waste database work or exceed safe numeric ranges, resulting in slow queries or database errors.
- **Recommended Fix**:
  ```typescript
  page: Joi.number().integer().min(1).max(10_000).default(1),
  ```
  Prefer cursor pagination for datasets where callers need to traverse beyond a bounded offset.

### AUTH-LOW-001: Login rate limiting is process-local
- **Severity**: Low
- **Affected File(s)**: `backend/middleware/rate.limiter.ts:19-29,32-40`; `backend/routes/user.routes.ts:18-26`
- **Component/Feature**: Login brute-force protection
- **The Edge Case / Problem**: The limiter stores counters in a process-local `Map`. Each server instance maintains independent counts.
- **Impact**: In a multi-instance deployment, requests distributed across instances can exceed the configured login attempt limit.
- **Recommended Fix**:
  ```typescript
  const allowed = await sharedRateLimitStore.increment(`login:${ip}`, windowMs);
  if (!allowed) return next(new AppError("Too many login attempts.", 429, "LOGIN_RATE_LIMIT_EXCEEDED"));
  ```
  Use a shared store or enforce the limit at a trusted gateway.

## Audit Scope and Limitations

- This report records findings only; no application code was changed.
- The chat response check was read-only. No uploads, message writes, or migration execution were performed.
- Findings are based on inspected source paths and the available local runtime. External provider behavior, production deployment topology, and load characteristics were not independently tested.
- The whiteboard snapshot-size impact is a worst-case bound derived from the source validation limit and the maximum revision page size; it was not load-tested.
