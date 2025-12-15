import { Card } from "@/components/ui/card";
import { Mail, Linkedin } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { format } from "date-fns";

interface LeadTileProps {
  conversation: Conversation;
  onDragStart: (e: React.DragEvent, conversationId: string) => void;
  canDrag: boolean;
  onClick?: () => void;
}

// Format date as "Dec 15" or "15 Dec"
const formatStageDate = (timestamp: string | undefined | null): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    return format(date, 'MMM d');
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

export function LeadTile({ conversation, onDragStart, canDrag, onClick }: LeadTileProps) {
  const { data: teamMembers } = useTeamMembers();

  const assignedSDR = teamMembers?.find(member => member.id === conversation.assigned_to);

  return (
    <Card
      className="p-2 space-y-2 hover:shadow-md transition-shadow cursor-pointer"
      draggable={canDrag}
      onDragStart={(e) => canDrag && onDragStart(e, conversation.id)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 max-w-[85%]">
          <h4 className="font-medium text-xs truncate">{conversation.sender_name}</h4>
          {conversation.subject && (
            <p className="text-xs text-muted-foreground truncate">{conversation.subject}</p>
          )}
        </div>
        {conversation.conversation_type === 'email' ? (
          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <Linkedin className="h-3 w-3 text-blue-600 flex-shrink-0" />
        )}
      </div>

      {/* Email preview - 2 lines, restricted width */}
      {conversation.preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 max-w-[85%]">{conversation.preview}</p>
      )}

      {/* Increased spacing with pt-3 instead of pt-1 */}
      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          {conversation.received_account && (
            <>
              <span className="truncate max-w-[100px]">
                {conversation.received_account.account_name}
              </span>
              <span>•</span>
            </>
          )}
          <span className="truncate">
            {assignedSDR ? assignedSDR.full_name : 'Unassigned'}
          </span>
        </div>
        {formatStageDate((conversation as any).stage_assigned_at || conversation.last_message_at) && (
          <span className="text-[11px] text-gray-400">
            {formatStageDate((conversation as any).stage_assigned_at || conversation.last_message_at)}
          </span>
        )}
      </div>
    </Card>
  );
}
