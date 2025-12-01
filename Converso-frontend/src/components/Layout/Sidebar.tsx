import { LayoutDashboard, Inbox, Users, Settings, BarChart3, Linkedin, Mail, KanbanSquare, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const adminItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Email Inbox", url: "/inbox/email", icon: Mail },
  { title: "LinkedIn Inbox", url: "/inbox/linkedin", icon: Linkedin },
  { title: "All Conversations", url: "/inbox/conversations", icon: Inbox },
  { title: "Sales Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Team", url: "/team", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

const sdrItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Email Inbox", url: "/inbox/email", icon: Mail },
  { title: "LinkedIn Inbox", url: "/inbox/linkedin", icon: Linkedin },
  { title: "All Conversations", url: "/inbox/conversations", icon: Inbox },
  { title: "Sales Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface SidebarProps {
  role?: "admin" | "sdr";
  userName?: string;
}

export function Sidebar({ role = "admin", userName }: SidebarProps) {
  const { open } = useSidebar();
  const items = role === "admin" ? adminItems : sdrItems;
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (userName || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarContent className="flex h-full flex-col">
        <div className="px-2 py-3 flex items-center justify-center">
          {open ? (
            <h2 className="font-bold text-sm">
              Converso AI
            </h2>
          ) : (
            <h2 className="font-bold text-sm">
              CA
            </h2>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] px-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-2 hover:bg-accent text-xs"
                      activeClassName="bg-accent text-accent-foreground"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto px-3 pb-4 pt-3 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border/60">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {open && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{userName || "User"}</span>
                <span className="text-xs text-muted-foreground capitalize truncate">{role}</span>
              </div>
            )}
          </div>
          {open ? (
            <Button variant="secondary" size="sm" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarContent>
    </ShadcnSidebar>
  );
}
