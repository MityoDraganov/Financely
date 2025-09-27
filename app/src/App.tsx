import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import CreateInvoicePage from './pages/create-invoice'
import TemplateDesignerPage from './pages/designer'
import LandingPage from './pages/landing'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/create-invoice" element={<CreateInvoicePage />} />
            <Route path="/designer" element={<TemplateDesignerPage />} />
          </Routes>
          <Toaster />

      </Router>
    </QueryClientProvider>
  )
}

export default App
