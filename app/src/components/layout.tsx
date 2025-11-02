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
import { Brush, FileText, LayoutDashboard, Settings, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { ModeToggle } from "./ui/mode-toggle";

const items = [
	{
		title: "Dashboard",
		href: "/dashboard",
		icon: LayoutDashboard,
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
		title: "Settings",
		href: "/settings/organization/general",
		icon: Settings,
	},
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-1">
			<Sidebar collapsible="icon">
				<SidebarHeader className="flex flex-col gap-3 p-4 border-b">
					<div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
						<div className="flex items-center gap-2">
							<h2 className="text-xl font-bold group-data-[collapsible=icon]:hidden">
								Financely
							</h2>
							<h2 className="text-xl font-bold group-data-[collapsible=icon]:block hidden">
								F
							</h2>
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
