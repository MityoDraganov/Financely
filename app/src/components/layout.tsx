import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { UserButton } from "@clerk/clerk-react";
import {
	Brush,
	FileText,
	LayoutDashboard,
	Settings,
	Zap,
	Users,
	Sparkles,
	MessageSquare,
	Package,
	//BarChart3,
	Menu,
	//Database,
	Store,
	FolderOpen,
	CornerDownRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { ModeToggle } from "./ui/mode-toggle";
import { LanguageSelector } from "./language-selector";
import { useOrganizationBranding } from "@/hooks/use-organization-branding";
import { Button } from "./ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLocation } from "react-router-dom";
import { useInvoiceTemplate } from "@/contexts/invoice-template-context";
import { useDesignerTemplate } from "@/contexts/designer-template-context";
import { useEmailDesignerTemplate } from "@/contexts/email-designer-template-context";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Eye, Plus } from "lucide-react";
import { memo, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HelpButton } from "@/components/help-button";

// Navigation items will be created with translations inside the component

type SubNavChild = { href: string; title: string };

// Memoized navigation item component to prevent unnecessary re-renders
const NavItem = memo(
	({
		item,
		isMobile,
		toggleSidebar,
		title,
	}: {
		item: { href: string; icon: React.ComponentType; children?: SubNavChild[] };
		isMobile: boolean;
		toggleSidebar: () => void;
		title: string;
	}) => {
		const location = useLocation();
		const { state } = useSidebar();
		const isSidebarCollapsed = state === "collapsed";

		const isActive = useMemo(() => {
			const pathname = location.pathname;
			// Exact match
			if (pathname === item.href) {
				return true;
			}
			// For settings, check if pathname starts with /settings
			if (item.href.startsWith("/settings") && pathname.startsWith("/settings")) {
				return true;
			}
			// For other routes, check if pathname starts with the href (but not just a prefix)
			if (pathname.startsWith(item.href) && item.href !== "/") {
				return true;
			}
			return false;
		}, [location.pathname, item.href]);

		const activeChildHref = useMemo(
			() => item.children?.find((c) => location.pathname === c.href)?.href ?? null,
			[item.children, location.pathname]
		);

		const showChildren = !isSidebarCollapsed && !!item.children?.length && isActive;

		const handleClick = useCallback(() => {
			if (isMobile) {
				toggleSidebar();
			}
		}, [isMobile, toggleSidebar]);

		return (
			<>
				<SidebarMenuItem>
					<SidebarMenuButton asChild tooltip={title} isActive={isActive}>
						<Link to={item.href} onClick={handleClick}>
							<item.icon />
							<span>{title}</span>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
				{showChildren &&
					item.children!.map((child) => (
						<SidebarMenuItem key={child.href} className="pl-4">
							<SidebarMenuButton
								asChild
								isActive={activeChildHref === child.href}
								className="text-muted-foreground data-[active=true]:text-foreground h-7"
							>
								<Link to={child.href} onClick={handleClick}>
									<CornerDownRight className="h-3 w-3 shrink-0" />
									<span className="text-sm">{child.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
			</>
		);
	}
);

NavItem.displayName = "NavItem";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { t } = useTranslation();
	const { organizationName } = useOrganizationBranding();
	const displayName = useMemo(
		() => organizationName || "Financely",
		[organizationName]
	);
	const isMobile = useMediaQuery("(max-width: 768px)");
	const { toggleSidebar, state } = useSidebar();
	const location = useLocation();
	const isCreateInvoicePage = useMemo(
		() => location.pathname === "/create-invoice",
		[location.pathname]
	);
	const isDesignerPage = useMemo(
		() => location.pathname.startsWith("/designer"),
		[location.pathname]
	);
	const isEmailDesignerPage = useMemo(
		() => location.pathname.startsWith("/email-designer"),
		[location.pathname]
	);
	const isMarketplaceListPage = useMemo(
		() => location.pathname === "/marketplace",
		[location.pathname]
	);
	const useInlineFitSidebar = useMemo(
		() => isMarketplaceListPage || isDesignerPage,
		[isMarketplaceListPage, isDesignerPage]
	);
	const invoiceTemplate = useInvoiceTemplate();
	const designerTemplate = useDesignerTemplate();
	const emailDesignerTemplate = useEmailDesignerTemplate();

	// Navigation items with translations
	const navItems = useMemo(
		() => [
			{
				title: t("layout.navigation.dashboard"),
				href: "/dashboard",
				icon: LayoutDashboard,
			},
			{
				title: t("layout.navigation.products"),
				href: "/products",
				icon: Package,
				children: [
					{
						href: "/products/collections",
						title: t("layout.navigation.collections"),
					},
				],
			},
			{
				title: t("layout.navigation.templates"),
				href: "/templates",
				icon: Brush,
			},
			{
				title: t("layout.navigation.invoices"),
				href: "/invoices",
				icon: FileText,
			},
			{
				title: t("layout.navigation.contacts"),
				href: "/contacts",
				icon: Users,
			},
			{
				title: t("layout.navigation.leads"),
				href: "/leads",
				icon: MessageSquare,
			},
			{
				title: t("layout.navigation.proposals"),
				href: "/proposals",
				icon: FileText,
			},
			{
				title: t("layout.navigation.marketplace"),
				href: "/marketplace",
				icon: Store,
			},
			{
				title: t("layout.navigation.workflows"),
				href: "/workflows",
				icon: Zap,
			},
			{
				title: t("layout.navigation.siteBuilder"),
				href: "/integrations",
				icon: Sparkles,
			},
			// {
			// 	title: t("layout.navigation.analytics"),
			// 	href: "/analytics",
			// 	icon: BarChart3,
			// },
			// {
			// 	title: "Data Sources",
			// 	href: "/data-sources",
			// 	icon: Database,
			// },
			{
				title: t("layout.navigation.content"),
				href: "/content/metaobjects",
				icon: FolderOpen,
			},
			{
				title: t("layout.navigation.settings"),
				href: "/settings/organization/general",
				icon: Settings,
			},
		],
		[t]
	);

	return (
		<div className="flex flex-1 overflow-x-hidden min-w-0">
			{/* Mobile Header Bar */}
			{isMobile && (
				<div className="fixed top-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-sm border-b h-14 flex items-center gap-2 px-4">
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0"
						onClick={toggleSidebar}
					>
						<Menu className="h-5 w-5" />
						<span className="sr-only">
							{t("layout.mobile.toggleMenu")}
						</span>
					</Button>
					{isCreateInvoicePage && invoiceTemplate && (
						<>
							<div className="flex-1 min-w-0">
								<Select
									value={invoiceTemplate.selectedTemplateId}
									onValueChange={
										invoiceTemplate.setSelectedTemplateId
									}
								>
									<SelectTrigger className="h-9 w-full">
										<SelectValue
											placeholder={t(
												"layout.templateSelector.placeholder"
											)}
										/>
									</SelectTrigger>
									<SelectContent>
										{invoiceTemplate.templates.map((t) => (
											<SelectItem key={t.id} value={t.id}>
												<div className="flex items-center space-x-2">
													<FileText className="h-4 w-4" />
													<span>{t.name}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									invoiceTemplate.setPreviewDialogOpen(true)
								}
								className="shrink-0"
								disabled={!invoiceTemplate.selectedTemplate}
							>
								<Eye className="h-4 w-4 mr-1.5" />
								{t("layout.preview")}
							</Button>
						</>
					)}
					{isDesignerPage && designerTemplate && (
						<div className="flex-1 min-w-0">
							<Select
								value={
									designerTemplate.currentTemplate?.id ?? ""
								}
								onValueChange={
									designerTemplate.onTemplateChange
								}
							>
								<SelectTrigger className="h-9 w-full">
									<SelectValue
										placeholder={t(
											"layout.templateSelector.placeholder"
										)}
									/>
								</SelectTrigger>
								<SelectContent>
									{designerTemplate.templates.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
									<SelectItem value="new">
										<Plus className="h-4 w-4 mr-1" />{" "}
										{t(
											"layout.templateSelector.newTemplate"
										)}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}
					{isEmailDesignerPage && emailDesignerTemplate && (
						<div className="flex-1 min-w-0">
							<Select
								value={
									emailDesignerTemplate.currentTemplate?.id ??
									""
								}
								onValueChange={
									emailDesignerTemplate.onTemplateChange
								}
							>
								<SelectTrigger className="h-9 w-full">
									<SelectValue
										placeholder={t(
											"layout.templateSelector.placeholder"
										)}
									/>
								</SelectTrigger>
								<SelectContent>
									{emailDesignerTemplate.templates.map(
										(t) => (
											<SelectItem key={t.id} value={t.id}>
												{t.name}
											</SelectItem>
										)
									)}
									<SelectItem value="new">
										<Plus className="h-4 w-4 mr-1" />{" "}
										{t(
											"layout.templateSelector.newTemplate"
										)}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}
					{/* UserButton on mobile - outside sidebar to avoid dialog issues */}
					<div className="shrink-0">
						<UserButton />
					</div>
				</div>
			)}

			<Sidebar
				collapsible="icon"
				desktopMode={useInlineFitSidebar ? "inline-fit" : "fixed"}
				className={useInlineFitSidebar ? "max-w-fit" : undefined}
			>
				<SidebarHeader className="flex flex-col gap-2 p-3 border-b min-w-0 overflow-x-hidden">
					<div className="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:justify-center">
						<div className="flex items-center gap-1.5 flex-1 max-w-fit">
							<Link to="/dashboard">
								<img
									src={"/financely-logo.svg"}
									alt={displayName}
									className="-ml-1.5 h-6 w-auto object-contain transition-opacity duration-200 hover:opacity-80 group-data-[collapsible=icon]:hidden"
									loading="eager"
									decoding="async"
								/>
							</Link>
						</div>
						{!isMobile && <SidebarTrigger className="shrink-0" />}
					</div>
					<div className="w-full min-w-0 overflow-x-hidden group-data-[collapsible=icon]:hidden">
						<OrganizationSwitcher />
					</div>
				</SidebarHeader>
				<SidebarContent className="justify-between">
					<SidebarGroup>
						{navItems.map((item) => (
							<NavItem
								key={item.href}
								item={item}
								isMobile={isMobile}
								toggleSidebar={toggleSidebar}
								title={item.title}
							/>
						))}
					</SidebarGroup>

					<div>
						<SidebarSeparator />
						<SidebarGroup
							className={`flex flex-col justify-between gap-3 ${state === "collapsed" ? "gap-1" : ""}`}
						>
							<div
								className={`flex items-center justify-between gap-1.5 ${state === "collapsed" ? "flex-col gap-1" : ""}`}
							>
								<LanguageSelector />
								<ModeToggle />
							</div>
							{/* UserButton only on desktop - on mobile it's in the header */}
							{!isMobile && (
								<SidebarMenuItem className="flex justify-center items-center w-full min-w-0 overflow-hidden">
									<div className="min-w-0 overflow-hidden w-full">
										<UserButton
											showName={state === "expanded"}
											appearance={{
												elements: {
													userButtonTrigger: "w-full max-w-full overflow-hidden",
													userButtonBox: "min-w-0 overflow-hidden w-full",
													userButtonOuterIdentifier: "truncate max-w-[10rem]",
												},
											}}
										/>
									</div>
								</SidebarMenuItem>
							)}
						</SidebarGroup>
					</div>
				</SidebarContent>
			</Sidebar>
			<div
				className={`flex-1 bg-background w-full min-w-0 overflow-x-hidden ${
					isMobile
						? `pt-14 ${useInlineFitSidebar ? "" : "pl-6"}`
						: useInlineFitSidebar
							? ""
							: "pl-6"
				}`}
			>
				{children}
			</div>
			<HelpButton />
		</div>
	);
}
