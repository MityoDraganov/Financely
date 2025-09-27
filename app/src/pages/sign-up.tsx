import { SignUp } from '@clerk/clerk-react'

export default function SignUpPage() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4">
      <SignUp afterSignUpUrl="/dashboard" signInUrl="/sign-in" />
    </div>
  )
}


