import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from "sonner";
import { ClerkProvider } from "@clerk/clerk-react";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardPage } from "@/pages/admin/dashboard";
import { AdminOrganizationsPage } from "@/pages/admin/organizations";
import { AdminSignInPage } from "@/pages/sign-in";
import { AdminAuthProvider } from "@/components/AdminAuthProvider";

const queryClient = new QueryClient();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Clerk Publishable Key: set VITE_CLERK_PUBLISHABLE_KEY in your .env.local"
  );
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
      }}
    >
      <AdminAuthProvider>
        <QueryClientProvider client={queryClient}>
          <ReactQueryDevtools initialIsOpen={false} />
          <ThemeProvider defaultTheme="system" storageKey="admin-ui-theme">
            <SidebarProvider>
              <Router>
              <Routes>
                {/* Public sign-in route */}
                <Route path="/sign-in" element={<AdminSignInPage />} />
                
                {/* Protected admin routes */}
                <Route
                  path="/"
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout>
                        <AdminDashboardPage />
                      </AdminLayout>
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/organizations"
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout>
                        <AdminOrganizationsPage />
                      </AdminLayout>
                    </AdminProtectedRoute>
                  }
                />
                {/* Add more routes as needed */}
              </Routes>
                <Toaster />
              </Router>
            </SidebarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AdminAuthProvider>
    </ClerkProvider>
  );
}

export default App;

