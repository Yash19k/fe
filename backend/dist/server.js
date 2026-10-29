"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const http_1 = require("http");
// import { app } from "./src/app"; 
const config_1 = require("./config/config");
const data_source_1 = require("./config/data.source");
const chat_gateway_1 = require("./websocket/chat.gateway");
const whiteboard_gateway_1 = require("./websocket/whiteboard.gateway");
const scheduler_service_1 = require("./services/scheduler.service");
async function startServer() {
    try {
        console.log("Starting TaskFlow...");
        console.log("Connecting to PostgreSQL...");
        await data_source_1.AppDataSource.initialize();
        console.log("Database connected successfully.");
        // Start background schedulers for automated SLA escalation and recurring tasks
        (0, scheduler_service_1.startScheduler)();
        const server = (0, http_1.createServer)(app_1.app);
        (0, chat_gateway_1.attachChatWebSocket)(server);
        (0, whiteboard_gateway_1.attachWhiteboardSocket)(server);
        server.listen(config_1.config.port, config_1.config.host, () => {
            console.log(`Server running at http://${config_1.config.host}:${config_1.config.port}`);
        });
        server.on("error", (error) => {
            (0, scheduler_service_1.stopScheduler)();
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
            (0, scheduler_service_1.stopScheduler)();
            console.error("HTTP server closed.");
        });
    }
    catch (error) {
        console.error("Application startup failed:", error);
        process.exitCode = 1;
    }
}
void startServer();
