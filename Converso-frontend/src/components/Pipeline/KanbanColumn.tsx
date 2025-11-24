import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadTile } from "./LeadTile";
import { Conversation } from "@/hooks/useConversations";

interface KanbanColumnProps {
  stage: { id: string; label: string };
  conversations: Conversation[];
  onDragStart: (e: React.DragEvent, conversationId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  canDrag: boolean;
  onLeadClick: (conversation: Conversation) => void;
}

export function KanbanColumn({
  stage,
  conversations,
  onDragStart,
  onDrop,
  onDragOver,
  canDrag,
  onLeadClick,
}: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-80 h-full flex flex-col">
      <Card className="h-full flex flex-col overflow-hidden">
        <div className="p-3 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs">{stage.label}</h3>
            <Badge variant="secondary" className="text-xs">
              {conversations.length}
            </Badge>
          </div>
        </div>

        <div
          className="flex-1 p-2 space-y-2 overflow-y-auto"
          onDrop={(e) => onDrop(e, stage.id)}
          onDragOver={onDragOver}
        >
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No leads in this stage
            </div>
          ) : (
            conversations.map((conversation) => (
              <LeadTile
                key={conversation.id}
                conversation={conversation}
                onDragStart={onDragStart}
                canDrag={canDrag}
                onClick={() => onLeadClick(conversation)}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
