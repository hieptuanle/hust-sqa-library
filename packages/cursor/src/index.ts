import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { DatabaseService } from './services/DatabaseService.js';
import { createAuthRoutes } from './routes/auth.js';
import { createBooksRoutes } from './routes/books.js';

/**
 * Library Book Manager Application
 * Main entry point for the Express server
 */

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize database
  const db = new DatabaseService();
  await db.initialize();

  // Rate limiting middleware
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });

  // Middleware
  app.use(limiter as any);
  app.use(cors());
  app.use(express.json());
  app.use(express.static('public'));

  // Routes
  app.use('/api/auth', createAuthRoutes(db));
  app.use('/api/books', createBooksRoutes(db));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Library Book Manager'
    });
  });

  // Serve the main HTML page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error'
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint not found'
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Graceful shutdown...');
    await db.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM. Graceful shutdown...');
    await db.close();
    process.exit(0);
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Library Book Manager server running on http://localhost:${PORT}`);
    console.log(`📚 Database initialized and ready`);
    console.log(`🌐 Open your browser and navigate to http://localhost:${PORT}`);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
