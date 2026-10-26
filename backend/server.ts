
import { app } from "./app";
// import { app } from "./src/app"; 
import { config } from "./config/config";
import { AppDataSource } from "./config/data.source";
import { startScheduler, stopScheduler } from "./services/scheduler.service";

async function startServer(): Promise<void> {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET must be configured in production.");
    }

    console.log("Starting TaskFlow...");
    console.log("Connecting to PostgreSQL...");

    await AppDataSource.initialize();

    console.log("Database connected successfully.");

    // Start background schedulers for automated SLA escalation and recurring tasks
    startScheduler();

    const server = app.listen(config.port, config.host, () => {
      console.log(
        `Server running at http://${config.host}:${config.port}`,
      );
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      stopScheduler();
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${config.port} is already in use. Stop the existing backend process or set a different PORT before starting TaskFlow.`,
        );
      } else {
        console.error("HTTP server error:", error);
      }

      process.exitCode = 1;
      server.close();
    });

    server.on("close", () => {
      stopScheduler();
      console.error("HTTP server closed.");
    });
  } catch (error) {
    console.error("Application startup failed:", error);
    process.exitCode = 1;
  }
}

void startServer();
