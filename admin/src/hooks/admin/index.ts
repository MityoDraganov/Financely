export * from "./use-admin-organizations";
export * from "./use-admin-users";
export * from "./use-admin-marketplace-templates";
export * from "./use-admin-approve-marketplace-template";
export * from "./use-admin-reject-marketplace-template";
export * from "./use-admin-dashboard-stats";
export * from "./use-admin-generate-official-template-pack";
export * from "./use-admin-publish-official-template-pack";
export * from "./use-admin-update-marketplace-template";
export * from "./use-admin-add-marketplace-template";

// Re-export with new names for clarity
export { useAdminApproveMarketplaceTemplate as useAdminFeatureMarketplaceTemplate } from "./use-admin-approve-marketplace-template";
export { useAdminRejectMarketplaceTemplate as useAdminUnfeatureMarketplaceTemplate } from "./use-admin-reject-marketplace-template";
