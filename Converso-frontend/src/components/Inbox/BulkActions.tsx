import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, CheckCheck, UserPlus, GitBranch, Archive, Trash2, Star, StarOff } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface BulkActionsProps {
  selectedCount: number;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onAssignSDR: (sdrId: string | null) => void;
  onChangeStage: (stageId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onClearSelection: () => void;
}

export function BulkActions({
  selectedCount,
  onMarkRead,
  onMarkUnread,
  onAssignSDR,
  onChangeStage,
  onArchive,
  onDelete,
  onFavorite,
  onUnfavorite,
  onClearSelection,
}: BulkActionsProps) {
  const { userRole } = useAuth();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: stages = [] } = usePipelineStages();

  const handleOpenChange = (open: boolean) => {
    if (open && selectedCount === 0) {
      toast.info("Select messages to perform bulk actions");
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs h-7">
          Actions
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-md z-50">
          <DropdownMenuItem onClick={onMarkRead}>
            <Check className="h-4 w-4 mr-2" />
            Mark as Read
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onMarkUnread}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark as Unread
          </DropdownMenuItem>

          {userRole === 'admin' && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign to SDR
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
                <DropdownMenuItem onClick={() => onAssignSDR(null)}>
                  Unassigned
                </DropdownMenuItem>
                {teamMembers.map((member) => (
                  <DropdownMenuItem 
                    key={member.id}
                    onClick={() => onAssignSDR(member.id)}
                  >
                    {member.full_name}
                  </DropdownMenuItem>
                ))}
                {teamMembers.length === 0 && (
                  <DropdownMenuItem disabled>No team members available</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <GitBranch className="h-4 w-4 mr-2" />
              Change Stage
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
              {stages.map((stage) => (
                <DropdownMenuItem 
                  key={stage.id}
                  onClick={() => onChangeStage(stage.id)}
                >
                  {stage.name}
                </DropdownMenuItem>
              ))}
              {stages.length === 0 && (
                <DropdownMenuItem disabled>No stages available</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem onClick={onFavorite}>
            <Star className="h-4 w-4 mr-2" />
            Mark as Favorite
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onUnfavorite}>
            <StarOff className="h-4 w-4 mr-2" />
            Remove Favorite
          </DropdownMenuItem>

          {userRole === 'admin' && (
            <>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
    </DropdownMenu>
  );
}
