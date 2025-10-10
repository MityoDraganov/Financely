import { useState, useEffect } from "react";
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
import { Brush, FileText, LayoutDashboard } from "lucide-react";
import { OnboardingFlow } from "@/components/onboarding";
import { useOnboardingStatus } from "@/hooks";

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
	const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
	const [forceShowApp, setForceShowApp] = useState(false);
	const { needsOnboarding, isLoading } = useOnboardingStatus();

	// Add timeout to prevent infinite loading
	useEffect(() => {
		const timer = setTimeout(() => {
			if (isLoading) {
				console.warn('Loading state persisted for 10 seconds, forcing app to show');
				setForceShowApp(true);
			}
		}, 10000); // 10 second timeout

		return () => clearTimeout(timer);
	}, [isLoading]);

	// Show onboarding if user needs it and hasn't completed it in this session
	if (!isLoading && needsOnboarding && !hasCompletedOnboarding && !forceShowApp) {
		return <OnboardingFlow onComplete={() => setHasCompletedOnboarding(true)} />;
	}

	// Show loading state while checking onboarding status (unless forced to show app)
	if (isLoading && !forceShowApp) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center space-y-4">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#166534] mx-auto" />
					<p className="text-gray-600">Loading your workspace...</p>
					<p className="text-sm text-gray-500">If this takes too long, try refreshing the page</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex">
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<h2 className="text-2xl font-bold group-data-[collapsible=icon]:hidden">
						Financely
					</h2>
					<SidebarTrigger />
				</SidebarHeader>
				<SidebarContent className="flex flex-col justify-between">
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
