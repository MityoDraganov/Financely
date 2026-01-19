import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { firebase } from "@/infrastructure/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Hook to check if the current user is a marketplace contributor
 * Reads directly from the user document in Firestore
 */
export function useIsContributor() {
  const { user } = useUser();

  return useQuery({
    queryKey: ["user", "isContributor", user?.id],
    queryFn: async () => {
      if (!user) {
        return false;
      }

      try {
        const userDocRef = doc(firebase.firestore, "users", user.id);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          return false;
        }

        const userData = userDoc.data();
        return userData?.isMarketplaceContributor === true;
      } catch (error) {
        console.error("Error checking contributor status:", error);
        return false;
      }
    },
    enabled: !!user,
  });
}
