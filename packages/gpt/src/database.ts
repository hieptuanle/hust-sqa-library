import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Book, User } from './types.js';

export class LibraryDatabase {
  private readonly db: DatabaseSync;

  constructor(private readonly filePath: string) {
    this.ensureDirectory();
    this.db = new DatabaseSync(this.filePath);
    this.bootstrap();
  }

  private ensureDirectory(): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true });
  }

  private bootstrap(): void {
    // Ensure required tables and indexes exist whenever the server boots.
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        year INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_books_title ON books (title);
      CREATE INDEX IF NOT EXISTS idx_books_author ON books (author);
    `);
  }

  getUserByUsername(username: string): User | null {
    const stmt = this.db.prepare(
      'SELECT id, username, password_hash AS passwordHash, password_salt AS passwordSalt, created_at AS createdAt FROM users WHERE username = ?'
    );
    const result = stmt.get(username) as User | undefined;
    return result ?? null;
  }

  createUser(user: User): void {
    const stmt = this.db.prepare(
      'INSERT INTO users (id, username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(user.id, user.username, user.passwordHash, user.passwordSalt, user.createdAt);
  }

  listBooks(): Book[] {
    const stmt = this.db.prepare(
      'SELECT id, title, author, year, created_at AS createdAt FROM books ORDER BY created_at DESC'
    );
    const rows = stmt.all() as unknown[];
    return rows.map(mapRowToBook);
  }

  searchBooks(field: 'title' | 'author', query: string): Book[] {
    const stmt = this.db.prepare(
      `SELECT id, title, author, year, created_at AS createdAt FROM books WHERE ${field} LIKE ? COLLATE NOCASE ORDER BY created_at DESC`
    );
    const pattern = `%${query}%`;
    const rows = stmt.all(pattern) as unknown[];
    return rows.map(mapRowToBook);
  }

  createBook(book: Book): void {
    // Lightweight duplicate guard so titles are unique per author/year tuple.
    const duplicateCheck = this.db.prepare(
      'SELECT id FROM books WHERE lower(title) = lower(?) AND lower(author) = lower(?) AND year = ?'
    );
    const existing = duplicateCheck.get(book.title, book.author, book.year) as { id: string } | undefined;
    if (existing) {
      throw new Error('A book with the same title, author, and year already exists.');
    }

    const stmt = this.db.prepare(
      'INSERT INTO books (id, title, author, year, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(book.id, book.title, book.author, book.year, book.createdAt);
  }

  deleteBook(bookId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM books WHERE id = ?');
    const result = stmt.run(bookId);
    return result.changes > 0;
  }
}

function mapRowToBook(row: unknown): Book {
  if (!row || typeof row !== 'object') {
    throw new Error('Corrupt book data encountered in storage.');
  }

  const record = row as Record<string, unknown>;
  const id = ensureString(record.id, 'Book row missing identifier.');
  const title = ensureString(record.title, 'Book row missing title.');
  const author = ensureString(record.author, 'Book row missing author.');
  const year = ensureInt(record.year, 'Book row missing year.');
  const createdAt = ensureInt(record.createdAt, 'Book row missing createdAt.');

  return { id, title, author, year, createdAt };
}

function ensureString(value: unknown, message: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(message);
}

function ensureInt(value: unknown, message: string): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error(message);
}
