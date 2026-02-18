export {
  createDb,
  ensurePostgresDatabase,
  migratePostgresIfEmpty,
  type MigrationBootstrapResult,
  type Db,
} from "./client.js";
export * from "./schema/index.js";
