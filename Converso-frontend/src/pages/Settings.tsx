import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin, Link, Loader2, AlertTriangle } from "lucide-react";
import { RulesEngine } from "@/components/Admin/RulesEngine";
import { PipelineStages } from "@/components/Admin/PipelineStages";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/useWorkspace";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useCreateRoutingRule, useDeleteRoutingRule } from "@/hooks/useRoutingRules";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { connectedAccountsApi } from "@/lib/backend-api";
import { initialSyncLinkedIn, disconnectLinkedInAccount } from "@/api/linkedinApi";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { user, userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = profile?.full_name || currentUserMember?.full_name || user?.email || "User";
  const updateProfile = useUpdateProfile();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const { data: connectedAccounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useConnectedAccounts();
  const queryClient = useQueryClient();
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; email?: string; name?: string; type?: string } | null>(null);
  
  useEffect(() => {
    function handleLinkedInConnected(event: MessageEvent) {
      if (event.data?.type === 'linkedin_connected') {
        toast.success('LinkedIn account connected.');
        refetchAccounts();
      }
    }
    window.addEventListener('message', handleLinkedInConnected);
    return () => window.removeEventListener('message', handleLinkedInConnected);
  }, [refetchAccounts]);
  
  const [isDeleting, setIsDeleting] = useState(false);

  // Get active tab from URL or default
  const activeTab = searchParams.get('tab') || (userRole === 'admin' ? 'rules' : 'profile');

  // Profile state
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Workspace state
  const [workspaceName, setWorkspaceName] = useState("");

  // Integrations state
  const [isEmailProviderModalOpen, setIsEmailProviderModalOpen] = useState(false);
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);
  const [newLinkedInAccount, setNewLinkedInAccount] = useState({ name: "", type: "linkedin" as "email" | "linkedin" });
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Initialize form values from data
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (workspace?.name) {
      setWorkspaceName(workspace.name);
    }
  }, [workspace]);

  // Handle OAuth callback success/error messages
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'gmail_connected') {
      toast.success('Gmail account connected successfully!');
      // Remove query params
      setSearchParams({ tab: 'integrations' });
      refetchAccounts();
    }
    
    if (error) {
      toast.error(decodeURIComponent(error));
      // Remove query params
      setSearchParams({ tab: 'integrations' });
    }
  }, [searchParams, refetchAccounts, setSearchParams]);

  // Profile handlers
  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    await updateProfile.mutateAsync({ full_name: fullName });
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect");
        setIsChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error(updateError.message || "Failed to update password");
      } else {
        toast.success("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Workspace handlers
  const handleUpdateWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    await updateWorkspace.mutateAsync(workspaceName);
  };

  // Integration handlers
  const handleConnectEmail = () => {
    if (!user?.id) {
      toast.error("Please log in to connect email");
      return;
    }
    setIsEmailProviderModalOpen(true);
  };

  const handleSelectEmailProvider = async (provider: "gmail" | "outlook") => {
    if (!user?.id) {
      toast.error("Please log in to connect email");
      return;
    }

    setIsEmailProviderModalOpen(false);
    
    // Redirect to appropriate OAuth flow
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    if (provider === "gmail") {
      window.location.href = `${backendUrl}/api/integrations/gmail/connect?userId=${user.id}`;
    } else if (provider === "outlook") {
      window.location.href = `${backendUrl}/api/integrations/outlook/connect?userId=${user.id}`;
    }
  };

  const handleAddLinkedInAccount = async () => {
    if (!newLinkedInAccount.name.trim()) {
      toast.error("Account name is required");
      return;
    }

    if (!user?.id || !workspace?.id) {
      toast.error("User/workspace not loaded");
      return;
    }

    setIsAddingAccount(true);

    try {
      // Use proxy in dev (relative /api), or absolute if provided
      const backendUrl = import.meta.env.VITE_API_URL;
      const startAuthUrl = backendUrl
        ? `${backendUrl}/api/linkedin/accounts/start-auth`
        : `/api/linkedin/accounts/start-auth`;

      // Start Hosted Auth with Unipile via backend
      const startResp = await fetch(startAuthUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        account_name: newLinkedInAccount.name,
        user_id: user.id,
          workspace_id: workspace.id,
        }),
      }).then(r => r.json());

      if (!startResp.hostedAuthUrl) {
        throw new Error(startResp.error || "Failed to start LinkedIn authentication");
      }

      // Open Unipile Hosted Auth popup
      const popup = window.open(startResp.hostedAuthUrl, "UnipileAuth", "width=500,height=700");
      const poll = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(poll);
          setIsAddingAccount(false);
          await refetchAccounts();
          toast.success("LinkedIn account connected. Refresh if not visible.");
        }
      }, 800);

      setIsLinkedInModalOpen(false);
      setNewLinkedInAccount({ name: "", type: "linkedin" });
    } catch (error: any) {
      toast.error(error.message || "Failed to connect LinkedIn account");
    } finally {
      // Note: when popup flow finishes, we also clear loader there; keep a guard here.
      setTimeout(() => setIsAddingAccount(false), 500);
    }
  };

  const handleRemoveAccount = async (account: { id: string; email?: string; name?: string; type?: string }) => {
    // Show confirmation dialog
    setAccountToDelete({
      id: account.id,
      email: account.email,
      name: account.name,
      type: account.type
    });
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;

    setIsDeleting(true);
    try {
      // If this is a LinkedIn account, use LinkedIn disconnect
      if (accountToDelete.type === 'linkedin') {
        await disconnectLinkedInAccount(accountToDelete.id);
        await refetchAccounts();
      } else {
        await connectedAccountsApi.delete(accountToDelete.id);
      }
      
      // Invalidate and refetch connected accounts
      await queryClient.invalidateQueries({ queryKey: ['connected_accounts'] });
      await refetchAccounts();
      
      toast.success("Account disconnected successfully");
      setAccountToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect account");
    } finally {
      setIsDeleting(false);
    }
  };

  const emailAccounts = connectedAccounts.filter(acc => acc.account_type === "email");
  // Use dedicated LinkedIn accounts query to ensure workspace-level accounts are shown
  const linkedInAccounts = connectedAccounts.filter(acc => acc.account_type === "linkedin");

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage integrations, automation, and workspace settings</p>
        </div>

        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setSearchParams({ tab: value })}
          className="w-full"
        >
          <TabsList>
            {userRole === 'admin' && (
              <>
                <TabsTrigger value="rules">Routing Rules</TabsTrigger>
                <TabsTrigger value="integrations">Integrations</TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline Stages</TabsTrigger>
                <TabsTrigger value="workspace">Workspace</TabsTrigger>
              </>
            )}
            <TabsTrigger value="profile">My Profile</TabsTrigger>
          </TabsList>

          {userRole === 'admin' && (
            <>
              <TabsContent value="rules" className="mt-6">
                <RulesEngine />
              </TabsContent>

              <TabsContent value="integrations" className="mt-6 space-y-6 max-w-4xl">
                <Card>
                  <CardHeader>
                    <CardTitle>Email Integration</CardTitle>
                    <CardDescription>Connect your email accounts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button onClick={handleConnectEmail} disabled={!user?.id}>
                      <Mail className="h-4 w-4 mr-2" />
                      Connect Email
                    </Button>
                    
                    <Dialog open={isEmailProviderModalOpen} onOpenChange={setIsEmailProviderModalOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Choose Email Provider</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                          <Button
                            variant="outline"
                            className="w-full justify-start h-auto py-4"
                            onClick={() => handleSelectEmailProvider("gmail")}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
                                <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold">Gmail</div>
                                <div className="text-xs text-muted-foreground">Connect your Gmail account</div>
                              </div>
                            </div>
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="w-full justify-start h-auto py-4"
                            onClick={() => handleSelectEmailProvider("outlook")}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold">Outlook</div>
                                <div className="text-xs text-muted-foreground">Connect your Outlook account</div>
                              </div>
                            </div>
                          </Button>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEmailProviderModalOpen(false)}>
                            Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {accountsLoading ? (
                      <div className="text-center py-4">Loading accounts...</div>
                    ) : emailAccounts.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Connected Accounts</Label>
                        <div className="space-y-2">
                          {emailAccounts.map(account => {
                            // Determine provider badge
                            const provider = (account as any).oauth_provider;
                            const isGmail = provider === 'google';
                            const isOutlook = provider === 'microsoft';
                            
                            return (
                              <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{account.account_email || account.account_name}</span>
                                  {isGmail && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                                    >
                                      Gmail
                                    </Badge>
                                  )}
                                  {isOutlook && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                    >
                                      Outlook
                                    </Badge>
                                  )}
                                  {!isGmail && !isOutlook && (
                                    <Badge variant="outline" className="text-xs">Email</Badge>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveAccount({
                                    id: account.id,
                                    email: account.account_email,
                                    name: account.account_name
                                  })}
                                >
                                  Disconnect
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No email accounts connected</div>
                    )}
                  </CardContent>
                </Card>

                {/* Confirmation Dialog for Account Disconnection */}
                <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Disconnect Account?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="pt-2">
                        Are you sure you want to disconnect <strong>{accountToDelete?.email || 'this account'}</strong>?
                        <br /><br />
                        <span className="text-destructive font-medium">
                          This action will permanently delete all associated data:
                        </span>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                          {accountToDelete?.email ? (
                            <>
                              <li>All synced emails and conversations</li>
                              <li>All messages and email threads</li>
                              <li>Email sync history</li>
                            </>
                          ) : (
                            <>
                              <li>All conversations and messages</li>
                              <li>All associated data and history</li>
                            </>
                          )}
                        </ul>
                        <br />
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmDeleteAccount}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          'Confirm Disconnect'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Card>
                  <CardHeader>
                    <CardTitle>LinkedIn Integration</CardTitle>
                    <CardDescription>Connect your LinkedIn accounts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Dialog open={isLinkedInModalOpen} onOpenChange={setIsLinkedInModalOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setIsLinkedInModalOpen(true)}>
                          <Linkedin className="h-4 w-4 mr-2" />
                          Add LinkedIn Account
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect LinkedIn Account</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="linkedin-account-name">Account Name</Label>
                            <Input
                              id="linkedin-account-name"
                              placeholder="e.g., LinkedIn Business Account"
                              value={newLinkedInAccount.name}
                              onChange={(e) => setNewLinkedInAccount({ ...newLinkedInAccount, name: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsLinkedInModalOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddLinkedInAccount} disabled={isAddingAccount}>
                            {isAddingAccount ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {accountsLoading ? (
                      <div className="text-center py-4">Loading accounts...</div>
                    ) : linkedInAccounts.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Connected Accounts</Label>
                        <div className="space-y-2">
                          {linkedInAccounts.map(account => (
                            <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Linkedin className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">{account.account_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const res = await initialSyncLinkedIn(account.id);
                                      toast.success(`Sync started: ${res.conversations} conversations, ${res.messages} messages`);
                                      await refetchAccounts();
                                    } catch (err: any) {
                                      toast.error(err.message || 'Failed to sync');
                                    }
                                  }}
                                >
                                  Sync
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveAccount({
                                    id: account.id,
                                    name: account.account_name,
                                    type: 'linkedin'
                                  })}
                                >
                                  Disconnect
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No LinkedIn accounts connected</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>CRM Integration</CardTitle>
                    <CardDescription>Connect your CRM platform</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button disabled>
                      <Link className="h-4 w-4 mr-2" />
                      Add CRM Connection
                    </Button>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Supported CRMs: HubSpot, Salesforce, Pipedrive (Coming Soon)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-6">
                <PipelineStages />
              </TabsContent>

              <TabsContent value="workspace" className="mt-6 max-w-4xl">
                <Card>
                  <CardHeader>
                    <CardTitle>Workspace Settings</CardTitle>
                    <CardDescription>Manage your workspace name and settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {workspaceLoading ? (
                      <div className="text-center py-4">Loading workspace...</div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="workspace-name">Workspace Name</Label>
                          <Input
                            id="workspace-name"
                            placeholder="My Company"
                            value={workspaceName || workspace?.name || ""}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={handleUpdateWorkspace}
                          disabled={updateWorkspace.isPending || !workspaceName.trim()}
                        >
                          {updateWorkspace.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update Workspace"
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          <TabsContent value="profile" className="mt-6 max-w-4xl">
            <Card>
              <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Manage your profile information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileLoading ? (
                  <div className="text-center py-4">Loading profile...</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input id="profile-email" type="email" value={user?.email || ''} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Full Name</Label>
                      <Input
                        id="profile-name"
                        placeholder="Enter your full name"
                        value={fullName || profile?.full_name || ""}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleUpdateProfile}
                      disabled={updateProfile.isPending || !fullName.trim()}
                    >
                      {updateProfile.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Profile"
                      )}
                    </Button>

                    <div className="pt-6 border-t space-y-4">
                      <h3 className="text-lg font-semibold">Change Password</h3>
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input
                          id="current-password"
                          type="password"
                          placeholder="Enter current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                      >
                        {isChangingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Changing Password...
                          </>
                        ) : (
                          "Change Password"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
