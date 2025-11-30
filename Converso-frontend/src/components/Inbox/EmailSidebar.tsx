import { Inbox, Send, Archive, Trash2, Star, Clock, Flag, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsEmailSyncInProgress, useEmailSyncStatus } from "@/hooks/useEmailSync";

interface EmailSidebarProps {
  onFolderChange?: (folder: string) => void;
  isCollapsed?: boolean;
}

const folders = [
  { id: "inbox", label: "Inbox", icon: Inbox, count: 281 },
  { id: "sent", label: "Sent", icon: Send, count: 4 },
  { id: "important", label: "Important", icon: Star, count: null },
  { id: "snoozed", label: "Snoozed", icon: Clock, count: null },
  { id: "drafts", label: "Drafts", icon: FolderOpen, count: 3 },
  { id: "archive", label: "Archive", icon: Archive, count: null },
  { id: "deleted", label: "Deleted Items", icon: Trash2, count: null },
];

export function EmailSidebar({ onFolderChange, isCollapsed }: EmailSidebarProps) {
  const [activeFolder, setActiveFolder] = useState("inbox");
  const isSyncing = useIsEmailSyncInProgress();
  const { data: syncStatuses = [] } = useEmailSyncStatus();

  const handleFolderClick = (folderId: string) => {
    setActiveFolder(folderId);
    onFolderChange?.(folderId);
  };

  return (
    <div className="h-full bg-muted/30 border-r flex flex-col">
      <div className={cn("p-3 border-b flex items-center", isCollapsed ? "justify-center" : "")}>
        {isCollapsed ? (
          <Inbox className="h-4 w-4" />
        ) : (
          <h2 className="text-xs font-semibold text-foreground">Mailbox</h2>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <nav className="space-y-1 p-2">
          {folders.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            
            return (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder.id)}
                title={isCollapsed ? folder.label : undefined}
                className={cn(
                  "w-full flex items-center px-2.5 py-1.5 text-xs rounded-md transition-colors",
                  isCollapsed ? "justify-center" : "justify-between",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className={cn("flex items-center", isCollapsed ? "" : "gap-2.5")}>
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {!isCollapsed && <span>{folder.label}</span>}
                </div>
                {!isCollapsed && folder.count !== null && (
                  <span className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {folder.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sync Status Indicator - Bottom Left */}
      {isSyncing && !isCollapsed && (
        <div className="p-3 border-t bg-muted/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="flex-1">Sync in progress...</span>
          </div>
          {syncStatuses.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {syncStatuses
                .filter((s: any) => s.status === 'in_progress')
                .map((status: any) => (
                  <div key={status.accountId} className="text-[10px] text-muted-foreground truncate">
                    {status.accountName}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
