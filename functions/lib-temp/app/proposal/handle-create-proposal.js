"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateProposal = void 0;
const core_1 = require("../../core");
const handleCreateProposal = async (params, dependencies) => {
    const { loggerService, proposalRepository } = dependencies;
    loggerService.info("createProposal:received", {
        orgId: params.orgId,
        customerId: params.customerId,
        title: params.title,
        itemCount: params.items.length,
        hasDescription: Boolean(params.description),
        hasNotes: Boolean(params.notes),
    });
    const { subtotal, taxTotal, total } = (0, core_1.calculateTotals)(params.items, params.vatRatePct);
    const proposalData = {
        orgId: params.orgId,
        customerId: params.customerId,
        title: params.title,
        description: params.description,
        status: "DRAFT",
        items: params.items,
        subtotal,
        taxTotal,
        total,
        currency: params.currency,
        terms: params.terms,
        notes: params.notes,
    };
    try {
        const proposalId = await proposalRepository.create({ data: proposalData });
        loggerService.info("createProposal:success", {
            proposalId,
            orgId: proposalData.orgId,
            customerId: proposalData.customerId,
            currency: proposalData.currency,
            subtotal,
            taxTotal,
            total,
        });
        return proposalId;
    }
    catch (error) {
        loggerService.error("createProposal:firestoreError", error, {
            orgId: proposalData.orgId,
            customerId: proposalData.customerId,
            title: proposalData.title,
            itemCount: proposalData.items.length,
            total,
        });
        throw error;
    }
};
exports.handleCreateProposal = handleCreateProposal;
//# sourceMappingURL=handle-create-proposal.js.map