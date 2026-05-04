import type { AppSettings } from "@dictation/domain";
import { defaultSettings } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";

export class SettingsRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  getSettings(): AppSettings {
    const rows = this.db.prepare("SELECT key, value FROM app_settings").all() as { key: string; value: string }[];
    return rows.reduce<AppSettings>((settings, row) => ({ ...settings, [row.key]: JSON.parse(row.value) }), defaultSettings);
  }

  updateSettings(input: Partial<AppSettings>): AppSettings {
    const now = Date.now();
    const statement = this.db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)");
    for (const [key, value] of Object.entries(input)) statement.run(key, JSON.stringify(value), now);
    return this.getSettings();
  }
}
