import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { CreateProposalPage } from './pages/CreateProposalPage'
import { AppShell } from './components/layout/AppShell'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppShell>
          <Routes>
  
            {/* New routes */}
            <Route path="/" element={<Navigate to="/create-proposal" replace />} />
            <Route path="/create-proposal" element={<CreateProposalPage />} />
            <Route path="/proposals/:id" element={<div>Proposal Details (Coming Soon)</div>} />
            <Route path="/proposals" element={<div>Proposals List (Coming Soon)</div>} />
            
            {/* Fallback for any other routes */}
            <Route path="*" element={<Navigate to="/create-proposal" replace />} />
          </Routes>
          <Toaster />
        </AppShell>
      </Router>
    </QueryClientProvider>
  )
}

export default App
