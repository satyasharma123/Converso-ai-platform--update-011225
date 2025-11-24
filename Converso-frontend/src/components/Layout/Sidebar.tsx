import { LayoutDashboard, Inbox, Users, Settings, BarChart3, Linkedin, Mail, KanbanSquare } from "lucide-react";
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
}

export function Sidebar({ role = "admin" }: SidebarProps) {
  const { open } = useSidebar();
  const items = role === "admin" ? adminItems : sdrItems;

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarContent>
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
      </SidebarContent>
    </ShadcnSidebar>
  );
}
