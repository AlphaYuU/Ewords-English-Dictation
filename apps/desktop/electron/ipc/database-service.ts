import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import {
  createApplicationDatabaseService,
  type ApplicationDatabaseService,
  type DatabaseQuery,
  type DatabaseResponse,
} from "@dictation/data-access";

const electronDir = path.dirname(fileURLToPath(import.meta.url));

let databaseService: ApplicationDatabaseService | null = null;

export type { DatabaseQuery };

export function handleDatabaseQuery(request: DatabaseQuery): DatabaseResponse {
  return getDatabaseService().handleQuery(request);
}

function getDatabaseService(): ApplicationDatabaseService {
  if (databaseService) return databaseService;
  const projectRoot = findProjectRoot();
  const developmentDbPath = projectRoot ? path.join(projectRoot, "data", "processed", "dictation.sqlite") : null;
  const migrationPath = projectRoot ? path.join(projectRoot, "data", "migrations", "0001_init.sql") : null;
  databaseService = createApplicationDatabaseService({
    dbPath: resolveDatabasePath(developmentDbPath),
    developmentDbPath,
    migrationPath,
    findBundledResource,
  });
  return databaseService;
}

function resolveDatabasePath(developmentDbPath: string | null): string {
  if (process.env.DICTATION_DB_PATH) return path.resolve(process.env.DICTATION_DB_PATH);
  if (!app.isPackaged && developmentDbPath) return developmentDbPath;
  return path.join(app.getPath("userData"), "dictation.sqlite");
}

function findProjectRoot(): string | null {
  const candidates = [process.cwd(), app.getAppPath(), electronDir];
  for (const start of candidates) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      if (existsSync(path.join(current, "pnpm-workspace.yaml")) && existsSync(path.join(current, "data", "migrations", "0001_init.sql"))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

function findBundledResource(relativePath: string): string | null {
  const candidates = [process.resourcesPath, app.getAppPath(), path.dirname(app.getPath("exe"))];
  for (const base of candidates) {
    const candidate = path.join(base, relativePath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
