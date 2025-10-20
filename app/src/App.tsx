import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import CreateInvoicePage from "./pages/create-invoice";
import TemplateDesignerPage from "./pages/designer";
import LandingPage from "./pages/landing";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import DashboardPage from "./pages/dashboard/dashboard-page";
import AppLayout from "./components/layout";
import { SidebarProvider } from "./components/ui/sidebar";
import InvoicesPage from "./pages/invoices/invoices";
import InvoiceDetailPage from "./pages/invoices/invoice-detail";
import SettingsLayout from "./pages/settings/layout";
import OrganizationGeneralPage from "./pages/settings/organization/general";
import OrganizationBrandingPage from "./pages/settings/organization/branding";
import OrganizationBillingPage from "./pages/settings/organization/billing";
import UsersListPage from "./pages/settings/users/list";
import InvitesPage from "./pages/settings/invites";
import OnboardingPage from "./pages/onboarding/page";
import AcceptInvitePage from "./pages/accept-invite";
import ProtectedRoute from "./components/ProtectedRoute";
import { OrganizationProvider } from "./contexts/organization-context";
import { ClerkProvider } from "@clerk/clerk-react";
import { ClerkAuthProvider } from "./components/ClerkAuthProvider";
import { ThemeProvider } from "./components/ui/theme-provider";

const queryClient = new QueryClient();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
	throw new Error(
		"Missing Clerk Publishable Key: set VITE_CLERK_PUBLISHABLE_KEY in your .env.local"
	);
}

function App() {
	return (
			<ClerkProvider publishableKey={PUBLISHABLE_KEY}>
				<QueryClientProvider client={queryClient}>
					<ClerkAuthProvider>
						<ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
					<SidebarProvider>
						<OrganizationProvider>
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
										path="/create-invoice"
										element={
											<ProtectedRoute>
												<AppLayout>
													<CreateInvoicePage />
												</AppLayout>
											</ProtectedRoute>
										}
									/>
									<Route
										path="/designer"
										element={
											<ProtectedRoute>
												<AppLayout>
													<TemplateDesignerPage />
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
											path="users"
											element={<UsersListPage />}
										/>
										<Route
											path="invites"
											element={<InvitesPage />}
										/>
										{/* TODO: Add more settings routes */}
									</Route>
								</Routes>
								<Toaster />
							</Router>
						</OrganizationProvider>
					</SidebarProvider>
					</ThemeProvider>
				</ClerkAuthProvider>
			</QueryClientProvider>
		</ClerkProvider>
	);
}

export default App;
