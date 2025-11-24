import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * GET /api/test/db
 * Test database connection
 */
router.get(
  '/db',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // Test basic connection by querying a simple table
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Database connection failed',
          details: error.message,
        });
      }

      res.json({
        success: true,
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Database test failed',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/test/tables
 * List available tables (test query)
 */
router.get(
  '/tables',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // Try to query different tables to see what's available
      const tables = [
        'profiles',
        'conversations',
        'messages',
        'pipeline_stages',
        'connected_accounts',
        'user_roles',
      ];

      const results: Record<string, any> = {};

      for (const table of tables) {
        try {
          const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

          results[table] = {
            exists: !error,
            count: count || 0,
            error: error?.message || null,
          };
        } catch (err: any) {
          results[table] = {
            exists: false,
            error: err.message,
          };
        }
      }

      res.json({
        success: true,
        tables: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Table check failed',
        details: error.message,
      });
    }
  })
);

export default router;

