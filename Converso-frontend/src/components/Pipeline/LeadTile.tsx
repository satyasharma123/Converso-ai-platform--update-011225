import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Linkedin } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { formatDistanceToNow } from "date-fns";
import { ReceivedAccountBadge } from "@/components/Inbox/ReceivedAccountBadge";

interface LeadTileProps {
  conversation: Conversation;
  onDragStart: (e: React.DragEvent, conversationId: string) => void;
  canDrag: boolean;
  onClick?: () => void;
}

// Safe timestamp formatter
const formatTimestamp = (timestamp: string | undefined | null): string => {
  if (!timestamp) return 'No date';
  
  try {
    const date = new Date(timestamp);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
};

export function LeadTile({ conversation, onDragStart, canDrag, onClick }: LeadTileProps) {
  const { data: teamMembers } = useTeamMembers();

  const assignedSDR = teamMembers?.find(member => member.id === conversation.assigned_to);
  const initials = conversation.sender_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      className="p-2 space-y-2 hover:shadow-md transition-shadow cursor-pointer"
      draggable={canDrag}
      onDragStart={(e) => canDrag && onDragStart(e, conversation.id)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-xs truncate">{conversation.sender_name}</h4>
            {conversation.sender_email && (
              <p className="text-xs text-muted-foreground truncate">{conversation.sender_email}</p>
            )}
          </div>
        </div>
        {conversation.conversation_type === 'email' ? (
          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <Linkedin className="h-3 w-3 text-blue-600 flex-shrink-0" />
        )}
      </div>

      {conversation.subject && (
        <p className="text-xs text-muted-foreground line-clamp-2">{conversation.subject}</p>
      )}

      <div className="flex items-center gap-1 pt-1">
        {conversation.received_account && (
          <ReceivedAccountBadge
            accountName={conversation.received_account.account_name}
            accountEmail={conversation.received_account.account_email}
            accountType={conversation.received_account.account_type}
          />
        )}
        {assignedSDR ? (
          <Badge variant="outline" className="text-xs">
            {assignedSDR.full_name}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Unassigned
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-end pt-1">
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(conversation.last_message_at)}
        </span>
      </div>
    </Card>
  );
}
