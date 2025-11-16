import { Outlet, useLocation, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Shield,
  Settings,
  Palette,
  Globe,
  UserCheck,
  FileText,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsSections = [
  {
    title: "Organization",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    items: [
      {
        title: "General",
        href: "/settings/organization/general",
        description: "Basic organization information",
        icon: Globe,
      },
      {
        title: "Branding",
        href: "/settings/organization/branding",
        description: "Logo, colors, and customization",
        icon: Palette,
      },
      {
        title: "AI Settings",
        href: "/settings/organization/ai",
        description: "AI features and automation",
        icon: Settings,
      },
    ],
  },
  {
    title: "Users",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50",
    items: [
      {
        title: "All Users",
        href: "/settings/users",
        description: "Manage team members",
        icon: UserCheck,
      },
      {
        title: "Invites",
        href: "/settings/invites",
        description: "Manage team invites",
        icon: UserPlus,
      },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    items: [
    
      {
        title: "Audit Log",
        href: "/settings/security/audit-log",
        description: "Activity and security logs",
        icon: FileText,
      },
    ],
  },
];

export default function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your organization</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <nav className="space-y-1.5">
                {settingsSections.map((section) => (
                  <div key={section.title} className="space-y-1">
                    {/* Section Header */}
                    <div className="flex items-center space-x-2 px-2 py-1.5">
                      <section.icon className={cn("h-4 w-4", section.color)} />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>
                    
                    {/* Section Items */}
                    <div className="space-y-0.5 pl-6">
                      {section.items.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              "group flex items-center space-x-2 px-2.5 py-2 rounded-md text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
