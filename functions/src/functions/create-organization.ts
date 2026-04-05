import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getUserRepository } from "../repositories/user-repository";
import { loggerService } from "../services/logger-service";
import { ORGANIZATION_ROLES } from "../core/roles";
import { OrganizationData } from "../core/entities/organization";
import { DEFAULT_BRAND_COLORS, DEFAULT_ORGANIZATION_SETTINGS } from "../core/constants/organization-defaults";
import { AuditLogService } from "../services/audit-log-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import { resolveUniqueOrganizationSlug } from "../services/organization-public-slug-service";

interface CreateOrganizationPayload {
  name: string;
  website?: string;
  settings?: {
    brandColors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    branding?: {
      customLogo?: string;
      description?: string;
      [key: string]: any;
    };
    country?: string;
    currency?: string;
    businessType?: string;
    starterTemplates?: string[];
    [key: string]: any;
  };
}

interface CreateOrganizationResponse {
  success: boolean;
  organizationId: string;
  message: string;
}

/**
 * Firebase Cloud Function for creating an organization.
 *
 * This function creates a new organization and sets the authenticated user as the owner.
 *
 * Request payload structure:
 * {
 *   name: string (required),
 *   description?: string,
 *   website?: string,
 *   settings?: {
 *     brandColors?: {
 *       primary?: string,
 *       secondary?: string,
 *       accent?: string,
 *     }
 *   }
 * }
 *
 * Response: { success: boolean, organizationId: string, message: string }
 */
export const createOrganization = onCall<
  CreateOrganizationPayload,
  Promise<CreateOrganizationResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const startTime = Date.now();
    let createdOrganizationId: string | undefined;
    try {
      const payload = request.data;
      const auth = request.auth;

      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      if (!payload) {
        throw new HttpsError("invalid-argument", "Request payload is required");
      }

      if (!payload.name || payload.name.trim().length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Organization name is required"
        );
      }

      loggerService.info("Creating organization", {
        userId: auth.uid,
        name: payload.name,
      });

      const databaseService = getDatabaseService();
      const organizationRepo = getOrganizationRepository(databaseService);
      const userRepo = getUserRepository(databaseService);

      // Get user to ensure they exist
      const user = await userRepo.get({ id: auth.uid });
      if (!user) {
        throw new HttpsError("not-found", "User not found");
      }

      // Extract brand colors with defaults from centralized constants
      const brandColors = {
        primary: payload.settings?.brandColors?.primary ?? DEFAULT_BRAND_COLORS.primary,
        secondary: payload.settings?.brandColors?.secondary ?? DEFAULT_BRAND_COLORS.secondary,
        accent: payload.settings?.brandColors?.accent ?? DEFAULT_BRAND_COLORS.accent,
      };

      // Build branding object — brandImages is required by the entity schema (default [])
      const incomingBranding = payload.settings?.branding ?? {};
      const brandingEntry = {
        branding: {
          brandImages: [] as string[],
          ...incomingBranding,
        },
      };
      const orgSlug = await resolveUniqueOrganizationSlug({
        requestedSlug: payload.name.trim(),
        fallbackName: payload.name.trim(),
      });

      // Prepare organization data using centralized defaults
      const orgData: OrganizationData = {
        name: payload.name.trim(),
        ...(payload.website && { website: payload.website.trim() }),
        memberIds: [auth.uid], // Add creator as member
        status: "active",
        billing: {
          status: "incomplete",
          cancelAtPeriodEnd: false,
          entitlements: {},
        },
        settings: {
          brandColors,
          ...brandingEntry,
          publicPages: {
            orgSlug,
            orgSlugAliases: [],
            domainPreference: "custom-first",
          },
          defaultCurrency: DEFAULT_ORGANIZATION_SETTINGS.defaultCurrency,
          defaultLanguage: DEFAULT_ORGANIZATION_SETTINGS.defaultLanguage,
          defaultTimezone: DEFAULT_ORGANIZATION_SETTINGS.defaultTimezone,
          invoicePrefix: DEFAULT_ORGANIZATION_SETTINGS.invoicePrefix,
          invoiceNumberStart: DEFAULT_ORGANIZATION_SETTINGS.invoiceNumberStart,
          features: { ...DEFAULT_ORGANIZATION_SETTINGS.features },
          ai: { ...DEFAULT_ORGANIZATION_SETTINGS.ai },
          multiCurrency: {
            enabled: DEFAULT_ORGANIZATION_SETTINGS.multiCurrency.enabled,
            pairs: [...DEFAULT_ORGANIZATION_SETTINGS.multiCurrency.pairs],
          },
          // Whitelist onboarding-collected fields
          ...(payload.settings?.country && { country: payload.settings.country }),
          ...(payload.settings?.currency && { currency: payload.settings.currency }),
          ...(payload.settings?.businessType && { businessType: payload.settings.businessType }),
          ...(payload.settings?.starterTemplates?.length && { starterTemplates: payload.settings.starterTemplates }),
        },
        usage: {
          templateCount: 0,
          invoiceCount: 0,
          memberCount: 1, // Creator is the first member
          storageBytes: 0,
        },
      };

      // Create organization
      const organizationId = await organizationRepo.create({ data: orgData });
      createdOrganizationId = organizationId;

      // Update user's organizationRoles to set them as owner
      const currentRoles = user.organizationRoles || {};
      await userRepo.update({
        id: auth.uid,
        data: {
          organizationRoles: {
            ...currentRoles,
            [organizationId]: ORGANIZATION_ROLES.OWNER,
          },
        },
      });

      loggerService.info("Organization created successfully", {
        organizationId,
        userId: auth.uid,
      });

      const fallbackAuditUserContext = AuditLogService.buildUserContext(
        auth.uid,
        auth.uid,
        user.email || auth.token.email || `unknown-${auth.uid}@financely.local`,
        user.name || user.email || "Unknown User",
        {
          role: ORGANIZATION_ROLES.OWNER,
        },
      );

      await logAuditSuccessForRequest({
        request,
        operationName: "createOrganization",
        organizationId,
        action: "organization.created",
        resource: {
          type: "organization",
          id: organizationId,
          name: payload.name.trim(),
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "createOrganization",
        },
        fallbackUserContext: fallbackAuditUserContext,
      });

      return {
        success: true,
        organizationId,
        message: "Organization created successfully",
      };
    } catch (error: any) {
      loggerService.error("Failed to create organization", {
        error: error.message,
        stack: error.stack,
        userId: request.auth?.uid,
      });

      const fallbackAuditUserContext = request.auth
        ? AuditLogService.buildUserContext(
            request.auth.uid,
            request.auth.uid,
            request.auth.token.email || `unknown-${request.auth.uid}@financely.local`,
            request.auth.token.name || "Unknown User",
            {
              role: ORGANIZATION_ROLES.OWNER,
            },
          )
        : undefined;

      await logAuditFailureForRequest({
        request,
        operationName: "createOrganization",
        organizationId: createdOrganizationId,
        action: "organization.created",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: createdOrganizationId
          ? {
              type: "organization",
              id: createdOrganizationId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "createOrganization",
        },
        fallbackUserContext: fallbackAuditUserContext,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error.message || "Failed to create organization"
      );
    }
  }
);
