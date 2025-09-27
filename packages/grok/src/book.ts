import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, Book } from './database.js';

export class BookService {
  constructor(private db: DatabaseService) {}

  private validateBook(title: string, author: string, year: number): void {
    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw new Error('Title is required and must be a non-empty string');
    }
    if (!author || typeof author !== 'string' || author.trim() === '') {
      throw new Error('Author is required and must be a non-empty string');
    }
    if (!Number.isInteger(year) || year < 1400 || year > new Date().getFullYear()) {
      throw new Error('Year must be an integer between 1400 and current year');
    }
  }

  async addBook(title: string, author: string, year: number): Promise<Book> {
    this.validateBook(title, author, year);

    const book: Book = {
      id: uuidv4(),
      title: title.trim(),
      author: author.trim(),
      year
    };

    await this.db.createBook(book);
    return book;
  }

  async getAllBooks(): Promise<Book[]> {
    return await this.db.getAllBooks();
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.deleteBook(id);
  }

  async searchBooks(query: string, type: 'title' | 'author'): Promise<Book[]> {
    if (!query || query.trim() === '') {
      return await this.getAllBooks();
    }
    return await this.db.searchBooks(query.toLowerCase(), type);
  }
}