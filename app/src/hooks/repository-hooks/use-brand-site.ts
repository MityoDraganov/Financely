import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFirestore, doc, getDoc, onSnapshot } from "firebase/firestore";
import { firebase } from "@/infrastructure/firebase";
import { useEffect, useState } from "react";
import { serviceHost } from "@/services";

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
  files?: Record<string, string>; // path -> content
  metadata?: {
    generatedAt?: string;
    model?: string;
    version?: number;
    regenerateSectionType?: "hero" | "about" | "features" | "contact";
  };
  pages?: Array<{
    id: string;
    title: string;
    slug: string;
    description?: string;
    context?: string;
    type?: "standard" | "blog" | "contact";
    order?: number;
    contentEntries?: Array<{
      id: string;
      title: string;
      summary?: string;
      link?: string;
      image?: string;
      description?: string; // Rich text HTML for AI
      localization?: {
        defaultLanguage: "en";
        languages: Record<string, {
          title: string;
          description: string;
          summary?: string;
          image?: string;
          link?: string;
        }>;
      };
    }>;
  }>;
  versions?: Array<{
    version: number;
    html: string;
    files?: Record<string, string>; // path -> content
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
  conversations?: Array<{
    id: string;
    title?: string;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      attachments?: string[];
      timestamp: string;
    }>;
    createdAt: string;
    updatedAt: string;
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
      // Poll more frequently if status is pending/generating/deploying (for streaming updates)
      const data = query.state.data as BrandSite | null;
      if (data?.status === "pending" || data?.status === "generating" || data?.status === "deploying") {
        // Poll even faster if files are being updated (HTML streaming)
        if (data?.files && Object.keys(data.files).length > 0) {
          return 300; // Poll every 300ms when HTML is streaming
        }
        return 500; // Poll every 500ms for faster streaming updates
      }
      // Also poll if there are conversations (to catch streaming message updates)
      if (data?.conversations && (data.conversations as any[]).length > 0) {
        // Check if any conversation has a streaming message
        const hasStreaming = (data.conversations as any[]).some(conv => 
          conv.messages?.some((m: any) => m.id?.startsWith("assistant-streaming"))
        );
        if (hasStreaming) {
          return 300; // Poll every 300ms when streaming (matches backend update interval)
        }
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
        if (error?.code === "failed-precondition" || error?.code === 9) {
          // Silently fallback - index will be created automatically by Firebase
          // or can be deployed via: firebase deploy --only firestore:indexes
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
          // Handle different timestamp formats: Firestore Timestamp, ISO string, or number
          return sites.sort((a, b) => {
            const getTimestamp = (site: BrandSite): number => {
              // Try metadata.generatedAt first (ISO string)
              if (site.metadata?.generatedAt) {
                return new Date(site.metadata.generatedAt).getTime();
              }
              
              // Try createdAt field (could be Firestore Timestamp or ISO string)
              const createdAt = (site as any).createdAt;
              if (createdAt) {
                // Firestore Timestamp object
                if (typeof createdAt.toMillis === "function") {
                  return createdAt.toMillis();
                }
                // ISO string
                if (typeof createdAt === "string") {
                  return new Date(createdAt).getTime();
                }
                // Number (milliseconds)
                if (typeof createdAt === "number") {
                  return createdAt;
                }
              }
              
              return 0;
            };
            
            const aTime = getTimestamp(a);
            const bTime = getTimestamp(b);
            return bTime - aTime; // Descending order (most recent first)
          });
        }
        throw error;
      }
    },
    enabled: !!organizationId,
  });
};

/**
 * Hook to update a brand site
 */
export const useUpdateBrandSite = () => {
  const queryClient = useQueryClient();
  const databaseService = serviceHost.getDatabaseService();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BrandSite> }) => {
      await databaseService.update("brandSites", id, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["brandSite", id] });
      queryClient.invalidateQueries({ queryKey: ["brandSites"] });
    },
  });
};

