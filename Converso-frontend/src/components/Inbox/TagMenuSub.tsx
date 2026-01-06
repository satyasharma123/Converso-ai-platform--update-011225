import { DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { GitBranch } from "lucide-react";
import { useSetConversationTag, useDeleteConversationTag, useConversationTag } from "@/hooks/useConversationTags";

interface TagMenuSubProps {
  conversationId: string;
  channel: 'email' | 'linkedin';
}

export function TagMenuSub({ conversationId, channel }: TagMenuSubProps) {
  const { data: currentTag } = useConversationTag(conversationId);
  const setTag = useSetConversationTag();
  const deleteTag = useDeleteConversationTag();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
        <GitBranch className="h-4 w-4 mr-2" />
        Lead Tag
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="bg-popover border shadow-md z-50">
        <DropdownMenuItem 
          onClick={(e) => { 
            e.stopPropagation(); 
            setTag.mutate({ 
              conversationId, 
              tag: 'meeting_requested',
              channel
            }); 
          }}
        >
          Meeting Requested
          {currentTag?.tag === 'meeting_requested' && " ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={(e) => { 
            e.stopPropagation(); 
            setTag.mutate({ 
              conversationId, 
              tag: 'info_requested',
              channel
            }); 
          }}
        >
          Info Requested
          {currentTag?.tag === 'info_requested' && " ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={(e) => { 
            e.stopPropagation(); 
            setTag.mutate({ 
              conversationId, 
              tag: 'lead',
              channel
            }); 
          }}
        >
          Lead
          {currentTag?.tag === 'lead' && " ✓"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={(e) => { 
            e.stopPropagation(); 
            setTag.mutate({ 
              conversationId, 
              tag: null,
              channel
            }); 
          }}
        >
          Clear Tag
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

