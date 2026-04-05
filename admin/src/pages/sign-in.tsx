import { SignIn } from "@clerk/clerk-react";

export function AdminSignInPage() {
  return (
    <div
      className="auth-viewport-shell w-full overflow-y-auto overscroll-contain bg-background px-4"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col py-4 md:min-h-[calc(100dvh-2rem)] md:justify-center">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Financely Admin</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to access the admin panel
          </p>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl={undefined}
          afterSignInUrl="/"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg",
              headerTitle: "text-2xl font-bold",
              headerSubtitle: "text-muted-foreground",
            },
            variables: {
              colorText: "hsl(var(--foreground))",
              colorTextSecondary: "hsl(var(--muted-foreground))",
              colorBackground: "hsl(var(--background))",
              colorInputBackground: "hsl(var(--background))",
              colorInputText: "hsl(var(--foreground))",
              colorNeutral: "hsl(var(--foreground))",
              colorDanger: "hsl(var(--destructive))",
              colorSuccess: "hsl(var(--primary))",
              colorWarning: "hsl(38, 92%, 50%)",
              colorShimmer: "hsl(var(--muted))",
            },
          }}
        />
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Admin access only. Admin users are created directly in Clerk.</p>
          <p className="mt-1">Contact your administrator for access.</p>
        </div>
      </div>
    </div>
  );
}
