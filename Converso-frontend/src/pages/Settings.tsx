import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin, Link, Loader2 } from "lucide-react";
import { RulesEngine } from "@/components/Admin/RulesEngine";
import { PipelineStages } from "@/components/Admin/PipelineStages";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/useWorkspace";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useCreateRoutingRule, useDeleteRoutingRule } from "@/hooks/useRoutingRules";
import { connectedAccountsApi } from "@/lib/backend-api";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export default function Settings() {
  const { user, userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const { data: connectedAccounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useConnectedAccounts();

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
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);
  const [newEmailAccount, setNewEmailAccount] = useState({ name: "", email: "", type: "email" as "email" | "linkedin" });
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
  const handleSelectEmailType = async (type: string) => {
    if (type === "Gmail") {
      // Check if user is authenticated
      if (!user?.id) {
        toast.error("Please log in to connect Gmail");
        return;
      }
      
      // Redirect to Gmail OAuth flow with userId as query parameter
      // This ensures the backend can identify the user even without auth headers
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      window.location.href = `${backendUrl}/api/integrations/gmail/connect?userId=${user.id}`;
    } else {
      // For other email types, show manual connection dialog
      setIsEmailModalOpen(true);
      setNewEmailAccount({ name: "", email: "", type: "email" });
    }
  };

  const handleAddEmailAccount = async () => {
    if (!newEmailAccount.name.trim() || !newEmailAccount.email.trim()) {
      toast.error("Account name and email are required");
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    setIsAddingAccount(true);

    try {
      await connectedAccountsApi.create({
        account_name: newEmailAccount.name,
        account_email: newEmailAccount.email,
        account_type: "email",
        is_active: true,
        user_id: user.id,
      });

      toast.success("Email account connected successfully");
      setIsEmailModalOpen(false);
      setNewEmailAccount({ name: "", email: "", type: "email" });
      refetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to connect email account");
    } finally {
      setIsAddingAccount(false);
    }
  };

  const handleAddLinkedInAccount = async () => {
    if (!newLinkedInAccount.name.trim()) {
      toast.error("Account name is required");
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    setIsAddingAccount(true);

    try {
      await connectedAccountsApi.create({
        account_name: newLinkedInAccount.name,
        account_email: null,
        account_type: "linkedin",
        is_active: true,
        user_id: user.id,
      });

      toast.success("LinkedIn account connected successfully");
      setIsLinkedInModalOpen(false);
      setNewLinkedInAccount({ name: "", type: "linkedin" });
      refetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to connect LinkedIn account");
    } finally {
      setIsAddingAccount(false);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    try {
      await connectedAccountsApi.delete(accountId);
      toast.success("Account disconnected successfully");
      refetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect account");
    }
  };

  const emailAccounts = connectedAccounts.filter(acc => acc.account_type === "email");
  const linkedInAccounts = connectedAccounts.filter(acc => acc.account_type === "linkedin");

  return (
    <AppLayout role={userRole} userName={user?.email}>
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
                    <div className="flex gap-2">
                      <Button onClick={() => handleSelectEmailType("Gmail")} disabled={!user?.id}>
                        <Mail className="h-4 w-4 mr-2" />
                        Connect Gmail
                      </Button>
                      <Button variant="outline" onClick={() => setIsEmailModalOpen(true)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Add Other Email
                      </Button>
                    </div>
                    <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
                      <DialogTrigger asChild>
                        <div style={{ display: 'none' }} />
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect Email Account</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="account-name">Account Name</Label>
                            <Input
                              id="account-name"
                              placeholder="e.g., Sales Team Email"
                              value={newEmailAccount.name}
                              onChange={(e) => setNewEmailAccount({ ...newEmailAccount, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="account-email">Email Address</Label>
                            <Input
                              id="account-email"
                              type="email"
                              placeholder="sales@company.com"
                              value={newEmailAccount.email}
                              onChange={(e) => setNewEmailAccount({ ...newEmailAccount, email: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddEmailAccount} disabled={isAddingAccount}>
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
                    ) : emailAccounts.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Connected Accounts</Label>
                        <div className="space-y-2">
                          {emailAccounts.map(account => (
                            <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{account.account_email || account.account_name}</span>
                                <Badge variant="outline" className="text-xs">Email</Badge>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveAccount(account.id)}
                              >
                                Disconnect
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No email accounts connected</div>
                    )}
                  </CardContent>
                </Card>

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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveAccount(account.id)}
                              >
                                Disconnect
                              </Button>
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
