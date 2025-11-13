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
	useSidebar,
} from "@/components/ui/sidebar";
import { UserButton } from "@clerk/clerk-react";
import { Brush, FileText, LayoutDashboard, Settings, Zap, Users, Sparkles, MessageSquare, Package, BarChart3, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { ModeToggle } from "./ui/mode-toggle";
import { useOrganizationBranding } from "@/hooks/use-organization-branding";
import { Button } from "./ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";

const items = [
	{
		title: "Dashboard",
		href: "/dashboard",
		icon: LayoutDashboard,
	},
	{
		title: "Products",
		href: "/products",
		icon: Package,
	},
	{
		title: "Invoices",
		href: "/invoices",
		icon: FileText,
	},
	{
		title: "Contacts",
		href: "/contacts",
		icon: Users,
	},
	{
		title: "Leads",
		href: "/leads",
		icon: MessageSquare,
	},
	{
		title: "Proposals",
		href: "/proposals",
		icon: FileText,
	},
	{
		title: "Templates",
		href: "/templates",
		icon: Brush,
	},
	{
		title: "Workflows",
		href: "/workflows",
		icon: Zap,
	},
	{
		title: "Site Builder",
		href: "/site-builder",
		icon: Sparkles,
	},
	{
		title: "Analytics",
		href: "/analytics",
		icon: BarChart3,
	},
	{
		title: "Settings",
		href: "/settings/organization/general",
		icon: Settings,
	},
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { organizationName, organizationLogo } = useOrganizationBranding();
	const displayName = organizationName || "Financely";
	const displayInitial = displayName.charAt(0).toUpperCase();
	const isMobile = useMediaQuery("(max-width: 768px)");
	const { toggleSidebar } = useSidebar();

	return (
		<div className="flex flex-1 overflow-x-hidden min-w-0">
			{/* Mobile Header Bar */}
			{isMobile && (
				<div className="fixed top-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-sm border-b h-14 flex items-center px-4">
				<Button
					variant="ghost"
					size="icon"
						className="h-9 w-9 shrink-0"
					onClick={toggleSidebar}
				>
						<Menu className="h-5 w-5" />
					<span className="sr-only">Toggle Menu</span>
				</Button>
				</div>
			)}

			<Sidebar collapsible="icon">
				<SidebarHeader className="flex flex-col gap-3 p-4 border-b min-w-0 overflow-x-hidden">
					<div className="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:justify-center">
						<div className="flex items-center gap-2 min-w-0 flex-1">
							{organizationLogo ? (
								<>
									<img 
										src={organizationLogo} 
										alt={displayName}
										className="h-8 w-auto shrink-0 group-data-[collapsible=icon]:hidden"
									/>
									<img 
										src={organizationLogo} 
										alt={displayName}
										className="h-6 w-6 rounded shrink-0 group-data-[collapsible=icon]:block hidden object-contain"
									/>
								</>
							) : (
								<>
									<h2 className="text-xl font-bold truncate group-data-[collapsible=icon]:hidden">
										{displayName}
									</h2>
									<h2 className="text-xl font-bold group-data-[collapsible=icon]:block hidden">
										{displayInitial}
									</h2>
								</>
							)}
						</div>
						{!isMobile && <SidebarTrigger className="shrink-0" />}
					</div>
					<div className="w-full min-w-0 overflow-x-hidden group-data-[collapsible=icon]:hidden">
						<div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Organization
						</div>
						<OrganizationSwitcher />
					</div>
				</SidebarHeader>
				<SidebarContent className="flex flex-col justify-between">
					<SidebarGroup>
						{items.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild tooltip={item.title}>
									<Link to={item.href} onClick={() => isMobile && toggleSidebar()}>
										<item.icon />
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarGroup>

					<div>
						<SidebarSeparator />
						<SidebarGroup className="flex flex-row justify-between items-center">
							<SidebarMenuItem>
								<UserButton showName />
							</SidebarMenuItem>
							<ModeToggle />
						</SidebarGroup>
					</div>
				</SidebarContent>
				<SidebarFooter />
			</Sidebar>
			<div className={`flex-1 bg-background w-full min-w-0 overflow-x-hidden ${isMobile ? 'pt-14' : ''}`}>
				{children}
			</div>
		</div>
	);
}
