import { Mail, Linkedin, Clock, MoreVertical, Check, CheckCheck, UserPlus, GitBranch, Archive, Star, StarOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReceivedAccountBadge } from "./ReceivedAccountBadge";
import { formatTimeAgo } from "@/utils/timeFormat";
import { useToggleRead, useAssignConversation, useUpdateConversationStage, useToggleFavoriteConversation, useDeleteConversation } from "@/hooks/useConversations";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTeamMembers } from "@/hooks/useTeamMembers";

export interface LinkedInConversation {
  id: string;
  senderName: string;
  senderEmail?: string;
  sender_profile_picture_url?: string;
  sender_linkedin_url?: string;
  subject?: string;
  preview: string;
  timestamp?: string;
  last_message_at?: string;
  type: "email" | "linkedin";
  status: "new" | "engaged" | "qualified" | "converted" | "not_interested";
  isRead: boolean;
  assignedTo?: string;
  customStageId?: string;
  selected?: boolean;
  receivedAccount?: {
    account_name: string;
    account_email?: string;
    account_type: string;
  };
}

interface LinkedInConversationListProps {
  conversations: LinkedInConversation[];
  onConversationClick: (id: string) => void;
  selectedId?: string;
  onToggleSelect?: (id: string) => void;
}

export function LinkedInConversationList({
  conversations,
  onConversationClick,
  selectedId,
  onToggleSelect,
}: LinkedInConversationListProps) {
  const toggleRead = useToggleRead();
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const toggleFavorite = useToggleFavoriteConversation();
  const deleteConversation = useDeleteConversation();
  const { data: stages = [] } = usePipelineStages();
  const { data: teamMembers = [] } = useTeamMembers();

  const getStatusColor = (status: LinkedInConversation["status"]) => {
    switch (status) {
      case "new": return "bg-blue-500";
      case "engaged": return "bg-yellow-500";
      case "qualified": return "bg-purple-500";
      case "converted": return "bg-green-500";
      case "not_interested": return "bg-red-500";
    }
  };

  // Helper function to strip HTML tags from text
  const stripHtml = (html: string): string => {
    if (!html) return '';
    // Create a temporary div to parse HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Get text content and clean up extra whitespace
    return tmp.textContent || tmp.innerText || '';
  };

  // Helper function to get SDR first name, truncated if needed
  const getSdrDisplayName = (assignedToId?: string): string | null => {
    if (!assignedToId) return null;
    const member = teamMembers.find(m => m.id === assignedToId);
    if (!member) return assignedToId; // Fallback to ID if member not found
    
    // Extract first name (before first space)
    const firstName = member.full_name.split(' ')[0];
    
    // Truncate if longer than 10 characters
    if (firstName.length > 10) {
      return firstName.substring(0, 9) + '…';
    }
    
    return firstName;
  };

  const handleToggleRead = (conversation: LinkedInConversation) => {
    const currentReadStatus = conversation.isRead ?? (conversation as any).is_read ?? false;
    toggleRead.mutate({ 
      conversationId: conversation.id, 
      isRead: !currentReadStatus // Toggle: if read, mark as unread, and vice versa
    });
  };

  const handleAssignSDR = (conversationId: string, sdrId: string | null) => {
    assignConversation.mutate({ conversationId, sdrId });
  };

  const handleChangeStage = (conversationId: string, stageId: string) => {
    updateStage.mutate({ conversationId, stageId });
  };

  const handleArchive = (conversationId: string) => {
    toast.info('Archive feature coming soon');
  };

  const handleToggleFavorite = (conversation: LinkedInConversation) => {
    const isFavorite = (conversation as any).is_favorite ?? (conversation as any).isFavorite ?? false;
    toggleFavorite.mutate({ 
      conversationId: conversation.id, 
      isFavorite: !isFavorite 
    });
  };

  const handleDelete = (conversationId: string) => {
    const confirmed = window.confirm('Delete this conversation? This cannot be undone.');
    if (!confirmed) return;
    
    deleteConversation.mutate(conversationId, {
      onSuccess: () => {
        toast.success('Conversation deleted successfully');
      },
      onError: (error) => {
        console.error('Error deleting conversation:', error);
        toast.error('Failed to delete conversation');
      }
    });
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-sm text-muted-foreground mb-2">No conversations found</p>
        <p className="text-xs text-muted-foreground">The database is empty. Please seed the database to see conversations.</p>
      </div>
    );
  }

  return (
    <div>
        {conversations.map((conversation) => {
          // Determine if email is unread (show dot if unread)
          const isUnread = !(conversation.isRead ?? (conversation as any).is_read ?? false);
          const unreadCount =
            (conversation as any).unreadCount ??
            (conversation as any).unread_count ??
            (isUnread ? 1 : 0);
          const ts = conversation.timestamp || (conversation as any).last_message_at || '';
          const initials = (conversation.senderName || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          
          return (
          <div
            key={conversation.id}
            className={cn(
              "flex items-center gap-3 p-3 transition-colors border-b cursor-pointer",
              "hover:bg-muted/30",
              isUnread && "bg-blue-50/50",
              conversation.selected && "bg-accent/20",
              selectedId === conversation.id && "bg-muted/40 border-l-4 border-l-green-600"
            )}
          >
            <Checkbox 
              className="h-3.5 w-3.5 flex-shrink-0" 
              checked={conversation.selected}
              onCheckedChange={() => onToggleSelect?.(conversation.id)}
              onClick={(e) => e.stopPropagation()}
            />
            
            <div 
              className="flex-1 min-w-0 flex gap-3"
              onClick={() => onConversationClick(conversation.id)}
            >
              {/* Avatar with unread indicator - Smaller for LinkedIn */}
              <div className="relative h-10 w-10 flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-semibold">
                  {conversation.sender_profile_picture_url ? (
                    <img
                      src={conversation.sender_profile_picture_url}
                      alt={conversation.senderName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                {isUnread && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-background">
                    <span className="text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name and Date */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={cn("text-xs font-medium truncate", isUnread && "font-semibold")}>
                    {conversation.senderName}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {ts ? formatTimeAgo(ts) : ''}
                  </span>
                </div>

                {/* Message Preview (2 lines) - LinkedIn style */}
                {conversation.preview && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-snug mb-1">
                    <span className="font-normal">You: </span>
                    {stripHtml(conversation.preview)}
                  </p>
                )}

                {/* From line */}
                {conversation.receivedAccount && (
                  <p className="text-xs text-muted-foreground">
                    From: {conversation.receivedAccount.account_name}
                  </p>
                )}
              </div>
            </div>

            {/* Three-dot menu */}
            <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-md z-50">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleRead(conversation); }}>
                {(conversation.isRead ?? (conversation as any).is_read) ? (
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
                <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign to SDR
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); handleAssignSDR(conversation.id, null); }}
                  >
                    Unassigned
                    {!conversation.assignedTo && " ✓"}
                  </DropdownMenuItem>
                  {teamMembers.map((member) => (
                    <DropdownMenuItem 
                      key={member.id}
                      onClick={(e) => { e.stopPropagation(); handleAssignSDR(conversation.id, member.id); }}
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
                <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Change Stage
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
                  {stages.map((stage) => (
                    <DropdownMenuItem 
                      key={stage.id}
                      onClick={(e) => { e.stopPropagation(); handleChangeStage(conversation.id, stage.id); }}
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

              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(conversation.id); }}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>

              {/* Favorite/Unfavorite */}
              {((conversation as any).is_favorite ?? (conversation as any).isFavorite) ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleFavorite(conversation); }}>
                  <StarOff className="h-4 w-4 mr-2" />
                  Remove Favorite
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleFavorite(conversation); }}>
                  <Star className="h-4 w-4 mr-2" />
                  Mark as Favorite
                </DropdownMenuItem>
              )}

              {/* Delete */}
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); handleDelete(conversation.id); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
          );
        })}
    </div>
  );
}
