import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
  owner_user_id?: string;
}

interface WorkspaceContextType {
  activeWorkspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  setActiveWorkspaceId: (id: string) => void;
  loading: boolean;
  hasNoWorkspaceMembership: boolean;
  isOwner: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNoWorkspaceMembership, setHasNoWorkspaceMembership] = useState(false);

  const fetchWorkspaces = useCallback(async (userId: string) => {
    try {
      console.log('[WS-FETCH] start', { userId });
      
      // Query workspace_members to get all workspaces for user
      // This supports multi-workspace users (SDR can belong to multiple workspaces)
      // Add timeout wrapper to detect hanging queries
      const queryPromise = (supabase
        .from('workspace_members' as any)
        .select('workspace_id, role, workspaces:workspaces(id, name, owner_user_id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }) as any);

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Workspace query timeout after 10s')), 10000)
      );

      console.log('[WS-FETCH] executing query with timeout');
      let queryResult: any;
      try {
        queryResult = await Promise.race([queryPromise, timeoutPromise]);
      } catch (timeoutError: any) {
        console.error('[WS-FETCH] Query timed out or failed', timeoutError);
        // Return error structure that matches Supabase response
        const { data, error } = { data: null, error: { message: timeoutError.message, code: 'TIMEOUT' } };
        throw timeoutError;
      }
      const { data, error } = queryResult;

      console.log('[WS-FETCH] query result', { 
        hasData: !!data, 
        dataLength: data?.length ?? 0,
        hasError: !!error,
        error: error ? { message: error.message, code: error.code, details: error.details } : null
      });

      if (error) {
        console.error('[WS-FETCH] Error fetching workspaces:', error);
        // Don't return early - let finally block set loading to false
        // But set empty state so UI can proceed
        setWorkspaces([]);
        setActiveWorkspace(null);
        setHasNoWorkspaceMembership(true);
        return;
      }

      // AUDIT: Log raw workspace_members rows
      console.log('[WS-CTX] raw workspace_members rows', data);

      const workspaceList: WorkspaceSummary[] = (data || [])
        .map((item: any) => {
          const workspace = item.workspaces;
          if (!workspace) return null;
          return {
            id: workspace.id,
            name: workspace.name,
            role: item.role || 'SDR', // Normalized: only ADMIN and SDR allowed
            owner_user_id: workspace.owner_user_id,
          };
        })
        .filter((w): w is WorkspaceSummary => w !== null);

      // AUDIT: Log mapped workspaceList before deduplication
      console.log('[WS-CTX] mapped workspaceList', workspaceList);

      // Deduplicate workspaces by workspace_id to prevent duplicates in dropdown
      const uniqueWorkspaceMap = new Map<string, WorkspaceSummary>();
      for (const workspace of workspaceList) {
        if (!uniqueWorkspaceMap.has(workspace.id)) {
          uniqueWorkspaceMap.set(workspace.id, workspace);
        }
      }
      const uniqueWorkspaces = Array.from(uniqueWorkspaceMap.values());

      setWorkspaces(uniqueWorkspaces);

      // AUDIT: Log memberships loaded
      console.log('[WS] memberships loaded', { 
        memberships: uniqueWorkspaces.length,
        workspaceIds: uniqueWorkspaces.map(w => w.id)
      });

      // FIX: Handle users with no workspace memberships (e.g., after deletion)
      if (!uniqueWorkspaces || uniqueWorkspaces.length === 0) {
        console.warn('[WS] User has no workspace memberships. Forcing create-workspace flow.');
        if (userId) {
          const storageKey = `synq_active_workspace_id:${userId}`;
          localStorage.removeItem(storageKey);
        }
        setWorkspaces([]);
        setActiveWorkspace(null);
        setHasNoWorkspaceMembership(true);
        setLoading(false);
        return;
      }

      // User has workspaces - clear the no-membership flag
      setHasNoWorkspaceMembership(false);

      // Determine active workspace (use deduplicated list)
      const storageKey = `synq_active_workspace_id:${userId}`;
      const savedWorkspaceId = localStorage.getItem(storageKey);

      // AUDIT: Log active workspace selection
      console.log('[WS-CTX] selecting active workspace', { 
        savedWorkspaceId, 
        uniqueWorkspacesCount: uniqueWorkspaces.length,
        uniqueWorkspaceIds: uniqueWorkspaces.map(w => w.id)
      });

      // Validate active workspace after fetch (use uniqueWorkspaces)
      const validWorkspace = savedWorkspaceId
        ? uniqueWorkspaces.find((w) => w.id === savedWorkspaceId) || null
        : null;

      let selectedWorkspace: WorkspaceSummary | null = validWorkspace;

      // If no valid stored workspace, use the first one
      if (!selectedWorkspace && uniqueWorkspaces.length > 0) {
        selectedWorkspace = uniqueWorkspaces[0];
        // Persist immediately
        localStorage.setItem(storageKey, selectedWorkspace.id);
      } else if (selectedWorkspace) {
        // Persist valid workspace
        localStorage.setItem(storageKey, selectedWorkspace.id);
      }

      // AUDIT: Log resolved active workspace
      console.log('[WS] resolved active workspace', { 
        activeWorkspaceId: selectedWorkspace?.id,
        activeWorkspaceName: selectedWorkspace?.name,
        wasFromStorage: !!validWorkspace,
        wasFallback: !validWorkspace && uniqueWorkspaces.length > 0
      });

      if (selectedWorkspace) {
        console.log('[WS-FETCH] setting active workspace', { id: selectedWorkspace.id, name: selectedWorkspace.name });
        setActiveWorkspace(selectedWorkspace);
      } else {
        // AUDIT: Log when no workspace is selected
        console.log('[WS-FETCH] active workspace not found -> fallback path (no valid workspace selected)');
      }
    } catch (error: any) {
      console.error('[WS-FETCH] Error in fetchWorkspaces:', error);
      // Ensure UI can proceed even on error
      setWorkspaces([]);
      setActiveWorkspace(null);
      if (error?.message?.includes('timeout')) {
        console.error('[WS-FETCH] Query timed out - possible RLS/network issue');
      }
    } finally {
      console.log('[WS-FETCH] finally block - setting loading to false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userId = user?.id;

    // HARD GUARANTEE: never block the app
    if (!userId) {
      console.log('[WS] boot skipped — userId not ready');
      setLoading(false);
      return;
    }

    console.log('[WS] boot start', { userId });

    // FIX: Do not clear localStorage on login - preserves workspace ID set during creation
    const storageKey = `synq_active_workspace_id:${userId}`;
    const storedId = localStorage.getItem(storageKey);
    
    // AUDIT: Log stored active workspace
    console.log('[WS] stored active workspace id', { storedId });

    let cancelled = false;

    setLoading(true);

    (async () => {
      try {
        await fetchWorkspaces(userId);
      } catch (err) {
        console.error('[WS] fetchWorkspaces failed', err);
      } finally {
        // ABSOLUTE SAFETY NET
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchWorkspaces]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      if (!user?.id) return;

      // FIX: Always set localStorage first (even if workspace not in array yet)
      const storageKey = `synq_active_workspace_id:${user.id}`;
      localStorage.setItem(storageKey, id);

      // If workspace exists in array, set it in state
      const workspace = workspaces.find((w) => w.id === id);
      if (workspace) {
        setActiveWorkspace(workspace);
      }
      // If not in array yet, fetchWorkspaces will pick it up from localStorage later
    },
    [user?.id, workspaces]
  );

  // Derive owner flag based on workspaces.owner_user_id
  const isOwner =
    activeWorkspace &&
    user?.id === activeWorkspace.owner_user_id;

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        workspaces,
        setActiveWorkspaceId,
        loading,
        hasNoWorkspaceMembership,
        isOwner: isOwner || false,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

