import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ConversationTagsProps {
  tags: Tag[];
  availableTags: Tag[];
  onAddTag?: (tagId: string) => void;
  onRemoveTag?: (tagId: string) => void;
}

export function ConversationTags({ tags, availableTags, onAddTag, onRemoveTag }: ConversationTagsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="gap-1">
          {tag.name}
          {onRemoveTag && (
            <button
              onClick={() => onRemoveTag(tag.id)}
              className="ml-1 hover:bg-muted rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {onAddTag && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="space-y-1">
              {availableTags
                .filter((at) => !tags.find((t) => t.id === at.id))
                .map((tag) => (
                  <Button
                    key={tag.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onAddTag(tag.id)}
                  >
                    <Badge variant="secondary" className="mr-2">
                      {tag.name}
                    </Badge>
                  </Button>
                ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
