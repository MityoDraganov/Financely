import { Outlet, useLocation, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Shield,
  Settings,
  ChevronRight,
  CreditCard,
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
        title: "Billing",
        href: "/settings/organization/billing",
        description: "Subscription and payment",
        icon: CreditCard,
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
      {
        title: "Roles",
        href: "/settings/roles",
        description: "Custom roles and permissions",
        icon: Shield,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header with depth and visual hierarchy */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-500">Manage your organization</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Settings Navigation - Responsive sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <nav className="space-y-2">
                {settingsSections.map((section) => (
                  <div key={section.title} className="space-y-1">
                    {/* Section Header */}
                    <div className="flex items-center space-x-2 px-3 py-2">
                      <div className={cn(
                        "p-1.5 rounded-md",
                        section.bgColor
                      )}>
                        <section.icon className={cn("h-4 w-4", section.color)} />
                      </div>
                      <span className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>
                    
                    {/* Section Items */}
                    <div className="space-y-1 pl-8">
                      {section.items.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              "group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                              isActive
                                ? "bg-white shadow-sm border border-gray-200 text-gray-900"
                                : "text-gray-600 hover:bg-white/50 hover:text-gray-900 hover:shadow-sm"
                            )}
                          >
                            <div className={cn(
                              "p-1 rounded-md transition-colors",
                              isActive 
                                ? "bg-gray-100" 
                                : "bg-gray-50 group-hover:bg-gray-100"
                            )}>
                              <item.icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{item.title}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {item.description}
                              </div>
                            </div>
                            {isActive && (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content Area with proper depth */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
              {/* Content with proper spacing and depth */}
              <div className="p-6 sm:p-8">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
