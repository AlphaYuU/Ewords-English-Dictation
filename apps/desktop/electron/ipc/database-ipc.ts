import { ipcMain } from "electron";
import { handleDatabaseQuery, type DatabaseQuery } from "./database-service.js";

ipcMain.handle("database:query", (_event, request: DatabaseQuery) => handleDatabaseQuery(request));
