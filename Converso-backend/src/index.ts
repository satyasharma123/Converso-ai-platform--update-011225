import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import apiRoutes from './routes';
import { errorHandler } from './utils/errorHandler';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - CORS configuration for credentials support
app.use(cors({
  origin: 'http://localhost:8082', // Frontend origin
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role'],
}));
app.use(express.json());

// Debug logger to trace all API requests
app.use((req, _res, next) => {
  console.log(`[API DEBUG] ${req.method} ${req.originalUrl}`);
  next();
});

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Converso Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      conversations: '/api/conversations',
      messages: '/api/messages',
      pipelineStages: '/api/pipeline-stages',
      teamMembers: '/api/team-members',
      connectedAccounts: '/api/connected-accounts',
      search: '/api/search',
      analytics: '/api/analytics',
      auth: '/api/auth/google',
      profiles: '/api/profiles',
      workspace: '/api/workspace',
      routingRules: '/api/routing-rules',
      test: process.env.NODE_ENV !== 'production' ? '/api/test' : undefined
    }
  });
});

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Request logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    next();
  });
}

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Converso Backend Server running on http://localhost:${PORT}`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`📡 API routes available at http://localhost:${PORT}/api`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

});

