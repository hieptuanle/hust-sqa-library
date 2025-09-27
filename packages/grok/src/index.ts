// src/index.ts
// Main entry point for the server.
// Sets up Express, sessions, EJS views, and routes for auth, add, delete, search.
// Integrates with db.ts for persistence.
// Handles input validation and graceful error handling.

import express from 'express';
import session from 'express-session';
import path from 'path';
import bcrypt from 'bcrypt';
import { initDB, addBook, deleteBook, getBooks, searchBooks, getUserByUsername, addUser } from './db';

const app = express();
const PORT = 3000;
const currentYear = new Date().getFullYear();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'secret-key', // Change this in production for security
  resave: false,
  saveUninitialized: true,
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Initialize DB on startup (auto-loads data)
initDB();

// Authentication middleware: Redirects unauthenticated users to login for protected routes
function isAuthenticated(req: express.Request & { session: any }, res: express.Response, next: express.NextFunction) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Root route: Handles listing books or searching (available to all users)
app.get('/', async (req, res) => {
  const query = req.query.query as string;
  let type = req.query.type as 'title' | 'author';
  if (!type) type = 'title'; // Default to title search
  let books;
  try {
    if (query) {
      books = await searchBooks(query, type);
    } else {
      books = await getBooks();
    }
    res.render('index', { books, user: req.session.user, query, type, error: null });
  } catch (err) {
    res.render('index', { books: [], user: req.session.user, query, type, error: 'Error loading books' });
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Handle login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Missing username or password' });
  }
  try {
    const user = await getUserByUsername(username);
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = username;
      res.redirect('/');
    } else {
      res.render('login', { error: 'Invalid credentials' });
    }
  } catch (err) {
    res.render('login', { error: 'Error during login' });
  }
});

// Register page
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// Handle registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('register', { error: 'Missing username or password' });
  }
  try {
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.render('register', { error: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await addUser(username, hashedPassword);
    req.session.user = username;
    res.redirect('/');
  } catch (err) {
    res.render('register', { error: 'Error during registration' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Add book (protected)
app.post('/add', isAuthenticated, async (req, res) => {
  const { title, author, year } = req.body;
  const parsedYear = parseInt(year);
  // Input validation
  if (!title?.trim() || !author?.trim() || isNaN(parsedYear) || parsedYear < 1400 || parsedYear > currentYear) {
    const books = await getBooks();
    return res.render('index', { books, user: req.session.user, query: '', type: 'title', error: 'Invalid input: Title and author must be non-empty; year must be between 1400 and ' + currentYear });
  }
  try {
    await addBook(title.trim(), author.trim(), parsedYear);
    res.redirect('/');
  } catch (err) {
    const books = await getBooks();
    res.render('index', { books, user: req.session.user, query: '', type: 'title', error: 'Error adding book (possible duplicate or DB issue)' });
  }
});

// Delete book (protected)
app.post('/delete/:id', isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.redirect('/');
  }
  try {
    await deleteBook(id);
    res.redirect('/');
  } catch (err) {
    const books = await getBooks();
    res.render('index', { books, user: req.session.user, query: '', type: 'title', error: 'Error deleting book' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});