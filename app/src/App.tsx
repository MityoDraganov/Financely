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

const queryClient = new QueryClient();

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<SidebarProvider>
				<Router>
					<Routes>
						<Route path="/" element={<LandingPage />} />
						<Route path="/sign-in" element={<SignInPage />} />
						<Route path="/sign-up" element={<SignUpPage />} />

						<Route
							path="/dashboard"
							element={
								<AppLayout>
									<DashboardPage />
								</AppLayout>
							}
						/>

						<Route
							path="/invoices"
							element={
								<AppLayout>
									<InvoicesPage />
								</AppLayout>
							}
						/>
					<Route
						path="/invoices/:id"
						element={
							<AppLayout>
								<InvoiceDetailPage />
							</AppLayout>
						}
					/>
						<Route
							path="/create-invoice"
							element={
								<AppLayout>
									<CreateInvoicePage />
								</AppLayout>
							}
						/>
						<Route
							path="/designer"
							element={
								<AppLayout>
									<TemplateDesignerPage />
								</AppLayout>
							}
						/>
					</Routes>
					<Toaster />
				</Router>
			</SidebarProvider>
		</QueryClientProvider>
	);
}

export default App;
