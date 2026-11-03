import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  isAllowedOrigin,
  validateBackendHost,
  validateBackendPort,
  validateBoolean,
  validateCorsOrigins,
  validateFrontendUrl,
  validateNodeEnvironment,
  validatePort,
} from "../config/config";

test("NODE_ENV and boolean settings accept only documented values", () => {
  assert.equal(validateNodeEnvironment(undefined), "development");
  assert.equal(validateNodeEnvironment("test"), "test");
  assert.equal(validateNodeEnvironment("production"), "production");
  assert.throws(() => validateNodeEnvironment("prod"), /NODE_ENV must be one of/);
  assert.equal(validateBoolean(" TRUE ", "DB_SSL"), true);
  assert.equal(validateBoolean(undefined, "DB_SSL"), false);
  assert.throws(() => validateBoolean("yes", "DB_SSL"), /DB_SSL must be either/);
});

test("database and service ports are validated", () => {
  assert.equal(validatePort("5432", "DB_PORT", 5432), 5432);
  assert.throws(() => validatePort("0", "DB_PORT", 5432), /DB_PORT must be an integer/);
  assert.throws(() => validatePort("bad", "SMTP_PORT", 587), /SMTP_PORT must be an integer/);
});

test("development backend listener defaults remain local", () => {
  assert.equal(validateBackendHost(undefined, false), "127.0.0.1");
  assert.equal(validateBackendPort(undefined, false), 3000);
});

test("production listener requires a valid explicit host and port", () => {
  assert.throws(() => validateBackendHost(undefined, true), /HOST must be explicitly configured/);
  assert.throws(() => validateBackendHost("https://example.invalid", true), /valid IP address or hostname/);
  assert.throws(() => validateBackendPort(undefined, true), /PORT must be explicitly configured/);
  assert.throws(() => validateBackendPort("70000", true), /between 1 and 65535/);
  assert.equal(validateBackendHost("0.0.0.0", true), "0.0.0.0");
  assert.equal(validateBackendPort("8080", true), 8080);
});

test("CORS allows multiple exact configured origins and rejects invalid entries", () => {
  const origins = validateCorsOrigins(
    "https://one.example.invalid,https://two.example.invalid,https://one.example.invalid",
    true
  );
  assert.deepEqual(origins, ["https://one.example.invalid", "https://two.example.invalid"]);
  assert.equal(isAllowedOrigin(origins[0], origins), true);
  assert.equal(isAllowedOrigin("https://unapproved.example.invalid", origins), false);
  assert.equal(isAllowedOrigin(undefined), true);
  assert.throws(() => validateCorsOrigins(undefined, true), /CORS_ORIGINS must contain/);
  assert.throws(() => validateCorsOrigins("*", true), /invalid origin/);
  assert.throws(() => validateCorsOrigins("https://one.example.invalid/path", true), /exact HTTP\(S\) origins/);
  assert.throws(() => validateCorsOrigins("http://one.example.invalid", true), /must use HTTPS/);
});

test("production frontend URL must be explicit HTTPS", () => {
  assert.throws(() => validateFrontendUrl(undefined, true), /FRONTEND_URL must be explicitly configured/);
  assert.throws(() => validateFrontendUrl("http://frontend.example.invalid", true), /must use HTTPS/);
  assert.equal(
    validateFrontendUrl("https://frontend.example.invalid", true),
    "https://frontend.example.invalid"
  );
});

test("production configuration startup fails clearly when HOST is missing", () => {
  const result = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", "-e", "require('./config/config')"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "",
        PORT: "8080",
        CORS_ORIGINS: "https://frontend.example.invalid",
        FRONTEND_URL: "https://frontend.example.invalid",
        ACCESS_TOKEN_SECRET: "production_test_secret_at_least_32_characters",
        DB_PASSWORD: "configured-for-test",
        DB_SYNCHRONIZE: "false",
        DB_LOGGING: "false",
        DB_SSL: "false",
        DB_HOST: "database.example.invalid",
        DB_PORT: "5432",
        DB_USERNAME: "taskflow",
        DB_NAME: "taskflow",
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HOST must be explicitly configured in production/);
});
