import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Brush, FileText, LayoutDashboard } from "lucide-react";

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
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex">
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<h2 className="text-2xl font-bold group-data-[collapsible=icon]:hidden">Financely</h2>
					<SidebarTrigger />
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						{items.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild tooltip={item.title}>
									<a href={item.href}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter />
			</Sidebar>
			<div className="flex-1">{children}</div>
		</div>
	);
}
