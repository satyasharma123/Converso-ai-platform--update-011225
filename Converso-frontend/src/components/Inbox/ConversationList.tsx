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
import { useAuth } from "@/hooks/useAuth";

export interface Conversation {
  id: string;
  senderName: string;
  senderEmail?: string;
  subject?: string;
  preview: string;
  timestamp: string;
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

interface ConversationListProps {
  conversations: Conversation[];
  onConversationClick: (id: string) => void;
  selectedId?: string;
  onToggleSelect?: (id: string) => void;
}

const stripHtml = (value?: string) => {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

export function ConversationList({
  conversations,
  onConversationClick,
  selectedId,
  onToggleSelect,
}: ConversationListProps) {
  const toggleRead = useToggleRead();
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const { data: stages = [] } = usePipelineStages();
  const { data: teamMembers = [] } = useTeamMembers();
  const favoriteConversation = useToggleFavoriteConversation();
  const deleteConversation = useDeleteConversation();
  const { userRole } = useAuth();

  const getStatusColor = (status: Conversation["status"]) => {
    switch (status) {
      case "new": return "bg-blue-500";
      case "engaged": return "bg-yellow-500";
      case "qualified": return "bg-purple-500";
      case "converted": return "bg-green-500";
      case "not_interested": return "bg-red-500";
    }
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

  const handleFavorite = (conversationId: string, isFavorite: boolean) => {
    favoriteConversation.mutate(
      { conversationId, isFavorite },
      {
        onSuccess: () => {
          toast.success(isFavorite ? "Added to favorites" : "Removed from favorites");
        },
        onError: () => {
          toast.error("Failed to update favorite status");
        },
      }
    );
  };

  const handleDelete = (conversationId: string) => {
    const confirmed = window.confirm('Delete this email thread? This cannot be undone.');
    if (!confirmed) return;
    deleteConversation.mutate(conversationId);
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
          const assignedMember = teamMembers.find(member => member.id === conversation.assignedTo);
          const assignedName = assignedMember?.full_name || conversation.assignedTo;
          const previewText = stripHtml(conversation.preview);
          const isFavorite = Boolean((conversation as any).isFavorite ?? (conversation as any).is_favorite);

          return (
          <div
            key={conversation.id}
            className={cn(
              "flex items-start gap-2 p-2 transition-colors border-b cursor-pointer rounded-sm",
              "hover:bg-muted/40",
              conversation.selected && "bg-accent/30 border border-border",
              selectedId === conversation.id && "bg-accent/20 border-l-2 border-l-primary shadow-sm"
            )}
          >
            <Checkbox 
              className="mt-0.5 h-3.5 w-3.5" 
              checked={conversation.selected}
              onCheckedChange={() => onToggleSelect?.(conversation.id)}
              onClick={(e) => e.stopPropagation()}
            />
            
            <div 
              className="flex-1 min-w-0"
              onClick={() => onConversationClick(conversation.id)}
            >
              {/* Line 1: Sender Name (left) + Timestamp (right) */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={cn("text-sm truncate", isUnread && "font-bold")}>
                  {conversation.senderName}
                </span>
                <div className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{formatTimeAgo(conversation.timestamp)}</span>
                  {isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0"></span>
                  )}
                </div>
              </div>

              {/* Line 2: Email Subject */}
              {conversation.subject && (
                <p className={cn("text-xs text-foreground mb-1 truncate", isUnread && "font-bold")}>
                  {conversation.subject}
                </p>
              )}

            {/* Line 3: Email Preview (2 lines max) */}
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {previewText || conversation.preview}
            </p>

            {/* Line 4: Account Badge (left) + SDR Badge (right) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {conversation.receivedAccount && (
                  <ReceivedAccountBadge
                    accountName={conversation.receivedAccount.account_name}
                    accountEmail={conversation.receivedAccount.account_email}
                    accountType={conversation.receivedAccount.account_type}
                  />
                )}
              </div>
              <div className="flex-shrink-0">
                {assignedName ? (
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                    {assignedName}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-orange-500 text-orange-500">
                    Unassigned
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
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

              {userRole === 'admin' && (
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
              )}

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

              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleFavorite(conversation.id, !isFavorite); }}>
                {isFavorite ? (
                  <>
                    <StarOff className="h-4 w-4 mr-2" />
                    Remove Favorite
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Mark as Favorite
                  </>
                )}
              </DropdownMenuItem>

              {userRole === 'admin' && (
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(conversation.id); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
          );
        })}
    </div>
  );
}
