import { useConversationTag } from "@/hooks/useConversationTags";
import { cn } from "@/lib/utils";

interface TagChipProps {
  conversationId: string;
  channel: 'email' | 'linkedin';
  className?: string;
}

export function TagChip({ conversationId, channel, className }: TagChipProps) {
  const { data: tag, isLoading } = useConversationTag(conversationId);

  if (isLoading) {
    return null;
  }

  if (!tag?.tag) {
    return null;
  }

  const getTagColor = (tagValue: string) => {
    switch (tagValue) {
      case 'meeting_requested':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'info_requested':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'lead':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTagLabel = (tagValue: string) => {
    switch (tagValue) {
      case 'meeting_requested':
        return 'Meeting Requested';
      case 'info_requested':
        return 'Info Requested';
      case 'lead':
        return 'Lead';
      default:
        return tagValue;
    }
  };

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded border font-medium",
        getTagColor(tag.tag),
        className
      )}
    >
      {getTagLabel(tag.tag)}
    </span>
  );
}

