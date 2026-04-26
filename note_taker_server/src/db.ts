import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = join(here, '..', 'data', 'notes.db');
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAtMs INTEGER NOT NULL
    )
`);

export interface Note {
    id: number;
    title: string;
    content: string;
    createdAtMs: number;
}

export function listNotes(): Note[] {
    return db.prepare('SELECT id, title, content, createdAtMs FROM notes ORDER BY createdAtMs ASC').all() as Note[];
}

export function createNote(input: { title: string; content: string }): Note {
    const createdAtMs = Date.now();
    const result = db
        .prepare('INSERT INTO notes (title, content, createdAtMs) VALUES (?, ?, ?)')
        .run(input.title, input.content, createdAtMs);
    return {
        id: Number(result.lastInsertRowid),
        title: input.title,
        content: input.content,
        createdAtMs,
    };
}

export function updateNote(id: number, input: { title: string; content: string }): Note | null {
    const result = db
        .prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?')
        .run(input.title, input.content, id);
    if (result.changes === 0) return null;
    return db.prepare('SELECT id, title, content, createdAtMs FROM notes WHERE id = ?').get(id) as Note;
}

export function deleteNote(id: number): boolean {
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return result.changes > 0;
}
