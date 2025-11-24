import { useState } from "react";
import { Conversation } from "@/hooks/useConversations";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { KanbanColumn } from "./KanbanColumn";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import { Skeleton } from "@/components/ui/skeleton";

const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'engaged', label: 'Engaged' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'converted', label: 'Converted' },
  { id: 'not_interested', label: 'Not Interested' },
] as const;

interface KanbanBoardProps {
  filters: {
    assignedTo: string;
    channelType: string;
    search: string;
  };
}

export function KanbanBoard({ filters }: KanbanBoardProps) {
  const { data: conversations = [], isLoading } = useConversations();
  const { userRole, user } = useAuth();
  const [selectedLead, setSelectedLead] = useState<Conversation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleLeadClick = (conversation: Conversation) => {
    setSelectedLead(conversation);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-80">
            <Skeleton className="h-[600px]" />
          </div>
        ))}
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, conversationId: string) => {
    e.dataTransfer.setData('conversationId', conversationId);
  };

  const handleDrop = (e: React.DragEvent, status: typeof STAGES[number]['id']) => {
    e.preventDefault();
    // Mock data doesn't support updates
    console.log('Drag and drop disabled for mock data');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getConversationsByStage = (stageId: string) => {
    let filtered = conversations?.filter(conv => conv.status === stageId) || [];
    
    // SDR role filtering: only show assigned conversations
    if (userRole === 'sdr' && user) {
      filtered = filtered.filter(conv => conv.assigned_to === user.id);
    }
    
    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.sender_name.toLowerCase().includes(searchLower) ||
        conv.sender_email?.toLowerCase().includes(searchLower) ||
        conv.subject?.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.channelType !== 'all') {
      filtered = filtered.filter(conv => conv.conversation_type === filters.channelType);
    }
    
    if (filters.assignedTo !== 'all') {
      if (filters.assignedTo === 'unassigned') {
        filtered = filtered.filter(conv => !conv.assigned_to);
      } else {
        filtered = filtered.filter(conv => conv.assigned_to === filters.assignedTo);
      }
    }
    
    return filtered;
  };

  return (
    <>
      <div className="h-full w-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 pb-4 h-full min-w-max">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              conversations={getConversationsByStage(stage.id)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              canDrag={userRole === 'admin'}
              onLeadClick={handleLeadClick}
            />
          ))}
        </div>
      </div>

      <LeadDetailsDialog 
        conversation={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
