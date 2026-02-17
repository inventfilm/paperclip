export interface Config {
  port: number;
  databaseUrl: string | undefined;
  serveUi: boolean;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT) || 3100,
    databaseUrl: process.env.DATABASE_URL,
    serveUi: process.env.SERVE_UI === "true",
  };
}
