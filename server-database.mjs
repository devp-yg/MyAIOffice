import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_KEY = 'registry_initialized';

export async function openOfficeDatabase() {
  const filename = fileURLToPath(new URL('./data/office.sqlite', import.meta.url));
  const directory = path.dirname(filename);
  await mkdir(directory, { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff_registry (
      session_id TEXT PRIMARY KEY,
      registry_index INTEGER NOT NULL CHECK (registry_index >= 0)
    );
    CREATE TABLE IF NOT EXISTS floor_registry (
      project_key TEXT PRIMARY KEY,
      floor_number INTEGER NOT NULL CHECK (floor_number > 0)
    );
  `);

  return {
    filename,
    readRegistries() {
      const staff = Object.fromEntries(db.prepare('SELECT session_id, registry_index FROM staff_registry').all().map(row => [row.session_id, { index: row.registry_index }]));
      const floors = Object.fromEntries(db.prepare('SELECT project_key, floor_number FROM floor_registry').all().map(row => [row.project_key, row.floor_number]));
      return { initialized: Boolean(db.prepare('SELECT 1 FROM app_metadata WHERE key = ?').get(ROOT_KEY)), staff, floors };
    },
    writeRegistries({ staff, floors }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const saveStaff = db.prepare('INSERT INTO staff_registry (session_id, registry_index) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET registry_index = excluded.registry_index');
        const saveFloor = db.prepare('INSERT INTO floor_registry (project_key, floor_number) VALUES (?, ?) ON CONFLICT(project_key) DO UPDATE SET floor_number = excluded.floor_number');
        for (const [id, value] of Object.entries(staff)) saveStaff.run(id, value.index);
        for (const [key, value] of Object.entries(floors)) saveFloor.run(key, value);
        db.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(ROOT_KEY, '1');
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export function validateRegistries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { staff, floors } = value;
  if (!staff || typeof staff !== 'object' || Array.isArray(staff) || !floors || typeof floors !== 'object' || Array.isArray(floors)) return null;
  const entriesAreValid = (entries, isValid) => Object.entries(entries).every(([key, item]) => key.length > 0 && key.length <= 256 && isValid(item));
  if (!entriesAreValid(staff, item => item && typeof item === 'object' && Number.isSafeInteger(item.index) && item.index >= 0)) return null;
  if (!entriesAreValid(floors, Number.isSafeInteger) || Object.values(floors).some(value => value <= 0)) return null;
  return { staff, floors };
}
