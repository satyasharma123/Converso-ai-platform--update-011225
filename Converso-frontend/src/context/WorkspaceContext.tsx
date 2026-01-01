import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceContextType {
  activeWorkspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  setActiveWorkspaceId: (id: string) => void;
  loading: boolean;
  hasNoWorkspaceMembership: boolean;
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
      // Query workspace_members to get all workspaces for user
      // This supports multi-workspace users (SDR can belong to multiple workspaces)
      const { data, error } = await (supabase
        .from('workspace_members' as any)
        .select('workspace_id, role, workspaces:workspaces(id, name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }) as any);

      if (error) {
        console.error('Error fetching workspaces:', error);
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
        setActiveWorkspace(selectedWorkspace);
      } else {
        // AUDIT: Log when no workspace is selected
        console.log('[WS] active workspace not found -> fallback path (no valid workspace selected)');
      }
    } catch (error) {
      console.error('Error in fetchWorkspaces:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // AUDIT: Log boot start
    console.log('[WS] boot start', { userId: user?.id });

    if (!user?.id) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    // FIX: Do not clear localStorage on login - preserves workspace ID set during creation
    const storageKey = `synq_active_workspace_id:${user.id}`;
    const storedId = localStorage.getItem(storageKey);
    
    // AUDIT: Log stored active workspace
    console.log('[WS] stored active workspace id', { storedId });

    setLoading(true);
    fetchWorkspaces(user.id);
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

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        workspaces,
        setActiveWorkspaceId,
        loading,
        hasNoWorkspaceMembership,
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

