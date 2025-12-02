import { useState } from "react";
import { Conversation, useUpdateConversationStage } from "@/hooks/useConversations";
import { useConversations } from "@/hooks/useConversations";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAuth } from "@/hooks/useAuth";
import { KanbanColumn } from "./KanbanColumn";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanBoardProps {
  filters: {
    assignedTo: string;
    channelType: string;
    search: string;
  };
}

export function KanbanBoard({ filters }: KanbanBoardProps) {
  const { data: conversations = [], isLoading, error: conversationsError } = useConversations();
  const { data: pipelineStages = [], isLoading: isLoadingStages, error: stagesError } = usePipelineStages();
  const { userRole, user } = useAuth();
  const [selectedLead, setSelectedLead] = useState<Conversation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const updateStage = useUpdateConversationStage();

  const handleLeadClick = (conversation: Conversation) => {
    setSelectedLead(conversation);
    setDialogOpen(true);
  };

  // Show loading state
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

  // Show error state for stages
  if (stagesError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Pipeline Stages</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {stagesError instanceof Error ? stagesError.message : 'An error occurred while loading pipeline stages'}
        </p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    );
  }

  // Show error state for conversations
  if (conversationsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Conversations</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {conversationsError instanceof Error ? conversationsError.message : 'An error occurred while loading conversations'}
        </p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, conversationId: string) => {
    e.dataTransfer.setData('conversationId', conversationId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const conversationId = e.dataTransfer.getData('conversationId');
    
    if (!conversationId || !stageId) return;

    // Find the conversation being moved
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    // Don't update if it's already in this stage
    if (conversation.custom_stage_id === stageId) return;

    // Update the stage
    updateStage.mutate(
      { conversationId, stageId },
      {
        onSuccess: () => {
          const stageName = pipelineStages.find(s => s.id === stageId)?.name || 'stage';
          toast.success(`Lead moved to ${stageName}`);
        },
        onError: (error) => {
          console.error('Error updating stage:', error);
          toast.error('Failed to update lead stage');
        }
      }
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Pipeline Stages Found</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Default stages should be created automatically.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Please check Settings → Pipeline Stages or contact support.
          </p>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
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
                canDrag={true} // Allow all users to drag and drop
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
