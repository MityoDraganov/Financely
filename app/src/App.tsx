import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import "./i18n/config";
import "./utils/debug-auth"; // Initialize debug utilities

import CreateInvoiceWrapper from "./pages/create-invoice-wrapper";
import DesignerWrapper from "./pages/designer-wrapper";
import TemplatesPage from "./pages/templates/templates";
import LandingPage from "./pages/landing";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import DashboardPage from "./pages/dashboard/dashboard-page";
import AppLayout from "./components/layout";
import { SidebarProvider } from "./components/ui/sidebar";
import InvoicesPage from "./pages/invoices/invoices";
import InvoiceDetailPage from "./pages/invoices/invoice-detail";
import UploadInvoicePage from "./pages/invoices/upload-invoice";
import InvoiceUploadFlowPage from "./pages/invoice-upload-flow";
import ContactsPage from "./pages/contacts/contacts";
import ContactDetailPage from "./pages/contacts/contact-detail";
import LeadsPage from "./pages/leads/leads";
import ProposalsPage from "./pages/proposals/proposals";
import ProposalDetailPage from "./pages/proposals/proposal-detail";
import ProductsPage from "./pages/products/products";
import ProductDetailPage from "./pages/products/product-detail";
import SettingsLayout from "./pages/settings/layout";
import OrganizationGeneralPage from "./pages/settings/organization/general";
import OrganizationBrandingPage from "./pages/settings/organization/branding";
import OrganizationBillingPage from "./pages/settings/organization/billing";
import OrganizationAISettingsPage from "./pages/settings/organization/ai-settings";
import DataManagementPage from "./pages/settings/data-management";
import UsersListPage from "./pages/settings/users/list";
import InvitesPage from "./pages/settings/invites";
import AuditLogPage from "./pages/settings/security/audit-log";
import DataSourcesPage from "./pages/data-sources";
import OnboardingPage from "./pages/onboarding/page";
import AcceptInvitePage from "./pages/accept-invite";
import CheckoutSuccessPage from "./pages/stripe/checkout-success";
import MarketplaceListPage from "./pages/marketplace/marketplace-list";
import TemplateDetailPage from "./pages/marketplace/template-detail";
import ContributorPortalPage from "./pages/marketplace/contributor-portal";
import WorkflowsPage from "./pages/workflows/workflows-page";
import WorkflowTemplatesPage from "./pages/workflows/workflow-templates-page";
import WorkflowExecutionPage from "./pages/workflows/workflow-execution-page";
// import SiteBuilderPage from "./pages/site-builder/site-builder-page";
import IntegrationsWrapper from "./pages/integrations/integrations-wrapper";
import { Navigate, useParams } from "react-router-dom";
import WidgetPage from "./pages/widget/widget-page";

function RedirectWidgetBuilderToIntegrations() {
	const { widgetId } = useParams<{ widgetId: string }>();
	return <Navigate to={widgetId ? `/integrations/${widgetId}` : "/integrations"} replace />;
}
import ModularWidgetPage from "./pages/widget/modular-widget-page";
import AnalyticsPage from "./pages/analytics/analytics-page";
import EmailDesignerWrapper from "./pages/email-designer-wrapper";
import ProtectedRoute from "./components/ProtectedRoute";
import { OrganizationProvider } from "./contexts/organization-context";
import { ClerkProvider } from "@clerk/clerk-react";
import { ClerkAuthProvider } from "./components/ClerkAuthProvider";
import { ThemeProvider } from "./components/ui/theme-provider";
import { useOrganizationBranding } from "./hooks/use-organization-branding";
import { RevokedAccessAlert } from "./components/revoked-access-alert";
import PaywallPreview from "./pages/PaywallPreview";
import ContentLayout from "./pages/content/layout";
import MetaobjectsPage from "./pages/content/metaobjects";
import FilesPage from "./pages/content/files";

const queryClient = new QueryClient();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
	throw new Error(
		"Missing Clerk Publishable Key: set VITE_CLERK_PUBLISHABLE_KEY in your .env.local"
	);
}

// Component to apply organization branding globally
function BrandingProvider({ children }: { children: React.ReactNode }) {
	useOrganizationBranding();
	return <>{children}</>;
}

