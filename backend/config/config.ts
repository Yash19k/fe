
import dotenv from "dotenv";
import { isIP } from "node:net";


dotenv.config();
const isProduction = process.env.NODE_ENV === "production";

export function validateBackendHost(value: string | undefined, production = isProduction): string {
  const host = value?.trim() || (production ? "" : "127.0.0.1");
  if (!host) {
    throw new Error("HOST must be explicitly configured in production.");
  }
  const isValidHostname =
    host.length <= 253 &&
    host.split(".").every((label) =>
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label),
    );
  if (isIP(host) === 0 && !isValidHostname) {
    throw new Error("HOST must be a valid IP address or hostname.");
  }
  return host;
}

export function validateBackendPort(value: string | undefined, production = isProduction): number {
  if (value === undefined && production) {
    throw new Error("PORT must be explicitly configured in production.");
  }
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

export function validateCorsOrigins(
  value: string | undefined,
  production = isProduction,
): string[] {
  const rawOrigins = value === undefined
    ? production
      ? []
      : ["http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173"]
    : value.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (rawOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must contain at least one allowed origin in production.");
  }

  return [...new Set(rawOrigins.map((origin) => {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.origin !== origin
    ) {
      throw new Error(`CORS_ORIGINS entries must be exact HTTP(S) origins: ${origin}`);
    }
    if (production && url.protocol !== "https:") {
      throw new Error("CORS_ORIGINS entries must use HTTPS in production.");
    }
    return url.origin;
  }))];
}

export function isAllowedOrigin(
  origin?: string,
  allowedOrigins: readonly string[] = config.corsOrigins,
): boolean {
  return !origin || allowedOrigins.includes(origin);
}

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test"));
const accessTokenSecret =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  (isTestEnv
    ? "test_jwt_secret_must_be_at_least_32_characters_long"
    : undefined);
if (!accessTokenSecret || accessTokenSecret.length < 32) {
  throw new Error(
    "ACCESS_TOKEN_SECRET (or JWT_SECRET) must be configured with a strong secret of at least 32 characters."
  );
}
const databaseSynchronize = process.env.DB_SYNCHRONIZE === "true";
const databasePassword = process.env.DB_PASSWORD ?? "";
if (process.env.NODE_ENV === "production" && !databasePassword.trim()) {
  throw new Error("DB_PASSWORD must be configured in production.");
}
if (process.env.NODE_ENV === "production" && databaseSynchronize) {
  throw new Error("DB_SYNCHRONIZE must be disabled in production.");
}
const invitationLifetimeHours = Number(
  process.env.INVITATION_LIFETIME_HOURS ?? 24,
);
if (!Number.isFinite(invitationLifetimeHours) || invitationLifetimeHours <= 0) {
  throw new Error("INVITATION_LIFETIME_HOURS must be a positive number.");
}

export function validateFrontendUrl(
  value: string | undefined,
  production = isProduction,
): string {
  const frontendUrl = value ?? (production ? "" : "http://localhost:5173");
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL must be explicitly configured in production.");
  }
  let url: URL;
  try {
    url = new URL(frontendUrl);
  } catch {
    throw new Error("FRONTEND_URL must be a valid absolute URL.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "FRONTEND_URL must use HTTP or HTTPS and must not contain credentials, a query, or a fragment.",
    );
  }
  if (production && url.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production.");
  }

  return url.toString().replace(/\/$/, "");
}

const frontendUrl = validateFrontendUrl(process.env.FRONTEND_URL);
const corsOrigins = validateCorsOrigins(process.env.CORS_ORIGINS);
if (isProduction && !corsOrigins.includes(new URL(frontendUrl).origin)) {
  throw new Error("CORS_ORIGINS must include the FRONTEND_URL origin in production.");
}

export const config = {
  host: validateBackendHost(process.env.HOST),
  port: validateBackendPort(process.env.PORT),
  frontendUrl,
  invitationLifetimeHours,
  corsOrigins,
  cookieSameSite: (() => {
    const sameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase() ?? "lax";
    if (!["lax", "strict", "none"].includes(sameSite)) {
      throw new Error("COOKIE_SAME_SITE must be one of: lax, strict, none.");
    }
    if (sameSite === "none" && !isProduction) {
      throw new Error("COOKIE_SAME_SITE=none is supported only in production.");
    }
    return sameSite as "lax" | "strict" | "none";
  })(),

  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? "postgres",
    password: databasePassword,
    name: process.env.DB_NAME ?? "taskflow",
    synchronize: databaseSynchronize,
    logging: process.env.DB_LOGGING === "true",
  },
  accessTokenSecret,
  email: {
    smtpHost: process.env.SMTP_HOST ?? (process.env as any)["SMTP HOST"] ?? "",
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpSecure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
    smtpUser: process.env.SMTP_USER ?? (process.env as any)["SMTP USER"] ?? "",
    smtpPassword: process.env.SMTP_PASS ?? (process.env as any)["SMTP PASS"] ?? process.env.SMTP_PASSWORD ?? "",
    smtpFrom: process.env.SMTP_FROM ?? (process.env as any)["SMTP FROM"] ?? "",
  },
};
