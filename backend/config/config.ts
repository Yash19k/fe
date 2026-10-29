
import dotenv from "dotenv";


dotenv.config();
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
  value: string,
  isProduction = process.env.NODE_ENV === "production",
): string {
  let url: URL;
  try {
    url = new URL(value);
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
  if (isProduction && url.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production.");
  }

  return url.toString().replace(/\/$/, "");
}

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: validateFrontendUrl(
    process.env.FRONTEND_URL ?? "http://localhost:5173",
  ),
  invitationLifetimeHours,
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
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
