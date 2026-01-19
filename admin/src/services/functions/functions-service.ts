import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { FunctionsService } from "@/core/ports/services/functions-service";

/**
 * Functions service implementation for admin app
 * Provides access to Firebase Cloud Functions
 */
export const functionsService: FunctionsService = {
  // Note: Most functions are not implemented in admin app
  // Only marketplace moderation functions are implemented here
  // Other functions would need to be added as needed

  async featureMarketplaceTemplate(payload: { templateId: string }) {
    const functions = getFunctions(firebase.app);
    const featureTemplate = httpsCallable<
      { templateId: string },
      { success: boolean; message: string }
    >(functions, "featureMarketplaceTemplate");
    const result = await featureTemplate(payload);
    return result.data;
  },

  async unfeatureMarketplaceTemplate(payload: { templateId: string }) {
    const functions = getFunctions(firebase.app);
    const unfeatureTemplate = httpsCallable<
      { templateId: string },
      { success: boolean; message: string }
    >(functions, "unfeatureMarketplaceTemplate");
    const result = await unfeatureTemplate(payload);
    return result.data;
  },
} as Partial<FunctionsService> as FunctionsService;
