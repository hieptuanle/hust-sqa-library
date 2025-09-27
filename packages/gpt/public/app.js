const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const authToggleButtons = document.querySelectorAll('[data-auth-mode]');
const authForm = document.getElementById('authForm');
const authFeedback = document.getElementById('authFeedback');
const authSubmitButton = authForm.querySelector('button[type="submit"]');
const welcomeMessage = document.getElementById('welcomeMessage');
const logoutButton = document.getElementById('logoutButton');
const addBookForm = document.getElementById('addBookForm');
const bookFeedback = document.getElementById('bookFeedback');
const booksTableBody = document.getElementById('booksTableBody');
const searchForm = document.getElementById('searchForm');
const clearSearchButton = document.getElementById('clearSearch');

let authMode = 'login';
let currentQuery = '';
let currentField = 'title';

initialize();

function initialize() {
  authToggleButtons.forEach((button) => {
    button.addEventListener('click', () => setAuthMode(button.dataset.authMode));
  });

  authForm.addEventListener('submit', handleAuthSubmit);
  logoutButton.addEventListener('click', handleLogout);
  addBookForm.addEventListener('submit', handleAddBook);
  searchForm.addEventListener('submit', handleSearch);
  clearSearchButton.addEventListener('click', handleClearSearch);

  refreshSession();
}

function setAuthMode(mode = 'login') {
  authMode = mode === 'register' ? 'register' : 'login';
  authToggleButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.authMode === authMode);
  });
  authSubmitButton.textContent = authMode === 'login' ? 'Login' : 'Create Account';
  authForm.reset();
  authFeedback.textContent = '';
}

async function refreshSession() {
  try {
    const response = await fetch('/api/session');
    const payload = await response.json();
    if (payload?.user) {
      showApp(payload.user);
      await loadBooks();
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('Failed to determine session', error);
    showAuth('Unable to reach the server.');
  }
}

function showAuth(message = '') {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
  welcomeMessage.textContent = '';
  if (message) {
    authFeedback.textContent = message;
  }
}

function showApp(user) {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  welcomeMessage.textContent = `Signed in as ${user.username}`;
  authFeedback.textContent = '';
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authFeedback.textContent = '';
  authSubmitButton.disabled = true;
  const formData = new FormData(authForm);
  const credentials = Object.fromEntries(formData.entries());

  try {
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const payload = await response.json();
    if (!response.ok) {
      authFeedback.textContent = payload?.error ?? 'Request failed.';
      return;
    }

    if (authMode === 'register') {
      const successMessage = payload?.message ?? 'Registration successful. Please log in.';
      setAuthMode('login');
      authFeedback.textContent = successMessage;
    } else {
      authForm.reset();
      await refreshSession();
    }
  } catch (error) {
    console.error('Authentication error', error);
    authFeedback.textContent = 'Unable to communicate with the server.';
  } finally {
    authSubmitButton.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    showAuth();
  }
}

async function handleAddBook(event) {
  event.preventDefault();
  bookFeedback.textContent = '';
  const submitButton = addBookForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const formData = new FormData(addBookForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      bookFeedback.textContent = body?.error ?? 'Unable to add book.';
      return;
    }
    addBookForm.reset();
    bookFeedback.textContent = body?.message ?? 'Book added.';
    await loadBooks();
  } catch (error) {
    console.error('Failed to add book', error);
    bookFeedback.textContent = 'Could not add the book. Try again.';
  } finally {
    submitButton.disabled = false;
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const formData = new FormData(searchForm);
  currentQuery = (formData.get('query') ?? '').toString().trim();
  const fieldValue = formData.get('field');
  currentField = fieldValue ? fieldValue.toString() : 'title';
  await loadBooks(currentQuery, currentField);
}

async function handleClearSearch() {
  searchForm.reset();
  currentQuery = '';
  currentField = 'title';
  await loadBooks();
}

async function loadBooks(query = currentQuery, field = currentField) {
  try {
    const params = new URLSearchParams();
    if (query) {
      params.set('query', query);
      params.set('field', field === 'author' ? 'author' : 'title');
    }
    const url = params.toString() ? `/api/books?${params}` : '/api/books';
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
      console.error('Failed to load books', payload?.error);
      renderBooks([]);
      return;
    }
    renderBooks(payload.books ?? []);
  } catch (error) {
    console.error('Failed to load books', error);
    renderBooks([]);
  }
}

function renderBooks(books) {
  booksTableBody.innerHTML = '';
  if (!Array.isArray(books) || books.length === 0) {
    const row = document.createElement('tr');
    row.className = 'empty-row';
    row.innerHTML = '<td colspan="4">No books found.</td>';
    booksTableBody.append(row);
    return;
  }

  books.forEach((book) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(book.title)}</td>
      <td>${escapeHtml(book.author)}</td>
      <td>${escapeHtml(book.year)}</td>
      <td><button type="button" class="book-action" data-book-id="${escapeHtml(book.id)}">Delete</button></td>
    `;
    const deleteButton = row.querySelector('button');
    deleteButton.addEventListener('click', () => handleDeleteBook(book.id));
    booksTableBody.append(row);
  });
}

async function handleDeleteBook(bookId) {
  if (!bookId) {
    return;
  }
  if (!window.confirm('Delete this book?')) {
    return;
  }
  try {
    const response = await fetch(`/api/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload?.error ?? 'Failed to delete the book.');
      return;
    }
    await loadBooks();
  } catch (error) {
    console.error('Failed to delete book', error);
    alert('Unable to delete the book.');
  }
}

function escapeHtml(value) {
  if (value == null) {
    return '';
  }
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
