import express from "express";
import {
  initializeDB,
  registerUser,
  loginUser,
  addBook,
  deleteBook,
  searchBooks,
  getAllBooks,
} from "./db.js";

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

// Initialize database
initializeDB().then(() => {
  console.log("Database initialized");
});

// User routes
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = await registerUser(username, password);
    res.json({ success: true, userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = await loginUser(username, password);
    if (userId) {
      res.json({ success: true, userId });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, message });
  }
});

// Book routes
app.post("/api/books", async (req, res) => {
  try {
    const { userId, title, author, year } = req.body;
    const bookId = await addBook(userId, title, author, parseInt(year));
    res.json({ success: true, bookId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, message });
  }
});

app.delete("/api/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    await deleteBook(bookId);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, message });
  }
});

app.get("/api/books", async (req, res) => {
  try {
    const { q, by } = req.query;
    if (q && by) {
      const books = await searchBooks(q.toString(), by as "title" | "author");
      res.json(books);
    } else {
      const books = await getAllBooks();
      res.json(books);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
