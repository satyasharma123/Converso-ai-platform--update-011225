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
  hasNoWorkspaceMembership: boolean | null;
  isOwner: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // null = unknown (still loading), true = confirmed no memberships, false = confirmed memberships exist
  const [hasNoWorkspaceMembership, setHasNoWorkspaceMembership] = useState<boolean | null>(null);

  const fetchWorkspaces = useCallback(async (userId: string) => {
    try {
      // Query workspace_members to get all workspaces for user
      // This supports multi-workspace users (SDR can belong to multiple workspaces)
      const queryResult = await (supabase
        .from('workspace_members' as any)
        .select('workspace_id, role, workspaces:workspaces(id, name, owner_user_id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }) as any);
      const { data, error } = queryResult;

      if (error) {
        // IMPORTANT:
        // Errors must NOT force create-workspace routing.
        // The invariant is: only an ACTUAL empty membership list may redirect.
        console.error('[WS] fetchWorkspaces failed', error);
        return;
      }

      // If there are no memberships, this is authoritative.
      if (!data || data.length === 0) {
        setWorkspaces([]);
        setActiveWorkspace(null);
        setHasNoWorkspaceMembership(true);
        return;
      }

      const workspaceList: WorkspaceSummary[] = (data || [])
        .map((item: any) => {
          const workspace = item.workspaces;
          if (!workspace) return null;
          return {
            id: workspace.id,
            name: workspace.name,
            role: item.role || 'SDR',
            owner_user_id: workspace.owner_user_id,
          };
        })
        .filter((w): w is WorkspaceSummary => w !== null);

      // Deduplicate workspaces by workspace_id to prevent duplicates in dropdown
      const uniqueWorkspaceMap = new Map<string, WorkspaceSummary>();
      for (const workspace of workspaceList) {
        if (!uniqueWorkspaceMap.has(workspace.id)) {
          uniqueWorkspaceMap.set(workspace.id, workspace);
        }
      }
      const uniqueWorkspaces = Array.from(uniqueWorkspaceMap.values());

      setWorkspaces(uniqueWorkspaces);
      setHasNoWorkspaceMembership(false);

      // Determine active workspace (use deduplicated list)
      const storageKey = `synq_active_workspace_id:${userId}`;
      const savedWorkspaceId = localStorage.getItem(storageKey);

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

      if (selectedWorkspace) {
        setActiveWorkspace(selectedWorkspace);
      }
    } catch (error: any) {
      // IMPORTANT: Errors must NOT force create-workspace routing.
      console.error('[WS] fetchWorkspaces exception', error);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);

    fetchWorkspaces(user.id)
      .catch(console.error)
      .finally(() => {
        setLoading(false);
      });
  }, [user?.id, fetchWorkspaces]);

  const refreshWorkspaces = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await fetchWorkspaces(user.id);
    } finally {
      setLoading(false);
    }
  };

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
        refreshWorkspaces,
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