function App() {
	return (
		<ClerkProvider
			publishableKey={PUBLISHABLE_KEY}
			appearance={{
				cssLayerName: "clerk",
				variables: {
					colorText: "hsl(var(--foreground))",
					colorTextSecondary: "hsl(var(--muted-foreground))",
					colorBackground: "hsl(var(--background))",
					colorInputBackground: "hsl(var(--background))",
					colorInputText: "hsl(var(--foreground))",
					colorNeutral: "hsl(var(--foreground))",
					colorDanger: "hsl(var(--destructive))",
					colorSuccess: "hsl(var(--primary))",
					colorWarning: "hsl(38, 92%, 50%)",
					colorShimmer: "hsl(var(--muted))",
				},
				elements: {
					userButtonPopoverCard: {
						backgroundColor: "hsl(var(--background))",
						color: "hsl(var(--foreground))",
					},
					userButtonPopoverActionButton: {
						color: "hsl(var(--foreground))",
						"&:hover": {
							backgroundColor: "hsl(var(--muted))",
						},
					},
					userButtonPopoverActionButtonText: {
						color: "hsl(var(--foreground))",
					},
					userButtonPopoverFooter: {
						backgroundColor: "hsl(var(--background))",
					},
					userButtonPopoverHeaderTitle: {
						color: "hsl(var(--foreground))",
					},
					userButtonPopoverHeaderSubtitle: {
						color: "hsl(var(--muted-foreground))",
					},
				},
			}}
		>
			<QueryClientProvider client={queryClient}>
				<ReactQueryDevtools initialIsOpen={false} />
				<ClerkAuthProvider>
					<ThemeProvider
						defaultTheme="system"
						storageKey="vite-ui-theme"
					>
						<SidebarProvider>
							<OrganizationProvider>
								<BrandingProvider>
									<Router>
										<RevokedAccessAlert />
										<Routes>
											<Route
												path="/"
												element={<LandingPage />}
											/>
											<Route
												path="/sign-in"
												element={<SignInPage />}
											/>
											<Route
												path="/sign-up"
												element={<SignUpPage />}
											/>
											<Route
												path="/onboarding"
												element={<OnboardingPage />}
											/>
											<Route
												path="/accept-invite"
												element={<AcceptInvitePage />}
											/>
											<Route
												path="/stripe/checkout-success"
												element={<CheckoutSuccessPage />}
											/>
											<Route
												path="/widget/:organizationId/modular/:widgetId"
												element={<ModularWidgetPage />}
											/>
											<Route
												path="/widget/:organizationId/:widgetType"
												element={<WidgetPage />}
											/>

											<Route
												path="/dashboard"
												element={
													<ProtectedRoute>
														<AppLayout>
															<DashboardPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>

											<Route
												path="/invoices"
												element={
													<ProtectedRoute>
														<AppLayout>
															<InvoicesPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/invoices/upload"
												element={
													<ProtectedRoute>
														<UploadInvoicePage />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/invoice-upload-flow"
												element={
													<ProtectedRoute>
														<InvoiceUploadFlowPage />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/invoices/:id"
												element={
													<ProtectedRoute>
														<AppLayout>
															<InvoiceDetailPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/contacts"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ContactsPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/contacts/:id"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ContactDetailPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/leads"
												element={
													<ProtectedRoute>
														<AppLayout>
															<LeadsPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/proposals"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ProposalsPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/proposals/:id"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ProposalDetailPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/products"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ProductsPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/products/:id"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ProductDetailPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/create-invoice"
												element={
													<ProtectedRoute>
														<CreateInvoiceWrapper />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/templates"
												element={
													<ProtectedRoute>
														<AppLayout>
															<TemplatesPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/marketplace"
												element={
													<ProtectedRoute>
														<AppLayout>
															<MarketplaceListPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/marketplace/:id"
												element={
													<ProtectedRoute>
														<AppLayout>
															<TemplateDetailPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/marketplace/contributor"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ContributorPortalPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/email-designer/:id?"
												element={
													<ProtectedRoute>
														<EmailDesignerWrapper />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/designer/:id?"
												element={
													<ProtectedRoute>
														<DesignerWrapper />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/workflows"
												element={
													<ProtectedRoute>
														<AppLayout>
															<WorkflowsPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/workflows/templates"
												element={
													<ProtectedRoute>
														<AppLayout>
															<WorkflowTemplatesPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/workflows/:id"
												element={
													<ProtectedRoute>
														<AppLayout>
															<WorkflowExecutionPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/integrations"
												element={
													<ProtectedRoute>
														<IntegrationsWrapper />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/integrations/:widgetId"
												element={
													<ProtectedRoute>
														<IntegrationsWrapper />
													</ProtectedRoute>
												}
											/>
											<Route
												path="/integrations/widget-builder"
												element={<Navigate to="/integrations" replace />}
											/>
											<Route
												path="/integrations/widget-builder/:widgetId"
												element={<RedirectWidgetBuilderToIntegrations />}
											/>
											<Route
												path="/analytics"
												element={
													<ProtectedRoute>
														<AppLayout>
															<AnalyticsPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/data-sources"
												element={
													<ProtectedRoute>
														<AppLayout>
															<DataSourcesPage />
														</AppLayout>
													</ProtectedRoute>
												}
											/>
											<Route
												path="/content"
												element={
													<ProtectedRoute>
														<AppLayout>
															<ContentLayout />
														</AppLayout>
													</ProtectedRoute>
												}
											>
												<Route path="metaobjects" element={<MetaobjectsPage />} />
												<Route path="files" element={<FilesPage />} />
											</Route>

											{/* Settings routes - integrated within main layout */}
											<Route
												path="/settings"
												element={
													<ProtectedRoute>
														<AppLayout>
															<SettingsLayout />
														</AppLayout>
													</ProtectedRoute>
												}
											>
												<Route
													path="organization/general"
													element={
														<OrganizationGeneralPage />
													}
												/>
												<Route
													path="organization/branding"
													element={
														<OrganizationBrandingPage />
													}
												/>
												<Route
													path="organization/billing"
													element={
														<OrganizationBillingPage />
													}
												/>
												<Route
													path="organization/ai"
													element={
														<OrganizationAISettingsPage />
													}
												/>
												<Route
													path="organization/data-management"
													element={
														<DataManagementPage />
													}
												/>
												<Route
													path="users"
													element={<UsersListPage />}
												/>
												<Route
													path="invites"
													element={<InvitesPage />}
												/>
												<Route
													path="security/audit-log"
													element={<AuditLogPage />}
												/>
											</Route>
											<Route path="/paywall-preview" element={<PaywallPreview />} />
										</Routes>
										<Toaster />
									</Router>
								</BrandingProvider>
							</OrganizationProvider>
						</SidebarProvider>
					</ThemeProvider>
				</ClerkAuthProvider>
			</QueryClientProvider>
		</ClerkProvider>
	);
}

export default App;
