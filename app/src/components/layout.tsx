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
import { Brush, FileText, LayoutDashboard, Settings, Zap, Users, Sparkles, MessageSquare, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { ModeToggle } from "./ui/mode-toggle";
import { useOrganizationBranding } from "@/hooks/use-organization-branding";

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
		title: "Designer",
		href: "/designer",
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
		title: "Settings",
		href: "/settings/organization/general",
		icon: Settings,
	},
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { organizationName, organizationLogo } = useOrganizationBranding();
	const displayName = organizationName || "Financely";
	const displayInitial = displayName.charAt(0).toUpperCase();

	return (
		<div className="flex flex-1">
			<Sidebar collapsible="icon">
				<SidebarHeader className="flex flex-col gap-3 p-4 border-b">
					<div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
						<div className="flex items-center gap-2">
							{organizationLogo ? (
								<>
									<img 
										src={organizationLogo} 
										alt={displayName}
										className="h-8 w-auto group-data-[collapsible=icon]:hidden"
									/>
									<img 
										src={organizationLogo} 
										alt={displayName}
										className="h-6 w-6 rounded group-data-[collapsible=icon]:block hidden object-contain"
									/>
								</>
							) : (
								<>
									<h2 className="text-xl font-bold group-data-[collapsible=icon]:hidden">
										{displayName}
									</h2>
									<h2 className="text-xl font-bold group-data-[collapsible=icon]:block hidden">
										{displayInitial}
									</h2>
								</>
							)}
						</div>
						<SidebarTrigger />
					</div>
					<div className="w-full group-data-[collapsible=icon]:hidden">
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
									<Link to={item.href}>
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
			<div className="flex-1 bg-background w-full">{children}</div>
		</div>
	);
}
