import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Linkedin, User, Calendar } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useMessages } from "@/hooks/useMessages";
import { formatDistanceToNow } from "date-fns";

interface LeadDetailsDialogProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function LeadDetailsDialog({ conversation, open, onOpenChange }: LeadDetailsDialogProps) {
  const { data: teamMembers } = useTeamMembers();
  const { data: messages = [] } = useMessages(conversation?.id || null);

  if (!conversation) return null;

  const assignedSDR = teamMembers?.find(member => member.id === conversation.assigned_to);
  
  const initials = conversation.sender_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'engaged': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'qualified': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'converted': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'not_interested': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Lead Details</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Lead Info */}
            <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-base">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg">{conversation.sender_name}</h3>
                    {conversation.sender_email && (
                      <p className="text-sm text-muted-foreground">{conversation.sender_email}</p>
                    )}
                    {conversation.sender_linkedin_url && (
                      <a 
                        href={conversation.sender_linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View LinkedIn Profile
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(conversation.status || 'new')}>
                      {conversation.status || 'new'}
                    </Badge>
                    {conversation.conversation_type === 'email' ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Linkedin className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="font-medium">
                      {assignedSDR ? assignedSDR.full_name : 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last message:</span>
                    <span className="font-medium">
                      {formatTimestamp(conversation.last_message_at)}
                    </span>
                  </div>
                </div>

                {conversation.subject && (
                  <div className="pt-2">
                    <p className="text-sm font-medium">Subject:</p>
                    <p className="text-sm text-muted-foreground">{conversation.subject}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="space-y-3">
              <h4 className="font-semibold">Conversation History</h4>
              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg border ${
                        message.is_from_lead 
                          ? 'bg-muted/30' 
                          : 'bg-primary/5 border-primary/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{message.sender_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                  No messages in this conversation yet
                </div>
              )}
            </div>

            {/* Received Account Info */}
            {conversation.received_on_account_id && (
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-semibold text-sm mb-2">Received On</h4>
                <div className="flex items-center gap-2">
                  {conversation.conversation_type === 'email' ? (
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Linkedin className="h-4 w-4 text-blue-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {conversation.received_on_account_id}
                    </p>
                    {conversation.conversation_type === 'email' && (
                      <p className="text-xs text-muted-foreground">
                        {conversation.sender_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
