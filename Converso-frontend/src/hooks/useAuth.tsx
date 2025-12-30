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
    const redirectUrl = `${window.location.origin}/auth/callback`;
    
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
    
    /**
     * PHASE 3 — Explicit workspace creation
     * This is REQUIRED and PERMANENT
     * Safe: runs only after signup success
     * 
     * INVARIANT:
     * A user may auto-create a workspace ONLY if
     * they do NOT already belong to any workspace
     */
    if (data?.user) {
      try {
        // AUDIT: Log signup success
        console.log('[AUTH] signup success', { userId: data.user.id, email });

        // Guard: Check if user already belongs to a workspace
        const { data: existingMemberships } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', data.user.id)
          .limit(1);

        // AUDIT: Log memberships check
        console.log('[AUTH] memberships after signup', { 
          existingMemberships, 
          count: existingMemberships?.length || 0 
        });

        if (existingMemberships && existingMemberships.length > 0) {
          // User already belongs to a workspace
          // DO NOT CREATE ANOTHER
          console.log('[AUTH] User already belongs to a workspace, skipping workspace creation');
          return { error, data };
        }

        const userEmailPrefix = email.split('@')[0];
        
        // 1. Create workspace
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .insert({
            name: `${userEmailPrefix}'s Workspace`,
          })
          .select()
          .single();

        // AUDIT: Log workspace creation result
        console.log('[AUTH] workspace created?', { 
          createdWorkspaceId: workspace?.id, 
          error: workspaceError?.message 
        });

        if (workspaceError) {
          console.error('Workspace creation failed after signup:', workspaceError);
          // Don't throw - allow signup to succeed, workspace can be created later
        } else if (workspace) {
          // 2. Create workspace_members row
          const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
              workspace_id: workspace.id,
              user_id: data.user.id,
              role: 'admin',
            });

          if (memberError) {
            console.error('Workspace membership creation failed:', memberError);
          }

          // AUDIT: Note - workspace created but activeWorkspace NOT set here
          // WorkspaceContext will pick it up on next render via fetchWorkspaces()
          console.log('[AUTH] workspace and membership created, but activeWorkspace not set in context yet');

          // 3. Update profile with workspace_id (if profile exists)
          await supabase
            .from('profiles')
            .update({ workspace_id: workspace.id })
            .eq('id', data.user.id);

          // 4. Assign admin role (if user_roles table exists)
          await supabase
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role: 'admin',
            })
            .select();
        }
      } catch (workspaceCreationError: any) {
        console.error('Error creating workspace after signup:', workspaceCreationError);
        // Don't throw - signup succeeded, workspace creation is non-critical
      }
    }
    
    return { error, user: data?.user, session: data?.session };
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
