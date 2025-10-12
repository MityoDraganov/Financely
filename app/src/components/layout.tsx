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
import { Brush, FileText, LayoutDashboard, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganizationBranding } from "@/hooks/use-organization-branding";
import { getOrganizationName, getOrganizationLogo } from "@/utils/branding";

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
		title: "Designer",
		href: "/designer",
		icon: Brush,
	},
	{
		title: "Settings",
		href: "/settings/organization/general",
		icon: Settings,
	},
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { organization } = useOrganizationBranding();

	return (
		<div className="flex">
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<div className="flex items-center gap-2">
						{getOrganizationLogo(organization) !== null && (
							<img
								src={getOrganizationLogo(organization)!}
								alt="Logo"
								className="h-8 w-8 rounded"
							/>
						)}
						{getOrganizationName(organization) && (
							<h2 className="text-2xl font-bold group-data-[collapsible=icon]:hidden">
								{getOrganizationName(organization)}
							</h2>
						)}
					</div>
					<SidebarTrigger />
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
						<SidebarGroup>
							<SidebarMenuItem>
								<UserButton showName />
							</SidebarMenuItem>
						</SidebarGroup>
					</div>
				</SidebarContent>
				<SidebarFooter />
			</Sidebar>
			<div className="flex-1">{children}</div>
		</div>
	);
}
