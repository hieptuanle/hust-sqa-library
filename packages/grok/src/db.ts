// src/db.ts
// Modular database handling for SQLite persistence.
// Initializes DB on startup, creates tables if needed, and provides functions for book operations.

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

let dbPromise: Promise<any> | null = null;

export async function initDB(): Promise<void> {
  if (!dbPromise) {
    dbPromise = open({
      filename: './library.db',
      driver: sqlite3.Database,
    });
  }
  const db = await dbPromise;
  // Create tables if they don't exist (users for auth, books for library).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER NOT NULL
    );
  `);
}

export async function getBooks(): Promise<any[]> {
  const db = await dbPromise;
  return db.all('SELECT * FROM books');
}

export async function searchBooks(query: string, type: 'title' | 'author'): Promise<any[]> {
  const db = await dbPromise;
  // Case-insensitive partial match using LIKE.
  const sql = `SELECT * FROM books WHERE LOWER(${type}) LIKE ?`;
  return db.all(sql, [`%${query.toLowerCase()}%`]);
}

export async function addBook(title: string, author: string, year: number): Promise<void> {
  const db = await dbPromise;
  await db.run('INSERT INTO books (title, author, year) VALUES (?, ?, ?)', [title, author, year]);
}

export async function deleteBook(id: number): Promise<void> {
  const db = await dbPromise;
  await db.run('DELETE FROM books WHERE id = ?', [id]);
}

export async function getUserByUsername(username: string): Promise<any> {
  const db = await dbPromise;
  return db.get('SELECT * FROM users WHERE username = ?', [username]);
}

export async function addUser(username: string, hashedPassword: string): Promise<void> {
  const db = await dbPromise;
  await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
}