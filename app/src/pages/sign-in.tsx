import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <SignIn afterSignInUrl="/dashboard" signUpUrl="/sign-up" />
    </div>
  )
}


