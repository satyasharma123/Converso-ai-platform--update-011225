import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AuthBrand } from "@/components/brand/AuthBrand";

export default function CreateWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceName.trim()) {
      toast.error("Please enter a workspace name");
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create workspace
      const { data: workspace, error: workspaceError } = await (supabase
        .from('workspaces' as any)
        .insert({
          name: workspaceName.trim(),
        })
        .select()
        .single() as any);

      if (workspaceError) {
        throw new Error(`Failed to create workspace: ${workspaceError.message}`);
      }

      if (!workspace) {
        throw new Error("Workspace creation returned no data");
      }

      console.log('[CREATE-WS] Workspace created', { workspaceId: workspace.id });

      // 2. Create workspace_members row (assign user as admin)
      const { error: memberError } = await (supabase
        .from('workspace_members' as any)
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'admin',
        }) as any);

      if (memberError) {
        throw new Error(`Failed to create workspace membership: ${memberError.message}`);
      }

      console.log('[CREATE-WS] Workspace membership created');

      // 3. Set active workspace in localStorage
      const storageKey = `synq_active_workspace_id:${user.id}`;
      localStorage.setItem(storageKey, workspace.id);
      console.log('[CREATE-WS] Active workspace set in localStorage', { workspaceId: workspace.id });

      // 4. Update profile with workspace_id (legacy field)
      await supabase
        .from('profiles')
        .update({ workspace_id: workspace.id } as any)
        .eq('id', user.id);

      // 5. Assign admin role
      await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin',
        })
        .select();

      toast.success("Workspace created successfully!");

      // 6. Redirect to dashboard (WorkspaceContext will pick up the new workspace)
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('[CREATE-WS] Error creating workspace:', error);
      toast.error(error.message || "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <AuthBrand />
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl">Create Your Workspace</CardTitle>
            <CardDescription>
              Get started by creating a workspace for your team
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="My Company"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isCreating || !workspaceName.trim()}
            >
              {isCreating ? "Creating..." : "Create Workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

