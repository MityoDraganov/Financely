"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProposal = void 0;
const https_1 = require("firebase-functions/v2/https");
const handle_create_proposal_1 = require("../app/proposal/handle-create-proposal");
const services_1 = require("../services");
const repositories_1 = require("../repositories");
exports.createProposal = (0, https_1.onCall)({ invoker: "public", ingressSettings: "ALLOW_ALL" }, async (request) => {
    const { data } = request;
    const loggerService = services_1.serviceHost.getLoggerService();
    const databaseService = services_1.serviceHost.getDatabaseService();
    const proposalRepository = repositories_1.repositoryHost.getProposalRepository(databaseService);
    try {
        const requestData = data;
        loggerService.info("createProposal:functionReceived", {
            orgId: requestData.orgId,
            customerId: requestData.customerId,
            title: requestData.title,
            currency: requestData.currency,
            itemCount: requestData.items.length,
        });
        const proposalId = await (0, handle_create_proposal_1.handleCreateProposal)(requestData, { loggerService, proposalRepository });
        loggerService.info("createProposal:functionSuccess", { proposalId });
        const response = { id: proposalId };
        return response;
    }
    catch (error) {
        loggerService.error("createProposal:functionError", error);
        throw new Error("Failed to create proposal");
    }
});
//# sourceMappingURL=create-proposal.js.map