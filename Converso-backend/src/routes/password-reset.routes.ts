/**
 * Password Reset Route (Backend Helper)
 * 
 * This route can help debug password reset issues
 * by testing the Supabase password reset functionality
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/password-reset/test
 * Test password reset email sending
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Test using Supabase admin client
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.headers.origin || 'http://localhost:8080'}/`,
      },
    });

    if (error) {
      logger.error('Password reset link generation error:', error);
      return res.status(500).json({
        error: 'Failed to generate password reset link',
        details: error.message,
        code: error.status,
      });
    }

    logger.info('Password reset link generated successfully');
    res.json({
      success: true,
      message: 'Password reset link generated',
      // In production, don't return the link - just send the email
      // This is for testing only
      link: data?.properties?.action_link,
      // expires_at is not available in GenerateLinkProperties type
      // The link expires based on Supabase settings
    });
  } catch (error: any) {
    logger.error('Password reset test error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

export default router;

