class LibraryApp {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkAuthStatus();
  }

  bindEvents() {
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
    document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
    document.getElementById('addBookForm').addEventListener('submit', (e) => this.handleAddBook(e));
    document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch());
    document.getElementById('clearSearchBtn').addEventListener('click', () => this.loadBooks());
    document.getElementById('searchQuery').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });
  }

  async checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const user = await response.json();
        this.setCurrentUser(user);
      } else {
        this.showAuthSection();
      }
    } catch (error) {
      this.showAuthSection();
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    document.getElementById('userInfo').textContent = `Logged in as: ${user.username}`;
    this.showLibrarySection();
    this.loadBooks();
  }

  showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('librarySection').style.display = 'none';
    document.getElementById('userInfo').textContent = '';
  }

  showLibrarySection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('librarySection').style.display = 'flex';
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('Login successful!', 'success');
        document.getElementById('loginForm').reset();
        this.checkAuthStatus();
      } else {
        this.showMessage(data.error || 'Login failed', 'error');
      }
    } catch (error) {
      this.showMessage('Network error', 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('Registration successful! Please login.', 'success');
        document.getElementById('registerForm').reset();
      } else {
        this.showMessage(data.error || 'Registration failed', 'error');
      }
    } catch (error) {
      this.showMessage('Network error', 'error');
    }
  }

  async handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });

      if (response.ok) {
        this.currentUser = null;
        this.showMessage('Logged out successfully', 'success');
        this.showAuthSection();
      }
    } catch (error) {
      this.showMessage('Logout failed', 'error');
    }
  }

  async handleAddBook(e) {
    e.preventDefault();
    const title = document.getElementById('bookTitle').value;
    const author = document.getElementById('bookAuthor').value;
    const publication_year = parseInt(document.getElementById('bookYear').value);

    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, publication_year })
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('Book added successfully!', 'success');
        document.getElementById('addBookForm').reset();
        this.loadBooks();
      } else {
        const errorMsg = data.errors ? data.errors.join(', ') : data.error;
        this.showMessage(errorMsg, 'error');
      }
    } catch (error) {
      this.showMessage('Failed to add book', 'error');
    }
  }

  async handleSearch() {
    const query = document.getElementById('searchQuery').value.trim();

    if (!query) {
      this.showMessage('Please enter a search term', 'error');
      return;
    }

    const searchType = document.querySelector('input[name="searchType"]:checked').value;

    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}&type=${searchType}`);
      const books = await response.json();

      if (response.ok) {
        this.displayBooks(books);
        if (books.length === 0) {
          this.showMessage('No books found matching your search', 'error');
        }
      } else {
        this.showMessage(books.error || 'Search failed', 'error');
      }
    } catch (error) {
      this.showMessage('Search failed', 'error');
    }
  }

  async loadBooks() {
    try {
      const response = await fetch('/api/books');
      const books = await response.json();

      if (response.ok) {
        this.displayBooks(books);
        document.getElementById('searchQuery').value = '';
      }
    } catch (error) {
      this.showMessage('Failed to load books', 'error');
    }
  }

  displayBooks(books) {
    const container = document.getElementById('booksTable');

    if (books.length === 0) {
      container.innerHTML = '<div class="empty-state">No books in the library yet. Add your first book!</div>';
      return;
    }

    const table = `
      <div class="books-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Year</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${books.map(book => `
              <tr>
                <td>${this.escapeHtml(book.title)}</td>
                <td>${this.escapeHtml(book.author)}</td>
                <td>${book.publication_year}</td>
                <td>
                  ${this.currentUser ?
                    `<button class="delete-btn" onclick="app.deleteBook('${book.id}')">Delete</button>` :
                    '<span style="color: #718096;">Login to delete</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = table;
  }

  async deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) {
      return;
    }

    try {
      const response = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok) {
        this.showMessage('Book deleted successfully', 'success');
        this.loadBooks();
      } else {
        this.showMessage(data.error || 'Failed to delete book', 'error');
      }
    } catch (error) {
      this.showMessage('Failed to delete book', 'error');
    }
  }

  showMessage(message, type) {
    const messageArea = document.getElementById('messageArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    messageArea.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const app = new LibraryApp();