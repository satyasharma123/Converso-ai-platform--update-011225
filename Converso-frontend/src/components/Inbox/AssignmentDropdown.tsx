import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAssignConversation } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/context/WorkspaceContext';
import { UserCheck } from 'lucide-react';

interface AssignmentDropdownProps {
  conversationId: string;
  currentAssignment?: string;
}

export function AssignmentDropdown({ conversationId, currentAssignment }: AssignmentDropdownProps) {
  const { userRole } = useAuth();
  const { activeWorkspace, isOwner } = useWorkspace();
  const workspaceRole = (activeWorkspace?.role || '').toString().toLowerCase();
  const isAdmin = isOwner || workspaceRole === 'admin' || userRole === 'admin';
  const { data: teamMembers, isLoading } = useTeamMembers();
  const assignMutation = useAssignConversation();
  
  // Hide assignment dropdown for SDR role
  if (!isAdmin) {
    return null;
  }

  const sdrs = teamMembers?.filter(member => member.role === 'sdr') || [];

  const handleAssign = (sdrId: string) => {
    assignMutation.mutate({ 
      conversationId, 
      sdrId: sdrId === 'unassigned' ? null : sdrId 
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <Select value={currentAssignment || 'unassigned'} onValueChange={handleAssign}>
      <SelectTrigger className="w-[180px]">
        <UserCheck className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Assign to SDR" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {sdrs.map((sdr) => (
          <SelectItem key={sdr.id} value={sdr.id}>
            {sdr.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
