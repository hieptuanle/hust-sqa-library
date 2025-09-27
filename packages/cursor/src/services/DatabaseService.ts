import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { User, UserRegistrationData } from '../models/User.js';
import { Book, BookCreationData, BookWithUser } from '../models/Book.js';
import bcrypt from 'bcryptjs';

/**
 * Database service class
 * Handles all database operations for the library management system
 */
export class DatabaseService {
  private db: sqlite3.Database;
  private run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  private get: (sql: string, params?: any[]) => Promise<any>;
  private all: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(dbPath: string = './library.db') {
    this.db = new sqlite3.Database(dbPath);

    // Promisify database methods for easier async/await usage
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
  }

  /**
   * Initialize the database service
   * Must be called after construction to ensure tables are created
   */
  async initialize(): Promise<void> {
    await this.initializeDatabase();
  }

  /**
   * Initialize database tables
   * Creates users and books tables if they don't exist
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Create users table
      await this.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create books table
      await this.run(`
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          publication_year INTEGER NOT NULL,
          added_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (added_by) REFERENCES users (id)
        )
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param userData User registration data
   * @returns Created user without password hash
   */
  async createUser(userData: UserRegistrationData): Promise<User> {
    try {
      // Check if username or email already exists
      const existingUser = await this.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [userData.username, userData.email]
      );

      if (existingUser) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      // Insert user
      await this.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [userData.username, userData.email, passwordHash]
      );

      // Get the last inserted user
      const user = await this.get(
        'SELECT * FROM users WHERE username = ? AND email = ?',
        [userData.username, userData.email]
      );

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   * @param username Username to search for
   * @returns User with password hash or null if not found
   */
  async findUserByUsername(username: string): Promise<User | null> {
    try {
      const user = await this.get(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return user || null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param id User ID to search for
   * @returns User without password hash or null if not found
   */
  async findUserById(id: number): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const user = await this.get(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [id]
      );
      return user || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Verify user password
   * @param password Plain text password
   * @param hash Hashed password from database
   * @returns True if password matches, false otherwise
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  /**
   * Add a new book to the library
   * @param bookData Book creation data
   * @returns Created book
   */
  async addBook(bookData: BookCreationData): Promise<Book> {
    try {
      // Generate unique book ID
      const bookId = this.generateBookId();

      // Insert book
      await this.run(
        'INSERT INTO books (id, title, author, publication_year, added_by) VALUES (?, ?, ?, ?, ?)',
        [bookId, bookData.title, bookData.author, bookData.publicationYear, bookData.addedBy]
      );

      // Return created book
      const book = await this.get(
        'SELECT * FROM books WHERE id = ?',
        [bookId]
      );

      return book;
    } catch (error) {
      console.error('Error adding book:', error);
      throw error;
    }
  }

  /**
   * Get all books with user information
   * @returns Array of books with user who added them
   */
  async getAllBooks(): Promise<BookWithUser[]> {
    try {
      const books = await this.all(`
        SELECT
          b.id,
          b.title,
          b.author,
          b.publication_year as publicationYear,
          b.added_by as addedBy,
          b.created_at as createdAt,
          u.username as addedByUsername
        FROM books b
        JOIN users u ON b.added_by = u.id
        ORDER BY b.created_at DESC
      `);

      return books;
    } catch (error) {
      console.error('Error getting all books:', error);
      throw error;
    }
  }

  /**
   * Search books by title or author
   * @param query Search query
   * @param searchType Type of search (title or author)
   * @returns Array of matching books with user information
   */
  async searchBooks(query: string, searchType: 'title' | 'author'): Promise<BookWithUser[]> {
    try {
      const searchColumn = searchType === 'title' ? 'b.title' : 'b.author';
      const books = await this.all(`
        SELECT
          b.id,
          b.title,
          b.author,
          b.publication_year as publicationYear,
          b.added_by as addedBy,
          b.created_at as createdAt,
          u.username as addedByUsername
        FROM books b
        JOIN users u ON b.added_by = u.id
        WHERE LOWER(${searchColumn}) LIKE LOWER(?)
        ORDER BY b.created_at DESC
      `, [`%${query}%`]);

      return books;
    } catch (error) {
      console.error('Error searching books:', error);
      throw error;
    }
  }

  /**
   * Delete a book by ID
   * @param bookId Book ID to delete
   * @param userId User ID requesting deletion (for authorization)
   * @returns True if deleted, false if not found or not authorized
   */
  async deleteBook(bookId: string, userId: number): Promise<boolean> {
    try {
      // Check if book exists and user has permission to delete it
      const book = await this.get(
        'SELECT added_by FROM books WHERE id = ?',
        [bookId]
      );

      if (!book) {
        return false;
      }

      if (book.added_by !== userId) {
        throw new Error('Unauthorized: You can only delete books you added');
      }

      // Delete the book
      await this.run(
        'DELETE FROM books WHERE id = ?',
        [bookId]
      );

      // Verify the book was deleted by checking if it still exists
      const deletedBook = await this.get(
        'SELECT id FROM books WHERE id = ?',
        [bookId]
      );

      return !deletedBook; // Return true if book no longer exists
    } catch (error) {
      console.error('Error deleting book:', error);
      throw error;
    }
  }

  /**
   * Generate a unique book ID
   * @returns Unique book ID string
   */
  private generateBookId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `book_${timestamp}_${random}`;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
