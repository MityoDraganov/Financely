import { SignIn } from "@clerk/clerk-react";

export function AdminSignInPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
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

