import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { BookCreationData } from '../models/Book.js';

/**
 * Books routes
 * Handles book CRUD operations
 */
export function createBooksRoutes(db: DatabaseService): Router {
  const router = Router();

  /**
   * Get all books
   * GET /api/books
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const books = await db.getAllBooks();
      return res.json({ books });
    } catch (error) {
      console.error('Error fetching books:', error);
      return res.status(500).json({
        error: 'Internal server error while fetching books'
      });
    }
  });

  /**
   * Search books by title or author
   * GET /api/books/search?q=query&type=title|author
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const { q: query, type } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Search query is required'
        });
      }

      if (!type || (type !== 'title' && type !== 'author')) {
        return res.status(400).json({
          error: 'Search type must be either "title" or "author"'
        });
      }

      const books = await db.searchBooks(query, type as 'title' | 'author');
      return res.json({ books, query, searchType: type });
    } catch (error) {
      console.error('Error searching books:', error);
      return res.status(500).json({
        error: 'Internal server error while searching books'
      });
    }
  });

  /**
   * Add a new book (authenticated users only)
   * POST /api/books
   */
  router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { title, author, publicationYear }: BookCreationData = req.body;

      // Validate input
      if (!title || !author || !publicationYear) {
        return res.status(400).json({
          error: 'Title, author, and publication year are required'
        });
      }

      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          error: 'Title must be a non-empty string'
        });
      }

      if (typeof author !== 'string' || author.trim().length === 0) {
        return res.status(400).json({
          error: 'Author must be a non-empty string'
        });
      }

      if (typeof publicationYear !== 'number' || !Number.isInteger(publicationYear)) {
        return res.status(400).json({
          error: 'Publication year must be an integer'
        });
      }

      const currentYear = new Date().getFullYear();
      if (publicationYear < 1400 || publicationYear > currentYear) {
        return res.status(400).json({
          error: `Publication year must be between 1400 and ${currentYear}`
        });
      }

      // Create book
      const book = await db.addBook({
        title: title.trim(),
        author: author.trim(),
        publicationYear,
        addedBy: req.user.id
      });

      return res.status(201).json({
        message: 'Book added successfully',
        book
      });
    } catch (error) {
      console.error('Error adding book:', error);
      return res.status(500).json({
        error: 'Internal server error while adding book'
      });
    }
  });

  /**
   * Delete a book (authenticated users only, can only delete own books)
   * DELETE /api/books/:id
   */
  router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { id: bookId } = req.params;

      if (!bookId) {
        return res.status(400).json({
          error: 'Book ID is required'
        });
      }

      const deleted = await db.deleteBook(bookId, req.user.id);

      if (!deleted) {
        return res.status(404).json({
          error: 'Book not found or you do not have permission to delete it'
        });
      }

      return res.json({
        message: 'Book deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting book:', error);

      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return res.status(403).json({
          error: error.message
        });
      }

      return res.status(500).json({
        error: 'Internal server error while deleting book'
      });
    }
  });

  return router;
}
