import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Lock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PresenceIndicatorProps {
  viewers: Array<{ name: string; isTyping: boolean }>;
  isLocked?: boolean;
  lockedBy?: string;
}

export function PresenceIndicator({ viewers, isLocked, lockedBy }: PresenceIndicatorProps) {
  if (viewers.length === 0 && !isLocked) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
      {isLocked && lockedBy ? (
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium">Locked by {lockedBy}</span>
          <Badge variant="destructive">Drafting Reply</Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {viewers.map((viewer) => (
            <div key={viewer.name} className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{viewer.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {viewer.name}
                {viewer.isTyping ? (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <Pencil className="h-3 w-3" />
                    typing...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 ml-1 text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    viewing
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
