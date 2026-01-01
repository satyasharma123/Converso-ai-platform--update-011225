import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'admin' | 'sdr' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any; user?: User | null; session?: Session | null }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'sdr' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (user: User) => {
    try {
      setLoading(true);
      
      // First, check user metadata for role
      const metadataRole = user.user_metadata?.role as 'admin' | 'sdr' | undefined;
      if (metadataRole === 'admin' || metadataRole === 'sdr') {
        setUserRole(metadataRole);
        setLoading(false);
        return;
      }

      // Fallback to user_roles table if not in metadata
      // Wrap in try/catch to allow failure - user_roles may not exist yet
      let resolvedRole: 'admin' | 'sdr' | null = null;

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.role) {
          resolvedRole = data.role as 'admin' | 'sdr';
          
          // Update user metadata with role for future use
          await supabase.auth.updateUser({
            data: { role: resolvedRole }
          });
        }
      } catch (err) {
        console.warn('[AUTH] user_roles not available yet, continuing', err);
      }

      setUserRole(resolvedRole);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user);
      } else {
        setLoading(false);
      }
    });

    // Set up auth state listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserRole(session.user);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log('[SIGNUP] start', { email, fullName: fullName ? 'provided' : 'missing' });
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      console.log('[SIGNUP] supabase response:', { 
        hasData: !!data, 
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        error: error ? { message: error.message, status: error.status } : null 
      });

      if (error) {
        console.error('[SIGNUP] error:', error);
        throw error;
      }

      console.log('[SIGNUP] user:', data?.user ? { id: data.user.id, email: data.user.email } : null);
      console.log('[SIGNUP] session:', data?.session ? 'exists' : 'null');

      if (!data?.user) {
        throw new Error('Signup succeeded but user is null');
      }

      // 🚨 IMPORTANT: DO NOT wait for session or create workspace
      // Signup only creates auth user
      // Workspace creation happens on /create-workspace page
      console.log('[SIGNUP] signup successful, returning user data (workspace creation happens on create-workspace page)');
      
      return { error: null, user: data.user, session: data.session };
    } catch (err: any) {
      console.error('[SIGNUP] catch:', err);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    try {
      // Try with explicit redirect URL
      // Make sure this URL is in Supabase redirect URLs list
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error, data } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      // Log for debugging (remove in production)
      if (error) {
        console.error('Password reset error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
      }
      
      return { error, data };
    } catch (err: any) {
      console.error('Password reset exception:', err);
      return { 
        error: { 
          message: err.message || 'Failed to send password reset email',
          status: 500 
        } 
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signIn, signUp, signInWithGoogle, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
