import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AuthBrand } from "@/components/brand/AuthBrand";

export default function CreateWorkspace() {
  const { user } = useAuth();
  const { setActiveWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('[CREATE-WS] submit clicked');
    console.log('[CREATE-WS] workspace name:', workspaceName);

    if (!workspaceName.trim()) {
      toast.error("Please enter a workspace name");
      return;
    }

    if (!user?.id) {
      console.error('[CREATE-WS] user not authenticated', { user });
      toast.error("User not authenticated");
      return;
    }

    console.log('[CREATE-WS] auth user:', { id: user.id, email: user.email });
    setIsCreating(true);

    try {
      // 1. Create workspace with owner fields
      console.log('[CREATE-WS] calling supabase insert workspace');
      const { data: workspace, error: workspaceError } = await (supabase
        .from('workspaces' as any)
        .insert({
          name: workspaceName.trim(),
          owner_user_id: user.id,
          owner_email: user.email || null,
        })
        .select()
        .single() as any);

      console.log('[CREATE-WS] supabase response:', { 
        hasWorkspace: !!workspace,
        workspaceId: workspace?.id,
        error: workspaceError ? { message: workspaceError.message, code: workspaceError.code } : null 
      });

      if (workspaceError) {
        console.error('[CREATE-WS] workspace creation error:', workspaceError);
        throw new Error(`Failed to create workspace: ${workspaceError.message}`);
      }

      if (!workspace) {
        console.error('[CREATE-WS] workspace creation returned no data');
        throw new Error("Workspace creation returned no data");
      }

      console.log('[CREATE-WS] Workspace created', { workspaceId: workspace.id });

      // 2. Create workspace_members row (assign user as admin) - NON-NEGOTIABLE
      console.log('[CREATE-WS] creating workspace_members row');
      const { error: memberError } = await (supabase
        .from('workspace_members' as any)
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'admin',
        }) as any);

      console.log('[CREATE-WS] workspace_members insert response:', { 
        error: memberError ? { message: memberError.message, code: memberError.code } : null 
      });

      if (memberError) {
        console.error('[CREATE-WS] failed to add creator as workspace member', memberError);
        throw memberError; // IMPORTANT: stop flow - fail fast
      }

      console.log('[CREATE-WS] Workspace membership created');

      // 3. Verify membership immediately (safety net)
      console.log('[CREATE-WS] verifying workspace membership');
      const { data: verifyMembership, error: verifyError } = await (supabase
        .from('workspace_members' as any)
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id)
        .single() as any);

      if (!verifyMembership || verifyError) {
        console.error('[CREATE-WS] membership verification failed', verifyError);
        throw new Error('Workspace membership not created - verification failed');
      }

      console.log('[CREATE-WS] Workspace membership verified', { membershipId: verifyMembership.id });

      // 4. Set active workspace in localStorage
      const storageKey = `synq_active_workspace_id:${user.id}`;
      localStorage.setItem(storageKey, workspace.id);
      console.log('[CREATE-WS] Active workspace set in localStorage', { workspaceId: workspace.id });

      // 5. Update profile with workspace_id (legacy field)
      await supabase
        .from('profiles')
        .update({ workspace_id: workspace.id } as any)
        .eq('id', user.id);

      // 6. Assign admin role (optional, non-blocking)
      try {
        await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'admin',
          });
      } catch (err: any) {
        console.warn('[CREATE-WS] user_roles insert failed, continuing', err);
      }

      toast.success("Workspace created successfully!");

      // 7. Set active workspace in context before navigation
      console.log('[CREATE-WS] Setting active workspace in context', { workspaceId: workspace.id });
      setActiveWorkspaceId(workspace.id);

      // 8. Force navigation to dashboard (ONLY after verification succeeds)
      console.log('[CREATE-WS] forcing dashboard redirect');
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

