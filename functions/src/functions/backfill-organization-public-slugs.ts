import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { Organization } from "../core/entities/organization";
import { snapshotToData } from "../services/database-service";
import {
  ensureUniqueSlugInSet,
  normalizePublicOrgSlug,
} from "../services/organization-public-slug-service";
import { normalizeSlugAliases } from "../services/public-product-page-service";
import { verifyAdminAuth } from "../utils/admin-auth-utils";

type BackfillOrganizationPublicSlugsInput = {
  organizationIds?: string[];
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
};

type BackfillOrganizationPublicSlugsResult = {
  scannedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  dryRun: boolean;
  updates: Array<{
    organizationId: string;
    previousSlug?: string;
    nextSlug: string;
    aliases: string[];
  }>;
};

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 2000;
const WRITE_BATCH_SIZE = 400;

function sortUpdatesByOrgId<T extends { organizationId: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.organizationId.localeCompare(b.organizationId));
}

export const backfillOrganizationPublicSlugs = onCall<
  BackfillOrganizationPublicSlugsInput,
  Promise<BackfillOrganizationPublicSlugsResult>
>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    await verifyAdminAuth(request, {
      requiredPermission: "organizations.write",
      requireWrite: true,
    });

    const payload = request.data || {};
    const dryRun = payload.dryRun === true;
    const force = payload.force === true;
    const requestedIds = Array.from(new Set((payload.organizationIds || []).filter(Boolean)));
    const safeLimit = Math.max(1, Math.min(MAX_LIMIT, payload.limit || DEFAULT_LIMIT));

    const db = getFirestore();
    const loadedOrganizations: Organization[] = [];

    if (requestedIds.length > 0) {
      const docs = await Promise.all(
        requestedIds.slice(0, safeLimit).map((id) => db.collection("organizations").doc(id).get()),
      );
      for (const doc of docs) {
        if (!doc.exists) continue;
        loadedOrganizations.push(snapshotToData<Organization>(doc));
      }
    } else {
      const snapshot = await db
        .collection("organizations")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(safeLimit)
        .get();
      for (const doc of snapshot.docs) {
        loadedOrganizations.push(snapshotToData<Organization>(doc));
      }
    }

    const organizations = sortUpdatesByOrgId(
      loadedOrganizations.map((organization) => ({
        organizationId: organization.id,
        organization,
      })),
    );

    const usedSlugs = new Set<string>();
    const plannedUpdates: Array<{
      organizationId: string;
      previousSlug?: string;
      nextSlug: string;
      aliases: string[];
      settings: Record<string, unknown>;
    }> = [];

    let skippedCount = 0;
    for (const entry of organizations) {
      const organization = entry.organization;
      const settings = (organization.settings || {}) as Record<string, unknown>;
      const publicPages = (
        settings.publicPages as {
          orgSlug?: string;
          orgSlugAliases?: string[];
          domainPreference?: "custom-first" | "app-only";
        } | undefined
      ) || { orgSlugAliases: [], domainPreference: "custom-first" };

      const previousSlugRaw =
        typeof publicPages.orgSlug === "string" ? publicPages.orgSlug.trim() : "";
      const requestedBaseSlug = normalizePublicOrgSlug(
        previousSlugRaw || organization.name || organization.id,
        organization.id,
      );
      const nextSlug = ensureUniqueSlugInSet(requestedBaseSlug, usedSlugs);
      const previousSlug = previousSlugRaw
        ? normalizePublicOrgSlug(previousSlugRaw, organization.id)
        : undefined;
      const aliases = normalizeSlugAliases(
        [
          ...(publicPages.orgSlugAliases || []),
          ...(previousSlug && previousSlug !== nextSlug ? [previousSlug] : []),
          ...(requestedBaseSlug !== nextSlug ? [requestedBaseSlug] : []),
        ],
        nextSlug,
      );
      const domainPreference = publicPages.domainPreference === "app-only" ? "app-only" : "custom-first";

      const normalizedCurrentSlug = previousSlugRaw
        ? normalizePublicOrgSlug(previousSlugRaw, organization.id)
        : "";
      const normalizedCurrentAliases = normalizeSlugAliases(publicPages.orgSlugAliases || [], nextSlug);
      const normalizedCurrentDomain = publicPages.domainPreference === "app-only" ? "app-only" : "custom-first";
      const shouldUpdate =
        force ||
        !publicPages.orgSlug ||
        normalizedCurrentSlug !== nextSlug ||
        JSON.stringify(normalizedCurrentAliases) !== JSON.stringify(aliases) ||
        normalizedCurrentDomain !== domainPreference;

      if (!shouldUpdate) {
        skippedCount += 1;
        continue;
      }

      plannedUpdates.push({
        organizationId: organization.id,
        previousSlug: previousSlugRaw || undefined,
        nextSlug,
        aliases,
        settings: {
          ...settings,
          publicPages: {
            ...(publicPages || {}),
            orgSlug: nextSlug,
            orgSlugAliases: aliases,
            domainPreference,
          },
        },
      });
    }

    if (!dryRun && plannedUpdates.length > 0) {
      let batch = db.batch();
      let batchCount = 0;

      for (const update of plannedUpdates) {
        const ref = db.collection("organizations").doc(update.organizationId);
        batch.update(ref, { settings: update.settings });
        batchCount += 1;

        if (batchCount >= WRITE_BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    const result: BackfillOrganizationPublicSlugsResult = {
      scannedCount: organizations.length,
      updatedCount: plannedUpdates.length,
      skippedCount,
      failedCount: 0,
      dryRun,
      updates: plannedUpdates.slice(0, 250).map((entry) => ({
        organizationId: entry.organizationId,
        previousSlug: entry.previousSlug,
        nextSlug: entry.nextSlug,
        aliases: entry.aliases,
      })),
    };

    logger.info("Organization public slug backfill completed", {
      scannedCount: result.scannedCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      dryRun,
      force,
      requestedIdsCount: requestedIds.length,
      limit: safeLimit,
    });

    return result;
  },
);
