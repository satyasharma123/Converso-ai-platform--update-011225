import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  logger.error(`Error [${statusCode}] on ${req.method} ${req.path}`, {
    message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    body: req.body,
    query: req.query,
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: {
      message: isDevelopment ? message : statusCode >= 500 ? 'Internal server error' : message,
      statusCode,
      ...(isDevelopment && { 
        stack: err.stack,
        code: err.code,
      }),
    },
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

