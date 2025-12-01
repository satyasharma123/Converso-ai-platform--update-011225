import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: React.ReactNode;
  role?: "admin" | "sdr";
  userName?: string;
}

export function AppLayout({ children, role = "admin", userName }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar role={role} />
        <div className="flex-1 flex flex-col">
          <Navbar userName={userName} role={role} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
