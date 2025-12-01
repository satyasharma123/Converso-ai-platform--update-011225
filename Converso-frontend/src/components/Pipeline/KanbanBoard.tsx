import { useState } from "react";
import { Conversation } from "@/hooks/useConversations";
import { useConversations } from "@/hooks/useConversations";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAuth } from "@/hooks/useAuth";
import { KanbanColumn } from "./KanbanColumn";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface KanbanBoardProps {
  filters: {
    assignedTo: string;
    channelType: string;
    search: string;
  };
}

export function KanbanBoard({ filters }: KanbanBoardProps) {
  const { data: conversations = [], isLoading } = useConversations();
  const { data: pipelineStages = [], isLoading: isLoadingStages } = usePipelineStages();
  const { userRole, user } = useAuth();
  const [selectedLead, setSelectedLead] = useState<Conversation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleLeadClick = (conversation: Conversation) => {
    setSelectedLead(conversation);
    setDialogOpen(true);
  };

  if (isLoading || isLoadingStages) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(7)].map((_, index) => (
          <div key={index} className="flex-shrink-0 w-80">
            <Skeleton className="h-[600px]" />
          </div>
        ))}
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, conversationId: string) => {
    e.dataTransfer.setData('conversationId', conversationId);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    // TODO: Implement drag and drop stage update
    console.log('Drag and drop to stage:', stageId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getConversationsByStage = (stageId: string) => {
    // Filter by custom_stage_id (database stage) instead of status
    let filtered = conversations?.filter(conv => conv.custom_stage_id === stageId) || [];
    
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
      {pipelineStages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">No pipeline stages found. Please configure stages in Settings.</p>
        </div>
      ) : (
        <div className="h-full w-full overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 pb-4 h-full min-w-max">
            {pipelineStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={{ id: stage.id, label: stage.name }}
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
      )}

      <LeadDetailsDialog 
        conversation={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
