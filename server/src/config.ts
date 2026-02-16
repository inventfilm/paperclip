export interface Config {
  port: number;
  databaseUrl: string;
  serveUi: boolean;
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  return {
    port: Number(process.env.PORT) || 3100,
    databaseUrl,
    serveUi: process.env.SERVE_UI === "true",
  };
}
