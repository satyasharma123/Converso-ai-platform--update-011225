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
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces:workspaces(id, name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching workspaces:', error);
        return;
      }

      const workspaceList: WorkspaceSummary[] = (data || [])
        .map((item: any) => {
          const workspace = item.workspaces;
          if (!workspace) return null;
          return {
            id: workspace.id,
            name: workspace.name,
            role: item.role || 'member',
          };
        })
        .filter((w): w is WorkspaceSummary => w !== null);

      setWorkspaces(workspaceList);

      // Determine active workspace
      const storageKey = `synq_active_workspace_id:${userId}`;
      const storedWorkspaceId = localStorage.getItem(storageKey);

      let selectedWorkspace: WorkspaceSummary | null = null;

      if (storedWorkspaceId) {
        // Verify the stored workspace is still in the list
        selectedWorkspace = workspaceList.find((w) => w.id === storedWorkspaceId) || null;
      }

      // If no valid stored workspace, use the first one
      if (!selectedWorkspace && workspaceList.length > 0) {
        selectedWorkspace = workspaceList[0];
      }

      if (selectedWorkspace) {
        setActiveWorkspace(selectedWorkspace);
        // Persist immediately
        localStorage.setItem(storageKey, selectedWorkspace.id);
      }
    } catch (error) {
      console.error('Error in fetchWorkspaces:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      fetchWorkspaces(user.id);
    } else {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
    }
  }, [user?.id, fetchWorkspaces]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      if (!user?.id) return;

      const workspace = workspaces.find((w) => w.id === id);
      if (workspace) {
        setActiveWorkspace(workspace);
        const storageKey = `synq_active_workspace_id:${user.id}`;
        localStorage.setItem(storageKey, id);
      }
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

