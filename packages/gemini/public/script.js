
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const authContainer = document.getElementById('auth-container');
    const libraryContainer = document.getElementById('library-container');
    const usernameDisplay = document.getElementById('username-display');

    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');

    const registerUsernameInput = document.getElementById('register-username');
    const registerPasswordInput = document.getElementById('register-password');
    const registerBtn = document.getElementById('register-btn');

    const logoutBtn = document.getElementById('logout-btn');

    const addBookForm = document.getElementById('add-book-form');
    const titleInput = document.getElementById('title');
    const authorInput = document.getElementById('author');
    const yearInput = document.getElementById('year');

    const searchInput = document.getElementById('search-input');
    const searchBy = document.getElementById('search-by');
    const searchBtn = document.getElementById('search-btn');

    const bookList = document.getElementById('book-list').getElementsByTagName('tbody')[0];

    let token = localStorage.getItem('token');
    let username = localStorage.getItem('username');

    const api = {
        login: '/api/login',
        register: '/api/register',
        books: '/api/books'
    };

    function checkUserSession() {
        if (token && username) {
            authContainer.style.display = 'none';
            libraryContainer.style.display = 'block';
            usernameDisplay.textContent = username;
            fetchBooks();
        } else {
            authContainer.style.display = 'block';
            libraryContainer.style.display = 'none';
        }
    }

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    registerBtn.addEventListener('click', async () => {
        const username = registerUsernameInput.value;
        const password = registerPasswordInput.value;
        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }

        try {
            const response = await fetch(api.register, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                registerUsernameInput.value = '';
                registerPasswordInput.value = '';
                showLogin.click();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Registration failed:', error);
            alert('Registration failed. Please try again.');
        }
    });

    loginBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value;
        const password = loginPasswordInput.value;
        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }

        try {
            const response = await fetch(api.login, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                token = data.token;
                localStorage.setItem('token', token);
                localStorage.setItem('username', username);
                checkUserSession();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please try again.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        token = null;
        username = null;
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        checkUserSession();
    });

    async function fetchBooks(query = '', searchBy = 'title') {
        try {
            const response = await fetch(`${api.books}?search=${query}&by=${searchBy}`);
            const books = await response.json();
            renderBooks(books);
        } catch (error) {
            console.error('Failed to fetch books:', error);
        }
    }

    function renderBooks(books) {
        bookList.innerHTML = '';
        books.forEach(book => {
            const row = bookList.insertRow();
            row.innerHTML = `
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.year}</td>
                <td><button class="delete-btn" data-id="${book.id}">Delete</button></td>
            `;
        });
    }

    addBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value;
        const author = authorInput.value;
        const year = parseInt(yearInput.value, 10);

        if (!title || !author || !year) {
            alert('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch(api.books, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, author, year })
            });

            if (response.ok) {
                fetchBooks();
                addBookForm.reset();
            } else {
                const data = await response.json();
                alert(data.message);
            }
        } catch (error) {
            console.error('Failed to add book:', error);
            alert('Failed to add book. Please try again.');
        }
    });

    bookList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const bookId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this book?')) {
                try {
                    const response = await fetch(`${api.books}/${bookId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        fetchBooks();
                    } else {
                        const data = await response.json();
                        alert(data.message);
                    }
                } catch (error) {
                    console.error('Failed to delete book:', error);
                    alert('Failed to delete book. Please try again.');
                }
            }
        }
    });

    searchBtn.addEventListener('click', () => {
        const query = searchInput.value;
        const by = searchBy.value;
        fetchBooks(query, by);
    });

    checkUserSession();
});
