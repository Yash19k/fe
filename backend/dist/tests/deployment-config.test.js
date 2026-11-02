"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_child_process_1 = require("node:child_process");
const config_1 = require("../config/config");
(0, node_test_1.test)("development backend listener defaults remain local", () => {
    strict_1.default.equal((0, config_1.validateBackendHost)(undefined, false), "127.0.0.1");
    strict_1.default.equal((0, config_1.validateBackendPort)(undefined, false), 3000);
});
(0, node_test_1.test)("production listener requires a valid explicit host and port", () => {
    strict_1.default.throws(() => (0, config_1.validateBackendHost)(undefined, true), /HOST must be explicitly configured/);
    strict_1.default.throws(() => (0, config_1.validateBackendHost)("https://example.invalid", true), /valid IP address or hostname/);
    strict_1.default.throws(() => (0, config_1.validateBackendPort)(undefined, true), /PORT must be explicitly configured/);
    strict_1.default.throws(() => (0, config_1.validateBackendPort)("70000", true), /between 1 and 65535/);
    strict_1.default.equal((0, config_1.validateBackendHost)("0.0.0.0", true), "0.0.0.0");
    strict_1.default.equal((0, config_1.validateBackendPort)("8080", true), 8080);
});
(0, node_test_1.test)("CORS allows multiple exact configured origins and rejects invalid entries", () => {
    const origins = (0, config_1.validateCorsOrigins)("https://one.example.invalid,https://two.example.invalid,https://one.example.invalid", true);
    strict_1.default.deepEqual(origins, ["https://one.example.invalid", "https://two.example.invalid"]);
    strict_1.default.equal((0, config_1.isAllowedOrigin)(origins[0], origins), true);
    strict_1.default.equal((0, config_1.isAllowedOrigin)("https://unapproved.example.invalid", origins), false);
    strict_1.default.equal((0, config_1.isAllowedOrigin)(undefined), true);
    strict_1.default.throws(() => (0, config_1.validateCorsOrigins)(undefined, true), /CORS_ORIGINS must contain/);
    strict_1.default.throws(() => (0, config_1.validateCorsOrigins)("*", true), /invalid origin/);
    strict_1.default.throws(() => (0, config_1.validateCorsOrigins)("https://one.example.invalid/path", true), /exact HTTP\(S\) origins/);
    strict_1.default.throws(() => (0, config_1.validateCorsOrigins)("http://one.example.invalid", true), /must use HTTPS/);
});
(0, node_test_1.test)("production frontend URL must be explicit HTTPS", () => {
    strict_1.default.throws(() => (0, config_1.validateFrontendUrl)(undefined, true), /FRONTEND_URL must be explicitly configured/);
    strict_1.default.throws(() => (0, config_1.validateFrontendUrl)("http://frontend.example.invalid", true), /must use HTTPS/);
    strict_1.default.equal((0, config_1.validateFrontendUrl)("https://frontend.example.invalid", true), "https://frontend.example.invalid");
});
(0, node_test_1.test)("production configuration startup fails clearly when HOST is missing", () => {
    const result = (0, node_child_process_1.spawnSync)(process.execPath, ["-r", "ts-node/register", "-e", "require('./config/config')"], {
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
        },
    });
    strict_1.default.notEqual(result.status, 0);
    strict_1.default.match(result.stderr, /HOST must be explicitly configured in production/);
});
