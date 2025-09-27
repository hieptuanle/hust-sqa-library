import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * JWT secret for token signing and verification
 * In production, this should be stored in environment variables
 */
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Interface for authenticated request
 * Extends Express Request to include user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

/**
 * Generate JWT token for user
 * @param userId User ID
 * @param username Username
 * @returns JWT token string
 */
export function generateToken(userId: number, username: string): string {
  return jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify JWT token middleware
 * Extracts user information from token and adds it to request
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    if (typeof decoded === 'object' && decoded !== null) {
      req.user = {
        id: decoded.userId,
        username: decoded.username
      };
    }

    next();
  });
}

/**
 * Optional authentication middleware
 * Similar to authenticateToken but doesn't fail if no token is provided
 * Useful for routes that work for both authenticated and anonymous users
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && typeof decoded === 'object' && decoded !== null) {
      req.user = {
        id: decoded.userId,
        username: decoded.username
      };
    }
    next();
  });
}
