import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { SignedIn, UserButton } from '@clerk/clerk-react'

import CreateInvoicePage from './pages/create-invoice'
import LandingPage from './pages/landing'
import SignInPage from './pages/sign-in'
import SignUpPage from './pages/sign-up'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/create-invoice" element={<CreateInvoicePage />} />
            <Route
              path="/dashboard"
              element={
                <SignedIn>
                  {/* Replace with your dashboard root when available */}
                  <div className="min-h-screen w-screen p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h1 className="text-2xl font-semibold">Dashboard</h1>
                      <UserButton afterSignOutUrl="/sign-in" />
                    </div>
                    <p>Welcome! You are signed in.</p>
                  </div>
                </SignedIn>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />

      </Router>
    </QueryClientProvider>
  )
}

export default App
