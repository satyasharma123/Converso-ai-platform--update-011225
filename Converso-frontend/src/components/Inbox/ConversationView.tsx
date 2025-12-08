import { Send, MoreVertical, UserCheck, Archive, Link as LinkIcon, Image as ImageIcon, File as FileIcon, Smile } from "lucide-react";
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
  senderProfilePictureUrl?: string | null;
  senderLinkedinUrl?: string | null;
  content: string;
  timestamp: string;
  isFromLead: boolean;
  reactions?: any[];
  attachments?: any[];
}

interface ConversationViewProps {
  conversation: {
    id: string;
    senderName: string;
    senderEmail?: string;
    status: string;
    sender_profile_picture_url?: string | null;
    sender_linkedin_url?: string | null;
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
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {conversation.sender_profile_picture_url ? (
                <img
                  src={conversation.sender_profile_picture_url}
                  alt={conversation.senderName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-primary">
                  {conversation.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              )}
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
                <div className="flex items-start gap-2 max-w-[75%]">
                  <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-semibold">
                    {message.senderProfilePictureUrl ? (
                      <img
                        src={message.senderProfilePictureUrl}
                        alt={message.senderName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{message.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                    )}
                  </div>
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
                      {message.senderLinkedinUrl && (
                        <a
                          href={message.senderLinkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] underline flex items-center gap-0.5"
                        >
                          <LinkIcon className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                    <p className="text-xs whitespace-pre-wrap">{message.content}</p>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {message.attachments.map((att: any, idx) => (
                          <a
                            key={idx}
                            href={att.url || att.href || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-background/60 px-2 py-1 text-[11px] border"
                          >
                            {att.type?.includes?.('image') ? (
                              <ImageIcon className="h-3 w-3" />
                            ) : (
                              <FileIcon className="h-3 w-3" />
                            )}
                            <span className="truncate max-w-[120px]">
                              {att.name || att.filename || 'Attachment'}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 items-center">
                        <Smile className="h-3 w-3 text-muted-foreground" />
                        {message.reactions.map((r: any, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-background/60 border"
                          >
                            {r.emoji || r.reaction || '🙂'}
                          </span>
                        ))}
                      </div>
                    )}
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
