/**
 * Library Book Manager - Frontend JavaScript
 * Handles user interface interactions and API calls
 */

class LibraryManager {
  constructor() {
    this.token = localStorage.getItem("token");
    this.user = null;
    this.books = [];

    this.initializeEventListeners();
    this.checkAuthStatus();
    this.loadBooks();
  }

  /**
   * Initialize event listeners for all forms and buttons
   */
  initializeEventListeners() {
    // Authentication forms
    document
      .getElementById("registerForm")
      .addEventListener("submit", (e) => this.handleRegister(e));
    document
      .getElementById("loginForm")
      .addEventListener("submit", (e) => this.handleLogin(e));
    document
      .getElementById("logoutBtn")
      .addEventListener("click", () => this.handleLogout());

    // Book management forms
    document
      .getElementById("addBookForm")
      .addEventListener("submit", (e) => this.handleAddBook(e));
    document
      .getElementById("searchForm")
      .addEventListener("submit", (e) => this.handleSearch(e));

    // Clear search on input change
    document.getElementById("searchQuery").addEventListener("input", () => {
      if (document.getElementById("searchQuery").value === "") {
        this.loadBooks();
      }
    });
  }

  /**
   * Check if user is authenticated and update UI accordingly
   */
  async checkAuthStatus() {
    if (this.token) {
      try {
        const response = await this.apiCall("/api/auth/profile", "GET");
        if (response.ok) {
          const data = await response.json();
          this.user = data.user;
          this.updateAuthUI(true);
        } else {
          this.clearAuth();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        this.clearAuth();
      }
    } else {
      this.updateAuthUI(false);
    }
  }

  /**
   * Update authentication UI based on login status
   */
  updateAuthUI(isLoggedIn) {
    const authSection = document.querySelector(".auth-section");
    const userInfo = document.getElementById("userInfo");
    const addBookSection = document.querySelector(".add-book-form");

    if (isLoggedIn) {
      authSection.style.display = "none";
      userInfo.style.display = "block";
      addBookSection.style.display = "block";
      document.getElementById("userName").textContent = this.user.username;
    } else {
      authSection.style.display = "block";
      userInfo.style.display = "none";
      addBookSection.style.display = "none";
    }
  }

  /**
   * Handle user registration
   */
  async handleRegister(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const userData = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const response = await this.apiCall(
        "/api/auth/register",
        "POST",
        userData
      );
      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem("token", this.token);
        this.updateAuthUI(true);
        this.showMessage("Registration successful!", "success");
        e.target.reset();
      } else {
        this.showMessage(data.error || "Registration failed", "error");
      }
    } catch (error) {
      console.error("Registration error:", error);
      this.showMessage("Registration failed. Please try again.", "error");
    }
  }

  /**
   * Handle user login
   */
  async handleLogin(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const userData = {
      username: formData.get("username"),
      password: formData.get("password"),
    };

    try {
      const response = await this.apiCall("/api/auth/login", "POST", userData);
      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem("token", this.token);
        this.updateAuthUI(true);
        this.showMessage("Login successful!", "success");
        e.target.reset();
      } else {
        this.showMessage(data.error || "Login failed", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showMessage("Login failed. Please try again.", "error");
    }
  }

  /**
   * Handle user logout
   */
  handleLogout() {
    this.clearAuth();
    this.showMessage("Logged out successfully", "success");
  }

  /**
   * Clear authentication data and update UI
   */
  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("token");
    this.updateAuthUI(false);
  }

  /**
   * Handle adding a new book
   */
  async handleAddBook(e) {
    e.preventDefault();

    if (!this.token) {
      this.showMessage("Please login to add books", "error");
      return;
    }

    const formData = new FormData(e.target);
    const bookData = {
      title: formData.get("title"),
      author: formData.get("author"),
      publicationYear: parseInt(formData.get("publicationYear")),
    };

    try {
      const response = await this.apiCall("/api/books", "POST", bookData);
      const data = await response.json();

      if (response.ok) {
        this.showMessage("Book added successfully!", "success");
        e.target.reset();
        this.loadBooks(); // Refresh the books list
      } else {
        this.showMessage(data.error || "Failed to add book", "error");
      }
    } catch (error) {
      console.error("Add book error:", error);
      this.showMessage("Failed to add book. Please try again.", "error");
    }
  }

  /**
   * Handle book search
   */
  async handleSearch(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const query = formData.get("query");
    const searchType = formData.get("searchType");

    if (!query.trim()) {
      this.loadBooks(); // Show all books if search is empty
      return;
    }

    try {
      const response = await this.apiCall(
        `/api/books/search?q=${encodeURIComponent(query)}&type=${searchType}`,
        "GET"
      );
      const data = await response.json();

      if (response.ok) {
        this.books = data.books;
        this.renderBooks();
        this.showMessage(`Found ${data.books.length} book(s)`, "success");
      } else {
        this.showMessage(data.error || "Search failed", "error");
      }
    } catch (error) {
      console.error("Search error:", error);
      this.showMessage("Search failed. Please try again.", "error");
    }
  }

  /**
   * Load all books from the server
   */
  async loadBooks() {
    try {
      const response = await this.apiCall("/api/books", "GET");
      const data = await response.json();

      if (response.ok) {
        this.books = data.books;
        this.renderBooks();
      } else {
        this.showMessage("Failed to load books", "error");
      }
    } catch (error) {
      console.error("Load books error:", error);
      this.showMessage(
        "Failed to load books. Please refresh the page.",
        "error"
      );
    }
  }

  /**
   * Delete a book
   */
  async deleteBook(bookId) {
    if (!this.token) {
      this.showMessage("Please login to delete books", "error");
      return;
    }

    if (!confirm("Are you sure you want to delete this book?")) {
      return;
    }

    try {
      const response = await this.apiCall(`/api/books/${bookId}`, "DELETE");
      const data = await response.json();

      if (response.ok) {
        this.showMessage("Book deleted successfully!", "success");
        this.loadBooks(); // Refresh the books list
      } else {
        this.showMessage(data.error || "Failed to delete book", "error");
      }
    } catch (error) {
      console.error("Delete book error:", error);
      this.showMessage("Failed to delete book. Please try again.", "error");
    }
  }

  /**
   * Render books in the table
   */
  renderBooks() {
    const tbody = document.getElementById("booksTableBody");

    if (this.books.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #7f8c8d;">
                        No books found
                    </td>
                </tr>
            `;
      return;
    }

    tbody.innerHTML = this.books
      .map(
        (book) => `
            <tr>
                <td>${this.escapeHtml(book.title)}</td>
                <td>${this.escapeHtml(book.author)}</td>
                <td>${book.publicationYear}</td>
                <td>${this.escapeHtml(book.addedByUsername)}</td>
                <td>
                    ${
                      this.user && this.user.id === book.addedBy
                        ? `<button class="btn btn-danger" onclick="libraryManager.deleteBook('${book.id}')">Delete</button>`
                        : '<span style="color: #7f8c8d;">-</span>'
                    }
                </td>
            </tr>
        `
      )
      .join("");
  }

  /**
   * Show a message to the user
   */
  showMessage(message, type = "success") {
    // Remove existing messages
    const existingMessages = document.querySelectorAll(".message");
    existingMessages.forEach((msg) => msg.remove());

    // Create new message
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    // Insert at the top of main content
    const mainContent = document.querySelector(".main-content");
    mainContent.insertBefore(messageDiv, mainContent.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Make API calls with authentication
   */
  async apiCall(url, method = "GET", data = null) {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (this.token) {
      options.headers["Authorization"] = `Bearer ${this.token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    return fetch(url, options);
  }
}

// Initialize the application when the page loads
let libraryManager;
document.addEventListener("DOMContentLoaded", () => {
  libraryManager = new LibraryManager();
});
