import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDatabasePath = path.join(__dirname, '..', '..', 'data', 'app-settings.sqlite');

let database = null;
let selectByKeyStatement = null;
let upsertStatement = null;

function getDatabasePath() {
  const configuredPath = typeof process.env.APP_SETTINGS_SQLITE_PATH === 'string'
    ? process.env.APP_SETTINGS_SQLITE_PATH.trim()
    : '';
  return configuredPath || defaultDatabasePath;
}

function ensureDatabase() {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_text TEXT,
      value_number REAL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  selectByKeyStatement = database.prepare(
    'SELECT key, value_text, value_number FROM app_settings WHERE key = ?'
  );
  upsertStatement = database.prepare(`
    INSERT INTO app_settings (key, value_text, value_number, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value_text = excluded.value_text,
      value_number = excluded.value_number,
      updated_at = CURRENT_TIMESTAMP
  `);

  return database;
}

function getRow(key) {
  ensureDatabase();
  return selectByKeyStatement.get(key) ?? null;
}

export function getAppSettingValueNumber(key) {
  const row = getRow(key);
  return typeof row?.value_number === 'number' ? row.value_number : null;
}

export function getAppSettingValueString(key) {
  const row = getRow(key);
  return typeof row?.value_text === 'string' ? row.value_text : null;
}

export function setAppSettingValueNumber(key, valueNumber) {
  ensureDatabase();
  upsertStatement.run(key, null, valueNumber);
}

export function setAppSettingValueString(key, valueString) {
  ensureDatabase();
  upsertStatement.run(key, valueString, null);
}

export function closeAppSettingsStore() {
  if (!database) {
    return;
  }

  database.close();
  database = null;
  selectByKeyStatement = null;
  upsertStatement = null;
}

export function getAppSettingsSqlitePath() {
  return getDatabasePath();
}

export async function migrateLegacyAppSettingsFromMongo(databaseConnection) {
  if (!databaseConnection) {
    return;
  }

  const documents = await databaseConnection.collection('appsettings')
    .find({}, { projection: { key: 1, value_text: 1, valueString: 1, value_number: 1, valueNumber: 1 } })
    .toArray()
    .catch(() => []);

  for (const document of documents) {
    const key = typeof document?.key === 'string' ? document.key.trim() : '';
    if (!key || getRow(key)) {
      continue;
    }

    const valueString = typeof document?.valueString === 'string'
      ? document.valueString
      : typeof document?.value_text === 'string'
        ? document.value_text
        : null;
    const valueNumber = typeof document?.valueNumber === 'number'
      ? document.valueNumber
      : typeof document?.value_number === 'number'
        ? document.value_number
        : null;

    upsertStatement.run(key, valueString, valueNumber);
  }
}
