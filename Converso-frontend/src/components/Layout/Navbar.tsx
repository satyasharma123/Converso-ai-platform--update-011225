import { Bell, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Loader2 } from "lucide-react";

interface NavbarProps {
  userName?: string;
  role?: "admin" | "sdr";
}

export function Navbar({ userName = "John Doe", role = "admin" }: NavbarProps) {
  const { activeWorkspace, workspaces, setActiveWorkspaceId, loading } = useWorkspace();

  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    // Reload page to avoid stale state
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        <div className="flex-1" />

        {/* Workspace Switcher */}
        {!loading && workspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="hidden md:flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="max-w-[150px] truncate">
                  {activeWorkspace?.name || "Select Workspace"}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace.id)}
                  className={activeWorkspace?.id === workspace.id ? "bg-accent" : ""}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{workspace.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {workspace.role}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {loading && (
          <div className="hidden md:flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        </Button>

        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{userName}</span>
          <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded-full">{role}</span>
        </div>
      </div>
    </header>
  );
}
