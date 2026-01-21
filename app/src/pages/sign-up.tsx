import { SignUp } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router-dom'
import { useHasInProgressData } from '@/hooks/use-onboarding-store'

const PENDING_INVITE_KEY = "pendingInviteCode";

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  const hasPreSignupData = useHasInProgressData();
  
  // Check if there's a pending invite - if so, redirect to accept-invite after sign-up
  const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
  
  // Check if user completed quiz - if so, redirect to onboarding to create org
  const fromOnboarding = searchParams.get('from_onboarding') === 'true';
  
  // Determine redirect URL
  let redirectUrl = searchParams.get('redirect_url');
  if (!redirectUrl) {
    if (pendingInvite) {
      redirectUrl = `/accept-invite?code=${pendingInvite}`;
    } else if (hasPreSignupData || fromOnboarding) {
      redirectUrl = '/onboarding';
    } else {
      redirectUrl = '/dashboard';
    }
  }
  
  const signInUrl = redirectUrl !== '/dashboard' 
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-in';

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <SignUp afterSignUpUrl={redirectUrl} signInUrl={signInUrl} />
    </div>
  )
}


