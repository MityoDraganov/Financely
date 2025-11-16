import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

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
import ContactsPage from "./pages/contacts/contacts";
import LeadsPage from "./pages/leads/leads";
import ProposalsPage from "./pages/proposals/proposals";
import ProposalDetailPage from "./pages/proposals/proposal-detail";
import ProductsPage from "./pages/products/products";
import SettingsLayout from "./pages/settings/layout";
import OrganizationGeneralPage from "./pages/settings/organization/general";
import OrganizationBrandingPage from "./pages/settings/organization/branding";
import OrganizationBillingPage from "./pages/settings/organization/billing";
import OrganizationAISettingsPage from "./pages/settings/organization/ai-settings";
import UsersListPage from "./pages/settings/users/list";
import InvitesPage from "./pages/settings/invites";
import AuditLogPage from "./pages/settings/security/audit-log";
import OnboardingPage from "./pages/onboarding/page";
import AcceptInvitePage from "./pages/accept-invite";
import WorkflowsPage from "./pages/workflows/workflows-page";
import WorkflowTemplatesPage from "./pages/workflows/workflow-templates-page";
import WorkflowExecutionPage from "./pages/workflows/workflow-execution-page";
import SiteBuilderPage from "./pages/site-builder/site-builder-page";
import AnalyticsPage from "./pages/analytics/analytics-page";
import ProtectedRoute from "./components/ProtectedRoute";
import { OrganizationProvider } from "./contexts/organization-context";
import { ClerkProvider } from "@clerk/clerk-react";
import { ClerkAuthProvider } from "./components/ClerkAuthProvider";
import { ThemeProvider } from "./components/ui/theme-provider";
import { useOrganizationBranding } from "./hooks/use-organization-branding";

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
			<ClerkProvider publishableKey={PUBLISHABLE_KEY}>
				<QueryClientProvider client={queryClient}>
					<ClerkAuthProvider>
						<ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
					<SidebarProvider>
						<OrganizationProvider>
							<BrandingProvider>
							<Router>
								<Routes>
									<Route path="/" element={<LandingPage />} />
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
										path="/site-builder"
										element={
											<ProtectedRoute>
												<AppLayout>
													<SiteBuilderPage />
												</AppLayout>
											</ProtectedRoute>
										}
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
										{/* TODO: Add more settings routes */}
									</Route>
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
