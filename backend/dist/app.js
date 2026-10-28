"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const organization_routes_1 = __importDefault(require("./routes/organization.routes"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const work_item_routes_1 = __importDefault(require("./routes/work.item.routes"));
const sprint_routes_1 = __importDefault(require("./routes/sprint.routes"));
const dashboard_route_1 = __importDefault(require("./routes/dashboard.route"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const sla_routes_1 = __importDefault(require("./routes/sla.routes"));
const error_handler_1 = require("./middleware/error.handler");
const config_1 = require("./config/config");
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const whiteboard_routes_1 = __importDefault(require("./routes/whiteboard.routes"));
exports.app = (0, express_1.default)();
console.log("App.ts executed");
exports.app.disable("x-powered-by");
exports.app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});
exports.app.use(express_1.default.json({ limit: "1mb" }));
exports.app.use(express_1.default.urlencoded({ extended: false, limit: "1mb" }));
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || config_1.config.corsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use("/api/users", user_routes_1.default);
exports.app.use("/api/projects", project_routes_1.default);
exports.app.use("/api/work-items", work_item_routes_1.default);
exports.app.use("/api/organizations", organization_routes_1.default);
exports.app.use("/api/organization", organization_routes_1.default);
exports.app.use("/api/notifications", notification_routes_1.default);
exports.app.use("/api/chat/conversations", chat_routes_1.default);
exports.app.use("/api/conversations", chat_routes_1.default);
exports.app.use("/api/chat", chat_routes_1.default);
exports.app.use("/api", whiteboard_routes_1.default);
exports.app.use("/api/sla", sla_routes_1.default);
exports.app.use("/api/organization/sla", sla_routes_1.default);
exports.app.use("/api", sprint_routes_1.default);
exports.app.use("/api", dashboard_route_1.default);
exports.app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        success: true,
        message: "TaskFlow API is healthy",
    });
});
exports.app.get("/", (_req, res) => {
    console.log("GET / request received");
    res.json({
        success: true,
        message: "TaskFlow API is running",
    });
});
exports.app.use(error_handler_1.errorHandler);
