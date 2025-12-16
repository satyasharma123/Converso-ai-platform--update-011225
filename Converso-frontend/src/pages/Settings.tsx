import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Linkedin, Link, Loader2, AlertTriangle, MoreVertical, RefreshCw } from "lucide-react";
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
import type { ConnectedAccount } from "@backend/src/types";

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
  const connectedAccountsQueryKey = ['connected_accounts', user?.id] as const;

  const updateConnectedAccountsCache = (updater: (accounts: ConnectedAccount[]) => ConnectedAccount[]) => {
    queryClient.setQueryData<ConnectedAccount[]>(connectedAccountsQueryKey, (old) => {
      const base = Array.isArray(old) ? old : [];
      return updater(base);
    });
  };
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
  const [reconnectingAccountId, setReconnectingAccountId] = useState<string | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

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

    const optimisticId = `temp-linkedin-${Date.now()}`;
    const optimisticAccount: ConnectedAccount & { __optimistic?: boolean; status?: string; connection_status?: string } = {
      id: optimisticId,
      account_name: newLinkedInAccount.name.trim(),
      account_email: null,
      account_type: 'linkedin',
      is_active: true,
      user_id: user.id,
      workspace_id: workspace.id,
      created_at: new Date().toISOString(),
    };
    optimisticAccount.__optimistic = true;
    optimisticAccount.status = 'connecting';
    optimisticAccount.connection_status = 'connecting';
    updateConnectedAccountsCache((accounts) => [...accounts, optimisticAccount]);

    const rollbackOptimistic = () => {
      updateConnectedAccountsCache((accounts) => accounts.filter(acc => acc.id !== optimisticId));
    };

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
      rollbackOptimistic();
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

  const handleReconnectLinkedIn = async (accountId: string, accountName: string) => {
    if (!user?.id || !workspace?.id) {
      toast.error("User/workspace not loaded");
      return;
    }

    setReconnectingAccountId(accountId);

    try {
      const backendUrl = import.meta.env.VITE_API_URL;
      const startAuthUrl = backendUrl
        ? `${backendUrl}/api/linkedin/accounts/start-auth`
        : `/api/linkedin/accounts/start-auth`;

      // Start reconnection flow
      const startResp = await fetch(startAuthUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: accountName,
          user_id: user.id,
          workspace_id: workspace.id,
          reconnect_account_id: accountId
        }),
      }).then(r => r.json());

      if (!startResp.hostedAuthUrl) {
        throw new Error(startResp.error || "Failed to start LinkedIn reconnection");
      }

      // Open Unipile Hosted Auth popup
      const popup = window.open(startResp.hostedAuthUrl, "UnipileAuth", "width=500,height=700");
      const poll = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(poll);
          setReconnectingAccountId(null);
          await refetchAccounts();
          toast.success("LinkedIn account reconnected successfully");
        }
      }, 800);
    } catch (error: any) {
      toast.error(error.message || "Failed to reconnect LinkedIn account");
      setReconnectingAccountId(null);
    }
  };

  const handleSyncAccount = async (accountId: string, accountName: string) => {
    setSyncingAccountId(accountId);
    toast.info(`Starting sync for ${accountName}...`);

    try {
      await initialSyncLinkedIn(accountId);
      toast.success(`Sync completed for ${accountName}`);
    } catch (error: any) {
      toast.error(error.message || `Failed to sync ${accountName}`);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;

    const pendingRemoval = accountToDelete;
    setAccountToDelete(null);
    setIsDeleting(true);

    const previousAccounts = queryClient.getQueryData<ConnectedAccount[]>(connectedAccountsQueryKey);
    updateConnectedAccountsCache((accounts) => accounts.filter(acc => acc.id !== pendingRemoval.id));

    try {
      if (pendingRemoval.type === 'linkedin') {
        await disconnectLinkedInAccount(pendingRemoval.id);
      } else {
        await connectedAccountsApi.delete(pendingRemoval.id);
      }

      await queryClient.invalidateQueries({ queryKey: connectedAccountsQueryKey });
      await refetchAccounts();

      toast.success("Account disconnected successfully");
    } catch (error: any) {
      if (previousAccounts) {
        queryClient.setQueryData(connectedAccountsQueryKey, previousAccounts);
      }
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle>Email Integration</CardTitle>
                      <CardDescription>Connect your email accounts</CardDescription>
                    </div>
                    <Button onClick={handleConnectEmail} disabled={!user?.id}>
                      <Mail className="h-4 w-4 mr-2" />
                      Connect Email
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle>LinkedIn Integration</CardTitle>
                      <CardDescription>Connect your LinkedIn accounts</CardDescription>
                    </div>
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
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {accountsLoading ? (
                      <div className="text-center py-4">Loading accounts...</div>
                    ) : linkedInAccounts.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Connected Accounts</Label>
                        <div className="border rounded-lg overflow-hidden">
                          {/* Table Header */}
                          <div className="grid grid-cols-[2fr_1.5fr_2fr_auto] gap-4 p-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                            <div>LinkedIn Account</div>
                            <div>Status</div>
                            <div>Sending limits</div>
                            <div className="w-20"></div>
                          </div>
                          
                          {/* Account Rows */}
                          {linkedInAccounts.map(account => {
                            const accountData = account as any;
                            const isOptimisticAccount = Boolean(accountData.__optimistic);
                            const isConnected = accountData.status === 'connected' || accountData.connection_status === 'connected';
                            const hasError = accountData.status === 'error' || accountData.connection_status === 'error' || accountData.error;
                            const isReconnecting = reconnectingAccountId === account.id;
                            const isSyncing = syncingAccountId === account.id;
                            
                            // Get initials for avatar
                            const nameParts = account.account_name.split(' ');
                            const initials = nameParts.length > 1 
                              ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
                              : account.account_name.substring(0, 2).toUpperCase();

                            // Default sending limits (can be customized per account if available in data)
                            const sendingLimits = {
                              connections: accountData.daily_connection_limit || 11,
                              messages: accountData.daily_message_limit || 14,
                              invitations: accountData.daily_invitation_limit || 9
                            };

                            return (
                              <div key={account.id} className="grid grid-cols-[2fr_1.5fr_2fr_auto] gap-4 p-3 items-center hover:bg-muted/30 transition-colors">
                                {/* Account Info */}
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={accountData.profile_picture || undefined} />
                                    <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{account.account_name}</span>
                                  </div>
                                </div>

                                {/* Status */}
                                <div className="flex items-center gap-2">
                                  {isOptimisticAccount ? (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 gap-1"
                                    >
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Connecting...
                                    </Badge>
                                  ) : hasError ? (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800 gap-1"
                                    >
                                      <AlertTriangle className="h-3 w-3" />
                                      Wrong credentials
                                    </Badge>
                                  ) : isConnected ? (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                                    >
                                      Connected
                                    </Badge>
                                  ) : (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800"
                                    >
                                      Unknown
                                    </Badge>
                                  )}
                                </div>

                                {/* Sending Limits */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Link className="h-3 w-3" />
                                    <span>{isOptimisticAccount ? '...' : `${sendingLimits.connections}/day`}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span>{isOptimisticAccount ? '...' : `${sendingLimits.messages}/day`}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="4" width="18" height="16" rx="2" />
                                      <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <span>{isOptimisticAccount ? '...' : `${sendingLimits.invitations}/day`}</span>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 justify-end">
                                  {hasError && !isOptimisticAccount && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleReconnectLinkedIn(account.id, account.account_name)}
                                      disabled={isReconnecting}
                                      className="gap-1"
                                    >
                                      {isReconnecting ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Reconnecting...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3" />
                                          Re-connect
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  
                                  {isOptimisticAccount ? (
                                    <span className="text-xs text-muted-foreground">Awaiting confirmation…</span>
                                  ) : (
                                    <>
                                      {!hasError && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleSyncAccount(account.id, account.account_name)}
                                          disabled={isSyncing}
                                          className="gap-1"
                                        >
                                          {isSyncing ? (
                                            <>
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              Syncing...
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="h-3 w-3" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                            <span className="sr-only">Open menu</span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => handleSyncAccount(account.id, account.account_name)}
                                            disabled={isSyncing}
                                          >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Sync
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleRemoveAccount({
                                              id: account.id,
                                              name: account.account_name,
                                              type: 'linkedin'
                                            })}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            Disconnect
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleReconnectLinkedIn(account.id, account.account_name)}
                                          >
                                            Reconnect
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            disabled
                                            className="text-muted-foreground"
                                          >
                                            Configure proxy
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No LinkedIn accounts connected</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle>CRM Integration</CardTitle>
                      <CardDescription>Connect your CRM platform</CardDescription>
                    </div>
                    <Button disabled>
                      <Link className="h-4 w-4 mr-2" />
                      Add CRM Connection
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
