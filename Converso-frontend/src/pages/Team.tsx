import { useState, useMemo } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Users, AlertCircle, Mail, UserCheck, MoreVertical, Copy, Send } from "lucide-react";
import { 
  useTeamMembers, 
  useCreateTeamMember, 
  useUpdateTeamMember, 
  useUpdateTeamMemberRole,
  useDeleteTeamMember
} from "@/hooks/useTeamMembers";
import { useBulkReassignConversations } from "@/hooks/useConversations";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { teamMembersApi } from "@/lib/backend-api";
import { toast } from "sonner";

export default function Team() {
  const { user } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [], isLoading, error } = useTeamMembers();
  const { data: conversations = [] } = useConversations();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const updateRole = useUpdateTeamMemberRole();
  const deleteMember = useDeleteTeamMember();
  const bulkReassign = useBulkReassignConversations();
  
  // Get user display name: prefer full_name from profile, then from teamMembers, fallback to email
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [deletingMember, setDeletingMember] = useState<any>(null);
  const [reassignToSdrId, setReassignToSdrId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "sdr" as "admin" | "sdr",
  });

  // Filter team members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(
      (member) =>
        member.full_name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.role?.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

  const handleAddMember = async () => {
    if (!formData.full_name.trim() || !formData.email.trim()) {
      return;
    }

    if (createMember.isPending) {
      return; // Prevent double submission
    }

    try {
      const result = await createMember.mutateAsync({
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
      });
      
      // Only close dialog and reset form on successful creation
      if (result) {
        setAddDialogOpen(false);
        setFormData({ full_name: "", email: "", role: "sdr" });
      }
    } catch (error: any) {
      // Error is handled by the hook (toast notification)
      // Don't close dialog on error so user can fix and retry
      console.error('Error in handleAddMember:', error);
      // Dialog will remain open so user can fix the issue
    }
  };

  const handleEditClick = (member: any) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name || "",
      email: member.email || "",
      role: member.role || "sdr",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !formData.full_name.trim()) {
      return;
    }

    try {
      await updateMember.mutateAsync({
        id: editingMember.id,
        updates: {
          full_name: formData.full_name,
          email: formData.email,
        },
      });
      setEditDialogOpen(false);
      setEditingMember(null);
      setFormData({ full_name: "", email: "", role: "sdr" });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleResendInvitation = async (userId: string) => {
    try {
      const result = await teamMembersApi.resendInvitation(userId);
      if (result.success) {
        toast.success(result.message || 'Invitation email sent successfully');
      } else {
        toast.error(result.message || 'Failed to resend invitation');
      }
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast.error(error?.message || 'Failed to resend invitation');
    }
  };

  const handleCopyInvitationLink = async (userId: string) => {
    try {
      const result = await teamMembersApi.getInvitationLink(userId);
      if (result.success && result.link) {
        await navigator.clipboard.writeText(result.link);
        toast.success('Invitation link copied to clipboard');
      } else {
        toast.error(result.message || 'Failed to get invitation link');
      }
    } catch (error: any) {
      console.error('Error getting invitation link:', error);
      toast.error(error?.message || 'Failed to copy invitation link');
    }
  };

  const handleDeleteClick = (member: any) => {
    setDeletingMember(member);
    setReassignToSdrId(""); // Reset reassignment selection
    
    // Check if this is an SDR with assigned conversations
    if (member.role === 'sdr') {
      const assignedCount = conversations.filter(
        (conv: any) => (conv.assigned_to || conv.assignedTo) === member.id
      ).length;
      
      if (assignedCount > 0) {
        // Show reassignment dialog
        setReassignDialogOpen(true);
      } else {
        // No assignments, proceed with delete
        setDeleteDialogOpen(true);
      }
    } else {
      // Admin or other role, proceed with delete
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmReassign = async () => {
    if (!deletingMember || !reassignToSdrId) return;

    try {
      // Bulk reassign conversations
      await bulkReassign.mutateAsync({
        fromSdrId: deletingMember.id,
        toSdrId: reassignToSdrId === 'unassigned' ? null : reassignToSdrId,
      });

      // Then delete the member
      await deleteMember.mutateAsync(deletingMember.id);
      setReassignDialogOpen(false);
      setDeleteDialogOpen(false);
      setDeletingMember(null);
      setReassignToSdrId("");
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;

    try {
      await deleteMember.mutateAsync(deletingMember.id);
      setDeleteDialogOpen(false);
      setDeletingMember(null);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleCancelReassign = () => {
    setReassignDialogOpen(false);
    setDeletingMember(null);
    setReassignToSdrId("");
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "sdr") => {
    try {
      await updateRole.mutateAsync({
        id: memberId,
        role: newRole,
      });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AppLayout role="admin" userName={userDisplayName}>
      <div className="flex flex-col h-full -m-6">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 px-10 pt-10 pb-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Team Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage your team members and their roles
              </p>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Team Member</DialogTitle>
                  <DialogDescription>
                    Create a new team member account. They will receive login credentials.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-name">Full Name *</Label>
                    <Input
                      id="add-name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-email">Email *</Label>
                    <Input
                      id="add-email"
                      type="email"
                      placeholder="john@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: "admin" | "sdr") =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger id="add-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sdr">SDR</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddDialogOpen(false);
                      setFormData({ full_name: "", email: "", role: "sdr" });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddMember}
                    disabled={
                      !formData.full_name.trim() ||
                      !formData.email.trim() ||
                      createMember.isPending
                    }
                  >
                    {createMember.isPending ? "Creating..." : "Create Member"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 text-sm"
            />
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-10 pb-10 min-h-0">

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive mb-6">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Failed to load team members: {error instanceof Error ? error.message : "Unknown error"}
              </span>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-20">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Loading team members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-20">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "No members found" : "No team members yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Get started by adding your first team member"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              )}
            </div>
          ) : (
          /* Table-like Row Layout */
          <div className="bg-white rounded-lg border border-border shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-6 px-8 py-5 border-b bg-muted/30">
              <div className="col-span-4">
                <span className="text-sm font-medium text-muted-foreground">Member</span>
              </div>
              <div className="col-span-3">
                <span className="text-sm font-medium text-muted-foreground">Email</span>
              </div>
              <div className="col-span-2">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
              </div>
              <div className="col-span-2">
                <span className="text-sm font-medium text-muted-foreground">Role</span>
              </div>
              <div className="col-span-1 text-right">
                <span className="text-sm font-medium text-muted-foreground">Actions</span>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y">
              {filteredMembers.map((member, index) => (
                <div
                  key={member.id}
                  className={cn(
                    "grid grid-cols-12 gap-6 px-8 py-6 hover:bg-muted/30 transition-colors",
                    index === filteredMembers.length - 1 && "rounded-b-lg"
                  )}
                >
                  {/* Member Info */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">
                        {member.full_name || "Unnamed"}
                      </span>
                      <Badge
                        variant={member.role === "admin" ? "default" : "secondary"}
                        className="shrink-0 text-[10px] font-normal px-1.5 py-0.5"
                      >
                        {member.role === "admin" ? "Admin" : "SDR"}
                      </Badge>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center">
                    <Badge
                      variant={(member as any).status === 'active' ? 'default' : 'outline'}
                      className="text-[10px] font-normal px-2 py-0.5"
                    >
                      {(member as any).status === 'active' ? 'Active' : 'Invited'}
                    </Badge>
                  </div>

                  {/* Role Selector */}
                  <div className="col-span-2 flex items-center">
                    <Select
                      value={member.role}
                      onValueChange={(value: "admin" | "sdr") =>
                        handleRoleChange(member.id, value)
                      }
                    >
                      <SelectTrigger className="w-[110px] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sdr">SDR</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions - 3 Dots Menu */}
                  <div className="col-span-1 flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(member)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {(member as any).status === 'invited' && (
                          <>
                            <DropdownMenuItem onClick={() => handleResendInvitation(member.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Resend Invitation
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyInvitationLink(member.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Invitation Link
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(member)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>
                Update team member information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="john@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingMember(null);
                  setFormData({ full_name: "", email: "", role: "sdr" });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMember}
                disabled={
                  !formData.full_name.trim() ||
                  !formData.email.trim() ||
                  updateMember.isPending
                }
              >
                {updateMember.isPending ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reassignment Dialog (for SDRs with assigned conversations) */}
        <AlertDialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Reassign Conversations</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  <strong>{deletingMember?.full_name || deletingMember?.email}</strong> has conversations assigned to them.
                </p>
                <p>What would you like to do with their assigned conversations?</p>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="reassign-sdr">Reassign to:</Label>
                  <Select value={reassignToSdrId} onValueChange={setReassignToSdrId}>
                    <SelectTrigger id="reassign-sdr" className="w-full">
                      <SelectValue placeholder="Select SDR or Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teamMembers
                        .filter(m => m.role === 'sdr' && m.id !== deletingMember?.id)
                        .map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelReassign}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmReassign}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!reassignToSdrId || deleteMember.isPending || bulkReassign.isPending}
              >
                {deleteMember.isPending || bulkReassign.isPending ? "Processing..." : "Delete & Reassign"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog (for members without assignments or admins) */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingMember?.full_name || deletingMember?.email}</strong>? 
                This action cannot be undone. All their assignments and data will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingMember(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMember.isPending}
              >
                {deleteMember.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
