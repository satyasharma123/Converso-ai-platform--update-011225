import { Mail, Linkedin, Clock, MoreVertical, Check, CheckCheck, UserPlus, GitBranch, Archive, Star, StarOff, Trash2, Reply, Forward, ReplyAll } from "lucide-react";
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

export interface Conversation {
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
  email_action_status?: 'replied' | 'replied_all' | 'forwarded' | null; // EMAIL ONLY - for action icons
  receivedAccount?: {
    account_name: string;
    account_email?: string;
    account_type: string;
  };
  // ✅ Folder-specific fields (from backend when filtering by folder)
  folder_last_message_at?: string; // Latest message timestamp in specific folder
  folder_preview?: string; // Preview of latest message in specific folder
  folder_name?: string; // The folder this message belongs to
  folder_sender_name?: string; // Sender name from latest message in folder
  folder_sender_email?: string; // Sender email from latest message in folder
  folderName?: string;
  folderSenderName?: string;
  folderSenderEmail?: string;
  folderIsFromLead?: boolean;
  email_folder?: string | null;
  emailFolder?: string | null;
  derived_folder?: string | null;
  derivedFolder?: string | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  onConversationClick: (id: string) => void;
  selectedId?: string;
  onToggleSelect?: (id: string) => void;
  showCheckboxes?: boolean;
}

