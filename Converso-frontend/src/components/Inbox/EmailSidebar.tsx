import { Inbox, Send, Archive, Trash2, Star, Clock, Flag, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface EmailSidebarProps {
  onFolderChange?: (folder: string) => void;
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

export function EmailSidebar({ onFolderChange }: EmailSidebarProps) {
  const [activeFolder, setActiveFolder] = useState("inbox");

  const handleFolderClick = (folderId: string) => {
    setActiveFolder(folderId);
    onFolderChange?.(folderId);
  };

  return (
    <div className="h-full bg-muted/30 border-r flex flex-col">
      <div className="p-3 border-b">
        <h2 className="text-xs font-semibold text-foreground">Mailbox</h2>
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
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{folder.label}</span>
                </div>
                {folder.count !== null && (
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
    </div>
  );
}
