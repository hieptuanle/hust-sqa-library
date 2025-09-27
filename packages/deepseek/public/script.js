let currentUserId = null;

// DOM elements
const authSection = document.getElementById("auth-section");
const bookSection = document.getElementById("book-section");
const authForm = document.getElementById("auth-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("register-btn");
const loginBtn = document.getElementById("login-btn");
const addBookForm = document.getElementById("add-book-form");
const titleInput = document.getElementById("title");
const authorInput = document.getElementById("author");
const yearInput = document.getElementById("year");
const searchInput = document.getElementById("search-query");
const searchByRadios = document.getElementsByName("search-by");
const bookList = document.getElementById("book-list");
const logoutBtn = document.getElementById("logout-btn");
const messageDiv = document.getElementById("message");

// Event listeners
registerBtn.addEventListener("click", handleRegister);
loginBtn.addEventListener("click", handleLogin);
addBookForm.addEventListener("submit", handleAddBook);
searchInput.addEventListener("input", handleSearch);
logoutBtn.addEventListener("click", handleLogout);

// Authentication handlers
async function handleRegister(e) {
  e.preventDefault();
  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (data.success) {
      showMessage("Registration successful! Please login.", "success");
    } else {
      showMessage(data.message, "error");
    }
  } catch (error) {
    showMessage("Error registering user", "error");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (data.success) {
      currentUserId = data.userId;
      authSection.style.display = "none";
      bookSection.style.display = "block";
      loadBooks();
    } else {
      showMessage(data.message, "error");
    }
  } catch (error) {
    showMessage("Error logging in", "error");
  }
}

// Book handlers
async function handleAddBook(e) {
  e.preventDefault();
  const title = titleInput.value;
  const author = authorInput.value;
  const year = yearInput.value;

  try {
    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, title, author, year }),
    });

    const data = await response.json();
    if (data.success) {
      showMessage("Book added successfully!", "success");
      titleInput.value = "";
      authorInput.value = "";
      yearInput.value = "";
      loadBooks();
    } else {
      showMessage(data.message, "error");
    }
  } catch (error) {
    showMessage("Error adding book", "error");
  }
}

async function handleDeleteBook(bookId) {
  try {
    const response = await fetch(`/api/books/${bookId}`, {
      method: "DELETE",
    });

    const data = await response.json();
    if (data.success) {
      showMessage("Book deleted successfully!", "success");
      loadBooks();
    } else {
      showMessage(data.message, "error");
    }
  } catch (error) {
    showMessage("Error deleting book", "error");
  }
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (query === "") {
    loadBooks();
    return;
  }

  const searchBy = document.querySelector(
    'input[name="search-by"]:checked'
  ).value;

  try {
    const response = await fetch(`/api/books?q=${query}&by=${searchBy}`);
    const books = await response.json();
    renderBooks(books);
  } catch (error) {
    showMessage("Error searching books", "error");
  }
}

async function loadBooks() {
  try {
    const response = await fetch("/api/books");
    const books = await response.json();
    renderBooks(books);
  } catch (error) {
    showMessage("Error loading books", "error");
  }
}

function renderBooks(books) {
  bookList.innerHTML = "";
  books.forEach((book) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.year}</td>
      <td>
        <button class="delete-btn" data-id="${book.id}">Delete</button>
      </td>
    `;
    bookList.appendChild(row);
  });

  // Add event listeners to delete buttons
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleDeleteBook(btn.dataset.id);
    });
  });
}

function handleLogout() {
  currentUserId = null;
  authSection.style.display = "block";
  bookSection.style.display = "none";
  usernameInput.value = "";
  passwordInput.value = "";
}

function showMessage(message, type) {
  messageDiv.textContent = message;
  messageDiv.className = `message ${type}`;
  setTimeout(() => {
    messageDiv.textContent = "";
    messageDiv.className = "message";
  }, 3000);
}

// Initialize
loadBooks();
