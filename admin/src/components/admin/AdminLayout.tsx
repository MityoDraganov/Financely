import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserButton } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  FileText,
  Shield,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAdminRole } from "@/utils/admin-utils";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { NotificationBell } from "./NotificationBell";

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Organizations",
    href: "/organizations",
    icon: Building2,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
  },
  {
    title: "Usage",
    href: "/usage",
    icon: BarChart3,
  },
  {
    title: "System Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Logs & Monitoring",
    href: "/logs",
    icon: FileText,
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const adminRole = useAdminRole();

  return (
    <div className="flex flex-1 overflow-x-hidden min-w-0">
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex flex-col gap-3 p-4 border-b">
          <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-2 flex-1">
              <Link to="/">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
                    Admin Panel
                  </span>
                </div>
              </Link>
            </div>
            <SidebarTrigger className="shrink-0" />
          </div>
          {adminRole && (
            <div className="w-full group-data-[collapsible=icon]:hidden">
              <Badge variant="secondary" className="text-xs">
                {adminRole.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent className="flex flex-col justify-between">
          <SidebarGroup>
            {adminNavItems.map((item) => {
              const isActive = location.pathname === item.href || 
                              (item.href !== "/" && location.pathname.startsWith(item.href));
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarGroup>

          <div>
            <SidebarSeparator />
            <SidebarGroup className="flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2 px-2">
                <ModeToggle />
                <NotificationBell />
              </div>
              <SidebarMenuItem className="flex justify-center items-center w-full">
                <UserButton showName />
              </SidebarMenuItem>
            </SidebarGroup>
          </div>
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
      <div className="flex-1 bg-background w-full min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}

