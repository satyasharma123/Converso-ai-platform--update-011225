import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useWorkspace } from "@/context/WorkspaceContext";

interface AppLayoutProps {
  children: React.ReactNode;
  userName?: string;
}

export function AppLayout({ children, userName }: AppLayoutProps) {
  const { activeWorkspace, isOwner } = useWorkspace();
  const workspaceRole = (activeWorkspace?.role || "").toString().toLowerCase();
  const effectiveRole = (isOwner ? "admin" : workspaceRole) as "admin" | "sdr";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar userName={userName} role={effectiveRole} />
          <main className="flex-1 overflow-hidden p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
