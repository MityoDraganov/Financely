import { AuthUser } from "@/core";
import { serviceHost } from "@/services";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";

const authenticationService = serviceHost.getAuthenticationService();

interface AuthStore {
  authUser: AuthUser | null;
  setAuthUser: (authUser: AuthUser | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  authUser: null,
  setAuthUser: (authUser) => set({ authUser }),
}));

export const useFirebaseAuthUser = () => {
  return useAuthStore((state) => state.authUser);
};

export const useOnUserStateChange = () => {
  const setAuthUser = useAuthStore((state) => state.setAuthUser);

  useEffect(() => {
    return authenticationService.onUserStateChanged((user) => {
      console.log("user", user);
      setAuthUser(user);
    });
  }, [setAuthUser]);
};

export const useSignInWithEmailAndPassword = () => {
  return useMutation({
    mutationKey: ["signInWithEmailAndPassword"],
    mutationFn: authenticationService.signInWithEmailAndPassword,
  });
};
export const useSignInWithCustomToken = () => {
  return useMutation({
    mutationKey: ["signInWithCustomToken"],
    mutationFn: authenticationService.signInWithCustomToken,
  });
};
export const useSignUpWithEmailAndPassword = () => {
  return useMutation({
    mutationKey: ["signUpWithEmailAndPassword"],
    mutationFn: authenticationService.signUpWithEmailAndPassword,
  });
};

export const useSendPasswordResetEmail = () => {
  return useMutation({
    mutationKey: ["sendPasswordResetEmail"],
    mutationFn: authenticationService.sendPasswordResetEmail,
  });
};

export const useSignOut = () => {
  return useMutation({
    mutationKey: ["signOut"],
    mutationFn: authenticationService.signOut,
  });
};
