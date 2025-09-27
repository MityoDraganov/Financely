import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key: set VITE_CLERK_PUBLISHABLE_KEY in your .env.local')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/sign-in">
      <App />
    </ClerkProvider>
  </StrictMode>,
)
