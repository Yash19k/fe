
import "reflect-metadata";
import { join } from "path";
import { DataSource } from "typeorm";
import { config } from "./config";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: (config.database.password),
  database: config.database.name,

  entities: [
    join(__dirname, "../entities/**/*{.ts,.js}").replace(/\\/g, "/"),
  ],

  migrations: [
    join(__dirname, "../migrations/**/*{.ts,.js}").replace(/\\/g, "/"),
  ],

  synchronize: config.database.synchronize,
  logging: config.database.logging,
});
