import { useQuery } from "@tanstack/react-query";
import { getFirestore, doc, getDoc, onSnapshot } from "firebase/firestore";
import { firebase } from "@/infrastructure/firebase";
import { useEffect, useState } from "react";

interface BrandSite {
  id: string;
  organizationId: string;
  brandName: string;
  status: "pending" | "generating" | "deploying" | "success" | "failed";
  deployedUrl?: string;
  subdomain?: string;
  customDomain?: string;
  error?: string;
  html?: string;
  metadata?: {
    generatedAt?: string;
    model?: string;
    version?: number;
    regenerateSectionType?: "hero" | "about" | "features" | "contact";
  };
  versions?: Array<{
    version: number;
    html: string;
    deployedUrl?: string;
    previewUrl?: string;
    metadata?: {
      generatedAt?: string;
      model?: string;
      regenerateSectionType?: "hero" | "about" | "features" | "contact";
    };
    createdAt: string;
    description?: string;
  }>;
}

/**
 * Hook to fetch a brand site by ID with real-time updates
 */
export const useBrandSite = (brandSiteId: string | null) => {
  return useQuery({
    queryKey: ["brandSite", brandSiteId],
    queryFn: async () => {
      if (!brandSiteId) return null;

      const db = getFirestore(firebase.app);
      const docRef = doc(db, "brandSites", brandSiteId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as BrandSite;
    },
    enabled: !!brandSiteId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if status is pending/generating/deploying
      const data = query.state.data as BrandSite | null;
      if (data?.status === "pending" || data?.status === "generating" || data?.status === "deploying") {
        return 2000;
      }
      return false; // Stop polling when done
    },
  });
};

/**
 * Hook to subscribe to brand site updates in real-time
 */
export const useBrandSiteRealtime = (brandSiteId: string | null) => {
  const [brandSite, setBrandSite] = useState<BrandSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!brandSiteId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const db = getFirestore(firebase.app);
    const docRef = doc(db, "brandSites", brandSiteId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setBrandSite({
            id: docSnap.id,
            ...docSnap.data(),
          } as BrandSite);
        } else {
          setBrandSite(null);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error subscribing to brand site:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [brandSiteId]);

  return { data: brandSite, isLoading };
};

/**
 * Hook to fetch brand sites for an organization
 */
export const useBrandSitesByOrganization = (organizationId: string | null | undefined) => {
  return useQuery({
    queryKey: ["brandSites", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const db = getFirestore(firebase.app);
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");
      
      try {
        // Try to query with orderBy first (requires composite index)
        const brandSitesQuery = query(
          collection(db, "brandSites"),
          where("organizationId", "==", organizationId),
          orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(brandSitesQuery);
        const sites = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as BrandSite));
        
        return sites;
      } catch (error: any) {
        // If index doesn't exist, fallback to query without orderBy
        if (error?.code === "failed-precondition") {
          console.warn("Firestore index not found, fetching without orderBy. Create index for brandSites: organizationId, createdAt");
          const brandSitesQuery = query(
            collection(db, "brandSites"),
            where("organizationId", "==", organizationId)
          );
          
          const querySnapshot = await getDocs(brandSitesQuery);
          const sites = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as BrandSite));
          
          // Sort manually by createdAt (most recent first)
          return sites.sort((a, b) => {
            const aTime = a.metadata?.generatedAt || (a as any).createdAt?.toMillis?.() || 0;
            const bTime = b.metadata?.generatedAt || (b as any).createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
        }
        throw error;
      }
    },
    enabled: !!organizationId,
  });
};

