"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
// import { app } from "./src/app"; 
const config_1 = require("./config/config");
const data_source_1 = require("./config/data.source");
async function startServer() {
    try {
        if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET must be configured in production.");
        }
        console.log("Starting TaskFlow...");
        console.log("Connecting to PostgreSQL...");
        await data_source_1.AppDataSource.initialize();
        console.log("Database connected successfully.");
        const server = app_1.app.listen(config_1.config.port, config_1.config.host, () => {
            console.log(`Server running at http://${config_1.config.host}:${config_1.config.port}`);
        });
        server.on("error", (error) => {
            if (error.code === "EADDRINUSE") {
                console.error(`Port ${config_1.config.port} is already in use. Stop the existing backend process or set a different PORT before starting TaskFlow.`);
            }
            else {
                console.error("HTTP server error:", error);
            }
            process.exitCode = 1;
            server.close();
        });
        server.on("close", () => {
            console.error("HTTP server closed.");
        });
    }
    catch (error) {
        console.error("Application startup failed:", error);
        process.exitCode = 1;
    }
}
void startServer();
