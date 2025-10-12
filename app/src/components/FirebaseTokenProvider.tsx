import { useAuth } from "@clerk/clerk-react";
import * as React from "react";
import { useEffect } from "react";

import {
  useFirebaseAuthUser,
  useOnUserStateChange,
  useSignInWithCustomToken,
} from "@/hooks";

export function FirebaseTokenProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { mutate, isError, isPending, isSuccess } = useSignInWithCustomToken();
  const firebaseAuthUser = useFirebaseAuthUser();

  useOnUserStateChange();

  useEffect(() => {
    if (!auth.isLoaded) {
      return;
    }

    if (isPending) {
      return;
    }

    if (firebaseAuthUser && firebaseAuthUser.uid === auth.userId) {
      return;
    }

    void (async () => {
      const token = await auth.getToken({ template: "integration_firebase" });
      if (!token) {
        return;
      }

      mutate(token);
    })();
  }, [auth, firebaseAuthUser, isError, isPending, isSuccess, mutate]);

  return <>{children}</>;
}
