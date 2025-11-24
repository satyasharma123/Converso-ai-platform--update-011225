/**
 * Supabase Client for Backend
 * Server-side Supabase client (uses service role key for admin operations)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wahvinwuyefmkmgmjspo.supabase.co';
// Support both ANON_KEY and PUBLISHABLE_KEY (they're the same in newer Supabase versions)
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__xq0Rw3XYbhTq1PyiLzw3Q_zdDEHKNV';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use anon key for now - in production, use service role key for admin operations
// For user-specific operations, we'll use the user's JWT token from the request
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // Server-side doesn't need session persistence
    autoRefreshToken: false,
  },
});

// Service role client (bypasses RLS) - use only for admin operations
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : (() => {
      // Warn if service role key is not set (but still return regular client)
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Some operations may fail due to RLS. Set it in .env file.');
      }
      return supabase; // Fallback to regular client if no service role key
    })();

/**
 * Create a Supabase client with a user's JWT token
 * Use this for user-specific operations
 */
export function createUserClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

