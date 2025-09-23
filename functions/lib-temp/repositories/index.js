"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repositoryHost = void 0;
const proposal_repository_1 = require("./proposal-repository");
exports.repositoryHost = {
    getProposalRepository: (databaseService) => (0, proposal_repository_1.getProposalRepository)(databaseService),
};
//# sourceMappingURL=index.js.map