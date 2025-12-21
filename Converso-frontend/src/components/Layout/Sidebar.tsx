import { Inbox, Users, Settings, BarChart3, Linkedin, Mail, KanbanSquare, LogOut, LayoutDashboard, ListTodo } from "lucide-react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";

// Navigation structure grouped by section
const dashboardItem = { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard };

const communicationItems = [
  { title: "Email Inbox", url: "/inbox/email", icon: Mail },
  { title: "LinkedIn Inbox", url: "/inbox/linkedin", icon: Linkedin },
];

const salesItemsAdmin = [
  { title: "Sales Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Work Queue", url: "/work-queue", icon: ListTodo },
  { title: "Team", url: "/team", icon: Users },
];

const salesItemsSdr = [
  { title: "Sales Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Work Queue", url: "/work-queue", icon: ListTodo },
];

const analyticsItems = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const systemItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

interface SidebarProps {
  role?: "admin" | "sdr";
}

// Section label component
function SectionLabel({ children, isFirst = false }: { children: React.ReactNode; isFirst?: boolean }) {
  return (
    <div 
      className={`text-[11px] tracking-wide text-[#9CA3AF] px-3 ${isFirst ? 'mt-2' : 'mt-5'} mb-1.5`}
    >
      {children}
    </div>
  );
}

export function Sidebar({ role = "admin" }: SidebarProps) {
  const { open } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  // Fetch conversations to calculate unread counts
  const { data: emailConversations = [] } = useConversations('email');
  const { data: linkedinConversations = [] } = useConversations('linkedin');
  
  // Calculate unread counts
  const emailUnreadCount = emailConversations.filter((conv: any) => {
    const isRead = conv.isRead ?? conv.is_read;
    return isRead === false || isRead === 'false' || isRead === 0;
  }).length;
  
  const linkedinUnreadCount = linkedinConversations.filter((conv: any) => {
    const isRead = conv.isRead ?? conv.is_read;
    return isRead === false || isRead === 'false' || isRead === 0;
  }).length;

  const salesItems = role === "admin" ? salesItemsAdmin : salesItemsSdr;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Check if a path is active
  const isActive = (url: string) => {
    if (url === '/dashboard') {
      // Dashboard is active for both /dashboard and /
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    if (url === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(url);
  };

  // Get unread count for a menu item
  const getUnreadCount = (url: string) => {
    if (url === '/inbox/email') return emailUnreadCount;
    if (url === '/inbox/linkedin') return linkedinUnreadCount;
    return 0;
  };

  // Render a navigation item
  const renderNavItem = (item: { title: string; url: string; icon: any }) => {
    const active = isActive(item.url);
    const unreadCount = getUnreadCount(item.url);
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild size="sm">
          <RouterNavLink
            to={item.url}
            end={item.url === '/'}
            className={`flex items-center gap-2 text-xs transition-all duration-150 ${
              active 
                ? 'bg-[#EEF2FF] text-[#3B82F6] rounded-xl font-medium' 
                : 'hover:bg-gray-100'
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span className="flex-1">{item.title}</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-medium">
                {unreadCount}
              </span>
            )}
          </RouterNavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
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

        {/* Dashboard - Top Level Item */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItem(dashboardItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* COMMUNICATION Section */}
        <SidebarGroup>
          {open && <SectionLabel isFirst>COMMUNICATION</SectionLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {communicationItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SALES Section */}
        <SidebarGroup>
          {open && <SectionLabel>SALES</SectionLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {salesItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ANALYTICS Section */}
        <SidebarGroup>
          {open && <SectionLabel>ANALYTICS</SectionLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SYSTEM Section */}
        <SidebarGroup>
          {open && <SectionLabel>SYSTEM</SectionLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto px-3 pb-4 pt-3 border-t border-border/50">
          <Button variant="secondary" size={open ? "sm" : "icon"} className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {open && <span>Logout</span>}
          </Button>
        </div>
      </SidebarContent>
    </ShadcnSidebar>
  );
}
