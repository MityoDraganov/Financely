import { SignIn } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router-dom'

const PENDING_INVITE_KEY = "pendingInviteCode";

export default function SignInPage() {
  const [searchParams] = useSearchParams();
  
  // Check if there's a pending invite - if so, redirect to accept-invite after sign-in
  const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
  const redirectUrl = searchParams.get('redirect_url') || 
                      (pendingInvite ? `/accept-invite?code=${pendingInvite}` : '/dashboard');
  
  const signUpUrl = redirectUrl !== '/dashboard' 
    ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-up';

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <SignIn afterSignInUrl={redirectUrl} signUpUrl={signUpUrl} />
    </div>
  )
}


