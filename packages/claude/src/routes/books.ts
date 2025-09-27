import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { Book } from '../models/Book.js';

const router: Router = Router();

function validateBookData(title: string, author: string, year: number) {
  const errors: string[] = [];

  if (!title || title.trim() === '') {
    errors.push('Title is required and cannot be empty');
  }

  if (!author || author.trim() === '') {
    errors.push('Author is required and cannot be empty');
  }

  const currentYear = new Date().getFullYear();
  if (!year || year < 1400 || year > currentYear) {
    errors.push(`Publication year must be between 1400 and ${currentYear}`);
  }

  return errors;
}

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const books = await db.all<Book[]>('SELECT * FROM books ORDER BY created_at DESC');
    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!type || (type !== 'title' && type !== 'author')) {
      return res.status(400).json({ error: 'Search type must be either "title" or "author"' });
    }

    const db = getDb();
    const searchTerm = `%${q.toLowerCase()}%`;
    let books: Book[];

    if (type === 'title') {
      books = await db.all<Book[]>(
        'SELECT * FROM books WHERE LOWER(title) LIKE ? ORDER BY created_at DESC',
        [searchTerm]
      );
    } else {
      books = await db.all<Book[]>(
        'SELECT * FROM books WHERE LOWER(author) LIKE ? ORDER BY created_at DESC',
        [searchTerm]
      );
    }

    res.json(books);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, author, publication_year } = req.body;

    const errors = validateBookData(title, author, publication_year);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const bookId = uuidv4();
    const db = getDb();

    await db.run(
      'INSERT INTO books (id, title, author, publication_year, added_by) VALUES (?, ?, ?, ?, ?)',
      [bookId, title.trim(), author.trim(), publication_year, req.session.userId]
    );

    const newBook = await db.get<Book>('SELECT * FROM books WHERE id = ?', [bookId]);
    res.status(201).json(newBook);
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const book = await db.get<Book>('SELECT * FROM books WHERE id = ?', [id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await db.run('DELETE FROM books WHERE id = ?', [id]);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

export default router;