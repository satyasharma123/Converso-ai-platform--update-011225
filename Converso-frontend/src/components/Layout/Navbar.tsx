import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  userName?: string;
  role?: "admin" | "sdr";
}

export function Navbar({ userName = "John Doe", role = "admin" }: NavbarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        <div className="flex-1" />

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        </Button>

        <Button variant="ghost" className="gap-2 cursor-default" asChild>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden md:inline-block">{userName}</span>
            <span className="hidden text-xs text-muted-foreground capitalize md:inline-block">{role}</span>
          </div>
        </Button>

        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
