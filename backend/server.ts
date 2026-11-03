
import { app } from "./app";
import { createServer } from "http";
// import { app } from "./src/app"; 
import { config } from "./config/config";
import {
  AppDataSource,
  assertRequiredEntityMetadata,
} from "./config/data.source";

import { refreshSlaStatuses } from "./services/sla.service";
import { attachChatWebSocket } from "./websocket/chat.gateway";
import { attachWhiteboardSocket } from "./websocket/whiteboard.gateway";

import { startScheduler, stopScheduler } from "./services/scheduler.service";
import { createGracefulShutdown } from "./services/shutdown.service";


async function startServer(): Promise<void> {
  try {
    console.log("Starting TaskFlow...");
    console.log("Connecting to PostgreSQL...");

    await AppDataSource.initialize();
    assertRequiredEntityMetadata();

    console.log("Database connected successfully.");

    // Start background schedulers for automated SLA escalation and recurring tasks
    startScheduler();

    const server = createServer(app);
    const chatWebSocket = attachChatWebSocket(server);
    const socketIo = attachWhiteboardSocket(server);
    const shutdown = createGracefulShutdown({
      socketIo,
      chatWebSocket,
      stopScheduler,
      dataSource: AppDataSource,
      onTimeout: (error) => {
        console.error("[Shutdown] Forced exit after shutdown timeout.", {
          name: error.name,
        });
        server.closeAllConnections();
        for (const socket of chatWebSocket.clients) socket.terminate();
        socketIo.disconnectSockets(true);
        process.exit(1);
      },
    });

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM").catch((error: unknown) => {
        console.error("[Shutdown] Resource cleanup failed.", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        process.exit(1);
      });
    });
    process.on("SIGINT", () => {
      void shutdown("SIGINT").catch((error: unknown) => {
        console.error("[Shutdown] Resource cleanup failed.", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        process.exit(1);
      });
    });

    server.listen(config.port, config.host, () => {
      console.log(`Server listening on ${config.host}:${config.port}.`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${config.port} is already in use. Stop the existing backend process or set a different PORT before starting TaskFlow.`,
        );
      } else {
        console.error("HTTP server error:", {
          name: error.name,
          code: error.code,
        });
      }

      process.exitCode = 1;
      void shutdown("HTTP server error").catch((shutdownError: unknown) => {
        console.error("[Shutdown] Resource cleanup failed.", {
          name:
            shutdownError instanceof Error
              ? shutdownError.name
              : "UnknownError",
        });
        process.exit(1);
      });
    });

    server.on("close", () => {
      console.error("HTTP server closed.");
    });
  } catch (error) {
    console.error("Application startup failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    let schedulerStopped = false;
    try {
      await stopScheduler();
      schedulerStopped = true;
    } catch (cleanupError) {
      console.error("[Shutdown] Scheduler cleanup failed after startup error.", {
        name:
          cleanupError instanceof Error
            ? cleanupError.name
            : "UnknownError",
      });
    }
    if (AppDataSource.isInitialized && schedulerStopped) {
      try {
        await AppDataSource.destroy();
      } catch (cleanupError) {
        console.error("[Shutdown] Database cleanup failed after startup error.", {
          name:
            cleanupError instanceof Error
              ? cleanupError.name
              : "UnknownError",
        });
      }
    } else if (AppDataSource.isInitialized) {
      console.error(
        "[Shutdown] Database cleanup was skipped because scheduler shutdown did not complete.",
      );
      process.exit(1);
    }
    process.exitCode = 1;
  }
}

void startServer();
