/**
 * User model interface
 * Represents a user in the library management system
 */
export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

/**
 * User registration data interface
 * Used when creating a new user
 */
export interface UserRegistrationData {
  username: string;
  email: string;
  password: string;
}

/**
 * User login data interface
 * Used for user authentication
 */
export interface UserLoginData {
  username: string;
  password: string;
}

/**
 * Public user data interface
 * Used when returning user data without sensitive information
 */
export interface PublicUser {
  id: number;
  username: string;
  email: string;
  createdAt: Date;
}
