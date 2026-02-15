/**
 * Firebase Cloud Function for generating widget styling and configuration using AI
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetGenerationService, WidgetType } from "../services/ai/widget-generation-service";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export interface GenerateWidgetInput {
  organizationId: string;
  widgetType: WidgetType;
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
    context?: string;
  };
}

export interface GenerateWidgetOutput {
  styling: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    errorColor: string;
    successColor: string;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    padding: string;
    gap: string;
    borderRadius: string;
    buttonPadding: string;
    buttonBorderRadius: string;
    buttonFontWeight: string;
    modalBackdropOpacity: string;
    modalBorderRadius: string;
    modalMaxWidth: string;
    shadow: string;
  };
  configuration: {
    title: string;
    description?: string;
    submitButtonText: string;
    successMessage: string;
    builtInFields?: {
      name?: { enabled: boolean; required: boolean; label: string };
      email?: { enabled: boolean; required: boolean; label: string };
      phone?: { enabled: boolean; required: boolean; label: string };
      company?: { enabled: boolean; required: boolean; label: string };
      message?: { enabled: boolean; required: boolean; label: string };
    };
    customFields?: Array<{
      id: string;
      name: string;
      label: string;
      type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";
      required: boolean;
      placeholder?: string;
      options?: string[];
      validation?: { min?: number; max?: number; pattern?: string };
      order: number;
    }>;
  };
}

export const generateWidget = onCall<
  GenerateWidgetInput,
  Promise<GenerateWidgetOutput>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public", // Allow CORS preflight (OPTIONS) requests without auth
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, widgetType, options } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      if (!widgetType) {
        throw new HttpsError("invalid-argument", "Widget type is required");
      }

      if (!["contactForm", "invoiceRequest", "quoteRequest"].includes(widgetType)) {
        throw new HttpsError("invalid-argument", "Invalid widget type");
      }

      loggerService.info("Generating widget", {
        organizationId,
        widgetType,
        style: options?.style,
      });

      // Get repositories
      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      // Fetch organization
      const organization = await organizationRepository.get({ id: organizationId });
      if (!organization) {
        throw new HttpsError("not-found", "Organization not found");
      }

      // Initialize AI service with Gemini provider
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured"
        );
      }

      // Register Gemini provider if not already registered
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.0-flash",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      // Get widget generation service
      const widgetGenerationService = getWidgetGenerationService();

      // Generate widget
      const result = await widgetGenerationService.generateWidget(
        widgetType,
        organization,
        options
      );

      loggerService.info("Widget generated successfully", {
        organizationId,
        widgetType,
      });

      return result;
    } catch (error) {
      loggerService.error("Failed to generate widget", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: request.data?.organizationId,
        widgetType: request.data?.widgetType,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to generate widget: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

