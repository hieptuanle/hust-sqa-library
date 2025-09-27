import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
}

export interface User {
  id: string;
  username: string;
  password: string;
}

export class DatabaseService {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database('./library.db');
    this.init();
  }

  private async init() {
    await this.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT
    )`);

    await this.run(`CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT,
      author TEXT,
      year INTEGER
    )`);
  }

  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // User methods
  async createUser(user: User): Promise<void> {
    await this.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [user.id, user.username, user.password]);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await this.get('SELECT * FROM users WHERE username = ?', [username]);
  }

  // Book methods
  async createBook(book: Book): Promise<void> {
    await this.run('INSERT INTO books (id, title, author, year) VALUES (?, ?, ?, ?)', [book.id, book.title, book.author, book.year]);
  }

  async getAllBooks(): Promise<Book[]> {
    return await this.all('SELECT * FROM books');
  }

  async deleteBook(id: string): Promise<void> {
    await this.run('DELETE FROM books WHERE id = ?', [id]);
  }

  async searchBooks(query: string, type: 'title' | 'author'): Promise<Book[]> {
    const sql = `SELECT * FROM books WHERE ${type} LIKE ?`;
    return await this.all(sql, [`%${query}%`]);
  }

  close() {
    this.db.close();
  }
}