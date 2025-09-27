export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  createdAt: number;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: number;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  username: string;
  expiresAt: number;
}
