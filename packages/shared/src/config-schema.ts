import { z } from "zod";

export const configMetaSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  source: z.enum(["onboard", "configure", "doctor"]),
});

export const llmConfigSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  apiKey: z.string().optional(),
});

export const databaseConfigSchema = z.object({
  mode: z.enum(["embedded-postgres", "postgres"]).default("embedded-postgres"),
  connectionString: z.string().optional(),
  embeddedPostgresDataDir: z.string().default("./data/embedded-postgres"),
  embeddedPostgresPort: z.number().int().min(1).max(65535).default(54329),
});

export const loggingConfigSchema = z.object({
  mode: z.enum(["file", "cloud"]),
  logDir: z.string().default("./data/logs"),
});

export const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3100),
  serveUi: z.boolean().default(true),
});

export const paperclipConfigSchema = z.object({
  $meta: configMetaSchema,
  llm: llmConfigSchema.optional(),
  database: databaseConfigSchema,
  logging: loggingConfigSchema,
  server: serverConfigSchema,
});

export type PaperclipConfig = z.infer<typeof paperclipConfigSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type ConfigMeta = z.infer<typeof configMetaSchema>;
