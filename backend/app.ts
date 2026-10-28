import express, {type NextFunction, type Request ,type Response } from "express";
import organizationRoutes from "./routes/organization.routes";

import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";
import workItemRoutes from "./routes/work.item.routes";
import sprintRoutes from "./routes/sprint.routes";
import dashboardRoutes from "./routes/dashboard.route";
import notificationRoutes from "./routes/notification.routes";
import slaRoutes from "./routes/sla.routes";
import { errorHandler } from "./middleware/error.handler";
import { config } from "./config/config";
import chatRoutes from "./routes/chat.routes";

export const app = express();

console.log("App.ts executed");

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/work-items", workItemRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/api/chat/conversations", chatRoutes);
app.use("/api/conversations", chatRoutes);
app.use("/api/chat", chatRoutes);

app.use("/api/sla", slaRoutes);
app.use("/api/organization/sla", slaRoutes);

app.use("/api", sprintRoutes);
app.use("/api", dashboardRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    success: true,
    message: "TaskFlow API is healthy",
  });
});

app.get("/", (_req, res) => {
  console.log("GET / request received");
  res.json({
    success: true,
    message: "TaskFlow API is running",
  });
});

app.use(errorHandler);
