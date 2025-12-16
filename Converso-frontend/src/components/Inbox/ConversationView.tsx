import { Send, MoreVertical, UserCheck, Archive, Link as LinkIcon, Image as ImageIcon, File as FileIcon, Smile, Tag, Trash, Check, CheckCheck, UserPlus, GitBranch, X, Paperclip, Video, AtSign, Loader2, Star, StarOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssignmentDropdown } from "./AssignmentDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { formatTimeAgo } from "@/utils/timeFormat";
import { useToggleRead, useAssignConversation, useUpdateConversationStage, useSyncConversation, useToggleFavoriteConversation, useDeleteConversation } from "@/hooks/useConversations";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useSendLinkedInMessage } from "@/hooks/useLinkedInMessages";
import { useQueryClient } from "@tanstack/react-query";

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
  deliveryStatus?: 'sending' | 'sent' | 'delivered';
  tempId?: string;
  serverId?: string | null;
  isOptimistic?: boolean;
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
    chat_id?: string | null;
    unipile_account_id?: string | null;
    is_favorite?: boolean;
    isFavorite?: boolean;
  };
  messages: Message[];
}

interface AttachmentPreview {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
  preview?: string;
}

export function ConversationView({ conversation, messages }: ConversationViewProps) {
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState(conversation.status);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);

  const combinedMessages = useMemo(() => {
    const confirmedIds = new Set(
      pendingMessages
        .map((msg) => msg.serverId)
        .filter((id): id is string => Boolean(id))
    );

    const filteredMessages = messages.filter((msg) => !confirmedIds.has(msg.id));
    const allMessages = [...filteredMessages, ...pendingMessages];

    return allMessages.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
  }, [messages, pendingMessages]);

  // Auto-scroll to bottom when conversation changes or new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [conversation.id, combinedMessages.length]);

  // Hooks for data and mutations
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: stages = [] } = usePipelineStages();
  const toggleRead = useToggleRead();
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const sendMessage = useSendLinkedInMessage();
  const syncConversation = useSyncConversation();
  const toggleFavorite = useToggleFavoriteConversation();
  const deleteConversation = useDeleteConversation();
  const queryClient = useQueryClient();

  useEffect(() => {
    setPendingMessages((prev) =>
      prev
        .map((msg) => {
          if (msg.serverId) {
            return msg;
          }

          const match = messages.find(
            (serverMsg) =>
              !serverMsg.isFromLead &&
              serverMsg.content === msg.content &&
              Math.abs(
                new Date(serverMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()
              ) < 15000
          );

          if (match) {
            return { ...msg, serverId: match.id };
          }

          return msg;
        })
        .filter((msg) => {
          if (!msg.serverId) {
            return true;
          }
          return !messages.some((serverMsg) => serverMsg.id === msg.serverId);
        })
    );
  }, [messages]);

  useEffect(() => {
    if (!conversation?.id) return;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${base}/api/events/stream`);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.conversation_id === conversation.id) {
          queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener('linkedin_message', handler);

    es.onerror = () => {
      // allow automatic retry
    };

    return () => {
      es.removeEventListener('linkedin_message', handler);
      es.close();
    };
  }, [conversation.id, queryClient]);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    toast.success(`Status updated to ${newStatus}`);
  };

  const isAccountDisconnected = conversation.is_account_connected === false;
  const isSending = sendMessage.isPending;
  const inputDisabled = isAccountDisconnected || isSending;

  const handleSendReply = async () => {
    if (isSending) {
      return;
    }

    if (!reply.trim() && attachments.length === 0) {
      toast.error('Please enter a message or attach a file');
      return;
    }

    if (!conversation.chat_id || !conversation.unipile_account_id) {
      toast.error(`Cannot send message: Missing ${!conversation.chat_id ? 'chat_id' : 'unipile_account_id'}`);
      console.error('❌ Missing required fields:', {
        has_chat_id: !!conversation.chat_id,
        has_unipile_account_id: !!conversation.unipile_account_id
      });
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      tempId,
      senderName: 'You',
      content: reply.trim(),
      timestamp: new Date().toISOString(),
      isFromLead: false,
      senderProfilePictureUrl: null,
      senderLinkedinUrl: null,
      attachments: attachments.length > 0 ? attachments.map(att => ({
        name: att.name,
        type: att.type,
        url: att.preview,
      })) : [],
      deliveryStatus: 'sending',
      isOptimistic: true,
    };
    setPendingMessages(prev => [...prev, optimisticMessage]);

    try {
      const response = await sendMessage.mutateAsync({
        chat_id: conversation.chat_id,
        account_id: conversation.unipile_account_id,
        text: reply.trim() || undefined,
        attachments: attachments.length > 0 ? attachments.map(att => ({
          name: att.name,
          type: att.type,
          file: att.file,
        })) : undefined,
      });

      setReply('');
      setAttachments([]);
      toggleRead.mutate({ conversationId: conversation.id, isRead: true });

      setPendingMessages(prev =>
        prev.map(msg =>
          msg.tempId === tempId
            ? {
                ...msg,
                deliveryStatus: 'sent',
                serverId: response?.message?.id || null,
              }
            : msg
        )
      );
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to send message:', error);
      setPendingMessages(prev => prev.filter(msg => msg.tempId !== tempId));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newAttachments: AttachmentPreview[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      file,
    }));

    // Generate previews for images
    newAttachments.forEach(att => {
      if (att.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachments(prev => prev.map(a => 
            a.id === att.id ? { ...a, preview: reader.result as string } : a
          ));
        };
        reader.readAsDataURL(att.file);
      }
    });

    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const insertEmoji = (emoji: string) => {
    setReply(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

  const handleToggleFavorite = () => {
    const isFavorite = Boolean((conversation as any).is_favorite ?? (conversation as any).isFavorite);
    toggleFavorite.mutate({
      conversationId: conversation.id,
      isFavorite: !isFavorite
    });
  };

  const handleDelete = () => {
    if (window.confirm('Delete this conversation? This cannot be undone.')) {
      deleteConversation.mutate(conversation.id, {
        onSuccess: () => {
          toast.success('Conversation deleted successfully');
        }
      });
    }
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
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full" 
              onClick={() => syncConversation.mutate(conversation.id)}
              disabled={syncConversation.isPending}
              title="Refresh messages"
            >
              {syncConversation.isPending ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
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

                {((conversation as any).is_favorite ?? (conversation as any).isFavorite) ? (
                  <DropdownMenuItem onClick={handleToggleFavorite}>
                    <StarOff className="h-4 w-4 mr-2" />
                    Remove Favorite
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleToggleFavorite}>
                    <Star className="h-4 w-4 mr-2" />
                    Mark as Favorite
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => toast.info('Archive feature coming soon')}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
        {combinedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Date Separator */}
            {combinedMessages.length > 0 && combinedMessages[0].timestamp && (
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
                  {new Date(combinedMessages[0].timestamp).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            )}

            {combinedMessages.map((message) => (
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
                    } ${message.deliveryStatus === 'sending' ? 'opacity-80' : ''}`}
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

                  {/* Delivery Status */}
                  {!message.isFromLead && (
                    <div className="flex items-center justify-end gap-1 mt-2 text-xs text-muted-foreground">
                      {message.deliveryStatus === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {message.deliveryStatus === 'sent' && <Check className="h-3.5 w-3.5" />}
                      {(message.deliveryStatus === 'delivered' || !message.deliveryStatus) && (
                        <CheckCheck className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {message.deliveryStatus === 'sending'
                          ? 'Sending'
                          : message.deliveryStatus === 'sent'
                            ? 'Sent'
                            : 'Delivered'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Scroll anchor - this element is used to auto-scroll to bottom */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Compose Area */}
      <div className="border-t bg-background p-4">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="relative group bg-muted rounded-lg p-2 flex items-center gap-2 max-w-[200px]"
              >
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : att.type.startsWith('video/') ? (
                  <Video className="w-10 h-10 text-muted-foreground" />
                ) : (
                  <FileIcon className="w-10 h-10 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{att.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAttachment(att.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
          multiple
        />
        <input
          ref={imageInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*"
          multiple
        />
        <input
          ref={videoInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="video/*"
          multiple
        />

        <div className="flex items-start gap-3">
          {/* Message Input */}
          <div className="flex-1 relative">
            <Textarea
              placeholder="Send a message..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="min-h-[80px] bg-background resize-none text-sm border-2 rounded-lg pr-24"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              disabled={inputDisabled}
            />
            
            {/* Action Buttons inside textarea */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {/* Attachment Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={inputDisabled}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <FileIcon className="h-4 w-4 mr-2" />
                    Attach Document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Attach Image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                    <Video className="h-4 w-4 mr-2" />
                    Attach Video
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Emoji Picker */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild disabled={inputDisabled}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="grid grid-cols-8 gap-1">
                    {['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '💪', '🎉', '🎊', '🎈', '❤️', '💕', '💖', '💗', '💓', '💞', '💝', '💘', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💯', '✅', '❌', '⭐', '🌟', '✨', '💫', '🔥', '💥', '💢', '💦', '💨', '👀', '🙈', '🙉', '🙊'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="p-1 hover:bg-muted rounded text-xl transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Send Button */}
          <Button 
            size="icon"
            onClick={handleSendReply}
            disabled={(!reply.trim() && attachments.length === 0) || inputDisabled}
            className="h-10 w-10 flex-shrink-0 rounded-full"
          >
            {sendMessage.isPending ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* LinkedIn Disconnected Warning - Only show if account is disconnected */}
        {conversation.is_account_connected === false && (
          <div className="mt-3 text-sm text-red-500 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Your LinkedIn account is disconnected. Please reconnect it to continue messaging.</span>
          </div>
        )}
      </div>
    </div>
  );
}
