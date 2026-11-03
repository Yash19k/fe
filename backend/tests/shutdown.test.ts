import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { afterEach, describe, test } from "node:test";
import { Server as SocketIoServer } from "socket.io";
import type { DataSource } from "typeorm";
import { WebSocketServer } from "ws";
import { createGracefulShutdown } from "../services/shutdown.service";

const activeServers: ReturnType<typeof createServer>[] = [];

function createFixture(options?: {
  requestListener?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void;
  stopScheduler?: () => Promise<void>;
  destroyDatabase?: () => Promise<void>;
  timeoutMs?: number;
  onTimeout?: () => void;
}) {
  const httpServer = createServer(options?.requestListener);
  const socketIo = new SocketIoServer(httpServer);
  const chatWebSocket = new WebSocketServer({ noServer: true });
  let databaseInitialized = true;
  let databaseDestroyed = false;
  let schedulerStops = 0;
  let timeoutCalls = 0;
  activeServers.push(httpServer);

  const shutdown = createGracefulShutdown({
    socketIo,
    chatWebSocket,
    stopScheduler: () => {
      schedulerStops += 1;
      return options?.stopScheduler?.() ?? Promise.resolve();
    },
    dataSource: {
      get isInitialized() {
        return databaseInitialized;
      },
      destroy: async () => {
        await options?.destroyDatabase?.();
        databaseDestroyed = true;
        databaseInitialized = false;
      },
    } as Pick<DataSource, "isInitialized" | "destroy">,
    timeoutMs: options?.timeoutMs,
    onTimeout: () => {
      timeoutCalls += 1;
      options?.onTimeout?.();
    },
  });

  return {
    httpServer,
    shutdown,
    schedulerStops: () => schedulerStops,
    databaseDestroyed: () => databaseDestroyed,
    timeoutCalls: () => timeoutCalls,
  };
}

async function listen(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

afterEach(async () => {
  for (const server of activeServers.splice(0)) {
    if (!server.listening) continue;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

describe("graceful shutdown", () => {
  test("closes HTTP, Socket.IO, chat WebSocket, scheduler, and database resources", async () => {
    const fixture = createFixture();
    await listen(fixture.httpServer);

    await fixture.shutdown("SIGTERM");

    assert.equal(fixture.httpServer.listening, false);
    assert.equal(fixture.schedulerStops(), 1);
    assert.equal(fixture.databaseDestroyed(), true);
    assert.equal(fixture.timeoutCalls(), 0);
  });

  test("runs shutdown only once for duplicate signals", async () => {
    const fixture = createFixture();
    await listen(fixture.httpServer);

    const first = fixture.shutdown("SIGTERM");
    const second = fixture.shutdown("SIGINT");
    assert.equal(first, second);
    await first;

    assert.equal(fixture.schedulerStops(), 1);
    assert.equal(fixture.databaseDestroyed(), true);
  });

  test("waits for in-flight HTTP requests before closing the database", async () => {
    let activeResponse!: ServerResponse;
    const fixture = createFixture({
      requestListener: (_request, response) => {
        activeResponse = response;
      },
    });
    await listen(fixture.httpServer);
    const address = fixture.httpServer.address();
    assert.ok(address && typeof address !== "string");
    const responsePromise = fetch(`http://127.0.0.1:${address.port}/in-flight`);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const shutdown = fixture.shutdown("SIGTERM");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fixture.databaseDestroyed(), false);

    activeResponse.end("complete");
    const response = await responsePromise;
    assert.equal(await response.text(), "complete");
    await shutdown;

    assert.equal(fixture.httpServer.listening, false);
    assert.equal(fixture.databaseDestroyed(), true);
  });

  test("handles SIGINT shutdown", async () => {
    const fixture = createFixture();
    await listen(fixture.httpServer);

    await fixture.shutdown("SIGINT");

    assert.equal(fixture.httpServer.listening, false);
    assert.equal(fixture.schedulerStops(), 1);
    assert.equal(fixture.databaseDestroyed(), true);
  });

  test("waits for running scheduler work before closing the database", async () => {
    let finishScheduler!: () => void;
    const fixture = createFixture({
      stopScheduler: () =>
        new Promise<void>((resolve) => {
          finishScheduler = resolve;
        }),
    });
    await listen(fixture.httpServer);

    const shutdown = fixture.shutdown("SIGTERM");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fixture.databaseDestroyed(), false);

    finishScheduler();
    await shutdown;
    assert.equal(fixture.databaseDestroyed(), true);
  });

  test("reports cleanup failures after attempting remaining resource cleanup", async () => {
    const fixture = createFixture({
      destroyDatabase: async () => {
        throw new Error("database cleanup failed");
      },
    });
    await listen(fixture.httpServer);

    await assert.rejects(fixture.shutdown("SIGTERM"), /database/);
    assert.equal(fixture.httpServer.listening, false);
    assert.equal(fixture.schedulerStops(), 1);
    assert.equal(fixture.databaseDestroyed(), false);
  });

  test("invokes the bounded-timeout handler when cleanup stalls", async () => {
    const fixture = createFixture({
      stopScheduler: () => new Promise<void>(() => {}),
      timeoutMs: 10,
    });
    await listen(fixture.httpServer);

    await assert.rejects(fixture.shutdown("SIGTERM"), /exceeded 10ms/);
    assert.equal(fixture.timeoutCalls(), 1);
    assert.equal(fixture.databaseDestroyed(), false);
  });
});
