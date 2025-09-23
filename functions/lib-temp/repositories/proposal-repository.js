"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProposalRepository = getProposalRepository;
const config_1 = require("./config");
const generic_repository_1 = require("./generic-repository");
/**
 * Factory for a `ProposalRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {ProposalRepository} Repository with CRUD operations for proposals.
 */
function getProposalRepository(databaseService) {
    return (0, generic_repository_1.getGenericRepository)(() => config_1.DatabaseCollection.PROPOSALS, databaseService);
}
//# sourceMappingURL=proposal-repository.js.map