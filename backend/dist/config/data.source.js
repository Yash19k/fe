"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const path_1 = require("path");
const typeorm_1 = require("typeorm");
const config_1 = require("./config");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: config_1.config.database.host,
    port: config_1.config.database.port,
    username: config_1.config.database.username,
    password: (config_1.config.database.password),
    database: config_1.config.database.name,
    entities: [
        (0, path_1.join)(__dirname, "../entities/**/*{.ts,.js}").replace(/\\/g, "/"),
    ],
    migrations: [
        (0, path_1.join)(__dirname, "../migrations/**/*{.ts,.js}").replace(/\\/g, "/"),
    ],
    synchronize: config_1.config.database.synchronize,
    logging: config_1.config.database.logging,
});
