/**
 * Book model interface
 * Represents a book in the library management system
 */
export interface Book {
  id: string;
  title: string;
  author: string;
  publicationYear: number;
  addedBy: number; // User ID who added the book
  createdAt: Date;
}

/**
 * Book creation data interface
 * Used when adding a new book to the library
 */
export interface BookCreationData {
  title: string;
  author: string;
  publicationYear: number;
  addedBy: number;
}

/**
 * Book search criteria interface
 * Used for searching books by title or author
 */
export interface BookSearchCriteria {
  query: string;
  searchType: 'title' | 'author';
}

/**
 * Book with user information interface
 * Used when returning book data with the user who added it
 */
export interface BookWithUser extends Book {
  addedByUsername: string;
}
