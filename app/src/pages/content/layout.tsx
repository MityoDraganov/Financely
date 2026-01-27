import { Outlet, useLocation, Link } from "react-router-dom";
import { Database, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ContentLayout() {
  const location = useLocation();

  const tabs = [
    {
      title: "Metaobjects",
      href: "/content/metaobjects",
      icon: Database,
    },
    {
      title: "Files",
      href: "/content/files",
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Content</h1>
            <p className="text-sm text-muted-foreground">Manage your metaobjects and files</p>
          </div>
        </div>

        <div className="border-b">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={cn(
                    "flex items-center space-x-2 pb-4 px-1 border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="font-medium">{tab.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
