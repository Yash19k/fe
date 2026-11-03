
import dotenv from "dotenv";
import { isIP } from "node:net";

dotenv.config();

export type NodeEnvironment = "development" | "test" | "production";

export function validateNodeEnvironment(value: string | undefined): NodeEnvironment {
  const environment = value ?? "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be one of: development, test, production.");
  }
  return environment as NodeEnvironment;
}

const nodeEnvironment = validateNodeEnvironment(process.env.NODE_ENV);
const isProduction = nodeEnvironment === "production";

export function validateBoolean(
  value: string | undefined,
  name: string,
  defaultValue = false,
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be either true or false.`);
}

export function validatePort(
  value: string | undefined,
  name: string,
  defaultValue: number,
  required = false,
): number {
  if (value === undefined && required) {
    throw new Error(`${name} must be explicitly configured in production.`);
  }
  const port = Number(value ?? defaultValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

function requireProductionValue(name: string, value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || (isProduction ? "" : fallback);
  if (!resolved) {
    throw new Error(`${name} must be explicitly configured in production.`);
  }
  return resolved;
}

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
  return validatePort(value, "PORT", 3000, production);
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

const isTestEnv = nodeEnvironment === "test" ||
  (!isProduction && process.argv.some((arg) => arg.includes("test")));
const accessTokenSecret =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  (!isProduction && isTestEnv
    ? "test_jwt_secret_must_be_at_least_32_characters_long"
    : undefined);
if (!accessTokenSecret || accessTokenSecret.length < 32) {
  throw new Error(
    "ACCESS_TOKEN_SECRET (or JWT_SECRET) must be configured with a strong secret of at least 32 characters."
  );
}
const databaseSynchronize = validateBoolean(
  process.env.DB_SYNCHRONIZE,
  "DB_SYNCHRONIZE",
);
const databaseLogging = validateBoolean(process.env.DB_LOGGING, "DB_LOGGING");
const databaseSsl = validateBoolean(process.env.DB_SSL, "DB_SSL");
const databasePassword = requireProductionValue(
  "DB_PASSWORD",
  process.env.DB_PASSWORD,
  "",
);
if (isProduction && databaseSynchronize) {
  throw new Error("DB_SYNCHRONIZE must be disabled in production.");
}
if (isProduction && databaseLogging) {
  throw new Error("DB_LOGGING must be disabled in production.");
}
const database = {
  host: requireProductionValue("DB_HOST", process.env.DB_HOST, "localhost"),
  port: validatePort(process.env.DB_PORT, "DB_PORT", 5432, isProduction),
  username: requireProductionValue(
    "DB_USERNAME",
    process.env.DB_USERNAME,
    "postgres",
  ),
  password: databasePassword,
  name: requireProductionValue("DB_NAME", process.env.DB_NAME, "taskflow"),
  synchronize: databaseSynchronize,
  logging: databaseLogging,
  ssl: databaseSsl,
};
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

const smtpPort = validatePort(
  process.env.SMTP_PORT,
  "SMTP_PORT",
  587,
);
const smtp = {
  smtpHost: process.env.SMTP_HOST ?? process.env["SMTP HOST"] ?? "",
  smtpPort,
  smtpSecure: validateBoolean(
    process.env.SMTP_SECURE,
    "SMTP_SECURE",
    smtpPort === 465,
  ),
  smtpUser: process.env.SMTP_USER ?? process.env["SMTP USER"] ?? "",
  smtpPassword:
    process.env.SMTP_PASS ??
    process.env["SMTP PASS"] ??
    process.env.SMTP_PASSWORD ??
    "",
  smtpFrom: process.env.SMTP_FROM ?? process.env["SMTP FROM"] ?? "",
};
const smtpValues = [
  smtp.smtpHost,
  smtp.smtpUser,
  smtp.smtpPassword,
  smtp.smtpFrom,
];
if (smtpValues.some(Boolean) && smtpValues.some((value) => !value.trim())) {
  throw new Error(
    "SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM together.",
  );
}

const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  apiKey: process.env.CLOUDINARY_API_KEY ?? "",
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
};
const cloudinaryValues = [
  cloudinary.cloudName,
  cloudinary.apiKey,
  cloudinary.apiSecret,
];
if (cloudinaryValues.some(Boolean) && cloudinaryValues.some((value) => !value.trim())) {
  throw new Error(
    "Cloudinary configuration is incomplete. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together.",
  );
}

export const config = {
  nodeEnvironment,
  isProduction,
  host: validateBackendHost(process.env.HOST),
  port: validateBackendPort(process.env.PORT),
  frontendUrl,
  invitationLifetimeHours,
  corsOrigins,
  cookieSecure: isProduction,
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

  database,
  accessTokenSecret,
  email: smtp,
  cloudinary,
};
