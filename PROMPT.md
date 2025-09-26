**Task:**
Build a simple **library book manager** with basic features to **add**, **delete**, and **search** books.

**Requirements:**

1. Provide a simple **GUI**.
2. Users can register, login, logout
3. Users can **add** a new book with fields: **title**, **author**, **publication year**.
4. Users can **delete** a book from the library.
5. Add and delete operations are only allowed for logged-in users.
6. Users can **search** for books by **title** or **author** (case-insensitive; partial matches allowed).
7. Persist the library to a **file** so data is **reloaded on startup** and **saved after changes**.

**Constraints & Behavior:**

- Validate inputs:
  - `title` and `author`: non-empty strings.
  - `year`: integer in a reasonable range (e.g., 1400–current year).
- Use a clear internal data model (e.g., list of objects). Assign a stable **book ID** (e.g., UUID or incremental) for delete operations.
- For persistence, use sqlite
- Handle errors gracefully (bad input, corrupt file, duplicate entries, missing fields) with friendly messages.
- Keep the code modular and include comments.

**GUI Design:**

- Minimal with:
  - Form inputs for title, author, year + **Add** button
  - A table/grid listing books with **Delete** action per row
  - A search box with toggle/radio for **Title** vs **Author**
  - Auto-load on open; auto-save on changes
  - Login/Register form
  - Logout button
