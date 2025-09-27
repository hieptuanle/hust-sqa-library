import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { LibraryDatabase } from './database.js';
import { SessionStore } from './session.js';
import { sanitizeBookInput, sanitizePassword, sanitizeUsername } from './validators.js';
import { hashPassword, verifyPassword } from './auth.js';
import { Book } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const PUBLIC_DIR = normalize(join(__dirname, '../public'));
const DB_PATH = normalize(join(__dirname, '../data/library.db'));

const database = new LibraryDatabase(DB_PATH);
const sessionStore = new SessionStore();

// Minimal HTTP server that serves static assets and JSON APIs.
const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      return sendJson(res, 400, { error: 'Invalid request.' });
    }

    const hostHeader = req.headers.host ?? `localhost:${PORT}`;
    const url = new URL(req.url, `http://${hostHeader}`);

    if (req.method === 'GET' && url.pathname === '/') {
      return serveStatic(res, 'index.html', 'text/html; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname.startsWith('/static/')) {
      const relativePath = url.pathname.replace('/static/', '');
      return serveStatic(res, relativePath);
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, url.pathname, url.searchParams);
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error('Unexpected error', error);
    sendJson(res, 500, { error: 'Internal server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`Library manager running on http://localhost:${PORT}`);
});

// Dispatch API routes and enforce authentication where required.
async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams
): Promise<void> {
  const session = sessionStore.getSession(getCookie(req, 'sessionId'));

  if (req.method === 'GET' && pathname === '/api/session') {
    sendJson(res, 200, { user: session ? { id: session.userId, username: session.username } : null });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const payload = await readJsonPayload(req);
    try {
      const username = sanitizeUsername(payload.username);
      const password = sanitizePassword(payload.password);

      if (database.getUserByUsername(username)) {
        sendJson(res, 409, { error: 'Username already exists.' });
        return;
      }

      const digest = hashPassword(password);
      database.createUser({
        id: cryptoRandomId(),
        username,
        passwordHash: digest.hash,
        passwordSalt: digest.salt,
        createdAt: Date.now()
      });

      sendJson(res, 201, { message: 'Registration successful. You can now log in.' });
    } catch (error) {
      handleClientError(res, error);
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const payload = await readJsonPayload(req);
    try {
      const username = sanitizeUsername(payload.username);
      const password = sanitizePassword(payload.password);
      const user = database.getUserByUsername(username);

      if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
        sendJson(res, 401, { error: 'Invalid username or password.' });
        return;
      }

      const newSession = sessionStore.createSession(user.id, user.username);
      setSessionCookie(res, newSession.sessionId, newSession.expiresAt);
      sendJson(res, 200, { message: 'Login successful.' });
    } catch (error) {
      handleClientError(res, error);
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    const sessionId = getCookie(req, 'sessionId');
    sessionStore.deleteSession(sessionId);
    clearSessionCookie(res);
    sendJson(res, 200, { message: 'Logged out successfully.' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/books') {
    const query = searchParams.get('query')?.trim() ?? '';
    const field = searchParams.get('field') === 'author' ? 'author' : 'title';
    const books = query ? database.searchBooks(field, query) : database.listBooks();
    sendJson(res, 200, { books });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/books') {
    if (!session) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    const payload = await readJsonPayload(req);
    try {
      const sanitized = sanitizeBookInput(payload);
      const newBook: Book = {
        id: cryptoRandomId(),
        title: sanitized.title,
        author: sanitized.author,
        year: sanitized.year,
        createdAt: Date.now()
      };
      database.createBook(newBook);
      sendJson(res, 201, { book: newBook, message: 'Book added successfully.' });
    } catch (error) {
      handleClientError(res, error);
    }
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/books/')) {
    if (!session) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    const bookId = pathname.replace('/api/books/', '');
    if (!bookId) {
      sendJson(res, 400, { error: 'Book ID is required.' });
      return;
    }

    const deleted = database.deleteBook(bookId);
    if (!deleted) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }

    sendJson(res, 200, { message: 'Book deleted successfully.' });
    return;
  }

  sendJson(res, 404, { error: 'API route not found.' });
}

// Aggregate the request body and parse it as JSON.
async function readJsonPayload(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const body = Buffer.concat(chunks).toString('utf-8');
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }
}

function getCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  const cookies = header.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue ?? '');
    }
  }
  return undefined;
}

function setSessionCookie(res: ServerResponse, sessionId: string, expiresAt: number): void {
  const expires = new Date(expiresAt).toUTCString();
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  res.setHeader(
    'Set-Cookie',
    `sessionId=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax; Expires=${expires}; Max-Age=${maxAgeSeconds}`
  );
}

function clearSessionCookie(res: ServerResponse): void {
  res.setHeader(
    'Set-Cookie',
    'sessionId=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
  );
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// Serve files from the public directory with a simple path guard.
async function serveStatic(res: ServerResponse, relativePath: string, contentType?: string): Promise<void> {
  const filePath = normalize(join(PUBLIC_DIR, relativePath));
  const allowedPrefix = PUBLIC_DIR.endsWith(sep) ? PUBLIC_DIR : `${PUBLIC_DIR}${sep}`;

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(allowedPrefix)) {
    sendJson(res, 403, { error: 'Access denied.' });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { error: 'Not found.' });
      return;
    }

    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType ?? guessContentType(filePath));
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found.' });
  }
}

function guessContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function handleClientError(res: ServerResponse, error: unknown): void {
  if (error instanceof Error) {
    sendJson(res, 400, { error: error.message });
  } else {
    sendJson(res, 400, { error: 'Invalid request.' });
  }
}

function cryptoRandomId(): string {
  return randomUUID();
}
