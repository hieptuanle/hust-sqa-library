import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService.js';
import { generateToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { UserRegistrationData, UserLoginData } from '../models/User.js';

/**
 * Authentication routes
 * Handles user registration, login, and logout
 */
export function createAuthRoutes(db: DatabaseService): Router {
  const router = Router();

  /**
   * Register a new user
   * POST /api/auth/register
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { username, email, password }: UserRegistrationData = req.body;

      // Validate input
      if (!username || !email || !password) {
        return res.status(400).json({
          error: 'Username, email, and password are required'
        });
      }

      if (username.length < 3) {
        return res.status(400).json({
          error: 'Username must be at least 3 characters long'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters long'
        });
      }

      // Email validation (basic)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format'
        });
      }

      // Create user
      const user = await db.createUser({ username, email, password });

      // Generate token
      const token = generateToken(user.id, user.username);

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Registration error:', error);

      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Username or email already exists'
        });
      }

      return res.status(500).json({
        error: 'Internal server error during registration'
      });
    }
  });

  /**
   * Login user
   * POST /api/auth/login
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password }: UserLoginData = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          error: 'Username and password are required'
        });
      }

      // Find user
      const user = await db.findUserByUsername(username);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid username or password'
        });
      }

      // Verify password
      const isValidPassword = await db.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid username or password'
        });
      }

      // Generate token
      const token = generateToken(user.id, user.username);

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Internal server error during login'
      });
    }
  });

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await db.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Profile error:', error);
      return res.status(500).json({
        error: 'Internal server error while fetching profile'
      });
    }
  });

  /**
   * Logout user (client-side token removal)
   * POST /api/auth/logout
   */
  router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    // Since we're using JWT, logout is handled client-side by removing the token
    // This endpoint is mainly for consistency and potential future server-side logout features
    return res.json({
      message: 'Logout successful'
    });
  });

  return router;
}
