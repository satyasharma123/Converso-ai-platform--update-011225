import { Send, MoreVertical, UserCheck, Archive, Link as LinkIcon, Image as ImageIcon, File as FileIcon, Smile, Tag, Trash, Check, CheckCheck, UserPlus, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssignmentDropdown } from "./AssignmentDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import { formatTimeAgo } from "@/utils/timeFormat";
import { useToggleRead, useAssignConversation, useUpdateConversationStage } from "@/hooks/useConversations";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTeamMembers } from "@/hooks/useTeamMembers";

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
    account_name?: string | null;
    is_account_connected?: boolean;
    is_read?: boolean;
    assignedTo?: string | null;
    customStageId?: string | null;
  };
  messages: Message[];
}

export function ConversationView({ conversation, messages }: ConversationViewProps) {
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState(conversation.status);

  // Hooks for data and mutations
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: stages = [] } = usePipelineStages();
  const toggleRead = useToggleRead();
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();

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

  const handleToggleRead = () => {
    toggleRead.mutate(
      { conversationId: conversation.id, isRead: !conversation.is_read },
      {
        onSuccess: () => {
          toast.success(conversation.is_read ? 'Marked as unread' : 'Marked as read');
        },
        onError: () => {
          toast.error('Failed to update read status');
        },
      }
    );
  };

  const handleAssignSDR = (sdrId: string | null) => {
    assignConversation.mutate(
      { conversationId: conversation.id, assignedTo: sdrId },
      {
        onSuccess: () => {
          toast.success(sdrId ? 'SDR assigned successfully' : 'Conversation unassigned');
        },
        onError: () => {
          toast.error('Failed to assign SDR');
        },
      }
    );
  };

  const handleChangeStage = (stageId: string) => {
    updateStage.mutate(
      { conversationId: conversation.id, stageId },
      {
        onSuccess: () => {
          toast.success('Stage updated successfully');
        },
        onError: () => {
          toast.error('Failed to update stage');
        },
      }
    );
  };

  const formatTimeStamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${minutesStr} ${ampm}`;
    } catch (e) {
      return '';
    }
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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-background">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-sm font-semibold">
              {conversation.sender_profile_picture_url ? (
                <img
                  src={conversation.sender_profile_picture_url}
                  alt={conversation.senderName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {conversation.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold truncate">{conversation.senderName}</h2>
                {conversation.account_name && (
                  <span className="text-xs text-orange-500 font-medium">
                    {conversation.account_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Talking from {conversation.account_name || conversation.senderEmail || 'LinkedIn'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toast.info('Refresh coming soon')}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toast.info('Tag feature coming soon')}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toast.info('Send feature coming soon')}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toast.info('Archive feature coming soon')}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleToggleRead}>
                  {conversation.is_read ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Mark as Unread
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Mark as Read
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign to SDR
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
                    <DropdownMenuItem onClick={() => handleAssignSDR(null)}>
                      Unassigned
                      {!conversation.assignedTo && " ✓"}
                    </DropdownMenuItem>
                    {teamMembers.map((member: any) => (
                      <DropdownMenuItem 
                        key={member.id}
                        onClick={() => handleAssignSDR(member.id)}
                      >
                        {member.full_name}
                        {conversation.assignedTo === member.id && " ✓"}
                      </DropdownMenuItem>
                    ))}
                    {teamMembers.length === 0 && (
                      <DropdownMenuItem disabled>No team members available</DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <GitBranch className="h-4 w-4 mr-2" />
                    Change Stage
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
                    {stages.map((stage: any) => (
                      <DropdownMenuItem 
                        key={stage.id}
                        onClick={() => handleChangeStage(stage.id)}
                      >
                        {stage.name}
                        {conversation.customStageId === stage.id && " ✓"}
                      </DropdownMenuItem>
                    ))}
                    {stages.length === 0 && (
                      <DropdownMenuItem disabled>No stages available</DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem onClick={() => toast.info('Archive feature coming soon')}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Date Separator */}
            {messages.length > 0 && messages[0].timestamp && (
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
                  {new Date(messages[0].timestamp).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className="flex items-start gap-3"
              >
                {/* Avatar (only for lead messages) */}
                {message.isFromLead && (
                  <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-semibold">
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
                )}

                {/* Message Content */}
                <div className={`flex-1 ${!message.isFromLead ? 'flex flex-col items-end' : ''}`}>
                  {/* Message Bubble with Name, Time, and Content */}
                  <div 
                    className={`rounded-2xl px-4 py-3 inline-block max-w-[65%] ${
                      message.isFromLead 
                        ? 'bg-gray-100 text-foreground' 
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    {/* Name and Timestamp inside bubble */}
                    <div className="flex items-center justify-between gap-4 mb-2 min-w-[200px]">
                      <span className={`text-sm font-semibold ${message.isFromLead ? 'text-foreground' : 'text-white'}`}>
                        {message.isFromLead ? message.senderName : 'You'}
                      </span>
                      <span className={`text-xs whitespace-nowrap ${message.isFromLead ? 'text-muted-foreground' : 'text-gray-300'}`}>
                        {message.timestamp ? formatTimeStamp(message.timestamp) : ''}
                      </span>
                    </div>

                    {/* Message Text */}
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${message.isFromLead ? 'text-foreground' : 'text-white'}`}>
                      {message.content}
                    </p>

                    {/* Display Images Inline */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.attachments.map((att: any, idx) => {
                          const isImage = att.type?.includes?.('image') || 
                                        att.contentType?.includes?.('image') ||
                                        /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url || att.name || '');
                          
                          if (isImage) {
                            return (
                              <a
                                key={idx}
                                href={att.url || att.href || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden"
                              >
                                <img
                                  src={att.url || att.href}
                                  alt={att.name || 'Image'}
                                  className="w-full rounded-lg"
                                  loading="lazy"
                                />
                              </a>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {message.reactions.map((r: any, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 rounded-full bg-background border shadow-sm cursor-pointer hover:scale-110 transition-transform"
                        >
                          {r.emoji || r.reaction || '👍'}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Delivered Status */}
                  {!message.isFromLead && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Delivered</span>
                      <div className="h-5 w-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {message.senderProfilePictureUrl && (
                          <img
                            src={message.senderProfilePictureUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Area */}
      <div className="border-t bg-background p-4">
        <div className="flex items-start gap-3">
          {/* Add Button */}
          <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-full text-muted-foreground">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </Button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <Textarea
              placeholder="Send a message..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="min-h-[80px] bg-background resize-none text-sm border-2 rounded-lg pr-12"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
            />
            {/* Plus Icon inside textarea */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute bottom-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </Button>
          </div>

          {/* Send Button */}
          <Button 
            size="icon"
            onClick={handleSendReply}
            disabled={!reply.trim()}
            className="h-10 w-10 flex-shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* LinkedIn Disconnected Warning - Only show if account is disconnected */}
        {conversation.is_account_connected === false && (
          <div className="mt-3 text-sm text-red-500">
            Your LinkedIn account is disconnected. Please reconnect it to continue messaging.
          </div>
        )}
      </div>
    </div>
  );
}
