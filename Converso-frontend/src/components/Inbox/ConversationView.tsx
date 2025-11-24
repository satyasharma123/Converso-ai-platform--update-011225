import { Send, MoreVertical, UserCheck, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssignmentDropdown } from "./AssignmentDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  senderName: string;
  content: string;
  timestamp: string;
  isFromLead: boolean;
}

interface ConversationViewProps {
  conversation: {
    id: string;
    senderName: string;
    senderEmail?: string;
    status: string;
  };
  messages: Message[];
}

export function ConversationView({ conversation, messages }: ConversationViewProps) {
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState(conversation.status);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    toast.success(`Status updated to ${newStatus}`);
  };

  const handleSendReply = async () => {
    if (!reply.trim()) {
      toast.error('Please enter a message');
      return;
    }

    toast.success('Message sent successfully');
    setReply('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'engaged': return 'bg-yellow-500';
      case 'qualified': return 'bg-purple-500';
      case 'converted': return 'bg-green-500';
      case 'not_interested': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 space-y-2 bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {conversation.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold truncate">{conversation.senderName}</h2>
              {conversation.senderEmail && (
                <p className="text-xs text-muted-foreground truncate">{conversation.senderEmail}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AssignmentDropdown conversationId={conversation.id} />
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="engaged">Engaged</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isFromLead ? 'justify-start' : 'justify-end'} group`}
              >
                <div className="flex items-start gap-1 max-w-[75%]">
                  {!message.isFromLead && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => toast.info('Assign feature coming soon')}>
                          <UserCheck className="h-3 w-3 mr-2" />
                          Assign
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Change SDR feature coming soon')}>
                          <UserCheck className="h-3 w-3 mr-2" />
                          Change SDR
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Archive feature coming soon')}>
                          <Archive className="h-3 w-3 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <div
                    className={`rounded-lg p-2 ${
                      message.isFromLead
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold">{message.senderName}</span>
                      <span className="text-[10px] opacity-70">{message.timestamp}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.isFromLead && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info('Assign feature coming soon')}>
                          <UserCheck className="h-3 w-3 mr-2" />
                          Assign
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Change SDR feature coming soon')}>
                          <UserCheck className="h-3 w-3 mr-2" />
                          Change SDR
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Archive feature coming soon')}>
                          <Archive className="h-3 w-3 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-2 space-y-1.5 bg-muted/30">
        <Textarea
          placeholder="Type your reply..."
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="min-h-[60px] bg-background resize-none text-xs"
          rows={2}
        />
        <div className="flex justify-end gap-1.5">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setReply('')}
            disabled={!reply.trim()}
            className="h-7 text-xs"
          >
            Clear
          </Button>
          <Button 
            size="sm"
            onClick={handleSendReply}
            disabled={!reply.trim()}
            className="h-7 text-xs"
          >
            <Send className="h-3 w-3 mr-1" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
