import { Outlet, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export default function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const settingsSections = [
    {
      title: t('settings.sections.organization'),
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      items: [
        {
          title: t('settings.organization.general.title'),
          href: "/settings/organization/general",
          description: t('settings.organization.general.description'),
          icon: Globe,
        },
        {
          title: t('settings.organization.branding.title'),
          href: "/settings/organization/branding",
          description: t('settings.organization.branding.description'),
          icon: Palette,
        },
        {
          title: t('settings.organization.aiSettings.title'),
          href: "/settings/organization/ai",
          description: t('settings.organization.aiSettings.description'),
          icon: Settings,
        },
      ],
    },
    {
      title: t('settings.sections.users'),
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
      items: [
        {
          title: t('settings.users.allUsers.title'),
          href: "/settings/users",
          description: t('settings.users.allUsers.description'),
          icon: UserCheck,
        },
        {
          title: t('settings.users.invites.title'),
          href: "/settings/invites",
          description: t('settings.users.invites.description'),
          icon: UserPlus,
        },
      ],
    },
    {
      title: t('settings.sections.security'),
      icon: Shield,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      items: [
        {
          title: t('settings.security.auditLog.title'),
          href: "/settings/security/audit-log",
          description: t('settings.security.auditLog.description'),
          icon: FileText,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
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
