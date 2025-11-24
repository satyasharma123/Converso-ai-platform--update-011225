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
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no role found in table, default to null
        if (error.code === 'PGRST116') {
          setUserRole(null);
        } else {
          throw error;
        }
      } else if (data?.role) {
        const role = data.role as 'admin' | 'sdr';
        setUserRole(role);
        
        // Update user metadata with role for future use
        await supabase.auth.updateUser({
          data: { role }
        });
      } else {
        setUserRole(null);
      }
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
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      }
    });

    // If email confirmation is disabled in Supabase, user is automatically confirmed
    // and a session is created. We don't need to do anything extra.
    // If email confirmation is enabled, user needs to check their email.
    
    return { error, user: data?.user, session: data?.session };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
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
