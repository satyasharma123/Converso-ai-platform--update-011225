import { Request, Response, NextFunction } from 'express';
import { supabase, createUserClient } from '../lib/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: 'admin' | 'sdr';
  };
  supabaseClient?: ReturnType<typeof createUserClient>;
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header or x-user-id header (dev only)
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.headers['x-user-id'] as string;

    // PRODUCTION SAFETY: Reject x-user-id in production
    if (process.env.NODE_ENV === 'production' && userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // NON-PRODUCTION: Handle x-user-id for local development
    if (process.env.NODE_ENV !== 'production' && userId) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        return res.status(401).json({ error: 'Invalid user' });
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      req.user = {
        id: profile.id,
        email: profile.email,
        role: roleData?.role || null,
      };

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        req.supabaseClient = createUserClient(token);
      }

      return next();
    }

    // JWT authentication (works in all environments)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      req.user = {
        id: user.id,
        email: user.email || '',
        role: roleData?.role || null,
      };

      req.supabaseClient = createUserClient(token);
      return next();
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (error: any) {
    return res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};

/**
 * Optional authentication - doesn't fail if no auth provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.headers['x-user-id'] as string;

    // PRODUCTION SAFETY: Ignore x-user-id in production (silently skip)
    // NON-PRODUCTION: Handle x-user-id for local development
    if (process.env.NODE_ENV !== 'production' && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (profile) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single();

        req.user = {
          id: profile.id,
          email: profile.email,
          role: roleData?.role || null,
        };
      }
    }

    // JWT authentication (works in all environments)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        req.user = {
          id: user.id,
          email: user.email || '',
          role: roleData?.role || null,
        };
        req.supabaseClient = createUserClient(token);
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: ('admin' | 'sdr')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

