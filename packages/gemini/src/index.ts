
import express, { type Response, type NextFunction } from 'express';
import type { Request as ExpressRequest } from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CustomRequest extends ExpressRequest {
    user?: { username: string };
}

const app = express();
const port = 3000;

// In-memory token store for simplicity
const activeTokens: { [key: string]: string } = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware for authentication
const authenticateToken = (req: CustomRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    const username = Object.keys(activeTokens).find(key => activeTokens[key] === token);

    if (!username) return res.sendStatus(403);

    req.user = { username };
    next();
};

app.get('/', (req: CustomRequest, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Auth routes
app.post('/api/register', (req: CustomRequest, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err: Error | null, row: any) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        if (row) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err: Error | null) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to register user' });
            }
            res.status(201).json({ message: 'User registered successfully' });
        });
    });
});

app.post('/api/login', (req: CustomRequest, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err: Error | null, row: any) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        if (!row) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = uuidv4();
        activeTokens[username] = token;
        res.json({ token });
    });
});

// Book routes
app.get('/api/books', (req: CustomRequest, res: Response) => {
    const { search, by } = req.query;
    let query = 'SELECT * FROM books';
    const params: any[] = [];

    if (search && by) {
        if (by === 'title') {
            query += ' WHERE title LIKE ?';
            params.push(`%${search}%`);
        } else if (by === 'author') {
            query += ' WHERE author LIKE ?';
            params.push(`%${search}%`);
        }
    }

    db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/books', authenticateToken, (req: CustomRequest, res: Response) => {
    const { title, author, year } = req.body;
    if (!title || !author || !year) {
        return res.status(400).json({ message: 'Title, author, and year are required' });
    }

    const currentYear = new Date().getFullYear();
    if (year < 1400 || year > currentYear) {
        return res.status(400).json({ message: `Year must be between 1400 and ${currentYear}` });
    }

    const id = uuidv4();
    db.run('INSERT INTO books (id, title, author, year) VALUES (?, ?, ?, ?)', [id, title, author, year], (err: Error | null) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to add book' });
        }
        res.status(201).json({ id, title, author, year });
    });
});

app.delete('/api/books/:id', authenticateToken, (req: CustomRequest, res: Response) => {
    const { id } = req.params;
    db.run('DELETE FROM books WHERE id = ?', [id], function(this: any, err: Error | null) {
        if (err) {
            return res.status(500).json({ message: 'Failed to delete book' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.sendStatus(204);
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
