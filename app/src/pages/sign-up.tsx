import { SignUp } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router-dom'

const PENDING_INVITE_KEY = "pendingInviteCode";

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  
  // Check if there's a pending invite - if so, redirect to accept-invite after sign-up
  const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
  const redirectUrl = searchParams.get('redirect_url') || 
                      (pendingInvite ? `/accept-invite?code=${pendingInvite}` : '/dashboard');
  
  const signInUrl = redirectUrl !== '/dashboard' 
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-in';

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <SignUp afterSignUpUrl={redirectUrl} signInUrl={signInUrl} />
    </div>
  )
}


