import { Outlet, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Database, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ContentLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const tabs = [
    {
      title: t("contentPages.layout.tabs.metaobjects", "Metaobjects & Metafields"),
      href: "/content/metaobjects",
      icon: Database,
    },
    {
      title: t("contentPages.layout.tabs.files", "Files"),
      href: "/content/files",
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-0 w-full overflow-x-hidden">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-5 sm:pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("contentPages.layout.title", "Content")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("contentPages.layout.subtitle", "Manage custom data structures and assets")}
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="border-b border-border">
          <nav className="-mb-px flex gap-1">
            {tabs.map((tab) => {
              const isActive =
                location.pathname === tab.href ||
                (location.pathname === "/content" && tab.href === "/content/metaobjects");
              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={cn(
                    "group inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-all duration-150",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <tab.icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {tab.title}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="pt-5 sm:pt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