export function ConversationList({
  conversations,
  onConversationClick,
  selectedId,
  onToggleSelect,
  showCheckboxes = false,
}: ConversationListProps) {
  const toggleRead = useToggleRead();
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const toggleFavorite = useToggleFavoriteConversation();
  const deleteConversation = useDeleteConversation();
  const { data: stages = [] } = usePipelineStages();
  const { data: teamMembers = [] } = useTeamMembers();

  const getStatusColor = (status: Conversation["status"]) => {
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
  const getSdrDisplayName = (assignedToId?: string): string => {
    if (!assignedToId) return '';
    const member = teamMembers.find(m => m.id === assignedToId);
    if (!member) {
      // If member not found, return empty string
      console.warn('Team member not found for ID:', assignedToId);
      return '';
    }
    
    // Extract first name (before first space)
    const firstName = member.full_name.split(' ')[0];
    
    // Truncate if longer than 10 characters
    if (firstName.length > 10) {
      return firstName.substring(0, 9) + '…';
    }
    
    return firstName;
  };

  const handleToggleRead = (conversation: Conversation) => {
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

  const handleToggleFavorite = (conversation: Conversation) => {
    const isFavorite = (conversation as any).is_favorite ?? (conversation as any).isFavorite ?? false;
    toggleFavorite.mutate({ 
      conversationId: conversation.id, 
      isFavorite: !isFavorite 
    });
  };

  const handleDelete = (conversationId: string) => {
    const confirmed = window.confirm('Delete this email thread? This cannot be undone.');
    if (!confirmed) return;
    
    deleteConversation.mutate(conversationId, {
      onSuccess: () => {
        toast.success('Email deleted successfully');
      },
      onError: (error) => {
        console.error('Error deleting conversation:', error);
        toast.error('Failed to delete email');
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
          
          // ✅ Use folder-specific timestamp if available (for email folder views)
          const ts = conversation.folder_last_message_at || conversation.timestamp || (conversation as any).last_message_at || '';
          
          // ✅ Use folder-specific preview if available (for email folder views)
          const displayPreview = conversation.folder_preview || conversation.preview;
          
          const folderName = (conversation as any).folder_name || (conversation as any).folderName || (conversation as any).derived_folder || (conversation as any).derivedFolder || conversation.emailFolder || (conversation as any).email_folder || '';
          const isSentFolderView = ['sent', 'drafts'].includes(folderName);
          
          // ✅ Use recipient info for Sent folder, sender info for others
          const displaySenderName = isSentFolderView
            ? ((conversation as any).senderName || conversation.sender_name || conversation.senderEmail || '')
            : (conversation.folder_sender_name || (conversation as any).folderSenderName || conversation.senderName);

          const displaySenderEmail = isSentFolderView
            ? ((conversation as any).senderEmail || conversation.sender_email || '')
            : (conversation.folder_sender_email || (conversation as any).folderSenderEmail || conversation.senderEmail || '');
          
          const initials = (displaySenderName || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          
          return (
          <div
            key={conversation.id}
            className={cn(
              "flex items-start gap-2.5 p-2.5 transition-colors border-b cursor-pointer",
              "hover:bg-muted/40",
              conversation.selected && "bg-accent/30",
              selectedId === conversation.id && "bg-accent/20 border-l-4 border-l-green-600"
            )}
          >
            {/* Checkbox - only show when showCheckboxes is true */}
            {showCheckboxes && (
              <Checkbox 
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" 
                checked={conversation.selected}
                onCheckedChange={() => onToggleSelect?.(conversation.id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            
            {/* Main Content */}
            <div 
              className="flex-1 min-w-0 space-y-2"
              onClick={() => onConversationClick(conversation.id)}
            >
              {/* First Row: Sender Name + Time + Unread Dot */}
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  "text-xs truncate flex-1",
                  isUnread ? "font-medium text-foreground" : "font-normal text-foreground"
                )}>
                  {displaySenderName}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {ts ? formatTimeAgo(ts) : ''}
                  </span>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                  )}
                </div>
              </div>

              {displaySenderEmail && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {displaySenderEmail}
                </div>
              )}

              {/* Second Row: Subject with Action Icon */}
              {conversation.subject && (
                <div className="flex items-center gap-1.5">
                  {/* Action Icon (EMAIL ONLY - replied/forwarded) */}
                  {conversation.type === 'email' && conversation.email_action_status && (
                    <>
                      {conversation.email_action_status === 'replied' && (
                        <Reply className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                      {conversation.email_action_status === 'replied_all' && (
                        <Reply className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                      {conversation.email_action_status === 'forwarded' && (
                        <Forward className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </>
                  )}
                  <p className={cn(
                    "text-xs truncate flex-1",
                    isUnread ? "font-normal text-foreground" : "text-muted-foreground"
                  )}>
                    {conversation.subject}
                  </p>
                </div>
              )}

              {/* Third Row: Preview (2 lines max) */}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {stripHtml(displayPreview)}
              </p>

              {/* Fourth Row: Account Badge + SDR Badge */}
              <div className="flex items-center justify-between gap-2 pt-3">
                <div className="flex items-center gap-1 text-[11px] text-gray-400 min-w-0">
                  {conversation.receivedAccount && (
                    <>
                      <span className="truncate max-w-[100px]">
                        {conversation.receivedAccount.account_name}
                      </span>
                      {(() => {
                        const assignedId = conversation.assignedTo || (conversation as any).assigned_to;
                        const sdrName = getSdrDisplayName(assignedId);
                        return sdrName ? <span>•</span> : null;
                      })()}
                    </>
                  )}
                  {(() => {
                    const assignedId = conversation.assignedTo || (conversation as any).assigned_to;
                    const sdrName = getSdrDisplayName(assignedId);
                    return sdrName ? <span className="truncate">{sdrName}</span> : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0 mt-1">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
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
                    {!(conversation.assignedTo || (conversation as any).assigned_to) && " ✓"}
                  </DropdownMenuItem>
                  {teamMembers.map((member) => (
                    <DropdownMenuItem 
                      key={member.id}
                      onClick={(e) => { e.stopPropagation(); handleAssignSDR(conversation.id, member.id); }}
                    >
                      {member.full_name}
                      {(conversation.assignedTo || (conversation as any).assigned_to) === member.id && " ✓"}
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
                      {(conversation.customStageId || (conversation as any).custom_stage_id) === stage.id && " ✓"}
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