import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from './database.js';
import { AuthService } from './auth.js';
import { BookService } from './book.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Initialize services
const dbService = new DatabaseService();
const authService = new AuthService(dbService);
const bookService = new BookService(dbService);

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.sendFile(path.join(__dirname, '../public/login.html'));
  }
});

// Auth routes
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    await authService.register(username, password);
    res.redirect('/');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await authService.login(username, password);
    req.session.userId = user.id;
    res.redirect('/');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Book routes
app.get('/api/books', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  try {
    const books = await bookService.getAllBooks();
    res.json(books);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/books', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  try {
    const { title, author, year } = req.body;
    const book = await bookService.addBook(title, author, year);
    res.json(book);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.delete('/api/books/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  try {
    await bookService.deleteBook(req.params.id);
    res.sendStatus(204);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.get('/api/books/search', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  try {
    const { query, type } = req.query;
    const books = await bookService.searchBooks(query as string, type as 'title' | 'author');
    res.json(books);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});