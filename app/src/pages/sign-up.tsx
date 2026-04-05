import { SignUp } from '@clerk/clerk-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHasInProgressData } from '@/hooks/use-onboarding-store'

const PENDING_INVITE_KEY = "pendingInviteCode";

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const clerkShellRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const root = clerkShellRef.current;
    if (!root) return;

    let frameId: number | null = null;
    const detectVerificationStep = () => {
      const hasOtpAutocomplete =
        root.querySelector("input[autocomplete='one-time-code']") !== null;
      const singleCharInputs = root.querySelectorAll("input[maxlength='1']").length;
      const hasVerificationLikeInput =
        root.querySelector("input[name*='code' i], input[id*='code' i]") !== null;
      const next = hasOtpAutocomplete || singleCharInputs >= 4 || hasVerificationLikeInput;
      setIsVerificationStep((prev) => (prev === next ? prev : next));
    };

    const scheduleDetect = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        detectVerificationStep();
      });
    };

    detectVerificationStep();
    const observer = new MutationObserver(scheduleDetect);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    window.addEventListener("focusin", scheduleDetect);

    return () => {
      observer.disconnect();
      window.removeEventListener("focusin", scheduleDetect);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <div
      ref={clerkShellRef}
      className={
        isVerificationStep
          ? "fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none p-4"
          : "auth-viewport-shell w-full overflow-y-auto overscroll-contain px-4"
      }
      style={
        isVerificationStep
          ? {
              height: "100dvh",
              minHeight: "100dvh",
              paddingTop: "max(env(safe-area-inset-top), 1rem)",
              paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
            }
          : {
              minHeight: "100dvh",
              paddingTop: "max(env(safe-area-inset-top), 1rem)",
              paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
            }
      }
    >
      <div
        className={
          isVerificationStep
            ? "w-full max-w-md"
            : "mx-auto flex w-full max-w-md items-start justify-center py-4 md:min-h-[calc(100dvh-2rem)] md:items-center"
        }
      >
        <SignUp afterSignUpUrl={redirectUrl} signInUrl={signInUrl} />
      </div>
    </div>
  )
}
