import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { v4 as uuidv4 } from "uuid";

// Database initialization
let db: any = null;

export async function initializeDB() {
  db = await open({
    filename: "./library.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER NOT NULL,
      added_by TEXT NOT NULL,
      FOREIGN KEY(added_by) REFERENCES users(id)
    );
  `);
}

// User functions
export async function registerUser(username: string, password: string) {
  if (!username || !password)
    throw new Error("Username and password are required");

  const userId = uuidv4();
  await db.run("INSERT INTO users (id, username, password) VALUES (?, ?, ?)", [
    userId,
    username,
    password,
  ]);
  return userId;
}

export async function loginUser(username: string, password: string) {
  const user = await db.get(
    "SELECT id FROM users WHERE username = ? AND password = ?",
    [username, password]
  );
  return user?.id || null;
}

// Book functions
export async function addBook(
  userId: string,
  title: string,
  author: string,
  year: number
) {
  if (!title || !author) throw new Error("Title and author are required");
  if (
    !Number.isInteger(year) ||
    year < 1400 ||
    year > new Date().getFullYear()
  ) {
    throw new Error("Publication year must be between 1400 and current year");
  }

  const bookId = uuidv4();
  await db.run(
    "INSERT INTO books (id, title, author, year, added_by) VALUES (?, ?, ?, ?, ?)",
    [bookId, title, author, year, userId]
  );
  return bookId;
}

export async function deleteBook(bookId: string) {
  await db.run("DELETE FROM books WHERE id = ?", [bookId]);
}

export async function searchBooks(query: string, by: "title" | "author") {
  const searchQuery = `%${query}%`;
  return await db.all(
    `SELECT id, title, author, year FROM books WHERE ${by} LIKE ?`,
    [searchQuery]
  );
}

export async function getAllBooks() {
  return await db.all("SELECT id, title, author, year FROM books");
}
