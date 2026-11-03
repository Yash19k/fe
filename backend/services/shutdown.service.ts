import type { Server as SocketIoServer } from "socket.io";
import type { WebSocketServer } from "ws";
import type { DataSource } from "typeorm";

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

interface ShutdownDependencies {
  socketIo: SocketIoServer;
  chatWebSocket: WebSocketServer;
  stopScheduler: () => Promise<void>;
  dataSource: Pick<DataSource, "isInitialized" | "destroy">;
  onTimeout: (error: Error) => void;
  timeoutMs?: number;
}

async function attemptCleanup(
  name: string,
  operation: () => void | Promise<void>,
  failures: string[],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.error(`[Shutdown] ${name} cleanup failed.`, {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    failures.push(name);
  }
}

function closeSocketIo(socketIo: SocketIoServer): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      socketIo.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function closeChatWebSocket(chatWebSocket: WebSocketServer): Promise<void> {
  for (const socket of chatWebSocket.clients) {
    socket.close(1001, "Server shutting down");
  }

  return new Promise((resolve, reject) => {
    try {
      chatWebSocket.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function createGracefulShutdown(
  dependencies: ShutdownDependencies,
): (signal: string) => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;

  return (signal: string) => {
    if (shutdownPromise) return shutdownPromise;

    console.info(`[Shutdown] ${signal} received; stopping the application.`);

    const cleanup = (async () => {
      const failures: string[] = [];
      const schedulerStopped = attemptCleanup(
        "scheduler",
        dependencies.stopScheduler,
        failures,
      );
      const socketIoClosed = attemptCleanup(
        "Socket.IO",
        () => closeSocketIo(dependencies.socketIo),
        failures,
      );
      const chatWebSocketClosed = attemptCleanup(
        "chat WebSocket",
        () => closeChatWebSocket(dependencies.chatWebSocket),
        failures,
      );

      await Promise.all([
        schedulerStopped,
        socketIoClosed,
        chatWebSocketClosed,
      ]);

      if (failures.length > 0) {
        throw new Error(
          `Graceful shutdown failed during: ${failures.join(", ")}.`,
        );
      }

      if (dependencies.dataSource.isInitialized) {
        await attemptCleanup(
          "database",
          () => dependencies.dataSource.destroy(),
          failures,
        );
      }

      if (failures.length > 0) {
        throw new Error(
          `Graceful shutdown failed during: ${failures.join(", ")}.`,
        );
      }

      console.info("[Shutdown] All application resources closed.");
    })();

    let timeout: ReturnType<typeof setTimeout>;
    const timedOut = new Promise<void>((_resolve, reject) => {
      timeout = setTimeout(() => {
        const error = new Error(
          `Graceful shutdown exceeded ${dependencies.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS}ms.`,
        );
        try {
          dependencies.onTimeout(error);
        } catch (timeoutHandlerError) {
          console.error("[Shutdown] Timeout handler failed.", {
            name:
              timeoutHandlerError instanceof Error
                ? timeoutHandlerError.name
                : "UnknownError",
          });
        }
        reject(error);
      }, dependencies.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS);
    });

    shutdownPromise = Promise.race([cleanup, timedOut]).finally(() => {
      clearTimeout(timeout);
    });
    return shutdownPromise;
  };
}
